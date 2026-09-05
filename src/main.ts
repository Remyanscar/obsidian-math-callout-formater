import { Plugin } from "obsidian";
import { ReplacePatternsSettings } from "./types";
import { DEFAULT_SETTINGS } from "./constants";
import { ReplacePatternsSettingTab } from "./ui/SettingsTab";
import { executeIntegrateCommand } from "./commands/integrateCommand";
import { executeExportCommand } from "./commands/exportCommand";
import { executeStandardizeCalloutBlocksCommand } from "./commands/standardizeCalloutBlocksCommand";
import { executeFormatSpacingCommand } from "./commands/formatSpacingCommand";

export default class ReplacePatterns extends Plugin {
    settings!: ReplacePatternsSettings;

    async onload(): Promise<void> {
        await this.loadSettings();
        this.addSettingTab(new ReplacePatternsSettingTab(this.app, this));

        this.addCommand({
            id: "replace-selected-text-patterns",
            name: "Integrate (replace patterns in selected text)",
            callback: () => executeIntegrateCommand(this)
        });

        this.addCommand({
            id: "copy-modified-selection",
            name: "Export (copy modified selected text)",
            callback: () => executeExportCommand(this)
        });

        this.addCommand({
            id: "standardize-callout-blocks",
            name: "Standardize callout block ids",
            callback: () => executeStandardizeCalloutBlocksCommand(this)
        });

        this.addCommand({
            id: "format-block-spacing",
            name: "Format spacing between blocks and text",
            callback: () => executeFormatSpacingCommand(this)
        });
    }

    async loadSettings(): Promise<void> {
        const loadedData = (await this.loadData()) as ReplacePatternsSettings | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData || {});

        if (this.settings.profiles) {
            this.settings.profiles.forEach(p => {
                if (!p.customRules) p.customRules = [];
                if (!p.translations) p.translations = {};
                p.customRules.forEach(r => {
                    if (r.name === undefined) r.name = "";
                    if (!r.integrateFlags) r.integrateFlags = "gm";
                    if (!r.exportFlags) r.exportFlags = "gm";
                });
            });
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}
