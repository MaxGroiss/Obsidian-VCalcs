import { BlockOptions } from '../types';

/**
 * Parse options from a vcalc code block's first line.
 * 
 * Supported syntax:
 * # {vset:main}
 * # {vset:main, hidden}
 * # {vset:main, hidden, accent:vset, bg:transparent, compact}
 */
export function parseVsetFromCodeBlock(callout: HTMLElement): BlockOptions {
    // Look for the code block's language class which contains the vset parameter
    const codeBlock = callout.querySelector('pre > code');
    if (!codeBlock) {
        return { 
            code: '', 
            vset: null, 
            hidden: false, 
            accentVset: null, 
            bgStyle: null, 
            compact: null 
        };
    }
    
    const code = codeBlock.textContent || '';
    
    // Check the first line of code for a comment with options
    // Examples: # {vset:main} or # {vset:main, hidden, accent:vset, bg:transparent, compact}
    const lines = code.split('\n');
    let vset: string | null = null;
    let hidden = false;
    let accentVset: boolean | null = null;
    let bgStyle: string | null = null;
    let compact: boolean | null = null;
    let cleanCode = code;
    
    // Check first line for vset/options declaration
    if (lines.length > 0) {
        // Match pattern like: # {vset:main} or # {vset:main, hidden} or # {hidden}
        const optionsMatch = lines[0].match(/#\s*\{([^}]+)\}/);
        if (optionsMatch) {
            const options = optionsMatch[1];
            
            // Parse vset
            const vsetMatch = options.match(/vset:(\w+)/);
            if (vsetMatch) {
                vset = vsetMatch[1];
            }
            
            // Parse hidden flag
            if (options.includes('hidden')) {
                hidden = true;
            }
            
            // Parse accent option: accent:vset or accent:default
            const accentMatch = options.match(/accent:(\w+)/);
            if (accentMatch) {
                accentVset = accentMatch[1] === 'vset';
            }
            
            // Parse background style: bg:transparent, bg:subtle, bg:solid
            const bgMatch = options.match(/bg:(\w+)/);
            if (bgMatch) {
                bgStyle = bgMatch[1];
            }
            
            // Parse compact flag
            if (options.includes('compact')) {
                compact = true;
            }
            
            // Remove the options line from code
            cleanCode = lines.slice(1).join('\n');
        }
    }
    
    return { code: cleanCode, vset, hidden, accentVset, bgStyle, compact };
}

/**
 * Get the title text from a callout element.
 */
export function getCalloutTitle(callout: HTMLElement): string {
    const titleInner = callout.querySelector('.callout-title-inner');
    return titleInner?.textContent || 'Calculation';
}
