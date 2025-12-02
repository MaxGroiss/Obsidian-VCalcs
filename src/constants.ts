import { CalcBlocksSettings, VSetColor } from './types';

// Sidebar view identifiers
export const VCALC_VIEW_TYPE = 'vcalc-variables-view';
export const VCALC_EDITOR_VIEW_TYPE = 'vcalc-editor-view';

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
