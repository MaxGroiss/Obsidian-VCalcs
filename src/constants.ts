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

// Timing constants (in milliseconds)
export const TIMING = {
    /** Delay between running blocks in "Run All" to prevent overwhelming the UI */
    INTER_BLOCK_DELAY_MS: 100,

    /** Delay before saving block to file to batch rapid changes */
    BLOCK_SAVE_DELAY_MS: 50,

    /** Duration to show UI feedback (e.g., "Copied!" button text) */
    UI_FEEDBACK_RESET_MS: 2000,

    /** Delay before auto-saving editor changes to prevent excessive writes */
    IDLE_SAVE_DELAY_MS: 2500,

    /** Interval for checking if editor mirror still exists in DOM */
    MIRROR_CHECK_INTERVAL_MS: 300,

    /** Delay before retrying to find blocks in DOM (during initialization) */
    BLOCK_RETRY_DELAY_MS: 100,

    /** Delay to allow DOM to stabilize after selecting a block */
    DOM_STABILIZATION_DELAY_MS: 150,

    /** Delay after running block to allow DOM to re-render */
    POST_RUN_RERENDER_DELAY_MS: 250,

    /** Delay after writing to file to allow DOM to settle */
    POST_WRITE_SETTLE_DELAY_MS: 300,

    /** Duration to show notices (e.g., "Python ready!") */
    NOTICE_DURATION_MS: 3000,

    /** Threshold for displaying time in milliseconds vs seconds */
    MS_SECONDS_THRESHOLD: 1000,
} as const;

// Retry limits
export const RETRY_LIMITS = {
    /** Maximum number of retries when waiting for blocks to appear in DOM */
    MAX_BLOCK_RETRIES: 3,
} as const;

// Lookahead/search limits
export const SEARCH_LIMITS = {
    /** Maximum lines to search ahead when looking for block ID in file */
    BLOCK_ID_LOOKAHEAD: 10,
} as const;

// UI formatting constants
export const UI_CONFIG = {
    /** Maximum length for error messages before truncation */
    ERROR_MESSAGE_MAX_LENGTH: 50,

    /** Length to truncate error messages to (leaving room for "...") */
    ERROR_MESSAGE_TRUNCATE_TO: 47,

    /** Editor font size in pixels */
    EDITOR_FONT_SIZE_PX: 14,
} as const;

// Default plugin settings
export const DEFAULT_SETTINGS: CalcBlocksSettings = {
    showSymbolic: true,
    showSubstitution: true,
    showResult: true,
    autoSaveOnRun: false,
    syncAccentWithVset: false,
    backgroundStyle: 'default',
    compactMode: false,
    autocompleteAcceptKey: 'tab',
    // Callout button visibility - all visible by default
    showRunButton: true,
    showToggleCodeButton: true,
    showClearButton: true,
    showCopyBlockButton: true
};
