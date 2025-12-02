import { CalcBlocksSettings, VSetColor } from './types';

// Sidebar view identifiers
export const VCALC_VIEW_TYPE = 'vcalc-variables-view';
export const VCALC_EDITOR_VIEW_TYPE = 'vcalc-editor-view';

// DOM attributes
export const VCALC_ID_ATTRIBUTE = 'data-vcalc-id';

// Generate a short unique ID (8 characters)
export function generateVCalcId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Autocomplete keywords for the editor
export const MATH_FUNCTIONS = [
    'sqrt', 'abs', 'sin', 'cos', 'tan', 'log', 'log10', 'exp',
    'asin', 'acos', 'atan', 'pow', 'floor', 'ceil', 'round'
];

export const MATH_CONSTANTS = [
    'pi', 'e'
];

export const GREEK_LETTERS = [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho',
    'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'
];

// Color palette for vset badges
export const VSET_COLORS: VSetColor[] = [
    { name: 'green', rgb: '100, 200, 150' },
    { name: 'blue', rgb: '100, 150, 255' },
    { name: 'orange', rgb: '255, 160, 80' },
    { name: 'purple', rgb: '180, 130, 255' },
    { name: 'teal', rgb: '80, 200, 200' },
    { name: 'pink', rgb: '255, 130, 180' },
    { name: 'yellow', rgb: '230, 200, 80' },
    { name: 'red', rgb: '255, 120, 120' },
];

// Default plugin settings
export const DEFAULT_SETTINGS: CalcBlocksSettings = {
    pythonPath: 'python3',
    showSymbolic: true,
    showSubstitution: true,
    showResult: true,
    autoSaveOnRun: false,
    syncAccentWithVset: false,
    backgroundStyle: 'default',
    compactMode: false
};
