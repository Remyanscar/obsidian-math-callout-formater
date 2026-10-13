import {Notice, TFile} from "obsidian";
import ReplacePatterns from "../main";
import {standardizeBlockIds, formatDocumentSpacing} from "../utils/textProcessor";
import {STANDARD_CALLOUTS} from "../constants";

export async function executeScopedStandardizeCallouts(plugin: ReplacePatterns, files: TFile[]): Promise<void> {
    const validNames = new Set(STANDARD_CALLOUTS.map(c => c.toLowerCase()));
    let processedCount = 0;
    let modifiedCount = 0;

    new Notice(`Standardizing callouts in ${files.length} file(s). Please wait...`);

    for (const file of files) {
        await plugin.app.vault.process(file, (data) => {
            const fileCache = plugin.app.metadataCache.getFileCache(file);
            const existingBlocks = fileCache?.blocks || {};
            const {formattedText, modified} = standardizeBlockIds(data, existingBlocks, validNames, plugin.settings);

            if (modified) {
                modifiedCount++;
                return formattedText;
            }
            return data;
        });
        processedCount++;
    }
    new Notice(`Standardization complete! Modified ${modifiedCount} out of ${processedCount} file(s).`);
}

export async function executeScopedFormatSpacing(plugin: ReplacePatterns, files: TFile[]): Promise<void> {
    let processedCount = 0;
    let modifiedCount = 0;

    new Notice(`Formatting spacing in ${files.length} file(s). Please wait...`);

    for (const file of files) {
        await plugin.app.vault.process(file, (data) => {
            const formattedText = formatDocumentSpacing(data, plugin.settings);
            if (formattedText !== data) {
                modifiedCount++;
                return formattedText;
            }
            return data;
        });
        processedCount++;
    }
    new Notice(`Formatting complete! Adjusted ${modifiedCount} out of ${processedCount} file(s).`);
}
