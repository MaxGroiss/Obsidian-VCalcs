/**
 * @fileoverview Parser for VCalc callout block options.
 *
 * This module extracts configuration from VCalc code blocks by parsing the
 * special options comment that can appear on the first line of the code.
 *
 * ## Options Line Format
 *
 * ```
 * # vcalc: id=abc12345 vset=physics hidden accent=vset bg=transparent compact
 * ```
 *
 * All options are optional. When absent, defaults are used or the global
 * settings apply. The options line is stripped from the code before execution.
 *
 * ## Available Options
 *
 * | Option | Format | Description |
 * |--------|--------|-------------|
 * | `id` | `id=abc12345` | 8-char block identifier for tracking |
 * | `vset` | `vset=name` | Variable set name for sharing variables |
 * | `hidden` | `hidden` | Hide code, show only LaTeX output |
 * | `accent` | `accent=vset\|default` | Override accent color sync setting |
 * | `bg` | `bg=transparent\|subtle\|solid` | Override background style |
 * | `compact` | `compact` | Override compact mode setting |
 *
 * @module callout/parser
 * @see {@link types#BlockOptions} for the parsed options structure
 * @see {@link buildOptionsLine} for serializing options back to string
 */

import { BlockOptions } from '../types';

/**
 * Parses block options from a VCalc callout's code block.
 *
 * Extracts the options comment from the first line of code (if present) and
 * returns a structured object containing all parsed options plus the clean
 * code with the options line removed.
 *
 * ## Parsing Behavior
 *
 * - Options line must start with `# vcalc:` (case-sensitive)
 * - Unknown options are silently ignored (forward compatibility)
 * - Missing code block returns empty defaults
 * - Options line is stripped from returned code
 *
 * @param callout - The callout DOM element containing the code block
 * @returns Parsed options and clean code, or defaults if parsing fails
 *
 * @example
 * ```typescript
 * // Given this code block in a callout:
 * // # vcalc: id=abc12345 vset=physics hidden
 * // g = 9.81
 * // F = m * g
 *
 * const options = parseVsetFromCodeBlock(calloutEl);
 * // options = {
 * //   id: 'abc12345',
 * //   code: 'g = 9.81\nF = m * g',
 * //   vset: 'physics',
 * //   hidden: true,
 * //   accentVset: null,
 * //   bgStyle: null,
 * //   compact: null
 * // }
 * ```
 *
 * @example
 * ```typescript
 * // Code block without options line:
 * // x = 5
 * // y = x * 2
 *
 * const options = parseVsetFromCodeBlock(calloutEl);
 * // options.id = null (will be auto-generated later)
 * // options.code = 'x = 5\ny = x * 2'
 * // options.vset = null (uses default 'main')
 * ```
 *
 * @see {@link buildOptionsLine} for the inverse operation
 */
export function parseVsetFromCodeBlock(callout: HTMLElement): BlockOptions {
    const codeBlock = callout.querySelector('pre > code');
    if (!codeBlock) {
        return {
            id: null,
            code: '',
            vset: null,
            hidden: false,
            accentVset: null,
            bgStyle: null,
            compact: null
        };
    }

    const code = codeBlock.textContent || '';
    const lines = code.split('\n');

    let id: string | null = null;
    let vset: string | null = null;
    let hidden = false;
    let accentVset: boolean | null = null;
    let bgStyle: string | null = null;
    let compact: boolean | null = null;
    let cleanCode = code;

    if (lines.length > 0) {
        const firstLine = lines[0].trim();

        // Parse format: # vcalc: id=abc123 vset=main hidden
        if (firstLine.startsWith('# vcalc:')) {
            const optionsPart = firstLine.substring(8).trim(); // Remove "# vcalc:"

            // Parse id=xxx
            const idMatch = optionsPart.match(/id=(\w+)/);
            if (idMatch) {
                id = idMatch[1];
            }

            // Parse vset=xxx
            const vsetMatch = optionsPart.match(/vset=(\w+)/);
            if (vsetMatch) {
                vset = vsetMatch[1];
            }

            // Parse hidden
            if (/\bhidden\b/.test(optionsPart)) {
                hidden = true;
            }

            // Parse accent=vset or accent=default
            const accentMatch = optionsPart.match(/accent=(\w+)/);
            if (accentMatch) {
                accentVset = accentMatch[1] === 'vset';
            }

            // Parse bg=transparent, bg=subtle, bg=solid
            const bgMatch = optionsPart.match(/bg=(\w+)/);
            if (bgMatch) {
                bgStyle = bgMatch[1];
            }

            // Parse compact
            if (/\bcompact\b/.test(optionsPart)) {
                compact = true;
            }

            // Remove the options line from code
            cleanCode = lines.slice(1).join('\n');
        }
    }

    return { id, code: cleanCode, vset, hidden, accentVset, bgStyle, compact };
}

