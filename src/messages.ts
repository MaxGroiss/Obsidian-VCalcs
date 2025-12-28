/**
 * @fileoverview Centralized message strings for the VCalc plugin.
 *
 * This module provides a single source of truth for all user-facing text,
 * making it easy to maintain consistency, enable future internationalization,
 * and keep messages separate from application logic.
 *
 * ## Message Categories
 *
 * | Export | Purpose | Display Location |
 * |--------|---------|------------------|
 * | `NOTICES` | Toast notifications | Obsidian Notice popups |
 * | `UI` | Buttons, labels, headings | Throughout the UI |
 * | `TOOLTIPS` | Hover text | Button/element titles |
 * | `STATUS` | Execution feedback | Editor view status bar |
 * | `SETTINGS` | Settings page text | Plugin settings tab |
 * | `CONSOLE` | Debug/error logging | Browser console |
 *
 * ## Usage Pattern
 *
 * ```typescript
 * import { NOTICES, UI, CONSOLE } from './messages';
 *
 * // Static message
 * new Notice(NOTICES.PYTHON_READY);
 *
 * // Dynamic message with interpolation
 * new Notice(NOTICES.VARIABLES_CLEARED(filename));
 *
 * // Console logging
 * console.error(CONSOLE.ERROR_RUNNING_BLOCK, error);
 * ```
 *
 * ## Design Decisions
 *
 * - **Functions for dynamic messages**: Messages with variables are functions
 *   that return strings, allowing type-safe interpolation
 * - **Grouped by context**: Messages are organized by where they appear,
 *   not by feature, making it easier to find related text
 * - **Inline documentation**: Each section documents its trigger conditions
 *   and source location for easy debugging
 *
 * @module messages
 */

// =============================================================================
// NOTICE MESSAGES (Toast notifications shown via Obsidian's Notice API)
// =============================================================================

