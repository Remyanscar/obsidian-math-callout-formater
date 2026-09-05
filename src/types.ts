/**
 * Represents a custom Regex replacement rule.
 */
export interface CustomRule {
    name: string;
    integrateRegex: string;
    integrateFlags: string;
    integrateReplacement: string;
    exportRegex: string;
    exportFlags: string;
    exportReplacement: string;
}

/**
 * Represents a user profile containing translations and specific processing rules.
 */
export interface Profile {
    name: string;
    translations: Record<string, string>;
    customRules: CustomRule[];
}

/**
 * Main configuration object for the ReplacePatterns plugin.
 */
export interface ReplacePatternsSettings {
    clipboardDelay: number;
    splitPattern: string;
    sourceLinkFormat: string;
    activeProfile: string;
    profiles: Profile[];
}
