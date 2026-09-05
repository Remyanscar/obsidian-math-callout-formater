import { REGEX } from "../constants";

interface Chunk {
    type: 'YAML' | 'Block' | 'HR' | 'Text';
    lines: string[];
}

/**
 * Processes raw text to enforce standardized spacing rules between Markdown blocks.
 */
export function formatDocumentSpacing(text: string): string {
    const lines = text.split("\n");
    const chunks: Chunk[] = [];
    let i = 0;
    let currentText: string[] = [];

    const pushText = () => {
        if (currentText.length > 0) {
            chunks.push({ type: 'Text', lines: currentText });
            currentText = [];
        }
    };

    if (lines.length > 0 && (lines[0] ?? "").trim() === "---") {
        const yamlLines: string[] = [lines[0] ?? ""];
        let foundEnd = false;
        let j = 1;
        while (j < lines.length) {
            const line = lines[j] ?? "";
            yamlLines.push(line);
            if (line.trim() === "---") {
                foundEnd = true;
                j++;
                break;
            }
            j++;
        }
        if (foundEnd) {
            chunks.push({ type: 'YAML', lines: yamlLines });
            i = j;
        }
    }

    while (i < lines.length) {
        const line = lines[i] ?? "";
        const trimmed = line.trim();

        const strippedHR = trimmed.replace(/[-_* \t\xA0]/g, '');
        const hasEnoughChars = (trimmed.match(/[-_*]/g) || []).length >= 3;

        if (strippedHR === '' && hasEnoughChars) {
            pushText();
            chunks.push({ type: 'HR', lines: [line] });
            i++;
            continue;
        }

        if (trimmed.startsWith("<!--START Md5:")) {
            pushText();
            const blockLines: string[] = [];

            let isTextMode = false;
            let j = i + 1;
            while (j < lines.length) {
                const peek = (lines[j] ?? "").trim();
                if (peek.startsWith("<!--START Md5:")) break;
                if (peek.startsWith("<!--END Md5:")) {
                    isTextMode = true;
                    break;
                }
                j++;
            }

            if (isTextMode) {
                while (i < lines.length) {
                    const cLine = lines[i] ?? "";
                    blockLines.push(cLine);
                    i++;
                    if (cLine.trim().startsWith("<!--END Md5:")) break;
                }
            } else {
                while (i < lines.length) {
                    const cLine = lines[i] ?? "";
                    blockLines.push(cLine);
                    i++;
                    if (cLine.includes("-->")) {
                        break;
                    }
                }

                let hasSeenQuote = false;
                while (i < lines.length) {
                    const cLine = lines[i] ?? "";
                    const cTrim = cLine.trim();

                    if (cTrim.startsWith("<!--START Md5:")) break;

                    if (/^[ \t\xA0]*>/.test(cLine)) {
                        hasSeenQuote = true;
                        blockLines.push(cLine);
                        i++;
                        continue;
                    }

                    if (cTrim === "" || cTrim.startsWith("%% [Link")) {
                        blockLines.push(cLine);
                        i++;
                        continue;
                    }

                    if (hasSeenQuote && (
                        REGEX.META_TAGS.test(cTrim) ||
                        REGEX.BLOCK_ID_ONLY.test(cTrim)
                    )) {
                        blockLines.push(cLine);
                        i++;
                        continue;
                    }
                    break;
                }
            }

            while (blockLines.length > 0 && (blockLines[blockLines.length - 1] ?? "").trim() === "") {
                blockLines.pop();
                i--;
            }

            chunks.push({ type: 'Block', lines: blockLines });
            continue;
        }

        currentText.push(line);
        i++;
    }

    pushText();

    const cleanedChunks: Chunk[] = [];
    for (const chunk of chunks) {
        if (chunk.type === 'Text') {
            while (chunk.lines.length > 0 && (chunk.lines[0]?.trim() ?? "") === "") {
                chunk.lines.shift();
            }
            while (chunk.lines.length > 0 && (chunk.lines[chunk.lines.length - 1]?.trim() ?? "") === "") {
                chunk.lines.pop();
            }
            if (chunk.lines.length > 0) cleanedChunks.push(chunk);
        } else {
            cleanedChunks.push(chunk);
        }
    }

    const newLines: string[] = [];
    for (let c = 0; c < cleanedChunks.length; c++) {
        const chunk = cleanedChunks[c];
        if(!chunk) continue;

        newLines.push(...chunk.lines);

        if (c < cleanedChunks.length - 1) {
            const spacing = chunk.type === 'HR' ? 1 : 3;
            for (let s = 0; s < spacing; s++) newLines.push("");
        }
    }

    return newLines.join("\n");
}

