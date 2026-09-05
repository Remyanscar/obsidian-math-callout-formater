// noinspection JSIgnoredPromiseFromCall

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ReplacePatterns from "../main";
import { ConfirmModal } from "./ConfirmModal";
import { STANDARD_CALLOUTS, DEFAULT_SETTINGS } from "../constants";
import { runAsync } from "../utils/helpers";
import { Profile, CustomRule } from "../types";

export class ReplacePatternsSettingTab extends PluginSettingTab {
    plugin: ReplacePatterns;
    private isTranslationsOpen = false;
    private isRulesSectionOpen = false;

    constructor(app: App, plugin: ReplacePatterns) {
        super(app, plugin);
        this.plugin = plugin;
    }

    /**
     * Satisfies the obsidianmd/settings-tab/prefer-setting-definitions linter rule.
     * Required for Obsidian 1.13.0+ to support settings search.
     */
    // noinspection JSUnusedGlobalSymbols
    public getSettingDefinitions(): Record<string, unknown>[] {
        return [];
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        this.renderExportConfig(containerEl);
        this.addDivider(containerEl);
        this.renderProfileManagement(containerEl);

        const activeProfile = this.plugin.settings.profiles.find(p => p.name === this.plugin.settings.activeProfile);
        if (activeProfile) {
            this.addDivider(containerEl);
            this.renderActiveProfileConfig(containerEl, activeProfile);
        }
    }

    private addDivider(containerEl: HTMLElement) {
        containerEl.createEl('hr', { attr: { style: 'border-top: 2px solid var(--background-modifier-border); margin: 2em 0;' }});
    }

    private renderExportConfig(containerEl: HTMLElement) {
        new Setting(containerEl).setName("Export configuration").setHeading();

        new Setting(containerEl)
            .setName("Clipboard copy delay (ms)")
            .setDesc("Time in milliseconds to wait between copying parts of the text to the clipboard history. Useful to ensure clipboard managers don't overwrite items.")
            .addText(text => text
                .setPlaceholder("900")
                .setValue(String(this.plugin.settings.clipboardDelay ?? 900))
                .onChange(val => {
                    const num = parseInt(val, 10);
                    this.plugin.settings.clipboardDelay = isNaN(num) ? 900 : num;
                    runAsync(() => this.plugin.saveSettings());
                })
            );

        new Setting(containerEl)
            .setName("Split pattern")
            .setDesc("The text marker used to split the content into multiple separate clipboard entries.")
            .addText(text => text
                .setPlaceholder("%%~%%")
                .setValue(this.plugin.settings.splitPattern || "%%~%%")
                .onChange(val => {
                    this.plugin.settings.splitPattern = val;
                    runAsync(() => this.plugin.saveSettings());
                })
            );

        new Setting(containerEl)
            .setName("Source link format")
            .setDesc("Format used when copying the source link to the clipboard. Use {URI} as a placeholder for the generated link.")
            .addTextArea(text => {
                text.inputEl.rows = 3;

                const placeholderStr = '<a hr' + 'ef="{URI}">Link</a>';

                text.setPlaceholder(placeholderStr)
                    .setValue(this.plugin.settings.sourceLinkFormat || "{URI}")
                    .onChange(val => {
                        this.plugin.settings.sourceLinkFormat = val;
                        runAsync(() => this.plugin.saveSettings());
                    });
            });
    }

