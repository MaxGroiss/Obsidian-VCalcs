/**
 * @fileoverview Core type definitions for VCalc plugin.
 *
 * This module defines all TypeScript interfaces and types used throughout
 * the VCalc plugin. It serves as the single source of truth for data structures
 * related to variables, settings, block options, and view interfaces.
 *
 * ## Architecture Overview
 *
 * ```
 * VariableStore (per-plugin)
 * └── NoteVariables (per-note, keyed by file path)
 *     └── VariableSet (per-vset, keyed by vset name)
 *         └── VariableInfo (per-variable, keyed by variable name)
 * ```
 *
 * @module types
 * @see {@link stores/variable-store} for variable management functions
 * @see {@link constants} for default settings and constants
 */

import { App } from 'obsidian';

// ============================================================================
// Variable Value Types
// ============================================================================

/**
 * Valid value types that can be stored as calculation variables.
 *
 * These types represent the possible results of Python expressions executed
 * in VCalc blocks. The type system is intentionally broad to accommodate
 * various mathematical and scientific computing outputs.
 *
 * | Type | Use Case | Example |
 * |------|----------|---------|
 * | `number` | Scalar results | `42`, `3.14159` |
 * | `string` | Text or complex numbers | `"hello"`, `"(3+4j)"` |
 * | `boolean` | Logical comparisons | `true`, `false` |
 * | `number[]` | Numeric arrays (NumPy) | `[1, 2, 3]` |
 * | `string[]` | String arrays | `["a", "b"]` |
 * | `null` | Explicit null/None | `null` |
 * | `object` | Structured data | `{x: 1, y: 2}` |
 *
 * @remarks
 * Complex numbers from Python are converted to string representation
 * (e.g., `"(3+4j)"`) since JavaScript doesn't have a native complex type.
 */
export type VariableValue = number | string | boolean | number[] | string[] | null | object;

// ============================================================================
// Variable Storage Types
// ============================================================================

/**
 * Complete information about a stored variable in the calculation context.
 *
 * Variables are created when a VCalc block executes an assignment statement
 * (e.g., `x = 5` or `result = sqrt(a**2 + b**2)`). They persist in memory
 * for the duration of the Obsidian session or until explicitly cleared.
 *
 * @example
 * ```typescript
 * const velocityInfo: VariableInfo = {
 *     value: 9.81,
 *     type: 'float',
 *     blockTitle: 'Physics Constants',
 *     sourceBlockId: 'abc12345',
 *     timestamp: 1703001234567
 * };
 * ```
 */
export interface VariableInfo {
    /**
     * The computed value of the variable.
     *
     * For most calculations, this will be a number. Complex numbers are
     * stored as strings (e.g., `"(3+4j)"`). Arrays from NumPy operations
     * are stored as JavaScript arrays.
     */
    value: VariableValue;

    /**
     * Python type name of the value.
     *
     * Common values: `'int'`, `'float'`, `'complex'`, `'str'`, `'list'`, `'bool'`
     *
     * This is extracted from Python's `type(value).__name__` and displayed
     * in the Variables panel to help users understand their data.
     */
    type: string;

    /**
     * Human-readable title of the block that defined this variable.
     *
     * Extracted from the callout title (e.g., `[!vcalc] My Calculation`
     * yields `"My Calculation"`). Displayed in the Variables panel to
     * help users trace where each variable originated.
     */
    blockTitle: string;

    /**
     * Unique 8-character ID of the block that last defined this variable.
     *
     * Used for the "last definer wins" cleanup strategy:
     * - When a block is re-run, variables with matching `sourceBlockId` are
     *   cleared before adding new variables
     * - This ensures deleted assignments are properly removed
     * - If Block B redefines a variable from Block A, Block B becomes the owner
     *
     * Set to `null` for variables injected programmatically or from legacy blocks.
     *
     * @see {@link stores/variable-store#removeBlockVariables}
     */
    sourceBlockId: string | null;