/**
 * Extracts the title text from a VCalc callout element.
 *
 * The title is the text that appears after `[!vcalc]` in the markdown source,
 * rendered inside the `.callout-title-inner` element. This is used for:
 * - Displaying in the Variables panel (shows which block defined a variable)
 * - Block selection dropdown in the Editor panel
 * - Notice messages (e.g., "LaTeX saved for 'My Calculation'")
 *
 * @param callout - The callout DOM element to extract the title from
 * @returns The title text, or 'Calculation' if no title is found
 *
 * @example
 * ```typescript
 * // Given markdown: > [!vcalc] Physics Constants
 * const title = getCalloutTitle(calloutEl);
 * // title = 'Physics Constants'
 *
 * // Given markdown: > [!vcalc]
 * const title = getCalloutTitle(calloutEl);
 * // title = 'Calculation' (default)
 * ```
 */
export function getCalloutTitle(callout: HTMLElement): string {
    const titleInner = callout.querySelector('.callout-title-inner');
    return titleInner?.textContent || 'Calculation';
}

/**
 * Builds a vcalc options comment line from structured options.
 *
 * This is the inverse of `parseVsetFromCodeBlock()`. It serializes block options
 * into the comment format that can be prepended to Python code in a VCalc block.
 *
 * ## Output Format
 *
 * ```
 * # vcalc: id=abc12345 vset=physics hidden accent=vset bg=transparent compact
 * ```
 *
 * Only non-null/non-undefined options are included in the output. The `id`
 * parameter is required and always appears first.
 *
 * @param options - The options to serialize
 * @param options.id - Required 8-character block identifier
 * @param options.vset - Optional variable set name
 * @param options.hidden - Whether to hide the code block
 * @param options.accentVset - Accent color sync override (true='vset', false='default')
 * @param options.bgStyle - Background style override
 * @param options.compact - Compact mode override
 * @returns The formatted options comment line
 *
 * @example
 * ```typescript
 * const line = buildOptionsLine({
 *     id: 'abc12345',
 *     vset: 'physics',
 *     hidden: true
 * });
 * // line = '# vcalc: id=abc12345 vset=physics hidden'
 * ```
 *
 * @example
 * ```typescript
 * // All options specified
 * const line = buildOptionsLine({
 *     id: 'xyz98765',
 *     vset: 'main',
 *     hidden: false,
 *     accentVset: true,
 *     bgStyle: 'transparent',
 *     compact: true
 * });
 * // line = '# vcalc: id=xyz98765 vset=main accent=vset bg=transparent compact'
 * // Note: hidden=false is omitted (only true is written)
 * ```
 *
 * @see {@link parseVsetFromCodeBlock} for the inverse operation
 */
export function buildOptionsLine(options: {
    id: string;
    vset?: string | null;
    hidden?: boolean;
    accentVset?: boolean | null;
    bgStyle?: string | null;
    compact?: boolean | null;
}): string {
    const parts = [`id=${options.id}`];
    
    if (options.vset) {
        parts.push(`vset=${options.vset}`);
    }
    if (options.hidden) {
        parts.push('hidden');
    }
    if (options.accentVset !== null && options.accentVset !== undefined) {
        parts.push(`accent=${options.accentVset ? 'vset' : 'default'}`);
    }
    if (options.bgStyle) {
        parts.push(`bg=${options.bgStyle}`);
    }
    if (options.compact) {
        parts.push('compact');
    }
    
    return `# vcalc: ${parts.join(' ')}`;
}
