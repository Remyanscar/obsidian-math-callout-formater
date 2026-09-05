import { MarkdownView, Notice } from "obsidian";
import ReplacePatterns from "../main";
import { formatDocumentSpacing } from "../utils/textProcessor";

/**
 * Executes document-wide spacing format, ensuring visual consistency around blocks and HRs.
 */
export function executeFormatSpacingCommand(plugin: ReplacePatterns): void {
    const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
        new Notice("No active document found.");
        return;
    }

    const editor = activeView.editor;
    const originalText = editor.getValue();

    const formattedText = formatDocumentSpacing(originalText);

    if (originalText !== formattedText) {
        const currentCursor = editor.getCursor();
        const currentScroll = editor.getScrollInfo();

        editor.setValue(formattedText);

        editor.setCursor(currentCursor);
        editor.scrollTo(currentScroll.left, currentScroll.top);

        new Notice("Document spacing formatted successfully.");
    } else {
        new Notice("Document is already properly formatted.");
    }
}
