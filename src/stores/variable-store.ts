/**
 * @fileoverview Variable storage and management for VCalc plugin.
 *
 * This module provides the in-memory variable store that tracks all variables
 * across notes and variable sets (vsets). It implements a mixin-style pattern
 * where functions operate on store objects passed as parameters, allowing the
 * main plugin to own the actual storage while this module provides the logic.
 *
 * ## Storage Architecture
 *
 * ```
 * VariableStore (global)
 * └── NoteVariables (per note, keyed by file path)
 *     └── VariableSet (per vset, keyed by vset name)
 *         └── VariableInfo (per variable, keyed by variable name)
 * ```
 *
 * ## Variable Lifecycle
 *
 * 1. **Creation**: When a block executes, new variables are added via `updateVariable()`
 * 2. **Sharing**: Other blocks in the same vset can read variables via `getVariables()`
 * 3. **Cleanup**: When a block re-runs, `removeBlockVariables()` clears its old variables
 * 4. **Deletion**: Entire notes can be cleared via `clearNoteVariables()`
 *
 * ## The "Last Definer Wins" Strategy
 *
 * Each variable tracks which block defined it (`sourceBlockId`). When a block is
 * re-run, we first remove all variables it previously defined, then add the new
 * ones. This ensures that if a user deletes a variable assignment from their code,
 * the variable is properly removed from the store.
 *
 * If Block B redefines a variable originally from Block A, Block B becomes the
 * new owner. This is intuitive: the most recent definition "wins".
 *
 * @module stores/variable-store
 * @see {@link types} for VariableStore, VariableSet, and VariableInfo types
 * @see {@link constants} for VSET_COLORS palette
 *
 * @example
 * ```typescript
 * // In main plugin initialization
 * const variableStore: VariableStore = {};
 * const vsetColors: VSetColorMap = {};
 *
 * // Store a variable from block execution
 * updateVariable(variableStore, 'notes/physics.md', 'main', 'g', 9.81, 'float', 'Constants', 'abc12345');
 *
 * // Retrieve variables for injection into another block
 * const vars = getVariables(variableStore, 'notes/physics.md', 'main');
 *
 * // Clear a block's old variables before re-running
 * removeBlockVariables(variableStore, 'notes/physics.md', 'main', 'abc12345');
 * ```
 */

import { VariableStore, VariableSet, VSetColorMap, VSetColor, VariableValue } from '../types';
import { VSET_COLORS } from '../constants';

// ============================================================================
// VSet Color Management
// ============================================================================

/**
 * Gets the color index for a vset, assigning a new one if needed.
 *
 * Colors are assigned sequentially from the VSET_COLORS palette. Each note
 * has independent color assignments, so 'main' in one note may have a different
 * color than 'main' in another note.
 *
 * When all colors are used, assignment wraps around to reuse colors (modulo
 * the palette length). This ensures we never run out of colors, though some
 * vsets may share colors in notes with many vsets.
 *
 * @param vsetColors - The global vset color mapping
 * @param notePath - Path to the note (e.g., 'folder/note.md')
 * @param vsetName - Name of the variable set (e.g., 'main', 'physics')
 * @returns Index into VSET_COLORS array (0 to VSET_COLORS.length - 1)
 *
 * @example
 * ```typescript
 * const colors: VSetColorMap = {};
 *
 * // First vset gets index 0 (green)
 * getVsetColorIndex(colors, 'note.md', 'main');    // Returns 0
 *
 * // Second vset gets index 1 (blue)
 * getVsetColorIndex(colors, 'note.md', 'physics'); // Returns 1
 *
 * // Same vset returns same index
 * getVsetColorIndex(colors, 'note.md', 'main');    // Returns 0 (cached)
 * ```
 */
export function getVsetColorIndex(
    vsetColors: VSetColorMap,
    notePath: string,
    vsetName: string
): number {
    // Ensure note entry exists
    if (!vsetColors[notePath]) {
        vsetColors[notePath] = {};
    }

    // Assign color if not already assigned
    if (vsetColors[notePath][vsetName] === undefined) {
        // Find the next available color index
        const usedIndices = Object.values(vsetColors[notePath]);
        let nextIndex = 0;
        while (usedIndices.includes(nextIndex)) {
            nextIndex++;
        }
        // Wrap around if we've used all colors
        vsetColors[notePath][vsetName] = nextIndex % VSET_COLORS.length;
    }

    return vsetColors[notePath][vsetName];
}