/**
 * Standardizes callout block IDs by assigning random identifiers where missing.
 */
export function standardizeBlockIds(
    text: string,
    existingBlocks: Record<string, unknown>,
    validNames: Set<string>
): { formattedText: string, addedCount: number, modified: boolean } {
    const lines = text.split("\n");
    let modified = false;
    let addedCount = 0;
    const newLines: string[] = [];

    const generateId = () => {
        let id, idWithoutCaret;
        do {
            idWithoutCaret = Math.random().toString(16).slice(2, 8).padStart(6, '0');
            id = "^" + idWithoutCaret;
        } while (
            existingBlocks[idWithoutCaret] !== undefined ||
            text.includes(id) ||
            newLines.join("\n").includes(id)
        );
        return id;
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i] ?? "";
        const match = line.match(REGEX.CALLOUT_START);

        if (match) {
            const calloutName = (match[2] ?? "").toLowerCase();

            if (validNames.has(calloutName)) {
                let endIdx = i;
                while (endIdx + 1 < lines.length) {
                    const nextLine = lines[endIdx + 1] ?? "";
                    if (/^[ \t\xA0]*>/.test(nextLine)) endIdx++;
                    else break;
                }

                const calloutLines = lines.slice(i, endIdx + 1);
                let existingId: string | null = null;

                for (let j = calloutLines.length - 1; j >= 0; j--) {
                    const cLine = calloutLines[j] ?? "";
                    const idMatch = cLine.match(REGEX.BLOCK_ID_LINE_END);
                    if (idMatch) {
                        existingId = "^" + (idMatch[1] ?? "");
                        calloutLines[j] = cLine.replace(REGEX.BLOCK_ID_LINE_END, '');
                        break;
                    }
                }

                while (calloutLines.length > 0 && /^[ \t\xA0>]*$/.test(calloutLines[calloutLines.length - 1] ?? "")) {
                    calloutLines.pop();
                }

                const blockId = existingId || generateId();
                if (!existingId) addedCount++;

                const lastContentLine = calloutLines[calloutLines.length - 1] || line;
                const prefixMatch = lastContentLine.match(/^[ \t\xA0>]+/);
                const safePrefix = prefixMatch ? prefixMatch[0] : "> ";
                const basePrefix = safePrefix.trimEnd() + (safePrefix.endsWith('\xA0') ? '\xA0' : ' ');

                calloutLines.push(basePrefix);
                calloutLines.push(basePrefix + blockId);

                newLines.push(...calloutLines);
                modified = true;

                i = endIdx + 1;
                let lookAhead = i;

                while (lookAhead < lines.length && /^[ \t\xA0]*$/.test(lines[lookAhead] ?? "")) {
                    lookAhead++;
                }

                if (lookAhead < lines.length) {
                    const nextLineTrimmed = (lines[lookAhead] ?? "").trim();
                    if (REGEX.META_TAGS.test(nextLineTrimmed)) {
                        i = lookAhead;
                    }
                }
                continue;
            }
        }

        newLines.push(line);
        i++;
    }

    return { formattedText: newLines.join("\n"), addedCount, modified };
}
