import { MarkdownView, Notice } from "obsidian";
import ReplacePatterns from "../main";
import { STANDARD_CALLOUTS } from "../constants";
import { standardizeBlockIds } from "../utils/textProcessor";

/**
 * Standardizes standard callouts by verifying and generating missing block references.
 */
export function executeStandardizeCalloutBlocksCommand(plugin: ReplacePatterns): void {
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
        new Notice("No active document found.");
        return;
    }

    const editor = activeView.editor;
    const text = editor.getValue();

    const fileCache = activeView.file ? plugin.app.metadataCache.getFileCache(activeView.file) : null;
    const existingBlocks = fileCache?.blocks || {};
    const validNames = new Set(STANDARD_CALLOUTS.map(c => c.toLowerCase()));

    const { formattedText, addedCount, modified } = standardizeBlockIds(text, existingBlocks, validNames);

    if (modified) {
        const currentCursor = editor.getCursor();
        const currentScroll = editor.getScrollInfo();

        editor.setValue(formattedText);

        editor.setCursor(currentCursor);
        editor.scrollTo(currentScroll.left, currentScroll.top);

        new Notice(`Standardized formatting and assigned ${addedCount} missing block ID(s).`);
    } else {
        new Notice("All callouts are already standardized.");
    }
}
