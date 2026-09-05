import { Editor, EditorPosition } from "obsidian";

/**
 * Returns the editor selection ordered consistently from top to bottom.
 */
export function getOrderedSelection(editor: Editor): { start: EditorPosition, end: EditorPosition, reversed: boolean } {
    const head = editor.getCursor("head");
    const anchor = editor.getCursor("anchor");

    const reversed = (head.line < anchor.line) || (head.line === anchor.line && head.ch < anchor.ch);

    if (reversed) {
        return { start: head, end: anchor, reversed };
    }
    return { start: anchor, end: head, reversed };
}

/**
 * Restores the editor selection after content modification, adjusting for character shifts.
 */
export function updateSelectionWithShifts(
    editor: Editor,
    start: EditorPosition,
    end: EditorPosition,
    reversed: boolean,
    firstLineCharShift: number,
    lastLineCharShift: number
): void {
    const isSingleLine = (start.line === end.line);

    const newStart = { line: start.line, ch: start.ch + firstLineCharShift };
    let newEnd: EditorPosition;

    if (isSingleLine) {
        newEnd = { line: end.line, ch: end.ch + firstLineCharShift };
    } else {
        newEnd = { line: end.line, ch: end.ch + lastLineCharShift };
    }

    if (reversed) {
        editor.setSelection(newEnd, newStart);
    } else {
        editor.setSelection(newStart, newEnd);
    }
}