/**
 * Gets the color definition for a vset.
 *
 * Convenience wrapper around `getVsetColorIndex()` that returns the full
 * color definition (name and RGB values) instead of just the index.
 *
 * @param vsetColors - The global vset color mapping
 * @param notePath - Path to the note (e.g., 'folder/note.md')
 * @param vsetName - Name of the variable set (e.g., 'main', 'physics')
 * @returns VSetColor object with name and rgb properties
 *
 * @example
 * ```typescript
 * const color = getVsetColor(colors, 'note.md', 'physics');
 * // color = { name: 'blue', rgb: '100, 150, 255' }
 *
 * // Use in CSS
 * element.style.borderColor = `rgb(${color.rgb})`;
 * ```
 *
 * @see {@link getVsetColorIndex} for the underlying color assignment logic
 * @see {@link VSET_COLORS} for the available color palette
 */
export function getVsetColor(
    vsetColors: VSetColorMap,
    notePath: string,
    vsetName: string
): VSetColor {
    const index = getVsetColorIndex(vsetColors, notePath, vsetName);
    return VSET_COLORS[index];
}

// ============================================================================
// Variable Store Operations
// ============================================================================

/**
 * Clears all variables for a note.
 *
 * Removes the entire note entry from the variable store, effectively
 * resetting all calculation state for that document. Called when:
 * - User explicitly requests to clear variables
 * - Note is closed (optional cleanup)
 * - User wants to start fresh without restarting Obsidian
 *
 * @param variableStore - The global variable store
 * @param notePath - Path to the note to clear (e.g., 'folder/note.md')
 *
 * @example
 * ```typescript
 * // Clear all variables when user clicks "Clear Variables" button
 * clearNoteVariables(store, activeFile.path);
 * // Now getVariables() will return {} for any vset in this note
 * ```
 */
export function clearNoteVariables(
    variableStore: VariableStore,
    notePath: string
): void {
    delete variableStore[notePath];
}

/**
 * Gets all variables for a specific vset in a note.
 *
 * Returns the complete variable set, or an empty object if the note
 * or vset doesn't exist. This is the primary way blocks access variables
 * defined by other blocks in the same vset.
 *
 * @param variableStore - The global variable store
 * @param notePath - Path to the note (e.g., 'folder/note.md')
 * @param vset - Name of the variable set (e.g., 'main', 'physics')
 * @returns VariableSet containing all variables, or empty object if not found
 *
 * @example
 * ```typescript
 * // Get variables to inject into Python execution
 * const existingVars = getVariables(store, 'physics.md', 'main');
 *
 * // Check if a specific variable exists
 * if (existingVars['gravity']) {
 *     console.log(`Gravity = ${existingVars['gravity'].value}`);
 * }
 *
 * // Iterate over all variables
 * for (const [name, info] of Object.entries(existingVars)) {
 *     console.log(`${name}: ${info.value} (${info.type})`);
 * }
 * ```
 */
export function getVariables(
    variableStore: VariableStore,
    notePath: string,
    vset: string
): VariableSet {
    return variableStore[notePath]?.[vset] || {};
}

/**
 * Sets all variables for a vset, replacing any existing variables.
 *
 * This is a bulk operation that replaces the entire vset. Use `updateVariable()`
 * for adding or updating individual variables, which is more common.
 *
 * @param variableStore - The global variable store
 * @param notePath - Path to the note (e.g., 'folder/note.md')
 * @param vset - Name of the variable set (e.g., 'main', 'physics')
 * @param variables - Complete VariableSet to store
 *
 * @example
 * ```typescript
 * // Bulk import variables (e.g., from saved state)
 * const importedVars: VariableSet = {
 *     'x': { value: 10, type: 'int', blockTitle: 'Setup', sourceBlockId: null, timestamp: Date.now() },
 *     'y': { value: 20, type: 'int', blockTitle: 'Setup', sourceBlockId: null, timestamp: Date.now() }
 * };
 * setVariables(store, 'note.md', 'main', importedVars);
 * ```
 *
 * @see {@link updateVariable} for adding/updating individual variables
 */
export function setVariables(
    variableStore: VariableStore,
    notePath: string,
    vset: string,
    variables: VariableSet
): void {
    // Ensure note entry exists
    if (!variableStore[notePath]) {
        variableStore[notePath] = {};
    }
    variableStore[notePath][vset] = variables;
}