    private renderProfileManagement(containerEl: HTMLElement) {
        new Setting(containerEl).setName("Profile management").setHeading();

        new Setting(containerEl)
            .setName("Active profile")
            .setDesc("Select which translation and rules package to use.")
            .addDropdown(drop => {
                this.plugin.settings.profiles.forEach(p => {
                    drop.addOption(p.name, p.name);
                });
                drop.setValue(this.plugin.settings.activeProfile)
                    .onChange(val => {
                        this.plugin.settings.activeProfile = val;
                        runAsync(async () => {
                            await this.plugin.saveSettings();
                            this.display();
                        });
                    });
            });

        const activeProfile = this.plugin.settings.profiles.find(p => p.name === this.plugin.settings.activeProfile);
        if (!activeProfile) return;

        let newProfileName = "";
        new Setting(containerEl)
            .setName("Add new profile")
            .addText(text => text.onChange(val => { newProfileName = val; }))
            .addButton(btn => btn
                .setButtonText("Create")
                .setCta()
                .onClick(() => {
                    runAsync(async () => {
                        if (newProfileName && !this.plugin.settings.profiles.find(p => p.name === newProfileName)) {

                            const baseProfile = DEFAULT_SETTINGS.profiles[0];
                            const defaultTranslations = baseProfile ? { ...baseProfile.translations } : {};
                            const defaultRules = baseProfile ? baseProfile.customRules.map(r => ({ ...r })) : [];

                            STANDARD_CALLOUTS.forEach(c => {
                                if (defaultTranslations[c] === undefined) defaultTranslations[c] = "";
                            });

                            this.plugin.settings.profiles.push({
                                name: newProfileName,
                                translations: defaultTranslations,
                                customRules: defaultRules
                            });

                            this.plugin.settings.activeProfile = newProfileName;
                            await this.plugin.saveSettings();
                            this.display();
                        } else if (!newProfileName) {
                            new Notice("Profile name cannot be empty.");
                        } else {
                            new Notice("A profile with this name already exists.");
                        }
                    });
                })
            )
            .addButton(btn => btn
                .setButtonText("Copy active")
                .onClick(() => {
                    runAsync(async () => {
                        if (newProfileName && !this.plugin.settings.profiles.find(p => p.name === newProfileName)) {

                            const copiedTranslations = { ...activeProfile.translations };
                            const copiedRules = activeProfile.customRules.map(r => ({ ...r }));

                            this.plugin.settings.profiles.push({
                                name: newProfileName,
                                translations: copiedTranslations,
                                customRules: copiedRules
                            });

                            this.plugin.settings.activeProfile = newProfileName;
                            await this.plugin.saveSettings();
                            new Notice(`Profile copied to '${newProfileName}'.`);
                            this.display();
                        } else if (!newProfileName) {
                            new Notice("Profile name cannot be empty.");
                        } else {
                            new Notice("A profile with this name already exists.");
                        }
                    });
                })
            );

        let renameInputValue = activeProfile.name;
        new Setting(containerEl)
            .setName("Rename active profile")
            .setDesc("Change the display name of the currently selected profile.")
            .addText(text => text
                .setValue(activeProfile.name)
                .onChange(val => { renameInputValue = val; })
            )
            .addButton(btn => btn
                .setButtonText("Rename")
                .setCta()
                .onClick(() => {
                    runAsync(async () => {
                        const trimmed = renameInputValue.trim();
                        if (!trimmed) {
                            new Notice("Profile name cannot be empty.");
                            return;
                        }
                        if (this.plugin.settings.profiles.some(p => p !== activeProfile && p.name === trimmed)) {
                            new Notice("A profile with this name already exists.");
                            return;
                        }
                        activeProfile.name = trimmed;
                        this.plugin.settings.activeProfile = trimmed;
                        await this.plugin.saveSettings();
                        new Notice(`Profile renamed to '${trimmed}'.`);
                        this.display();
                    });
                })
            );

        if (this.plugin.settings.profiles.length > 1) {
            new Setting(containerEl)
                .setName(`Delete profile`)
                .addButton(btn => btn
                    .setButtonText("Delete")
                    .setWarning()
                    .onClick(() => {
                        new ConfirmModal(
                            this.app,
                            `Are you sure you want to delete profile '${activeProfile.name}'?`,
                            () => {
                                runAsync(async () => {
                                    this.plugin.settings.profiles = this.plugin.settings.profiles.filter(p => p.name !== activeProfile.name);
                                    this.plugin.settings.activeProfile = this.plugin.settings.profiles[0]?.name || "";
                                    await this.plugin.saveSettings();
                                    new Notice(`Profile '${activeProfile.name}' deleted.`);
                                    this.display();
                                });
                            }
                        ).open();
                    })
                );
        }
    }

