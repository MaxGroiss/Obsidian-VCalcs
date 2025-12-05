import { VariableStore, VariableSet, VSetColorMap, VSetColor } from '../types';
import { VSET_COLORS } from '../constants';

/**
 * Manages variable storage and vset color assignments.
 * This is a mixin-style module that provides methods to be used by the main plugin.
 */

// Get the color index for a vset, assigning a new one if needed
export function getVsetColorIndex(
    vsetColors: VSetColorMap,
    notePath: string,
    vsetName: string
): number {
    if (!vsetColors[notePath]) {
        vsetColors[notePath] = {};
    }
    
    if (vsetColors[notePath][vsetName] === undefined) {
        // Assign next available color index
        const usedIndices = Object.values(vsetColors[notePath]);
        let nextIndex = 0;
        while (usedIndices.includes(nextIndex)) {
            nextIndex++;
        }
        vsetColors[notePath][vsetName] = nextIndex % VSET_COLORS.length;
    }
    
    return vsetColors[notePath][vsetName];
}

// Get the color for a vset
export function getVsetColor(
    vsetColors: VSetColorMap,
    notePath: string,
    vsetName: string
): VSetColor {
    const index = getVsetColorIndex(vsetColors, notePath, vsetName);
    return VSET_COLORS[index];
}

// Clear all variables for a note
export function clearNoteVariables(
    variableStore: VariableStore,
    notePath: string
): void {
    delete variableStore[notePath];
}

// Get variables for a specific vset
export function getVariables(
    variableStore: VariableStore,
    notePath: string,
    vset: string
): VariableSet {
    return variableStore[notePath]?.[vset] || {};
}

// Set all variables for a vset
export function setVariables(
    variableStore: VariableStore,
    notePath: string,
    vset: string,
    variables: VariableSet
): void {
    if (!variableStore[notePath]) {
        variableStore[notePath] = {};
    }
    variableStore[notePath][vset] = variables;
}

// Update a single variable
export function updateVariable(
    variableStore: VariableStore,
    notePath: string,
    vset: string,
    varName: string,
    value: any,
    type: string,
    blockTitle: string,
    blockId: string | null = null
): void {
    if (!variableStore[notePath]) {
        variableStore[notePath] = {};
    }
    if (!variableStore[notePath][vset]) {
        variableStore[notePath][vset] = {};
    }
    variableStore[notePath][vset][varName] = {
        value,
        type,
        blockTitle,
        sourceBlockId: blockId,
        timestamp: Date.now()
    };
}

// Remove all variables from a specific block in a vset
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