    /**
     * Unix timestamp (milliseconds) when this variable was last updated.
     *
     * Captured via `Date.now()` at the moment of assignment. Useful for:
     * - Debugging variable update order
     * - Potential future features (variable history, stale detection)
     */
    timestamp: number;
}

/**
 * Collection of variables within a single variable set (vset).
 *
 * A VariableSet is a namespace that allows blocks to share variables.
 * Variables are keyed by their Python identifier name.
 *
 * @example
 * ```typescript
 * const physicsVars: VariableSet = {
 *     'g': { value: 9.81, type: 'float', blockTitle: 'Constants', ... },
 *     'm': { value: 5, type: 'int', blockTitle: 'Setup', ... },
 *     'F': { value: 49.05, type: 'float', blockTitle: 'Calculation', ... }
 * };
 * ```
 */
export interface VariableSet {
    [varName: string]: VariableInfo;
}

/**
 * All variable sets for a single note.
 *
 * Each note can have multiple independent variable sets, allowing users
 * to organize calculations into logical groups (e.g., separate vsets for
 * different problems or sections of a document).
 *
 * @example
 * ```typescript
 * const noteVars: NoteVariables = {
 *     'main': { ... },      // Default vset
 *     'physics': { ... },   // Physics calculations
 *     'circuit': { ... }    // Electrical circuit analysis
 * };
 * ```
 */
export interface NoteVariables {
    [vsetName: string]: VariableSet;
}

/**
 * The complete variable store for the entire plugin.
 *
 * Top-level storage structure that contains all variables across all notes.
 * Variables are scoped by note path to prevent leakage between documents.
 *
 * @remarks
 * This is stored in memory only and does not persist across Obsidian restarts.
 * For persistence, use the "Save to File" feature which embeds LaTeX output
 * directly in the markdown.
 *
 * @example
 * ```typescript
 * const store: VariableStore = {
 *     'folder/physics-notes.md': {
 *         'main': { g: {...}, m: {...} },
 *         'circuit': { R: {...}, C: {...} }
 *     },
 *     'another-note.md': {
 *         'main': { x: {...}, y: {...} }
 *     }
 * };
 * ```
 */
export interface VariableStore {
    [notePath: string]: NoteVariables;
}

// ============================================================================
// VSet Color Types
// ============================================================================

/**
 * Mapping of vset names to color indices for a single note.
 *
 * Colors are assigned dynamically as vsets are created, cycling through
 * the available color palette. This provides visual distinction between
 * different variable sets in the UI.
 *
 * @see {@link VSET_COLORS} in constants.ts for the color palette
 */
export interface VSetColorMap {
    [notePath: string]: {
        /** Maps vset name to index in VSET_COLORS array */
        [vsetName: string]: number;
    };
}

/**
 * Definition of a single vset color.
 *
 * Used for styling vset badges, accent borders, and other UI elements
 * that need to be color-coded by variable set.
 */
export interface VSetColor {
    /**
     * Human-readable color name for debugging and accessibility.
     * @example 'green', 'blue', 'orange'
     */
    name: string;

    /**
     * RGB values as a comma-separated string for use in CSS.
     * Format: `'R, G, B'` where each value is 0-255.
     * @example '100, 200, 150'
     */
    rgb: string;
}

// ============================================================================
// Plugin Settings
// ============================================================================

/**
 * User-configurable settings for the VCalc plugin.
 *
 * These settings are persisted to `.obsidian/plugins/obsidian-vcalc/data.json`
 * and can be modified through the Settings tab in Obsidian.
 *
 * @see {@link DEFAULT_SETTINGS} in constants.ts for default values
 * @see {@link settings.ts} for the settings UI implementation
 */
export interface CalcBlocksSettings {
    // --- Display Options ---

    /**
     * Show the symbolic expression in LaTeX output.
     * @example `z = x + y` (the formula with variable names)
     * @default true
     */
    showSymbolic: boolean;

    /**
     * Show the substituted values in LaTeX output.
     * @example `z = 5 + 10` (formula with values plugged in)
     * @default true
     */
    showSubstitution: boolean;