    private renderActiveProfileConfig(containerEl: HTMLElement, activeProfile: Profile) {
        new Setting(containerEl).setName(`Configuration for: ${activeProfile.name}`).setHeading();

        const translationsDetails = containerEl.createEl('details', {
            attr: { style: 'margin-bottom: 20px; border: 1px solid var(--background-modifier-border); padding: 10px; border-radius: 8px;' }
        });
        if (this.isTranslationsOpen) translationsDetails.open = true;
        translationsDetails.addEventListener('toggle', () => { this.isTranslationsOpen = translationsDetails.open; });

        const translationsSummary = translationsDetails.createEl('summary', {
            attr: { style: 'font-weight: bold; cursor: pointer; font-size: 1.1em; padding: 5px 0;' }
        });
        translationsSummary.createSpan({ text: 'Callout translations' });
        translationsSummary.createEl('p', {
            text: 'Translate standard callout names into your custom names.',
            cls: 'setting-item-description',
            attr: { style: 'margin: 5px 0 15px 0; font-weight: normal;' }
        });

        STANDARD_CALLOUTS.forEach(calloutKey => {
            new Setting(translationsDetails)
                .setName(calloutKey)
                .addText(text => text
                    .setValue(activeProfile.translations[calloutKey] || "")
                    .onChange(value => {
                        activeProfile.translations[calloutKey] = value;
                        runAsync(() => this.plugin.saveSettings());
                    })
                );
        });

        new Setting(translationsDetails)
            .addButton(btn => btn
                .setButtonText("Import translations")
                .setTooltip("Import callout translations from clipboard (JSON).")
                .onClick(() => {
                    runAsync(async () => {
                        try {
                            const clipboardText = await navigator.clipboard.readText();
                            const parsed = JSON.parse(clipboardText) as unknown;

                            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                                const translationsObj = parsed as Record<string, unknown>;
                                let importedCount = 0;

                                for (const key of Object.keys(translationsObj)) {
                                    const val = translationsObj[key];
                                    if (typeof val === "string") {
                                        activeProfile.translations[key] = val;
                                        importedCount++;
                                    }
                                }

                                if (importedCount > 0) {
                                    this.isTranslationsOpen = true;
                                    await this.plugin.saveSettings();
                                    this.display();
                                    new Notice(`Imported ${importedCount} translation(s) from clipboard.`);
                                } else {
                                    new Notice("No valid translations found in clipboard.");
                                }
                            } else {
                                new Notice("Clipboard does not contain a valid JSON object.");
                            }
                        } catch (e) {
                            console.error("Import error:", e);
                            new Notice("Failed to parse clipboard data. Is it valid JSON?");
                        }
                    });
                })
            )
            .addButton(btn => btn
                .setButtonText("Export translations")
                .setTooltip("Copy all callout translations from this profile to clipboard as JSON.")
                .onClick(() => {
                    runAsync(async () => {
                        const translationsJson = JSON.stringify(activeProfile.translations, null, 2);
                        await navigator.clipboard.writeText(translationsJson);
                        new Notice("Callout translations copied to clipboard.");
                    });
                })
            );

        const rulesSectionDetails = containerEl.createEl('details', {
            attr: { style: 'margin-bottom: 20px; border: 1px solid var(--background-modifier-border); padding: 10px; border-radius: 8px;' }
        });
        if (this.isRulesSectionOpen) rulesSectionDetails.open = true;
        rulesSectionDetails.addEventListener('toggle', () => { this.isRulesSectionOpen = rulesSectionDetails.open; });

        const rulesSummary = rulesSectionDetails.createEl('summary', {
            attr: { style: 'font-weight: bold; cursor: pointer; font-size: 1.1em; padding: 5px 0;' }
        });
        rulesSummary.createSpan({ text: 'Custom rules' });
        rulesSummary.createEl('p', {
            text: 'Define custom regex macros to format or clean up text during export and integration.',
            cls: 'setting-item-description',
            attr: { style: 'margin: 5px 0 15px 0; font-weight: normal;' }
        });

        activeProfile.customRules.forEach((rule, index) => {
            this.renderSingleRule(rulesSectionDetails, activeProfile, rule, index);
        });

