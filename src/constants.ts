import { ReplacePatternsSettings } from "./types";

export const STANDARD_CALLOUTS = [
    "axiom", "definition", "lemma", "proposition", "theorem",
    "corollary", "claim", "assumption", "exm", "exercise",
    "conjecture", "hypothesis", "remark"
];

export const DEFAULT_SETTINGS: ReplacePatternsSettings = {
    clipboardDelay: 900,
    splitPattern: "<!--~-->",
    sourceLinkFormat: '<div style="text-align:right"><a hr' + 'ef="{URI}"><img src="https://cdn.simpleicons.org/obsidian/7C3AED" width="32" height="32" alt="Obsidian icon" style="display:inline-block"></a></div>',
    activeProfile: "Default Settings",
    profiles: [{
        name: "Default Settings",
        translations: {
            "axiom": "Axiom",
            "definition": "Definition",
            "lemma": "Lemma",
            "proposition": "Proposition",
            "theorem": "Theorem",
            "corollary": "Corollary",
            "claim": "Claim",
            "assumption": "Assumption",
            "exm": "Example",
            "exercise": "Exercise",
            "conjecture": "Conjecture",
            "hypothesis": "Hypothesis",
            "remark": "Remark"
        },
        customRules: [
            {
                name: "Proof start",
                integrateRegex: "<!--start proof-->[\\s>]*---[\\s>]*\\*\\*Beweis:\\*\\*",
                integrateFlags: "gm",
                integrateReplacement: "###### `\\start{proof}`",
                exportRegex: "###### `\\\\start\\{proof\\}`",
                exportFlags: "gm",
                exportReplacement: "<!--start proof-->\n\n---\n**Beweis:**"
            },
            {
                name: "Proof end",
                integrateRegex: "<!--end proof-->",
                integrateFlags: "gm",
                integrateReplacement: "`\\stop{proof}`",
                exportRegex: "`\\\\stop\\{proof\\}`",
                exportFlags: "gm",
                exportReplacement: "<!--end proof-->"
            },
            {
                name: "Remove Source Link",
                integrateRegex: "<div style=\"text-align:right\"><a href=\"obsidian:\\/\\/adv-uri\\?vault=[a-zA-Z0-9\\-\\_\\ ]+&uid=[a-zA-Z0-9\\-\\_\\.]+&block=[a-zA-Z0-9]{6}\"><.*?><\\/a><\\/div>",
                integrateFlags: "gm",
                integrateReplacement: "",
                exportRegex: "",
                exportFlags: "gm",
                exportReplacement: ""
            },
            {
                name: "Hide BlockID",
                integrateRegex: "<!--(\\^[a-zA-Z0-9]{6})-->",
                integrateFlags: "gm",
                integrateReplacement: "$1",
                exportRegex: "(\\^[a-zA-Z0-9]{6})",
                exportFlags: "gm",
                exportReplacement: "<!--$1-->"
            },
            {
                name: "Hide Anki Deletion",
                integrateRegex: "<!--❌DELETE❌-->",
                integrateFlags: "gm",
                integrateReplacement: "❌DELETE❌",
                exportRegex: "❌DELETE❌",
                exportFlags: "gm",
                exportReplacement: "<!--❌DELETE❌-->"
            }
        ]
    }]
};

export const REGEX = {
    CALLOUT_START: /^([ \t\xA0>]+)\[!([^\s\x5D|]+)/,
    MARGINNOTE_EMPTY_LINE: /^[ \t\xA0>]*\[\s*]\(marginnote4app:\/\/[^)]+\)[ \t\xA0]*\r?\n/gm,
    MARGINNOTE_INLINE: /\[\s*]\(marginnote4app:\/\/[^)]+\)/g,
    ADV_URI_EMPTY_LINE: /^[ \t\xA0>]*\[[^\x5D]*]\(obsidian:\/\/adv-uri\?[^)]+\)[ \t\xA0]*\r?\n/gm,
    ADV_URI_INLINE: /\[[^\x5D]*]\(obsidian:\/\/adv-uri\?[^)]+\)/g,
    BLOCK_ID_LINE_END: /(?:[ \t\xA0]+)?\^([a-zA-Z0-9-]+)\s*$/,
    BLOCK_ID_ONLY: /^\^[a-zA-Z0-9-]+$/,
    META_TAGS: /^(<!--Tags:|<!--ID:|❌DELETE❌)/
};