export const NOTICES = {
    // --------------------------------------------------------------------------
    // Python Environment (shown during Pyodide initialization)
    // Triggered: On plugin load, first time only
    // Location: main.ts onload()
    // --------------------------------------------------------------------------
    PYTHON_LOADING: 'Loading Python environment (first time only)...',
    PYTHON_READY: 'Python environment ready!',

    // --------------------------------------------------------------------------
    // Calculation Execution
    // Triggered: When running calculations via commands or buttons
    // Location: main.ts command handlers, processCallout()
    // --------------------------------------------------------------------------
    CALCULATION_RENDERED: 'Calculation rendered!',
    CALCULATION_UPDATED: 'Calculation updated!',

    // --------------------------------------------------------------------------
    // Run All Blocks
    // Triggered: "Run All VCalc Blocks" command
    // Location: main.ts runAllBlocks()
    // --------------------------------------------------------------------------
    RUNNING_BLOCKS: (count: number) => `Running ${count} VCalc block(s)...`,
    ALL_BLOCKS_EXECUTED: 'All VCalc blocks executed!',

    // --------------------------------------------------------------------------
    // Variables
    // Triggered: "Clear Variables" command
    // Location: main.ts clearVariables command
    // --------------------------------------------------------------------------
    VARIABLES_CLEARED: (filename: string) => `Variables cleared for ${filename}`,

    // --------------------------------------------------------------------------
    // LaTeX Persistence
    // Triggered: Save/Clear LaTeX commands and buttons
    // Location: latex-persistence.ts, main.ts
    // --------------------------------------------------------------------------
    LATEX_SAVED: (blockTitle: string) => `LaTeX saved for "${blockTitle}"`,
    LATEX_SAVED_COUNT: (count: number) => `Saved ${count} LaTeX output(s) to file!`,
    LATEX_CLEARED: (blockTitle: string) => `Cleared saved LaTeX for "${blockTitle}"`,
    LATEX_CLEARED_COUNT: (count: number) => `Cleared ${count} saved LaTeX output(s) from note!`,
    NO_LATEX_TO_SAVE: 'No LaTeX output to save. Run the block first.',
    NO_LATEX_FOUND: 'No saved LaTeX found for this block.',
    NO_LATEX_IN_NOTE: 'No saved LaTeX outputs found in this note.',
    NO_OUTPUTS_TO_SAVE: 'No rendered outputs to save. Run blocks first.',
    CANNOT_IDENTIFY_BLOCK: 'Could not identify the block. Please run it first.',
    CANNOT_FIND_BLOCK_IN_FILE: 'Could not find the calculation block in file.',

    // --------------------------------------------------------------------------
    // Editor View Operations
    // Triggered: Various editor actions (save, run, rename)
    // Location: editor-view.ts
    // --------------------------------------------------------------------------
    CODE_SAVED: 'Code saved to file',
    NO_BLOCK_SELECTED: 'No block selected',
    BLOCK_NOT_FOUND: 'Block not found',
    RUN_BUTTON_NOT_FOUND: 'Run button not found',
    BLOCK_RENAMED: (newTitle: string) => `Block renamed to "${newTitle}"`,
    BLOCK_COPIED: 'Block copied to clipboard (with new ID)',

    // --------------------------------------------------------------------------
    // Cursor/Context Errors
    // Triggered: When command executed outside valid context
    // Location: main.ts runCalculationAtCursor()
    // --------------------------------------------------------------------------
    NO_ACTIVE_VIEW: 'No active markdown view',
    NO_BLOCKS_IN_NOTE: 'No VCalc blocks found in this note',
    CURSOR_NOT_IN_BLOCK: 'Cursor is not inside a calculation block',
    NO_CODE_IN_BLOCK: 'No Python code found in calculation block',

    // --------------------------------------------------------------------------
    // Error Messages (with dynamic content)
    // Triggered: Various error conditions
    // Location: Throughout the codebase
    // --------------------------------------------------------------------------
    ERROR_RUNNING_CALCULATION: (error: string) => `Error running calculation: ${error}`,
    ERROR_RUNNING_ALL_BLOCKS: (error: string) => `Error running all blocks: ${error}`,
    ERROR_SAVING_LATEX: (error: string) => `Error saving LaTeX: ${error}`,
    ERROR_CLEARING_LATEX: (error: string) => `Error clearing LaTeX: ${error}`,
    ERROR_CLEARING_BLOCK_LATEX: (error: string) => `Error clearing block LaTeX: ${error}`,
    ERROR_COPYING_CLIPBOARD: (error: string) => `Error copying to clipboard: ${error}`,
    ERROR_SAVING_FILE: (error: string) => `Error saving to file: ${error}`,
    ERROR_SAVING_BLOCK: (error: string) => `Error saving block: ${error}`,
    ERROR_RENAMING_BLOCK: (error: string) => `Error renaming block: ${error}`,
    ERROR_EXECUTING_CALCULATION: (error: string) => `Error executing calculation: ${error}`,
    ERROR_UPDATING_CALCULATION: (error: string) => `Error updating calculation: ${error}`,

    // Simplified error for user-friendly Notice popup
    CALCULATION_FAILED: 'Calculation failed - check your code',
};

// =============================================================================
// UI LABELS (Button text, headings, labels)
// =============================================================================

