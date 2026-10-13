import {MarkdownView, Notice, TFile} from "obsidian";
import ReplacePatterns from "../main";
import {getLineMetaState, compileRegex} from "../utils/helpers";
import {getOrderedSelection, updateSelectionWithShifts} from "../utils/editorHelpers";

export function executeIntegrateCommand(plugin: ReplacePatterns): void {
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const editor = activeView.editor;
    if (!editor.somethingSelected()) {
        new Notice("No text selected.");
        return;
    }

    const {start, reversed} = getOrderedSelection(editor);
    let text = editor.getSelection();

    const profile = plugin.settings.profiles.find(p => p.name === plugin.settings.activeProfile);
    if (!profile) return;

    const isTextMode = text.includes("<!--END Md5:");

    for (const rule of profile.customRules || []) {
        if (!rule.integrateRegex) continue;
        try {
            const regex = new RegExp(rule.integrateRegex, rule.integrateFlags || "gm");
            text = text.replace(regex, rule.integrateReplacement);
        } catch (e) {
            console.error("Integration Regex error:", e);
        }
    }

    if (!isTextMode) {
        const linesForCallout = text.split("\n");
        const firstCalloutIdx = linesForCallout.findIndex(line => line.includes("[!"));

        if (firstCalloutIdx !== -1) {
            let calloutLine = linesForCallout[firstCalloutIdx] ?? "";

            calloutLine = calloutLine.replace(/\[!([^\s\x5D|]+)\s+([^\x5D\s][^\x5D]*?)\s*(\x5D[-+]?)\s*(?:\[\s*([^\x5D\n]*?)\s*\x5D)?/gu,
                (_match: string, name: string, option: string, bracket: string, title?: string): string => {
                    let result = `[!${name}|${option}${bracket}`;
                    if (title !== undefined) result += ` ${title}`;
                    return result;
                }
            );

            calloutLine = calloutLine.replace(/\[!([^\s\x5D|]+)\s*(\x5D[-+]?)\s*(?:\[\s*([^\x5D\n]*?)\s*\x5D)?/gu,
                (_match: string, name: string, bracket: string, title?: string): string => {
                    let result = `[!${name}${bracket}`;
                    if (title !== undefined) result += ` ${title}`;
                    return result;
                }
            );

            const reverseMap: Record<string, string> = {};
            for (const [std, loc] of Object.entries(profile.translations || {})) {
                const locStr = String(loc);
                if (locStr) reverseMap[locStr.toLowerCase()] = std;
            }

            calloutLine = calloutLine.replace(/\[!([^\s\x5D|]+)/gu, (_match: string, name: string): string => {
                const std = reverseMap[name.toLowerCase()];
                return std ? `[!${std}` : _match;
            });

            linesForCallout[firstCalloutIdx] = calloutLine;
        }
        text = linesForCallout.join("\n");
    }

    text = text.replace(/\[([^\x5D]+)\x5D\((obsidian:\/\/[^\x29]+)\)/g, (_match: string, alias: string, uriString: string): string => {
        try {
            const url = new URL(uriString);
            if (url.host === "adv-uri" || url.pathname.includes("adv-uri")) {
                const uid = url.searchParams.get("uid");
                const block = url.searchParams.get("block");
                const heading = url.searchParams.get("heading");

                if (uid) {
                    const files = plugin.app.vault.getMarkdownFiles();
                    let targetFile: TFile | null = null;
                    for (const f of files) {
                        const cache = plugin.app.metadataCache.getFileCache(f);
                        if (cache?.frontmatter?.id === uid) {
                            targetFile = f;
                            break;
                        }
                    }
                    if (targetFile) {
                        let linkTarget = targetFile.basename;
                        if (block) linkTarget += `#^${block}`;
                        else if (heading) linkTarget += `#${heading}`;

                        if (alias === linkTarget || alias === targetFile.basename) {
                            return `[[${linkTarget}]]`;
                        }
                        return `[[${linkTarget}|${alias}]]`;
                    }
                }
                return _match;
            } else {
                const filePart = url.searchParams.get("file") || "";
                const decodedTarget = decodeURIComponent(filePart);
                if (!decodedTarget) return _match;

                if (alias === decodedTarget) {
                    return `[[${decodedTarget}]]`;
                }
                return `[[${decodedTarget}|${alias}]]`;
            }
        } catch (e) {
            console.error("URI Decode Error:", e);
            return _match;
        }
    });

    const rawPattern = plugin.settings.splitPattern || "%%~%%";
    const flags = plugin.settings.splitPatternFlags || "m";
    const splitRegex = compileRegex(rawPattern, flags);

    if (!splitRegex) {
        new Notice("Invalid split pattern regular expression. Check settings.");
        return;
    }

    if (isTextMode) {
        try {
            const tailCleanupRegex = new RegExp(`(?:[ \\t\\xA0\\r\\n]|(?:${rawPattern}))+(?=<!--END Md5:)`, 'g');
            text = text.replace(tailCleanupRegex, "\n\n");
        } catch (e) {
            console.error("Tail cleanup regex error:", e);
        }

        const textLines = text.split("\n");
        while (textLines.length > 0 && textLines[textLines.length - 1]?.trim() === "") {
            textLines.pop();
        }
        textLines.push("");
        text = textLines.join("\n");
        editor.replaceSelection(text);
        const endLine = start.line + textLines.length - 1;
        const endCh = textLines.length === 1
            ? start.ch + (textLines[0] ?? "").length
            : (textLines[textLines.length - 1] ?? "").length;

        const adjustedEnd = {line: endLine, ch: endCh};
        updateSelectionWithShifts(editor, start, adjustedEnd, reversed, 0, 0);
        new Notice("Integration rules applied (text mode).");
    } else {
        const linesBeforeIntegration = text.split("\n");
        for (let i = linesBeforeIntegration.length - 1; i >= 0; i--) {
            const line = linesBeforeIntegration[i] ?? "";
            if (splitRegex.test(line)) {
                linesBeforeIntegration.splice(i, 1);
                break;
            } else if (line.trim() !== "") {
                break;
            }
        }
        text = linesBeforeIntegration.join("\n");
        const lines = text.split("\n");

        while (lines.length > 0 && lines[lines.length - 1]?.trim() === "") {
            lines.pop();
        }
        lines.push("");

        const endLine = start.line + lines.length - 1;
        const endCh = lines.length === 1
            ? start.ch + (lines[0] ?? "").length
            : (lines[lines.length - 1] ?? "").length;

        const adjustedEnd = {line: endLine, ch: endCh};
        const {isMeta} = getLineMetaState(lines, plugin.settings);

        const eligibleIndices: number[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (!isMeta[i]) eligibleIndices.push(i);
        }

        const firstEligible = eligibleIndices.length > 0 ? (eligibleIndices[0] ?? -1) : -1;
        const lastEligible = eligibleIndices.length > 0 ? (eligibleIndices[eligibleIndices.length - 1] ?? -1) : -1;

        let firstLineCharShift = 0;
        let lastLineCharShift = 0;

        for (let i = 0; i < lines.length; i++) {
            if (isMeta[i]) continue;
            const line = lines[i] ?? "";
            const isFirstSelectedLine = (i === 0);
            const isSelectionNotAtStart = (start.ch > 0);
            const skipAddingQuote = (isFirstSelectedLine && isSelectionNotAtStart);
            const hasContent = line.trim() !== "";
            let addedShift = 0;

            if (hasContent) {
                if (!skipAddingQuote) {
                    lines[i] = "> " + line;
                    addedShift = 2;
                }
            } else {
                if (i > firstEligible && i < lastEligible) {
                    let prev = i - 1;
                    while (prev >= 0 && isMeta[prev]) prev--;
                    let next = i + 1;
                    while (next < lines.length && isMeta[next]) next++;
                    if (prev >= 0 && next < lines.length) {
                        const prevLine = lines[prev] ?? "";
                        const nextLine = lines[next] ?? "";
                        if (prevLine.trim() !== "" && nextLine.trim() !== "") {
                            lines[i] = "> " + line;
                            addedShift = 2;
                        }
                    }
                }
            }
            if (addedShift !== 0) {
                if (i === 0) firstLineCharShift = addedShift;
                if (i === lines.length - 1) lastLineCharShift = addedShift;
            }
        }
        const integratedText = lines.join("\n");
        editor.replaceSelection(integratedText);
        updateSelectionWithShifts(editor, start, adjustedEnd, reversed, firstLineCharShift, lastLineCharShift);
        new Notice("Integration rules applied (callout mode).");
    }
}
