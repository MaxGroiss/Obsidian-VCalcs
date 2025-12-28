/**
 * @fileoverview Shared constants and utility functions for VCalc plugin.
 *
 * This module centralizes all magic numbers, string constants, and configuration
 * values used throughout the plugin. By keeping these in one place, we:
 * - Avoid "magic numbers" scattered throughout the codebase
 * - Make it easy to tune timing and limits
 * - Provide clear documentation for each value's purpose
 *
 * ## Constant Categories
 *
 * - **View Identifiers**: Unique IDs for Obsidian sidebar views
 * - **DOM Attributes**: Data attributes used for block tracking
 * - **Autocomplete Keywords**: Math functions, constants, Greek letters
 * - **Colors**: VSet color palette for visual distinction
 * - **Timing**: Delays and intervals (all in milliseconds)
 * - **Limits**: Retry counts and search boundaries
 * - **UI Config**: Formatting and display settings
 * - **Default Settings**: Initial plugin configuration
 *
 * @module constants
 * @see {@link types} for type definitions used here
 */

import { CalcBlocksSettings, VSetColor } from './types';

// ============================================================================
// View Identifiers
// ============================================================================

/**
 * Unique identifier for the Variables sidebar view.
 *
 * Used when registering the view with Obsidian and when activating it.
 * Must be unique across all installed plugins.
 *
 * @see {@link views/variables-view.ts}
 */
export const VCALC_VIEW_TYPE = 'vcalc-variables-view';

/**
 * Unique identifier for the Editor sidebar view.
 *
 * Used when registering the view with Obsidian and when activating it.
 * Must be unique across all installed plugins.
 *
 * @see {@link views/editor-view.ts}
 */
export const VCALC_EDITOR_VIEW_TYPE = 'vcalc-editor-view';

// ============================================================================
// DOM Attributes
// ============================================================================

/**
 * HTML data attribute used to store block IDs on DOM elements.
 *
 * Applied to callout elements to enable ID-based block tracking.
 * This survives Obsidian's DOM re-renders better than storing
 * direct element references.
 *
 * @example
 * ```html
 * <div class="callout" data-vcalc-id="abc12345">...</div>
 * ```
 *
 * @example
 * ```typescript
 * // Finding a block by ID
 * const block = document.querySelector(`[${VCALC_ID_ATTRIBUTE}="${blockId}"]`);
 * ```
 */
export const VCALC_ID_ATTRIBUTE = 'data-vcalc-id';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generates a unique 8-character alphanumeric ID for a VCalc block.
 *
 * IDs are used for:
 * - DOM element tracking (survives re-renders)
 * - Variable ownership ("last definer wins" cleanup)
 * - Editor panel ↔ callout block synchronization
 *
 * ## Collision Probability
 *
 * With 36 characters (a-z, 0-9) and 8 positions:
 * - Total combinations: 36^8 ≈ 2.8 trillion
 * - For 1000 blocks, collision probability ≈ 0.00000018%
 *
 * @returns An 8-character lowercase alphanumeric string
 *
 * @example
 * ```typescript
 * const blockId = generateVCalcId(); // e.g., 'a7xk2m9p'
 * ```
 */
export function generateVCalcId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// ============================================================================
// Autocomplete Keywords
// ============================================================================

/**
 * Mathematical functions available in VCalc calculations.
 *
 * These are provided by Python's `math` module and are available
 * without any import statement in VCalc blocks. Shown in editor
 * autocomplete when user types a matching prefix.
 *
 * @see https://docs.python.org/3/library/math.html
 */
export const MATH_FUNCTIONS = [
    'sqrt',   // Square root: sqrt(x)
    'abs',    // Absolute value: abs(x)
    'sin',    // Sine (radians): sin(x)
    'cos',    // Cosine (radians): cos(x)
    'tan',    // Tangent (radians): tan(x)
    'log',    // Natural logarithm: log(x)
    'log10',  // Base-10 logarithm: log10(x)
    'exp',    // Exponential: exp(x) = e^x
    'asin',   // Inverse sine: asin(x)
    'acos',   // Inverse cosine: acos(x)
    'atan',   // Inverse tangent: atan(x)
    'pow',    // Power: pow(x, y) = x^y
    'floor',  // Round down: floor(x)
    'ceil',   // Round up: ceil(x)
    'round'   // Round to nearest: round(x)
];