export const UI = {
    // --------------------------------------------------------------------------
    // Main Callout Buttons
    // Location: main.ts processCallout() - button bar in each vcalc block
    // --------------------------------------------------------------------------
    BUTTON_RUN: 'Run',
    BUTTON_TOGGLE_CODE: '<🡙>',
    BUTTON_CLEAR_LATEX: '✕',
    BUTTON_COPY_BLOCK: '📋',
    BUTTON_COPY_LATEX: 'Copy LaTeX',
    BUTTON_SAVE_TO_FILE: 'Save to File',

    // Temporary button states after action
    BUTTON_COPIED: 'Copied!',
    BUTTON_SAVED: 'Saved!',

    // --------------------------------------------------------------------------
    // Editor View Buttons & Labels
    // Location: editor-view.ts - VCalc Editor panel
    // --------------------------------------------------------------------------
    EDITOR_LABEL_BLOCK: 'Block:',
    EDITOR_BUTTON_RENAME: '✏️',
    EDITOR_BUTTON_REFRESH: '↻',
    EDITOR_BUTTON_DISCONNECT: 'Disconnect',

    // --------------------------------------------------------------------------
    // LaTeX Source Section
    // Location: main.ts processCallout() - collapsible details element
    // --------------------------------------------------------------------------
    LATEX_SOURCE_SUMMARY: 'LaTeX Source',

    // --------------------------------------------------------------------------
    // Variables View
    // Location: variables-view.ts - Variables sidebar panel
    // --------------------------------------------------------------------------
    VARIABLES_TITLE: 'VCalc Variables',
    VARIABLES_NO_ACTIVE_NOTE: 'No active note',
    VARIABLES_NO_VARIABLES: 'No variables in this set',
    VARIABLES_EQUALS: ' = ',
    VARIABLES_SOURCE_PREFIX: '↳ ',
    VARIABLES_CLEAR_ALL: 'Clear All Variables',

    // --------------------------------------------------------------------------
    // Block Selector States
    // Location: editor-view.ts - dropdown when no blocks available
    // --------------------------------------------------------------------------
    SELECTOR_NO_ACTIVE_NOTE: 'No active note',
    SELECTOR_NO_BLOCKS: 'No VCalc blocks found',

    // --------------------------------------------------------------------------
    // Rename Modal
    // Location: editor-view.ts RenameModal class
    // --------------------------------------------------------------------------
    MODAL_RENAME_TITLE: 'Rename Block',
    MODAL_BUTTON_CANCEL: 'Cancel',
    MODAL_BUTTON_RENAME: 'Rename',

    // --------------------------------------------------------------------------
    // Mirror Indicator
    // Location: editor-view.ts applyMirrorToCallout() - shown in note when editing
    // --------------------------------------------------------------------------
    MIRROR_INDICATOR: '< > Editing in VCalc Editor',

    // --------------------------------------------------------------------------
    // Outdated Badge
    // Location: main.ts - shown when saved output doesn't match current
    // --------------------------------------------------------------------------
    BADGE_OUTDATED: '⚠️ Saved output (outdated) - <em>click Save to update</em>',

    // --------------------------------------------------------------------------
    // Editor Settings Panel
    // Location: editor-view.ts - collapsible block settings panel
    // --------------------------------------------------------------------------
    SETTINGS_PANEL_TOGGLE: '⚙',
    SETTINGS_VSET_LABEL: 'Variable Set',
    SETTINGS_VSET_NONE: '(none)',
    SETTINGS_VSET_CREATE_NEW: '+ New...',
    SETTINGS_BG_LABEL: 'Background',
    SETTINGS_BG_DEFAULT: 'Default',
    SETTINGS_BG_TRANSPARENT: 'Transparent',
    SETTINGS_BG_SUBTLE: 'Subtle',
    SETTINGS_BG_SOLID: 'Solid',
    SETTINGS_COMPACT_LABEL: 'Compact',
    SETTINGS_ACCENT_LABEL: 'Sync Accent',
    SETTINGS_HIDDEN_LABEL: 'Hidden',
    SETTINGS_APPLY_BUTTON: 'Apply',
};

// =============================================================================
// TOOLTIPS (Hover text for buttons and elements)
// =============================================================================

export const TOOLTIPS = {
    // --------------------------------------------------------------------------
    // Editor View Tooltips
    // Location: editor-view.ts - various buttons in the editor panel
    // --------------------------------------------------------------------------
    UNSAVED_CHANGES: 'Unsaved changes',
    RENAME_BLOCK: 'Rename block',
    REFRESH_BLOCK_LIST: 'Refresh block list',
    TOGGLE_SETTINGS: 'Toggle block settings panel',

    // --------------------------------------------------------------------------
    // Callout Tooltips
    // Location: main.ts processCallout() - button tooltips
    // --------------------------------------------------------------------------
    TOGGLE_CODE: 'Toggle Code (add "hidden" to options to persist)',
    CLEAR_SAVED_LATEX: 'Clear saved LaTeX from file',
    COPY_BLOCK: 'Copy block with new ID',
    VSET_BADGE: (vset: string) => `Variable Set: ${vset}`,
};

