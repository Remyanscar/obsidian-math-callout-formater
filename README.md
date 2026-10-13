# Formal Callout Formatter for Obsidian

Formal Callout Formatter is an advanced bidirectional clipboard processing pipeline and structural maintenance toolkit for Obsidian. Built to manage metadata-dense vaults, it safely exports clean text out of your notes and integrates it back in, while strictly respecting, preserving, and standardizing your custom architectural blocks.

## 1. The Custom Standard Explained

This plugin is built around a formal standard designed to isolate and group related information into distinct, modular blocks within your notes. By establishing a strict boundary between operational metadata and readable content, this architecture allows notes to carry complex synchronization data without losing clarity. 

This standard is shared with our companion plugin, [Source Mode Decorator](https://github.com/Remyanscar/obsidian-src-mode-decorator), which visually folds and protects these structures inside the editor. Formal Callout Formatter operates at the boundary of this format—acting as the translation and filtering pipeline whenever these blocks leave or re-enter Obsidian.

To understand how Formal Callout Formatter processes text, you must distinguish between the **Information Block** (the container), its **Metadata Header**, and specific **Anki tags**.

### The Grouped Information Block (The Container)
This is the physical boundary of your grouped content:
- **Standard Text Blocks:** Requires an opening `<!--START Md5: [hash]-->` tag and a closing `<!--END Md5: [hash]-->` tag at the bottom to define the container's boundaries. The engine strictly enforces **exact hash matching** between the START and END tags to prevent structural leaks if blocks overlap or are nested.
- **Formal Callout Blocks:** Requires only the opening `<!--START Md5: [hash]-->` tag. The content within consists of formal LaTeX-like theorem environments (e.g., `> [!theorem|id]`) managed alongside [LaTeX-like Theorem & Equation Referencer](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer). The engine does not need a closing `END Md5` tag because it treats the continuous Markdown quote syntax (`> `) and any trailing metadata lines (like Anki tags) as the block's natural boundary, terminating when regular text begins.

*The Plugin's Role:* During export, Formal Callout Formatter completely strips these container tags from the clipboard to extract only the pure, relevant content for external tools.

### The Metadata Header
Every Information Block begins with a multi-line Metadata Header:
- It is initiated by the `<!--START Md5: [hash]` tag.
- It spans multiple lines containing raw metadata (such as document titles, modification dates, or page references).
- It is strictly closed by a `-->` marker.
- It is usually followed immediately by a source reference line (e.g., `%% [Link to source](URL) %%`). The plugin uses a **flexible regex parser** for these references, meaning you can use any custom label (e.g., `[Source]`, `[File]`, `[Link]`) without breaking the structural boundary recognition.

*The Plugin's Role:* Formal Callout Formatter completely omits the entire Metadata Header and the source reference line during export, treating them as internal vault logic that should not clutter external applications.

### Anki Tags
Your notes may also contain customizable tags from workflows like [Obsidian to Anki](https://github.com/Remyanscar/obsidian-to-anki). The plugin specifically recognizes three types of markers: **Identifier tags** (`<!--ID:`), **Tags markers** (`<!--Tags:`), and **deletion markers** (`DELETE`). *(Note: The exact text for these prefixes is now fully dynamic and can be customized in the plugin settings to match your personal workflow).*

*The Plugin's Role:* Unlike the Metadata Header, these tags are explicitly **preserved** during export so your flashcard tracking does not break. During import, when the plugin recalculates blockquote prefixes (`> `), it explicitly skips these tags to prevent accidental indentation or structural corruption.

## 2. Core Commands Explained

The plugin operates primarily through two dedicated commands that handle the extraction and integration of your text:

### Command: Export (copy modified selected text)
The goal of this command is to extract pure, standalone information while ensuring it can always find its way back to your vault.
- **Clean Extraction:** The plugin determines whether it is exporting a Standard Text Block or a Formal Callout Block. It actively strips away structural `Md5` boundaries, the Metadata Header, and (for callouts) Markdown quote prefixes (`> `) to produce flat, readable prose.
- **Absolute Link Conversion:** The engine specifically targets native `[[Wikilinks]]` (standard Markdown file links are intentionally ignored) and translates them into absolute URLs based on the file type. For standard Markdown notes, it checks the target file's frontmatter and automatically generates a permanent, unique identifier (`id: [UUID]`) if one does not exist, creating an unbreakable `obsidian://adv-uri` link (requires the [Obsidian Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri) plugin). For attachments and media files (e.g., images, PDFs) that cannot store metadata, it intelligently falls back to Obsidian's native `obsidian://open` protocol, ensuring all media references remain fully clickable in your external tools.
- **Deep Source Linking:** It scans the selection for the nearest block reference (`^id`), combining it with the active file's UID to generate a clickable HTML Source Link. This is copied to the clipboard last, providing a one-click return button from your external app directly to the specific paragraph in Obsidian.
- **Callout Translation & Macro Execution:** In Callout Mode, the plugin deconstructs the formal LaTeX-like environment syntax required by [LaTeX-like Theorem & Equation Referencer](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer) (e.g., `> [!theorem|custom-id] Title`) into a flat, readable string. The parser strips the markdown blockquote and callout brackets, then queries your active Profile to translate the canonical environment name into a localized version (e.g., converting `theorem` to `thm`). Next, it flattens any pipe-delimited identifiers (`|custom-id`) into a clean, space-separated format. The title is then extracted, sanitized (internal commas are converted to semicolons to prevent data field conflicts in external tools), and appended to the header using a semicolon separator. Finally, the pipeline sequentially executes your custom Export Regex macros to handle remaining structures.
- **Granularity Restoration (Clipboard Chunking):** Continuous blocks of text in Obsidian often contain multiple logical sub-elements. To make this data usable in external tools that require discrete inputs, the plugin slices the body using your configured Split Pattern (e.g., `%%~%%`). Before slicing, it dynamically isolates the block's header (Markdown heading or Callout line). If no formal header syntax is detected, header extraction is bypassed. These elements are pushed to the OS clipboard in a strict, delay-throttled sequence: first the sliced text chunks, then the source link, and finally the isolated header (if present). This populates your clipboard history with distinct items, perfectly ordered for pasting into separate fields.

### Command: Import integration (replace patterns in selected text)
This command safely merges externally modified or annotated text back into Obsidian's rigid structures without corrupting metadata or formatting.
- **Macro Execution & Artifact Cleanup:** The pipeline first executes your profile's sequential Integration Regex macros, cleaning incoming text by removing external OCR artifacts or converting external markers back into vault syntax.
- **Callout Environment Reconstruction:** In Callout Mode, the plugin reconstructs the formal LaTeX-like environment syntax required by [LaTeX-like Theorem & Equation Referencer](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer). When text returns from external applications, structural characters are often degraded—for example, pipe delimiters might be simplified into whitespace (e.g., `[!thm custom-id]`). The parser captures this trailing identifier and reinserts the required pipe (`|`) before the closing bracket to produce `[!thm|custom-id]`, while perfectly preserving any collapse flags (`+`/`-`). Next, it queries your active Profile's reverse translation map to restore localized names or shorthand aliases back to their canonical Obsidian environments (e.g., mapping `thm` back to `theorem`, resulting in `> [!theorem|custom-id]`). Finally, if external tools enclosed the title in square brackets (e.g., `[Title]`), the engine extracts the raw text and seamlessly appends it as an unbracketed string, ensuring strict compliance with Obsidian's native standard.
- **Strict Wikilink Reconstitution:** The parser scans incoming text for external Obsidian links and reconstructs them into clean, native `[[Wikilinks]]`. It handles two distinct link types: for markdown notes (`obsidian://adv-uri`), it extracts the UUID and queries Obsidian's internal `metadataCache` to securely locate the file (even if it was renamed) and appends any block references (`#^id`). For attachments like images or PDFs exported via the fallback protocol (`obsidian://open`), it extracts the target filename directly from the URL parameter, ensuring all your media links are fully restored alongside your text.
- **Splitter & Boundary Cleanup:** Leftover chunk splitters returning from external apps are automatically purged. The engine removes trailing occurrences of your configured Split Pattern (e.g., `%%~%%`) before the `<!--END Md5:` tag in Text Mode, or strips them cleanly from the tail of a Callout Block.
- **Smart Quote Prefixing & Meta Tag Protection:** In Callout Mode, the plugin runs a context-aware line scanner that prepends `> ` to content lines and maintains empty lines within paragraphs. Crucially, it detects and preserves `isMeta` lines (such as Anki tags `<!--ID:`, `<!--Tags:`, or `DELETE`), skipping them entirely to prevent destructive double-indentation. If the cursor selection began mid-line, it also skips prefixing that first line to protect surrounding syntax.
- **Selection & Scroll Preservation:** Positional shifts caused by prepended quotes, regex substitutions, and reconstructed links are calculated line-by-line. The plugin applies mathematical shift compensation to accurately restore your active editor selection and viewport scroll position.

## 3. Document Standardization & Batch Processing

Beyond clipboard pipelines, Formal Callout Formatter includes maintenance commands to enforce vault-wide spacing rules and maintain the structural integrity of your formal callout environments.

### Format Block Spacing
Maintains clean visual structure and removes formatting decay across your vault:
- **Block-Aware Spacing:** Enforces exactly **3 blank lines** between structural `Md5` blocks and **1 blank line** after horizontal rules (`***`). The parser also enforces **strict boundary cutoffs** for Formal Callout Blocks, instantly terminating the block scope upon encountering any clean text or empty line lacking a quote prefix (`> `), preventing format bleeding.
- **Whitespace Cleanup:** Trims unnecessary empty lines at the boundaries of text chunks while leaving internal paragraph line breaks intact.
- **Editor Stability:** Modifies the document buffer without resetting your cursor coordinates or causing viewport jumps.

### Standardize Formal Callout IDs
Within our standard, Formal Callout Blocks represent theorem-like environments managed by [LaTeX-like Theorem & Equation Referencer](https://github.com/RyotaUshio/obsidian-latex-theorem-equation-referencer). For that plugin to index, automatically number (e.g., *Theorem 1.1*), and cross-reference these callouts, each block must terminate with a dedicated block identifier (`^id`). This command automates that structural requirement:
- **Targeted Environment Matching:** Scans exclusively for the 13 canonical formal environment types defined by the standard (`axiom`, `definition`, `lemma`, `proposition`, `theorem`, `corollary`, `claim`, `assumption`, `exm`, `exercise`, `conjecture`, `hypothesis`, `remark`), ignoring generic Obsidian callouts (like `[!note]` or `[!tip]`).
- **Repositions Buried IDs:** Scans each callout from the bottom up. If an existing `> ^id` reference is trapped higher in the callout body, the parser removes it from the text and relocates it to the canonical bottom position.
- **Collision-Free Generation:** If an identifier is missing entirely, the engine generates a random 6-character hexadecimal block ID (e.g., `^a1b2c3`), validating against Obsidian's `metadataCache.blocks` and document content to guarantee vault uniqueness.
- **Parser Spacing Compliance:** Formats the callout base by appending an empty quote prefix (`> `) followed by the block ID line (`> ^id`), satisfying the spacing requirements of the theorem referencer.
- **Anki Tag Proximity:** Look-ahead logic inspects lines immediately following the callout. If trailing Anki markers (`<!--Tags:`, `<!--ID:`, `DELETE`) are detected, any intervening blank lines are stripped, keeping flashcard metadata directly adjacent to the theorem block to prevent broken card tracking.

### Scoped Batch Operations
Both standardization tools can be run across multiple files via the **Scope Modal**:
- **Targeting Modes:** Process the active file, search for any single note vault-wide using a fuzzy finder, or choose a folder (with an optional recursive toggle for nested subdirectories).
- **Persistent Preferences:** Includes a toggle to remember your chosen folder and recursive setting as the default scope for future runs.
- **Headless Background Writes:** Batch tasks run headlessly using Obsidian's atomic `vault.process` API, preventing UI freezes, avoiding file conflicts, and presenting a summary notice of modified files upon completion.

## 4. Profiles & Custom Regex Macros

Adapt the plugin to different workflows using the Profile Management system:
- **Callout Translations:** Define bidirectional mappings between formal environment names (e.g., exporting `theorem` as `Satz` or `thm`, and seamlessly reversing it upon import).
- **Custom Regex Macros:** Define sequential rules (with custom regex flags) applied during Export or Integration to strip OCR artifacts, hide Block IDs, or transform syntax (such as converting between LaTeX proof environments and markdown headers).
- **Portability:** Export and import entire Profiles, Translations, and Rule sets via clipboard JSON.

## 5. Configuration & Installation

### Requirements
- **[Obsidian Advanced URI](https://github.com/Vinzent03/obsidian-advanced-uri)**: Required to allow external applications to properly resolve and open the `obsidian://adv-uri` permanent links generated by this plugin.

### Settings
Navigate to **Settings > Formal Callout Formatter** to configure:
- **Clipboard copy delay (ms):** Adjust the delay between chunk exports (Default: `900`).
- **Split pattern (regex):** Define the text string used as your chunk separator (Default: `%%~%%`).
- **Split pattern flags:** Regexp flags for the split pattern (Default: `m`).
- **Source link format:** The HTML template for the back-to-obsidian button (uses `{URI}`).
- **Anki integration:** Define custom text markers for Anki IDs, Tags, and Deletion flags to match your personal flashcard workflow.
- **Profile Management:** Switch active profiles and manage JSON rule imports.

### Manual Installation

Copy over `main.js` and `manifest.json` to your vault `VaultFolder/obsidian/plugins/obsidian-math-callout-formater/`.