/**
 * Mathematical constants available in VCalc calculations.
 *
 * These are provided by Python's `math` module. Note that `pi` appears
 * in both this list and GREEK_LETTERS - this is intentional as users
 * may want either the constant value or the Greek letter display.
 */
export const MATH_CONSTANTS = [
    'pi',  // π ≈ 3.14159265...
    'e'    // Euler's number ≈ 2.71828182...
];

/**
 * Greek letter variable names for mathematical notation.
 *
 * When used as variable names, these are automatically converted to
 * their LaTeX Greek letter equivalents in the rendered output.
 *
 * ## Lowercase (24 letters)
 * α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω
 *
 * ## Uppercase (commonly used, 10 letters)
 * Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω
 *
 * @example
 * ```python
 * alpha = 0.5      # Renders as: α = 0.5
 * Gamma_L = 0.25   # Renders as: Γ_L = 0.25
 * ```
 */
export const GREEK_LETTERS = [
    // Lowercase Greek letters
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'omicron', 'pi', 'rho',
    'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    // Uppercase Greek letters (commonly used in math/physics)
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Phi', 'Psi', 'Omega'
];

// ============================================================================
// Color Palette
// ============================================================================

/**
 * Color palette for variable set (vset) visual identification.
 *
 * Colors are assigned to vsets in order as they're created. When all
 * colors are used, assignment wraps around to the beginning.
 *
 * These colors are chosen to:
 * - Be visually distinct from each other
 * - Work well in both light and dark themes
 * - Provide good contrast for accessibility
 *
 * Used for:
 * - Vset badges in the Variables panel
 * - Accent borders on callout blocks (when syncAccentWithVset is enabled)
 * - Block selector dropdown indicators
 *
 * @see {@link VSetColor} for the type definition
 * @see {@link stores/variable-store#getVsetColor} for color assignment logic
 */
export const VSET_COLORS: VSetColor[] = [
    { name: 'green',  rgb: '100, 200, 150' },
    { name: 'blue',   rgb: '100, 150, 255' },
    { name: 'orange', rgb: '255, 160, 80' },
    { name: 'purple', rgb: '180, 130, 255' },
    { name: 'teal',   rgb: '80, 200, 200' },
    { name: 'pink',   rgb: '255, 130, 180' },
    { name: 'yellow', rgb: '230, 200, 80' },
    { name: 'red',    rgb: '255, 120, 120' },
];

// ============================================================================
// Timing Constants
// ============================================================================

/**
 * Timing constants for async operations and UI interactions.
 *
 * All values are in milliseconds. These have been tuned through testing
 * to balance responsiveness with stability (avoiding race conditions and
 * DOM timing issues).
 *
 * ## Tuning Guidelines
 *
 * - **Too short**: May cause race conditions, flickering, or missed updates
 * - **Too long**: Makes the UI feel sluggish
 * - **Consider**: Different hardware speeds, Obsidian version differences
 *
 * @remarks
 * Using `as const` ensures these are readonly and can be used as literal types.
 */
