import { BlockOptions } from '../types';

/**
 * Parse options from a vcalc code block.
 * 
 * NEW FORMAT (preferred):
 * # vcalc: id=abc123 vset=main hidden accent=vset bg=transparent compact
 * 
 * OLD FORMAT (still supported for backward compatibility):
 * # {vset:main, hidden, accent:vset, bg:transparent, compact}
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
        
        // Try NEW FORMAT first: # vcalc: id=abc123 vset=main hidden
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
        // Try OLD FORMAT: # {vset:main, hidden}
        else {
            const optionsMatch = firstLine.match(/#\s*\{([^}]+)\}/);
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
                
                // Parse accent option
                const accentMatch = options.match(/accent:(\w+)/);
                if (accentMatch) {
                    accentVset = accentMatch[1] === 'vset';
                }
                
                // Parse background style
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
    }
    
    return { id, code: cleanCode, vset, hidden, accentVset, bgStyle, compact };
}

/**
 * Get the title text from a callout element.
 */
export function getCalloutTitle(callout: HTMLElement): string {
    const titleInner = callout.querySelector('.callout-title-inner');
    return titleInner?.textContent || 'Calculation';
}

/**
 * Build the vcalc options line for the new format.
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