    /**
     * Show the final computed result in LaTeX output.
     * @example `z = 15` (the answer)
     * @default true
     */
    showResult: boolean;

    // --- Behavior Options ---

    /**
     * Automatically save LaTeX output to file after each run.
     * When enabled, the "Save to File" button behavior happens automatically.
     * @default false
     */
    autoSaveOnRun: boolean;

    /**
     * Sync callout accent color with the vset's assigned color.
     * When enabled, the left border and title of callouts match the vset color.
     * @default false
     */
    syncAccentWithVset: boolean;

    /**
     * Background style for VCalc callout blocks.
     * - `'default'`: Standard Obsidian callout background
     * - `'transparent'`: No background color
     * - `'subtle'`: Very light background tint
     * - `'solid'`: More prominent background
     * @default 'default'
     */
    backgroundStyle: 'default' | 'transparent' | 'subtle' | 'solid';

    /**
     * Enable compact mode with reduced padding and spacing.
     * Useful for dense calculation documents.
     * @default false
     */
    compactMode: boolean;

    /**
     * Key(s) to accept autocomplete suggestions in the editor.
     * - `'tab'`: Only Tab key accepts
     * - `'enter'`: Only Enter key accepts
     * - `'both'`: Either key accepts
     * @default 'tab'
     */
    autocompleteAcceptKey: 'tab' | 'enter' | 'both';

    // --- Callout Button Visibility ---

    /**
     * Show the "Run" button on callout blocks.
     * @default true
     */
    showRunButton: boolean;

    /**
     * Show the "Toggle Code" button to show/hide Python code.
     * @default true
     */
    showToggleCodeButton: boolean;

    /**
     * Show the "Clear" button to remove LaTeX output.
     * @default true
     */
    showClearButton: boolean;

    /**
     * Show the "Copy Block" button to copy the entire callout.
     * @default true
     */
    showCopyBlockButton: boolean;
}

// ============================================================================
// Block Parsing Types
// ============================================================================

/**
 * Parsed options and code from a VCalc callout block.
 *
 * Extracted by parsing the first line of the code block, which may contain
 * a vcalc options comment: `# vcalc: id=abc123 vset=main hidden`
 *
 * @see {@link callout/parser#parseVsetFromCodeBlock}
 *
 * @example
 * ```typescript
 * // Given this code block:
 * // # vcalc: id=abc12345 vset=physics hidden
 * // g = 9.81
 *
 * const options: BlockOptions = {
 *     id: 'abc12345',
 *     code: 'g = 9.81',
 *     vset: 'physics',
 *     hidden: true,
 *     accentVset: null,  // Not specified
 *     bgStyle: null,     // Not specified
 *     compact: null      // Not specified
 * };
 * ```
 */
export interface BlockOptions {
    /**
     * Unique 8-character identifier for this block.
     * Auto-generated if not present in the options line.
     * Used for DOM tracking and variable ownership.
     */
    id: string | null;

    /**
     * The Python code to execute, with the options line removed.
     */
    code: string;

    /**
     * Name of the variable set this block belongs to.
     * Blocks with the same vset share variables.
     * @example 'main', 'physics', 'circuit'
     */
    vset: string | null;

    /**
     * Whether to hide the code block in the rendered output.
     * When true, only the LaTeX output is visible.
     */
    hidden: boolean;

    /**
     * Override for accent color syncing.
     * - `true`: Force sync with vset color
     * - `false`: Force default accent
     * - `null`: Use global setting
     */
    accentVset: boolean | null;

    /**
     * Override for background style.
     * - `'transparent'`, `'subtle'`, `'solid'`: Specific style
     * - `null`: Use global setting
     */
    bgStyle: string | null;

    /**
     * Override for compact mode.
     * - `true`: Force compact
     * - `false`: Force normal spacing (not typically used)
     * - `null`: Use global setting
     */
    compact: boolean | null;
}

// ============================================================================
// Python Execution Types
// ============================================================================

/**
 * Result returned from Python code execution via Pyodide.
 *
 * Contains the rendered LaTeX output and information about all variables
 * that were assigned during execution.
 *
 * @see {@link python/pyodide-executor#pythonToLatexWithVars}
 */
