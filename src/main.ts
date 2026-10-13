import {Plugin} from "obsidian";
import {ReplacePatternsSettings} from "./types";
import {DEFAULT_SETTINGS} from "./constants";
import {ReplacePatternsSettingTab} from "./ui/SettingsTab";
import {executeIntegrateCommand} from "./commands/integrateCommand";
import {executeExportCommand} from "./commands/exportCommand";
import {executeStandardizeCalloutBlocksCommand} from "./commands/standardizeCalloutBlocksCommand";
import {executeFormatSpacingCommand} from "./commands/formatSpacingCommand";
import {ScopeModal} from "./ui/ScopeModal";
import {executeScopedStandardizeCallouts, executeScopedFormatSpacing} from "./commands/scopedCommands";

export default class ReplacePatterns extends Plugin {
    settings!: ReplacePatternsSettings;

    async onload(): Promise<void> {
        await this.loadSettings();

        this.addSettingTab(new ReplacePatternsSettingTab(this.app, this));

        this.addCommand({
            id: "replace-selected-text-patterns",
            name: "Import integration (replace patterns in selected text)",
            callback: () => executeIntegrateCommand(this)
        });

        this.addCommand({
            id: "copy-modified-selection",
            name: "Export (copy modified selected text)",
            callback: () => executeExportCommand(this)
        });

        this.addCommand({
            id: "standardize-callout-ids",
            name: "Standardize formal callout ids (active editor)",
            callback: () => executeStandardizeCalloutBlocksCommand(this)
        });

        this.addCommand({
            id: "format-block-spacing",
            name: "Format block spacing (active editor)",
            callback: () => executeFormatSpacingCommand(this)
        });

        this.addCommand({
            id: "scoped-standardize-callout-ids",
            name: "Scoped standardize formal callout ids (choose folder/file)",
            callback: () => {
                new ScopeModal(this.app, this, "Standardize formal callouts", (files) => {
                    void executeScopedStandardizeCallouts(this, files);
                }).open();
            }
        });

        this.addCommand({
            id: "scoped-format-block-spacing",
            name: "Scoped format block spacing (choose folder/file)",
            callback: () => {
                new ScopeModal(this.app, this, "Format block spacing", (files) => {
                    void executeScopedFormatSpacing(this, files);
                }).open();
            }
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
