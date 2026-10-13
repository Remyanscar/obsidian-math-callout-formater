import {
    App,
    Modal,
    Setting,
    TFile,
    TFolder,
    Notice,
    FuzzySuggestModal,
    DropdownComponent,
    ToggleComponent
} from "obsidian";
import ReplacePatterns from "../main";
import {runAsync} from "../utils/helpers";

export class ScopeModal extends Modal {
    plugin: ReplacePatterns;
    selectedFolder: string;
    isRecursive: boolean;
    actionTitle: string;
    onSubmit: (files: TFile[]) => void;

    constructor(app: App, plugin: ReplacePatterns, actionTitle: string, onSubmit: (files: TFile[]) => void) {
        super(app);
        this.plugin = plugin;
        this.actionTitle = actionTitle;
        this.onSubmit = onSubmit;

        this.selectedFolder = this.plugin.settings.lastScopeFolder || "/";
        this.isRecursive = this.plugin.settings.lastScopeRecursive ?? true;
    }

    onOpen() {
        const {contentEl, titleEl} = this;

        void titleEl.setText(`Choose scope: ${this.actionTitle}`);
        contentEl.addClass("replace-patterns-scope-modal");

        void new Setting(contentEl).setHeading().setName("Quick selection");

        void new Setting(contentEl)
            .setName("Active file")
            .setDesc("Process the Markdown file currently open in the editor.")
            .addButton(btn => {
                void btn.setButtonText("Process active")
                    .setCta()
                    .onClick(() => {
                        const activeFile = this.app.workspace.getActiveFile();
                        if (activeFile !== null && activeFile.extension === "md") {
                            this.close();
                            this.onSubmit([activeFile]);
                        } else {
                            new Notice("No active Markdown file found.");
                        }
                    });
            });

        void new Setting(contentEl).setHeading().setName("Area selection (folders)");

        const allFolders = this.getAllFolders();
        const foundInitialFolder = allFolders.find(f => f.path === this.selectedFolder);

        if (foundInitialFolder === undefined) {
            this.selectedFolder = "/";
        }

        let currentDropdown: DropdownComponent;
        let saveToggle: ToggleComponent;

        const checkIsSaved = (): boolean => {
            const savedFolder = this.plugin.settings.lastScopeFolder || "/";
            const savedRecursive = this.plugin.settings.lastScopeRecursive ?? true;
            return this.selectedFolder === savedFolder && this.isRecursive === savedRecursive;
        };

        const updateSaveToggle = () => {
            if (saveToggle !== undefined) {
                void saveToggle.setValue(checkIsSaved());
            }
        };

        void new Setting(contentEl)
            .setName("Filter structure")
            .setDesc("Type a fragment of the name to narrow down the list of available directories.")
            .addSearch(search => {
                void search.setPlaceholder("Filter folders...");
                void search.onChange(val => {
                    updateDropdown(val);
                });
            });

        void new Setting(contentEl)
            .setName("Target directory")
            .setDesc("Pick a folder from the filtered list.")
            .addDropdown(drop => {
                currentDropdown = drop;
                void drop.onChange(val => {
                    this.selectedFolder = val;
                    updateSaveToggle();
                });
            });

        const updateDropdown = (term: string) => {
            currentDropdown.selectEl.innerHTML = "";
            const filtered = allFolders.filter(f => f.path.toLowerCase().includes(term.toLowerCase()));

            if (filtered.length > 0) {
                filtered.forEach(f => {
                    void currentDropdown.addOption(f.path, f.path === "/" ? "/ (Vault Root)" : f.path);
                });

                const foundFiltered = filtered.find(f => f.path === this.selectedFolder);
                if (foundFiltered === undefined && filtered[0] !== undefined) {
                    this.selectedFolder = filtered[0].path;
                }
                void currentDropdown.setValue(this.selectedFolder);
            } else {
                void currentDropdown.addOption("", "No results");
                void currentDropdown.setValue("");
                this.selectedFolder = "";
            }
            updateSaveToggle();
        };

        updateDropdown("");

        void new Setting(contentEl)
            .setName("Include subfolders")
            .setDesc("Recursively include all nested directories.")
            .addToggle(toggle => {
                void toggle.setValue(this.isRecursive);
                void toggle.onChange(val => {
                    this.isRecursive = val;
                    updateSaveToggle();
                });
            });

        void new Setting(contentEl)
            .setName("Start task")
            .setDesc("The toggle saves this folder as the default for the future.")
            .addToggle(toggle => {
                saveToggle = toggle;
                void toggle.setTooltip("Remember this folder configuration");
                void toggle.setValue(checkIsSaved());
                void toggle.onChange((val: boolean) => {
                    runAsync(async () => {
                        if (val) {
                            if (this.selectedFolder === "") return;
                            this.plugin.settings.lastScopeFolder = this.selectedFolder;
                            this.plugin.settings.lastScopeRecursive = this.isRecursive;
                            await this.plugin.saveSettings();
                            new Notice("Remembered this folder as default.");
                        } else {
                            this.plugin.settings.lastScopeFolder = "/";
                            this.plugin.settings.lastScopeRecursive = true;
                            await this.plugin.saveSettings();
                            new Notice("Restored main default settings.");
                        }
                    });
                });
            })
            .addButton(btn => {
                void btn.setButtonText("Process folder")
                    .setCta()
                    .onClick(() => {
                        if (this.selectedFolder === "") {
                            new Notice("Pick a valid folder from the list.");
                            return;
                        }

                        const folder = this.app.vault.getAbstractFileByPath(this.selectedFolder);
                        if (folder instanceof TFolder) {
                            let filesToProcess: TFile[];
                            if (this.isRecursive) {
                                filesToProcess = this.getAllTFilesInFolder(folder).filter(f => f.extension === "md");
                            } else {
                                filesToProcess = folder.children.filter((child): child is TFile => child instanceof TFile && child.extension === "md");
                            }

                            if (filesToProcess.length === 0) {
                                new Notice("No Markdown files found in the chosen folder.");
                            } else {
                                this.close();
                                this.onSubmit(filesToProcess);
                            }
                        }
                    });
            });

        void new Setting(contentEl).setHeading().setName("Manual selection");

        void new Setting(contentEl)
            .setName("Search for a specific file")
            .setDesc("Opens a global search to find and process any single file.")
            .addButton(btn => {
                void btn.setButtonText("Search file...")
                    .onClick(() => {
                        this.close();
                        new SingleFileSuggestModal(this.app, this.plugin, this.onSubmit).open();
                    });
            });
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }

    getAllFolders(): TFolder[] {
        const folders: TFolder[] = [];
        const root = this.app.vault.getRoot();
        folders.push(root);

        const iterate = (folder: TFolder) => {
            folder.children.forEach(child => {
                if (child instanceof TFolder) {
                    folders.push(child);
                    iterate(child);
                }
            });
        }
        iterate(root);
        return folders.sort((a, b) => a.path.localeCompare(b.path));
    }

    getAllTFilesInFolder(tfolder: TFolder): TFile[] {
        const allTFiles: TFile[] = [];
        tfolder.children.forEach((child) => {
            if (child instanceof TFile) {
                allTFiles.push(child);
            } else if (child instanceof TFolder) {
                allTFiles.push(...this.getAllTFilesInFolder(child));
            }
        });
        return allTFiles;
    }
}

class SingleFileSuggestModal extends FuzzySuggestModal<TFile> {
    plugin: ReplacePatterns;
    onSubmit: (files: TFile[]) => void;

    constructor(app: App, plugin: ReplacePatterns, onSubmit: (files: TFile[]) => void) {
        super(app);
        this.plugin = plugin;
        this.onSubmit = onSubmit;
        this.setPlaceholder("Type the name of the Markdown file...");
    }

    getItems(): TFile[] {
        return this.app.vault.getMarkdownFiles();
    }

    getItemText(item: TFile): string {
        return item.path;
    }

    onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent) {
        this.onSubmit([item]);
    }
}