export interface PythonResult {
    /**
     * The generated LaTeX string ready for MathJax rendering.
     * Wrapped in `\begin{aligned}...\end{aligned}` for multi-line equations.
     */
    latex: string;

    /**
     * Variables created or updated during execution.
     * Keyed by Python variable name, containing value and type info.
     */
    variables: {
        [key: string]: {
            /** The computed value */
            value: VariableValue;
            /** Python type name (e.g., 'int', 'float') */
            type: string;
        };
    };

    /**
     * Any errors or warnings generated during execution.
     * Empty array or undefined if execution was successful.
     */
    errors?: string[];
}

/**
 * Options controlling what parts of the equation are shown in LaTeX output.
 *
 * Passed to the Python converter to determine which equation components
 * to include in the rendered output.
 *
 * @example
 * ```typescript
 * // Show only symbolic and result: "z = x + y = 15"
 * const options: DisplayOptions = {
 *     showSymbolic: true,
 *     showSubstitution: false,
 *     showResult: true
 * };
 * ```
 */
export interface DisplayOptions {
    /** Include the symbolic formula (e.g., `z = x + y`) */
    showSymbolic: boolean;

    /** Include the substituted values (e.g., `z = 5 + 10`) */
    showSubstitution: boolean;

    /** Include the final result (e.g., `z = 15`) */
    showResult: boolean;
}

// ============================================================================
// View Plugin Interfaces
// ============================================================================

/**
 * Plugin interface exposed to the Editor View sidebar panel.
 *
 * Defines the subset of plugin functionality that the editor view needs
 * to access. This abstraction allows for easier testing and clearer
 * dependency boundaries.
 *
 * @see {@link views/editor-view.ts}
 */
export interface EditorViewPlugin {
    /** Obsidian App instance for workspace and vault access */
    app: App;

    /** Current plugin settings */
    settings: CalcBlocksSettings;

    /** Reference to the global variable store */
    variableStore: VariableStore;

    /**
     * Get all variables for a specific vset in a note.
     * @param notePath - Path to the note file
     * @param vset - Name of the variable set
     * @returns The variable set, or undefined if not found
     */
    getVariables(notePath: string, vset: string): VariableSet | undefined;

    /**
     * Update or create a variable in the store.
     * @param notePath - Path to the note file
     * @param vset - Name of the variable set
     * @param varName - Python variable name
     * @param value - Computed value
     * @param type - Python type name
     * @param blockTitle - Title of the defining block
     * @param blockId - Optional block ID for ownership tracking
     */
    updateVariable(
        notePath: string,
        vset: string,
        varName: string,
        value: VariableValue,
        type: string,
        blockTitle: string,
        blockId?: string | null
    ): void;
}

/**
 * Plugin interface exposed to the Variables View sidebar panel.
 *
 * Defines the subset of plugin functionality that the variables view needs
 * to access for displaying variable information and managing state.
 *
 * @see {@link views/variables-view.ts}
 */
export interface VariablesViewPlugin {
    /** Obsidian App instance for workspace and vault access */
    app: App;

    /** Current plugin settings */
    settings: CalcBlocksSettings;

    /** Reference to the global variable store */
    variableStore: VariableStore;

    /** Color assignments for vsets across all notes */
    vsetColors: VSetColorMap;

    /**
     * Get the color assigned to a vset.
     * @param notePath - Path to the note file
     * @param vsetName - Name of the variable set
     * @returns Color definition for the vset
     */
    getVsetColor(notePath: string, vsetName: string): VSetColor;

    /**
     * Get all variables for a specific vset in a note.
     * @param notePath - Path to the note file
     * @param vset - Name of the variable set
     * @returns The variable set, or undefined if not found
     */
    getVariables(notePath: string, vset: string): VariableSet | undefined;

    /**
     * Clear all variables for a note.
     * Called when user requests to reset the calculation state.
     * @param notePath - Path to the note file
     */
    clearNoteVariables(notePath: string): void;
}