// =============================================================================
// STATUS BAR MESSAGES (Editor view status bar)
// =============================================================================

export const STATUS = {
    // --------------------------------------------------------------------------
    // Execution Status
    // Location: editor-view.ts updateExecutionStatus()
    // Triggered: After running a block from the editor
    // --------------------------------------------------------------------------
    RUNNING: 'Running...',
    SAVED: 'Saved',

    // Dynamic status messages
    SUCCESS: (timeStr: string, varText: string) => `✓ Executed in ${timeStr} • ${varText}`,
    ERROR: (shortError: string) => `✗ Error: ${shortError}`,

    // Variable count formatting
    VARIABLE_COUNT: (count: number) => count === 1 ? '1 variable used' : `${count} variables used`,

    // Default error message when no specific error available
    EXECUTION_FAILED: 'Execution failed',
    EXECUTION_ERROR: 'Execution error',
};

// =============================================================================
// SETTINGS PAGE (Plugin settings tab)
// =============================================================================

export const SETTINGS = {
    // --------------------------------------------------------------------------
    // Section Headers
    // Location: settings.ts display()
    // --------------------------------------------------------------------------
    HEADER_MAIN: 'VCalc Settings',
    HEADER_BEHAVIOR: 'Behavior',
    HEADER_DISPLAY: 'Display Options',
    HEADER_APPEARANCE: 'Appearance',
    HEADER_VSET_COLORS: 'Variable Set Colors',

    // --------------------------------------------------------------------------
    // Info Banner
    // Location: settings.ts - top of settings page
    // --------------------------------------------------------------------------
    INFO_PYODIDE: '💡 <strong>Python Execution:</strong> VCalc uses Pyodide (Python in WebAssembly) - no Python installation required!',

    // --------------------------------------------------------------------------
    // Setting: Auto-save on Run
    // --------------------------------------------------------------------------
    AUTOSAVE_NAME: 'Auto-save on Run',
    AUTOSAVE_DESC: 'Automatically save LaTeX output to file when running a calculation',

    // --------------------------------------------------------------------------
    // Setting: Show Symbolic Expression
    // --------------------------------------------------------------------------
    SHOW_SYMBOLIC_NAME: 'Show Symbolic Expression',
    SHOW_SYMBOLIC_DESC: 'Show the symbolic form of the equation (e.g., z = x + y)',

    // --------------------------------------------------------------------------
    // Setting: Show Substitution Step
    // --------------------------------------------------------------------------
    SHOW_SUBSTITUTION_NAME: 'Show Substitution Step',
    SHOW_SUBSTITUTION_DESC: 'Show values substituted into the equation (e.g., z = 5 + 10)',

    // --------------------------------------------------------------------------
    // Setting: Show Result
    // --------------------------------------------------------------------------
    SHOW_RESULT_NAME: 'Show Result',
    SHOW_RESULT_DESC: 'Show the final calculated result (e.g., z = 15)',

    // --------------------------------------------------------------------------
    // Setting: Background Style
    // --------------------------------------------------------------------------
    BACKGROUND_NAME: 'Background Style',
    BACKGROUND_DESC: 'Control the background opacity of VCalc blocks',

    // --------------------------------------------------------------------------
    // Setting: Compact Mode
    // --------------------------------------------------------------------------
    COMPACT_NAME: 'Compact Mode',
    COMPACT_DESC: 'Reduce padding and margins for a more compact layout',

    // --------------------------------------------------------------------------
    // Setting: Sync Accent with VSet Color
    // --------------------------------------------------------------------------
    ACCENT_SYNC_NAME: 'Sync Accent with VSet Color',
    ACCENT_SYNC_DESC: 'Match the callout accent (left border and title) color to the variable set color. Can also be set per-block with "accent:vset" or "accent:default".',

    // --------------------------------------------------------------------------
    // Setting: Autocomplete Accept Key
    // --------------------------------------------------------------------------
    AUTOCOMPLETE_KEY_NAME: 'Autocomplete Accept Key',
    AUTOCOMPLETE_KEY_DESC: 'Key to accept autocompletion suggestions in the VCalc Editor \n Needs VCalc Editor restart to take effect',

    // --------------------------------------------------------------------------
    // Callout Button Visibility
    // --------------------------------------------------------------------------
    HEADER_BUTTON_VISIBILITY: 'Callout Buttons',
    SHOW_RUN_BUTTON_NAME: 'Show Run Button',
    SHOW_RUN_BUTTON_DESC: 'Show the Run button on VCalc blocks',
    SHOW_TOGGLE_CODE_NAME: 'Show Toggle Code Button',
    SHOW_TOGGLE_CODE_DESC: 'Show the button to toggle code visibility',
    SHOW_CLEAR_BUTTON_NAME: 'Show Clear Button',
    SHOW_CLEAR_BUTTON_DESC: 'Show the button to clear saved LaTeX output',
    SHOW_COPY_BLOCK_NAME: 'Show Copy Block Button',
    SHOW_COPY_BLOCK_DESC: 'Show the button to copy block with new ID',
};

