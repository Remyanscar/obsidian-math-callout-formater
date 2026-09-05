/**
 * Executes a Promise safely without requiring await in the caller function.
 */
export function runAsync(promiseFn: () => Promise<void>): void {
    promiseFn().catch((err: unknown) => {
        console.error("Async operation failed:", err);
    });
}

/**
 * Returns a promise that resolves after a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

/**
 * Scans an array of text lines to determine which lines belong to meta-blocks
 * (e.g., Md5 tracking tags, specific marginnote links).
 */
export function getLineMetaState(lines: string[]): { isMeta: boolean[], isRemovable: boolean[] } {
    // Używamy Array.from, aby bezpiecznie wygenerować tablicę booleanów bez typu 'any'
    const isMeta: boolean[] = Array.from({ length: lines.length }, () => false);
    const isRemovable: boolean[] = Array.from({ length: lines.length }, () => false);
    let inMetaBlock = false;

    for (let i = 0; i < lines.length; i++) {
        const lineStr = lines[i] ?? "";
        const trimmed = lineStr.trim();

        if (trimmed.startsWith("<!--START Md5:") || trimmed.startsWith("<!--END Md5:")) {
            isMeta[i] = true;
            isRemovable[i] = true;
            inMetaBlock = !trimmed.includes("-->");
            continue;
        }

        if (inMetaBlock) {
            isMeta[i] = true;
            isRemovable[i] = true;
            if (trimmed.includes("-->")) {
                inMetaBlock = false;
            }
            continue;
        }

        if (trimmed.startsWith("%% [Link to source]")) {
            isMeta[i] = true;
            isRemovable[i] = true;
        } else if (
            trimmed.startsWith("<!--Tags:") ||
            trimmed.startsWith("<!--ID:") ||
            trimmed.startsWith("❌DELETE❌")
        ) {
            isMeta[i] = true;
            isRemovable[i] = false;
        }
    }

    return { isMeta, isRemovable };
}