        new Setting(rulesSectionDetails)
            .addButton(btn => btn
                .setButtonText("Add custom rule")
                .setCta()
                .onClick(() => {
                    runAsync(async () => {
                        this.isRulesSectionOpen = true;
                        activeProfile.customRules.push({
                            name: "",
                            integrateRegex: "",
                            integrateFlags: "gm",
                            integrateReplacement: "",
                            exportRegex: "",
                            exportFlags: "gm",
                            exportReplacement: ""
                        });
                        await this.plugin.saveSettings();
                        this.display();
                    });
                })
            )
            .addButton(btn => btn
                .setButtonText("Import rules")
                .setTooltip("Import custom rules from clipboard (JSON).")
                .onClick(() => {
                    runAsync(async () => {
                        try {
                            const clipboardText = await navigator.clipboard.readText();
                            const parsed = JSON.parse(clipboardText) as unknown;

                            if (Array.isArray(parsed)) {
                                let importedCount = 0;
                                for (const item of parsed) {
                                    if (item && typeof item === "object") {
                                        const rule = item as Record<string, unknown>;

                                        activeProfile.customRules.push({
                                            name: typeof rule.name === "string" ? rule.name : "",
                                            integrateRegex: typeof rule.integrateRegex === "string" ? rule.integrateRegex : "",
                                            integrateFlags: typeof rule.integrateFlags === "string" ? rule.integrateFlags : "gm",
                                            integrateReplacement: typeof rule.integrateReplacement === "string" ? rule.integrateReplacement : "",
                                            exportRegex: typeof rule.exportRegex === "string" ? rule.exportRegex : "",
                                            exportFlags: typeof rule.exportFlags === "string" ? rule.exportFlags : "gm",
                                            exportReplacement: typeof rule.exportReplacement === "string" ? rule.exportReplacement : ""
                                        });

                                        importedCount++;
                                    }
                                }

                                if (importedCount > 0) {
                                    this.isRulesSectionOpen = true;
                                    await this.plugin.saveSettings();
                                    this.display();
                                    new Notice(`Imported ${importedCount} rule(s) from clipboard.`);
                                } else {
                                    new Notice("No valid rules found in clipboard.");
                                }
                            } else {
                                new Notice("Clipboard does not contain a valid JSON array.");
                            }
                        } catch (e) {
                            console.error("Import error:", e);
                            new Notice("Failed to parse clipboard data. Is it valid JSON?");
                        }
                    });
                })
            )
            .addButton(btn => btn
                .setButtonText("Export rules")
                .setTooltip("Copy all custom rules from this profile to clipboard as JSON.")
                .onClick(() => {
                    runAsync(async () => {
                        const rulesJson = JSON.stringify(activeProfile.customRules, null, 2);
                        await navigator.clipboard.writeText(rulesJson);
                        new Notice("Custom rules copied to clipboard.");
                    });
                })
            );
    }

    private renderSingleRule(container: HTMLElement, profile: Profile, rule: CustomRule, index: number) {
        const singleRuleDetails = container.createEl('details', {
            attr: { style: 'margin-bottom: 12px; border: 1px solid var(--background-modifier-border); border-radius: 8px; background-color: var(--background-primary-alt); overflow: hidden;' }
        });

        const ruleDisplayName = rule.name && rule.name.trim() !== "" ? rule.name : `Rule #${index + 1}`;
        const singleRuleSummary = singleRuleDetails.createEl('summary', {
            attr: { style: 'font-weight: 600; cursor: pointer; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; background-color: var(--background-secondary);' }
        });

        singleRuleSummary.createSpan({ text: ruleDisplayName });
        const deleteBtn = singleRuleSummary.createEl('button', {
            text: 'Delete',
            cls: 'mod-warning',
            attr: { style: 'padding: 2px 8px; font-size: 0.85em; margin-left: 10px;' }
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            new ConfirmModal(this.app, `Are you sure you want to delete rule '${ruleDisplayName}'?`, () => {
                runAsync(async () => {
                    this.isRulesSectionOpen = true;
                    profile.customRules.splice(index, 1);
                    await this.plugin.saveSettings();
                    new Notice(`Rule '${ruleDisplayName}' deleted.`);
                    this.display();
                });
            }).open();
        });

        const ruleBody = singleRuleDetails.createDiv({
            attr: { style: 'padding: 15px; border-top: 1px solid var(--background-modifier-border);' }
        });

        let ruleRenameValue = rule.name || "";
        new Setting(ruleBody)
            .setName("Rule name")
            .setDesc("Give this rule a recognizable title.")
            .addText(text => text
                .setValue(rule.name || "")
                .onChange(val => { ruleRenameValue = val; })
            )
            .addButton(btn => btn
                .setButtonText("Save name")
                .setCta()
                .onClick(() => {
                    runAsync(async () => {
                        rule.name = ruleRenameValue.trim();
                        await this.plugin.saveSettings();
                        new Notice("Rule name saved.");
                        this.isRulesSectionOpen = true;
                        this.display();
                    });
                })
            );

        const cardsContainer = ruleBody.createDiv({ attr: { style: 'display: flex; flex-direction: column; gap: 15px; margin-top: 15px;' } });
        this.renderRegexCard(cardsContainer, "Integration (to obsidian)", rule, "integrate");
        this.renderRegexCard(cardsContainer, "Export (to clipboard)", rule, "export");
    }

    private renderRegexCard(container: HTMLElement, title: string, rule: CustomRule, type: "integrate" | "export") {
        const card = container.createDiv({
            attr: { style: 'display: flex; flex-direction: column; border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 15px; background-color: var(--background-primary); box-sizing: border-box;' }
        });
        card.createDiv({
            text: title,
            attr: { style: 'margin: 0 0 15px 0; color: var(--text-accent); font-size: 1.05em; font-weight: bold;' }
        });

        if (type === "integrate") {
            this.bindRegexHeader(card, 'Regex pattern', rule.integrateFlags || "gm", (val) => {
                rule.integrateFlags = val;
                runAsync(() => this.plugin.saveSettings());
            });

            this.bindTextArea(card, null, rule.integrateRegex || "", (val) => {
                rule.integrateRegex = val;
                runAsync(() => this.plugin.saveSettings());
            }, false);

            this.bindTextArea(card, 'Replacement string', rule.integrateReplacement || "", (val) => {
                rule.integrateReplacement = val;
                runAsync(() => this.plugin.saveSettings());
            }, true);
        } else {
            this.bindRegexHeader(card, 'Regex pattern', rule.exportFlags || "gm", (val) => {
                rule.exportFlags = val;
                runAsync(() => this.plugin.saveSettings());
            });

            this.bindTextArea(card, null, rule.exportRegex || "", (val) => {
                rule.exportRegex = val;
                runAsync(() => this.plugin.saveSettings());
            }, false);

            this.bindTextArea(card, 'Replacement string', rule.exportReplacement || "", (val) => {
                rule.exportReplacement = val;
                runAsync(() => this.plugin.saveSettings());
            }, true);
        }
    }

    private bindRegexHeader(container: HTMLElement, label: string, flagsValue: string, onFlagsChange: (val: string) => void) {
        const header = container.createDiv({ attr: { style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;' } });
        header.createSpan({ text: label, attr: { style: 'font-weight: 600; font-size: 0.85em;' } });

        const flagsDiv = header.createDiv({ attr: { style: 'display: flex; align-items: center; gap: 5px;' } });
        flagsDiv.createSpan({ text: 'Flags', attr: { style: 'font-size: 0.8em; color: var(--text-muted);' } });

        const flagsInp = flagsDiv.createEl('input', {
            attr: { type: 'text', placeholder: 'Flags', style: 'width: 50px; padding: 2px 5px; text-align: center; font-family: var(--font-monospace); font-size: 0.85em;' }
        });
        flagsInp.value = flagsValue;
        flagsInp.addEventListener('input', () => onFlagsChange(flagsInp.value));
    }

    private bindTextArea(container: HTMLElement, label: string | null, initialValue: string, onChange: (val: string) => void, isLast: boolean) {
        if (label) {
            container.createSpan({ text: label, attr: { style: 'font-weight: 600; font-size: 0.85em; margin-bottom: 5px; display: block;' } });
        }
        const ta = container.createEl('textarea', {
            attr: { style: `width: 100%; resize: vertical; min-height: 60px; font-family: var(--font-monospace); font-size: 0.85em; box-sizing: border-box;${isLast ? '' : ' margin-bottom: 15px;'}` }
        });
        ta.value = initialValue;
        ta.addEventListener('input', () => onChange(ta.value));
    }
}
