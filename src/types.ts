export interface CustomRule {
    name: string;
    integrateRegex: string;
    integrateFlags: string;
    integrateReplacement: string;
    exportRegex: string;
    exportFlags: string;
    exportReplacement: string;
}

export interface Profile {
    name: string;
    translations: Record<string, string>;
    customRules: CustomRule[];
}

export interface ReplacePatternsSettings {
    clipboardDelay: number;
    splitPattern: string;
    splitPatternFlags?: string;
    sourceLinkFormat: string;
    activeProfile: string;
    profiles: Profile[];
    lastScopeFolder?: string;
    lastScopeRecursive?: boolean;
    ankiIdPrefix: string;
    ankiTagsPrefix: string;
    deleteMarker: string;
}
