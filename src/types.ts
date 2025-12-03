// Type-safe variable value types
export type VariableValue = number | string | boolean | number[] | string[] | null | object;

// Variable storage types
export interface VariableInfo {
    value: VariableValue;
    type: string;
    blockTitle: string;
    timestamp: number;
}

export interface VariableSet {
    [varName: string]: VariableInfo;
}

export interface NoteVariables {
    [vsetName: string]: VariableSet;
}

export interface VariableStore {
    [notePath: string]: NoteVariables;
}

// VSet color tracking per note
export interface VSetColorMap {
    [notePath: string]: { [vsetName: string]: number };
}

// Color definition
export interface VSetColor {
    name: string;
    rgb: string;
}

// Plugin settings
export interface CalcBlocksSettings {
    pythonPath: string;
    showSymbolic: boolean;
    showSubstitution: boolean;
    showResult: boolean;
    autoSaveOnRun: boolean;
    syncAccentWithVset: boolean;
    backgroundStyle: 'default' | 'transparent' | 'subtle' | 'solid';
    compactMode: boolean;
}

// Parsed block options
export interface BlockOptions {
    id: string | null;
    code: string;
    vset: string | null;
    hidden: boolean;
    accentVset: boolean | null;
    bgStyle: string | null;
    compact: boolean | null;
}

// Python execution result with proper typing
export interface PythonResult {
    latex: string;
    variables: { [key: string]: { value: VariableValue; type: string } };
    errors?: string[];
}

// Display options for Python converter
export interface DisplayOptions {
    showSymbolic: boolean;
    showSubstitution: boolean;
    showResult: boolean;
}

// Plugin interfaces for views (properly typed)
import { App } from 'obsidian';

export interface EditorViewPlugin {
    app: App;
    settings: CalcBlocksSettings;
    variableStore: VariableStore;
    getVariables(notePath: string, vset: string): VariableSet | undefined;
    updateVariable(notePath: string, vset: string, varName: string, value: VariableValue, type: string, blockTitle: string): void;
}

export interface VariablesViewPlugin {
    app: App;
    settings: CalcBlocksSettings;
    variableStore: VariableStore;
    vsetColors: VSetColorMap;
    getVsetColor(notePath: string, vsetName: string): VSetColor;
    getVariables(notePath: string, vset: string): VariableSet | undefined;
    clearNoteVariables(notePath: string): void;
}
