import {ReplacePatternsSettings} from "../types";

export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isAnkiMetaLine(line: string, settings: ReplacePatternsSettings): boolean {
    const trimmed = line.trim().toLowerCase();
    const tagsPrefix = (settings.ankiTagsPrefix || "<!--Tags:").trim().toLowerCase();
    const idPrefix = (settings.ankiIdPrefix || "<!--ID:").trim().toLowerCase();
    const deleteMarker = (settings.deleteMarker || "DELETE").trim().toLowerCase();

    return trimmed.startsWith(tagsPrefix) ||
        trimmed.startsWith(idPrefix) ||
        trimmed.startsWith(deleteMarker);
}

export function runAsync(promiseFn: () => Promise<void>): void {
    promiseFn().catch((err: unknown) => {
        console.error("Async operation failed:", err);
    });
}

export function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

export function getLineMetaState(lines: string[], settings: ReplacePatternsSettings): {
    isMeta: boolean[],
    isRemovable: boolean[]
} {
    const isMeta: boolean[] = Array.from({length: lines.length}, () => false);
    const isRemovable: boolean[] = Array.from({length: lines.length}, () => false);
    let inMetaBlock = false;
    let expectedHash = "";

    for (let i = 0; i < lines.length; i++) {
        const lineStr = lines[i] ?? "";
        const trimmed = lineStr.trim();

        const startMatch = trimmed.match(/^<!--START Md5:\s*([a-f0-9]+)/);
        if (startMatch) {
            expectedHash = startMatch[1] ?? "";
            isMeta[i] = true;
            isRemovable[i] = true;
            inMetaBlock = !trimmed.includes("-->");
            continue;
        }

        if (trimmed.startsWith("<!--END Md5:")) {
            if (!expectedHash || trimmed.includes(`<!--END Md5: ${expectedHash}`)) {
                isMeta[i] = true;
                isRemovable[i] = true;
                expectedHash = "";
                continue;
            }
        }

        if (inMetaBlock) {
            isMeta[i] = true;
            isRemovable[i] = true;
            if (trimmed.includes("-->")) {
                inMetaBlock = false;
            }
            continue;
        }

        // Zmiana: usunięto ukośnik przed zewnętrznym ]
        if (/^%%\s*\[[^\]]+]\([^)]+\)\s*%%$/.test(trimmed)) {
            isMeta[i] = true;
            isRemovable[i] = true;
        } else if (isAnkiMetaLine(trimmed, settings)) {
            isMeta[i] = true;
            isRemovable[i] = false;
        }
    }
    return {isMeta, isRemovable};
}

export function compileRegex(pattern: string, flags = "m"): RegExp | null {
    try {
        return new RegExp(pattern, flags);
    } catch (e) {
        console.error("Invalid RegExp:", pattern, e);
        return null;
    }
}