/**
 * Updates or creates a single variable in the store.
 *
 * This is the primary way variables are added during block execution.
 * The function handles creating nested structures as needed (note → vset → variable).
 *
 * The `blockId` parameter is crucial for the "last definer wins" cleanup strategy.
 * When provided, it records which block owns this variable, allowing
 * `removeBlockVariables()` to clean up stale variables when a block is re-run.
 *
 * @param variableStore - The global variable store
 * @param notePath - Path to the note (e.g., 'folder/note.md')
 * @param vset - Name of the variable set (e.g., 'main', 'physics')
 * @param varName - Python variable name (e.g., 'velocity', 'F_gravity')
 * @param value - Computed value (number, string, array, etc.)
 * @param type - Python type name (e.g., 'int', 'float', 'complex')
 * @param blockTitle - Human-readable title of the defining block
 * @param blockId - Optional 8-character block ID for ownership tracking
 *
 * @example
 * ```typescript
 * // Store a variable from block execution
 * updateVariable(
 *     store,
 *     'physics.md',
 *     'main',
 *     'g',
 *     9.81,
 *     'float',
 *     'Physical Constants',
 *     'abc12345'  // Block ID for cleanup tracking
 * );
 *
 * // Store without block ID (legacy or programmatic injection)
 * updateVariable(store, 'note.md', 'main', 'imported_value', 42, 'int', 'External');
 * ```
 *
 * @see {@link removeBlockVariables} for the cleanup counterpart
 */
export function updateVariable(
    variableStore: VariableStore,
    notePath: string,
    vset: string,
    varName: string,
    value: VariableValue,
    type: string,
    blockTitle: string,
    blockId: string | null = null
): void {
    // Ensure nested structure exists
    if (!variableStore[notePath]) {
        variableStore[notePath] = {};
    }
    if (!variableStore[notePath][vset]) {
        variableStore[notePath][vset] = {};
    }

    // Store the variable with metadata
    variableStore[notePath][vset][varName] = {
        value,
        type,
        blockTitle,
        sourceBlockId: blockId,
        timestamp: Date.now()
    };
}

/**
 * Removes all variables that were defined by a specific block.
 *
 * This implements the "last definer wins" cleanup strategy. Before a block
 * adds its new variables, we remove any variables it previously defined.
 * This ensures that if a user deletes a variable assignment from their code
 * and re-runs the block, the variable is properly removed from the store.
 *
 * ## Important Behaviors
 *
 * - Only removes variables where `sourceBlockId` matches the given `blockId`
 * - Variables defined by other blocks are not affected
 * - Variables with `null` sourceBlockId are not affected
 * - Safe to call even if the note/vset/block doesn't exist (no-op)
 *
 * ## Ownership Transfer
 *
 * If Block B redefines a variable originally from Block A:
 * 1. When Block B runs, it calls `updateVariable()` with Block B's ID
 * 2. The variable's `sourceBlockId` changes from Block A to Block B
 * 3. Later, if Block A re-runs, it won't delete this variable (wrong owner)
 * 4. If Block B re-runs, it will delete and re-add the variable
 *
 * @param variableStore - The global variable store
 * @param notePath - Path to the note (e.g., 'folder/note.md')
 * @param vset - Name of the variable set (e.g., 'main', 'physics')
 * @param blockId - 8-character ID of the block whose variables to remove
 *
 * @example
 * ```typescript
 * // Before re-running a block, clean up its old variables
 * removeBlockVariables(store, 'physics.md', 'main', 'abc12345');
 *
 * // Then execute the block and add new variables
 * for (const [name, info] of Object.entries(result.variables)) {
 *     updateVariable(store, 'physics.md', 'main', name, info.value, info.type, 'Block Title', 'abc12345');
 * }
 * ```
 *
 * @see {@link updateVariable} for adding variables with block ownership
 */
export function removeBlockVariables(
    variableStore: VariableStore,
    notePath: string,
    vset: string,
    blockId: string
): void {
    const vsetVars = variableStore[notePath]?.[vset];
    if (!vsetVars) return;

    // Find and remove variables that belong to this block
    for (const varName of Object.keys(vsetVars)) {
        if (vsetVars[varName].sourceBlockId === blockId) {
            delete vsetVars[varName];
        }
    }
}