// =============================================================================
// CONSOLE MESSAGES (Developer/debug messages)
// =============================================================================

export const CONSOLE = {
    // --------------------------------------------------------------------------
    // Plugin Lifecycle
    // Location: main.ts onload(), onunload()
    // --------------------------------------------------------------------------
    PLUGIN_LOADED: 'VCalc plugin loaded',
    PLUGIN_UNLOADED: 'VCalc plugin unloaded',

    // --------------------------------------------------------------------------
    // Pyodide
    // Location: pyodide-executor.ts
    // --------------------------------------------------------------------------
    PYODIDE_LOADED: 'Pyodide loaded successfully in Obsidian/Electron environment',
    PYODIDE_FAILED: 'Failed to load Pyodide:',

    // --------------------------------------------------------------------------
    // Block Operations
    // Location: main.ts, editor-view.ts
    // --------------------------------------------------------------------------
    RUNNING_BLOCK: (blockIndex: number, vset: string | null) =>
        `VCalc: Running block ${blockIndex} with vset: ${vset}`,
    ERROR_RUNNING_BLOCK: 'VCalc: Error running block:',
    ERROR_RUNNING_BLOCK_NUM: (blockNum: number) => `Error running block ${blockNum}:`,
    ERROR_RUNNING_AT_CURSOR: 'VCalc: Error running calculation at cursor:',
    ERROR_RUNNING_ALL: 'VCalc: Error running all blocks:',
    ERROR_SAVING_ALL: 'VCalc: Error saving all LaTeX:',
    ERROR_RUN_AND_SAVE: 'VCalc: Error running and saving all:',
    ERROR_CLEARING_LATEX: 'VCalc: Error clearing saved LaTeX:',
    ERROR_COPYING: 'VCalc: Error copying to clipboard:',
    ERROR_SAVING: 'VCalc: Error saving to file:',
    VCALC_ERROR: 'VCalc error:',

    // --------------------------------------------------------------------------
    // Editor View Errors
    // Location: editor-view.ts
    // --------------------------------------------------------------------------
    COULD_NOT_FIND_BLOCK_SAVE: 'Could not find block to save',
    COULD_NOT_FIND_BLOCK_RENAME: 'Could not find block to rename',
    ERROR_WRITING_FILE: 'Error writing to file:',
    ERROR_RENAMING: 'Error renaming block:',

    // --------------------------------------------------------------------------
    // LaTeX Persistence Errors
    // Location: latex-persistence.ts
    // --------------------------------------------------------------------------
    ERROR_SAVING_LATEX_FILE: 'Error saving LaTeX to file:',
    ERROR_CLEARING_SAVED_LATEX: 'Error clearing saved LaTeX:',
    ERROR_CLEARING_BLOCK_LATEX: 'Error clearing block LaTeX:',
};
