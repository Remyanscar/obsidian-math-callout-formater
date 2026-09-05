import { MarkdownView, Notice } from "obsidian";
import ReplacePatterns from "../main";
import { getLineMetaState, delay, runAsync } from "../utils/helpers";
import { REGEX } from "../constants";

/**
 * Handles the logic for exporting content. Generates Advanced URI backlinks,
 * processes wikilinks asynchronously, and copies content to the clipboard.
 */
export function executeExportCommand(plugin: ReplacePatterns): void {
    runAsync(async () => {
        const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) return;

        const editor = activeView.editor;
        const selection = editor.getSelection();

        if (!selection) {
            new Notice("No text selected.");
            return;
        }

        let text: string = selection;
        const profile = plugin.settings.profiles.find(p => p.name === plugin.settings.activeProfile);
        if (!profile) return;

        const targetVaultName = encodeURIComponent(plugin.app.vault.getName());
        const currentFilePath = activeView.file ? activeView.file.path.replace(/\.md$/, "") : "";

        let currentBlockId = "";
        const rawLines = text.split("\n");

        for (let i = rawLines.length - 1; i >= 0; i--) {
            const m = rawLines[i]?.match(REGEX.BLOCK_ID_LINE_END) || rawLines[i]?.match(REGEX.BLOCK_ID_ONLY);
            if (m) {
                currentBlockId = m[1] ?? "";
                break;
            }
        }

        const currentFile = activeView.file;
        let currentUid = "";

        if (currentFile) {
            const fmCache = plugin.app.metadataCache.getFileCache(currentFile)?.frontmatter;
            currentUid = fmCache?.id ? String(fmCache.id) : "";

            if (!currentUid) {
                currentUid = window.crypto.randomUUID();
                await plugin.app.fileManager.processFrontMatter(currentFile, (fm: { id?: string }) => {
                    fm.id = currentUid;
                });
            }
        }

        let sourceUri = `obsidian://adv-uri?vault=${targetVaultName}`;
        if (currentUid) sourceUri += `&uid=${encodeURIComponent(currentUid)}`;
        else if (currentFilePath) sourceUri += `&filepath=${encodeURIComponent(currentFilePath)}`;

        if (currentBlockId) sourceUri += `&block=${encodeURIComponent(currentBlockId)}`;

        const formatStr = plugin.settings.sourceLinkFormat || "{URI}";
        const sourceLink = formatStr.replace(/{URI}/g, sourceUri);

        const convertWikilinks = async (str: string) => {
            const promises: Promise<string>[] = [];

            str.replace(/\[\[(.*?)\x5D\x5D/g, (match: string, content: string) => {
                const promise = (async () => {
                    let target = content;
                    let alias = content;
                    const splitIdx = content.indexOf('|');

                    if (splitIdx > -1) {
                        target = content.substring(0, splitIdx);
                        alias = content.substring(splitIdx + 1);
                    }

                    let fileName = target;
                    let hash = "";
                    const hashIdx = target.indexOf('#');
                    if (hashIdx > -1) {
                        fileName = target.substring(0, hashIdx);
                        hash = target.substring(hashIdx + 1);
                    }

                    if (fileName === "" && currentFilePath) {
                        fileName = currentFilePath.split('/').pop() || "";
                    }

                    const targetFile = plugin.app.metadataCache.getFirstLinkpathDest(fileName, currentFilePath);

                    if (targetFile && targetFile.extension === "md") {
                        const targetFm = plugin.app.metadataCache.getFileCache(targetFile)?.frontmatter;
                        let uid = targetFm?.id ? String(targetFm.id) : "";

                        if (!uid) {
                            uid = window.crypto.randomUUID();
                            await plugin.app.fileManager.processFrontMatter(targetFile, (fm: { id?: string }) => {
                                fm.id = uid;
                            });
                        }

                        let url = `obsidian://adv-uri?vault=${targetVaultName}&uid=${encodeURIComponent(uid)}`;
                        if (hash) {
                            if (hash.startsWith('^')) {
                                url += `&block=${encodeURIComponent(hash.substring(1))}`;
                            } else {
                                url += `&heading=${encodeURIComponent(hash)}`;
                            }
                        }
                        return `[${alias}](${url})`;
                    }

                    const encodedTarget = encodeURIComponent(target);
                    const url = `obsidian://open?vault=${targetVaultName}&file=${encodedTarget}`;
                    return `[${alias}](${url})`;
                })();
                promises.push(promise);
                return match;
            });

            const data = await Promise.all(promises);
            return str.replace(/\[\[(.*?)\x5D\x5D/g, () => data.shift() || "");
        };

        const isTextMode = text.includes("<!--END Md5:");
        const splitPattern = plugin.settings.splitPattern || "%%~%%";
        const delayMs = plugin.settings.clipboardDelay ?? 900;

        if (isTextMode) {
            const exportLines = text.split("\n");
            const { isRemovable } = getLineMetaState(exportLines);
            text = exportLines.filter((_, i) => !isRemovable[i]).join("\n");

            text = await convertWikilinks(text);

            for (const rule of profile.customRules || []) {
                if (!rule.exportRegex) continue;
                try {
                    const regex = new RegExp(rule.exportRegex, rule.exportFlags || "gm");
                    text = text.replace(regex, rule.exportReplacement);
                } catch (e) {
                    console.error("Export Regex error:", e);
                }
            }

            text = text.trim();
            const parts = text.split(splitPattern).map(part => part.trim()).filter(part => part !== "");

            for (let i = 0; i < parts.length; i++) {
                await navigator.clipboard.writeText(parts[i] ?? "");
                new Notice(`Copied text part ${i + 1}/${parts.length} to clipboard.`);
                await delay(delayMs);
            }

            await navigator.clipboard.writeText(sourceLink);
            new Notice("Copied source link to clipboard.");

        } else {
            const exportLines = text.split("\n");
            for (let i = 0; i < exportLines.length; i++) {
                const line = exportLines[i] ?? "";
                if (line.startsWith("> ") || line.startsWith(">\xA0")) {
                    exportLines[i] = line.substring(2);
                } else if (line.startsWith(">")) {
                    exportLines[i] = line.substring(1);
                }
            }
            text = exportLines.join("\n");

            text = await convertWikilinks(text);

            const linesAfterWikilinks = text.split("\n");
            const { isRemovable } = getLineMetaState(linesAfterWikilinks);
            text = linesAfterWikilinks.filter((_, i) => !isRemovable[i]).join("\n");

            text = text.replace(/\n(?:[ \t\xA0]*\n){2,}(?=[ \t\xA0]*\^[a-zA-Z0-9-]+\b)/g, "\n\n");
            text = text.replace(/(\^[a-zA-Z0-9-]+[ \t\xA0]*)\n(?:[ \t\xA0]*\n)+(?=[ \t\xA0]*(?:<!--Tags:|<!--ID:|❌DELETE❌))/g, "$1\n");

            const linesForCallout = text.split("\n");
            const firstCalloutIdx = linesForCallout.findIndex(line => line.includes("[!"));

            if (firstCalloutIdx !== -1) {
                let calloutLine = linesForCallout[firstCalloutIdx] ?? "";

                calloutLine = calloutLine.replace(/\[!([^\s\x5D|]+)(?:[\s|]+([^\x5D]+))?\x5D[-+]?(?:[ \t]*(?:\[\s*([^\x5D\n]*?)\s*\x5D|([^\n]+)))?/gu,
                    (_match: string, rawName: string, option?: string, titleBracketed?: string, titleUnbracketed?: string): string => {
                        const nameLower = rawName.toLowerCase();
                        let result = (profile.translations && profile.translations[nameLower]) ? String(profile.translations[nameLower]) : rawName;

                        if (option !== undefined && option.trim().length > 0) result += ` ${option.trim()}`;
                        const rawTitle = (titleBracketed !== undefined ? titleBracketed : titleUnbracketed) || "";
                        const cleanTitle = rawTitle.trim();

                        if (cleanTitle.length > 0) {
                            result += `; ${cleanTitle.replace(/,\s*/g, '; ')}`;
                        } else {
                            result += `;`;
                        }
                        return result;
                    }
                );

                linesForCallout[firstCalloutIdx] = calloutLine;
            }

            let header: string;
            let contentStr: string;

            if (firstCalloutIdx !== -1) {
                header = linesForCallout.slice(0, firstCalloutIdx + 1).join("\n").trim();
                contentStr = linesForCallout.slice(firstCalloutIdx + 1).join("\n").trim();
            } else {
                const fullText = linesForCallout.join("\n").trim();
                const firstNewLineIdx = fullText.indexOf('\n');
                if (firstNewLineIdx === -1) {
                    header = fullText;
                    contentStr = "";
                } else {
                    header = fullText.substring(0, firstNewLineIdx).trim();
                    contentStr = fullText.substring(firstNewLineIdx + 1).trim();
                }
            }

            for (const rule of profile.customRules || []) {
                if (!rule.exportRegex) continue;
                try {
                    const regex = new RegExp(rule.exportRegex, rule.exportFlags || "gm");
                    header = header.replace(regex, rule.exportReplacement);
                    contentStr = contentStr.replace(regex, rule.exportReplacement);
                } catch (e) {
                    console.error("Export Regex error:", e);
                }
            }

            const parts = contentStr.split(splitPattern).map(part => part.trim()).filter(part => part !== "");

            for (let i = 0; i < parts.length; i++) {
                await navigator.clipboard.writeText(parts[i] ?? "");
                new Notice(`Copied content part ${i + 1}/${parts.length} to clipboard.`);
                await delay(delayMs);
            }

            await navigator.clipboard.writeText(sourceLink);
            new Notice("Copied source link to clipboard.");

            if (header) {
                await delay(delayMs);
                await navigator.clipboard.writeText(header);
                new Notice("Copied header to clipboard.");
            }
        }
    });
}
