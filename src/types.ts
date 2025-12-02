// Variable storage types
export interface VariableInfo {
    value: any;
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
    code: string;
    vset: string | null;
    hidden: boolean;
    accentVset: boolean | null;
    bgStyle: string | null;
    compact: boolean | null;
}

// Python execution result
export interface PythonResult {
    latex: string;
    variables: { [key: string]: { value: any; type: string } };
}

// Display options for Python converter
export interface DisplayOptions {
    showSymbolic: boolean;
    showSubstitution: boolean;
    showResult: boolean;
}