export const TIMING = {
    /**
     * Delay between running consecutive blocks in "Run All" command.
     *
     * Prevents UI freezing by allowing DOM updates between executions.
     * Also helps ensure variables from earlier blocks are available
     * to later blocks in the correct order.
     */
    INTER_BLOCK_DELAY_MS: 100,

    /**
     * Short delay before saving block changes to file.
     *
     * Batches rapid changes (e.g., multiple quick edits) into a single
     * file write operation.
     */
    BLOCK_SAVE_DELAY_MS: 50,

    /**
     * Duration to show temporary UI feedback.
     *
     * Used for button state changes like "Copy" → "Copied!" before
     * reverting to the original text.
     */
    UI_FEEDBACK_RESET_MS: 2000,

    /**
     * Debounce delay for auto-saving editor changes.
     *
     * Prevents excessive file writes while user is actively typing.
     * Set to 2.5 seconds based on typical typing pause patterns -
     * long enough to avoid mid-word saves, short enough to feel responsive.
     */
    IDLE_SAVE_DELAY_MS: 2500,

    /**
     * Interval for checking if the editor mirror element still exists.
     *
     * Obsidian may re-render the DOM at any time, removing our mirror.
     * This interval checks for orphaned mirrors and re-creates them.
     */
    MIRROR_CHECK_INTERVAL_MS: 300,

    /**
     * Delay before retrying block lookup in DOM.
     *
     * When searching for blocks during editor panel initialization,
     * the DOM may not be fully rendered yet. This delay allows time
     * for Obsidian to complete its rendering pass.
     */
    BLOCK_RETRY_DELAY_MS: 100,

    /**
     * Delay to allow DOM to stabilize after selecting a block.
     *
     * When switching between blocks in the editor panel, Obsidian may
     * trigger re-renders. This delay ensures the DOM is stable before
     * we attempt to connect to the new block.
     */
    DOM_STABILIZATION_DELAY_MS: 150,

    /**
     * Delay after running a block to allow DOM to re-render.
     *
     * Running a block updates the file content, which triggers Obsidian
     * to re-render the markdown. This delay ensures the new LaTeX output
     * is visible before we attempt to scroll to it or update the UI.
     */
    POST_RUN_RERENDER_DELAY_MS: 250,

    /**
     * Delay after writing to file to allow DOM to settle.
     *
     * File writes trigger Obsidian's markdown re-rendering pipeline.
     * This delay ensures all DOM updates are complete before we
     * attempt to interact with the updated content.
     */
    POST_WRITE_SETTLE_DELAY_MS: 300,

    /**
     * Duration to display Obsidian Notice messages.
     *
     * Used for informational messages like "Python ready!" or
     * "LaTeX saved to file". Long enough to read, short enough
     * to not be annoying.
     */
    NOTICE_DURATION_MS: 3000,

    /**
     * Threshold for switching between ms and seconds display.
     *
     * Execution times below this value are shown in milliseconds,
     * above this value in seconds with 1 decimal place.
     */
    MS_SECONDS_THRESHOLD: 1000,
} as const;

// ============================================================================
// Retry Limits
// ============================================================================

/**
 * Maximum retry counts for operations that may need multiple attempts.
 *
 * These prevent infinite loops while allowing transient failures
 * (like DOM not being ready) to resolve naturally.
 */
export const RETRY_LIMITS = {
    /**
     * Maximum retries when waiting for blocks to appear in DOM.
     *
     * During editor panel initialization, blocks may not be immediately
     * available. We retry up to this many times with BLOCK_RETRY_DELAY_MS
     * between attempts.
     */
    MAX_BLOCK_RETRIES: 3,
} as const;

// ============================================================================
// Search Limits
// ============================================================================

/**
 * Limits for searching through files and DOM structures.
 *
 * Prevents excessive searching in large files while still finding
 * what we need in typical use cases.
 */
export const SEARCH_LIMITS = {
    /**
     * Maximum lines to search ahead when looking for block ID.
     *
     * When parsing a file to find a block's ID, we search forward
     * from the callout start. This limits how far we look before
     * giving up - a block's options line should be near the top.
     */
    BLOCK_ID_LOOKAHEAD: 10,
} as const;

// ============================================================================
// UI Configuration
// ============================================================================

/**
 * Configuration constants for UI rendering and formatting.
 *
 * Controls visual aspects like text truncation and font sizing.
 */
export const UI_CONFIG = {
    /**
     * Maximum character length for error messages in the status bar.
     *
     * Longer messages are truncated to prevent the status bar from
     * overflowing or wrapping awkwardly.
     */
    ERROR_MESSAGE_MAX_LENGTH: 50,

    /**
     * Character position to truncate error messages.
     *
     * Set to MAX_LENGTH - 3 to leave room for "..." suffix.
     */
    ERROR_MESSAGE_TRUNCATE_TO: 47,

    /**
     * Font size for the CodeMirror editor in pixels.
     *
     * Chosen to match Obsidian's default code block font size
     * for visual consistency.
     */
    EDITOR_FONT_SIZE_PX: 14,
} as const;

// ============================================================================
// Default Settings
// ============================================================================

/**
 * Default values for all plugin settings.
 *
 * Applied when:
 * - Plugin is first installed
 * - A setting is missing from saved data (e.g., new setting added)
 * - User resets to defaults
 *
 * @see {@link CalcBlocksSettings} for setting descriptions
 * @see {@link settings.ts} for the settings UI
 */
export const DEFAULT_SETTINGS: CalcBlocksSettings = {
    // Display options - show all equation components by default
    showSymbolic: true,
    showSubstitution: true,
    showResult: true,

    // Behavior options - conservative defaults
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
