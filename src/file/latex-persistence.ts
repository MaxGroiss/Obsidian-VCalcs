/**
 * @fileoverview LaTeX output persistence to markdown files.
 *
 * This module handles saving and clearing LaTeX calculation outputs directly
 * in the markdown source files. This allows calculation results to be:
 * - Visible when viewing the note outside Obsidian
 * - Preserved across Obsidian restarts
 * - Version controlled with the note content
 *
 * ## File Format
 *
 * LaTeX output is stored within HTML comment markers inside the callout:
 *
 * ```markdown
 * > [!vcalc] My Calculation
 * > ```python
 * > # vcalc: id=abc12345
 * > x = 5
 * > y = x * 2
 * > ```
 * >
 * > <!-- vcalc-output -->
 * > $$
 * > \begin{aligned}
 * > x &= 5 \\
 * > y &= x \cdot 2 = 5 \cdot 2 = 10
 * > \end{aligned}
 * > $$
 * > <!-- /vcalc-output -->
 * ```
 *
 * ## Block Identification
 *
 * Blocks are identified by their zero-based index in the file (nth occurrence
 * of `[!vcalc]`). This index is stored as `data-vcalc-index` on the DOM element
 * during rendering and used when saving/clearing.
 *
 * @module file/latex-persistence
 * @see {@link main#processCalculationCallouts} for where blocks get indexed
 */

import { App, Notice, MarkdownView } from 'obsidian';
import { getErrorMessage } from '../utils/type-guards';
import { NOTICES, CONSOLE } from '../messages';

/**
 * Saves LaTeX output for a specific calculation block to the markdown file.
 *
 * Reads the file, locates the correct block by index, and either inserts
 * new output or replaces existing output. The output is wrapped in HTML
 * comment markers for easy identification.
 *
 * ## Algorithm
 *
 * 1. Read the file and split into lines
 * 2. Scan for the Nth `[!vcalc]` callout (N = blockIndex)
 * 3. Find the end of the code block (closing ```)
 * 4. Check for existing vcalc-output markers
 * 5. If existing output found, remove it (including blank line before)
 * 6. Insert new output lines after the code block
 * 7. Write the modified content back to file
 *
 * @param app - Obsidian App instance for file access
 * @param callout - The callout DOM element (must have data-vcalc-latex and data-vcalc-index)
 * @param sourcePath - Path to the markdown file
 * @param blockTitle - Human-readable title for the Notice message
 *
 * @example
 * ```typescript
 * // Save LaTeX for a block after execution
 * await saveBlockLatexToFile(
 *     app,
 *     calloutEl,
 *     'notes/physics.md',
 *     'Kinematics'
 * );
 * // Shows Notice: 'LaTeX saved for "Kinematics"'
 * ```
 */
export async function saveBlockLatexToFile(
    app: App,
    callout: HTMLElement, 
    sourcePath: string, 
    blockTitle: string
): Promise<void> {
    const latex = callout.getAttribute('data-vcalc-latex');
    const blockIndex = callout.getAttribute('data-vcalc-index');
    
    if (!latex) {
        new Notice(NOTICES.NO_LATEX_TO_SAVE);
        return;
    }

    if (blockIndex === null) {
        new Notice(NOTICES.CANNOT_IDENTIFY_BLOCK);
        return;
    }

    const targetIndex = parseInt(blockIndex, 10);

    try {
        // Read current file content
        let content = await app.vault.adapter.read(sourcePath);
        const lines = content.split('\n');
        
        // Find the Nth vcalc block
        let currentBlockIndex = -1;
        let codeBlockEnd = -1;
        let existingOutputStart = -1;
        let existingOutputEnd = -1;
        let foundBlock = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for vcalc callout start
            if (line.match(/^>\s*\[!vcalc\]/i)) {
                currentBlockIndex++;
                
                if (currentBlockIndex === targetIndex) {
                    // This is our block! Find the code block end and any existing output
                    foundBlock = true;
                    
                    for (let j = i + 1; j < lines.length; j++) {
                        const nextLine = lines[j];
                        
                        // Find end of code block (closing ```)
                        if (nextLine.match(/^>\s*```\s*$/) && codeBlockEnd === -1) {
                            codeBlockEnd = j;
                        }
                        
                        // Find existing output markers
                        if (nextLine.includes('<!-- vcalc-output -->') && existingOutputStart === -1) {
                            existingOutputStart = j;
                        }
                        if (nextLine.includes('<!-- /vcalc-output -->')) {
                            existingOutputEnd = j;
                        }
                        
                        // Stop at non-callout line or next vcalc block
                        if (!nextLine.startsWith('>') && nextLine.trim() !== '') {
                            break;
                        }
                        if (nextLine.match(/^>\s*\[!vcalc\]/i)) {
                            break;
                        }
                    }
                    break;
                }
            }
        }
        
        if (!foundBlock || codeBlockEnd === -1) {
            new Notice(NOTICES.CANNOT_FIND_BLOCK_IN_FILE);
            return;
        }
        
        // Build the output block with callout formatting
        const outputLines = [
            '> ',
            '> <!-- vcalc-output -->',
            '> $$',
            ...latex.split('\n').map((l: string) => `> ${l}`),
            '> $$',
            '> <!-- /vcalc-output -->'
        ];
        
        // Remove existing output if present (including any blank line before it)
        if (existingOutputStart !== -1 && existingOutputEnd !== -1) {
            // Check if there's a blank callout line before the output
            let removeStart = existingOutputStart;
            if (removeStart > 0 && lines[removeStart - 1].match(/^>\s*$/)) {
                removeStart--;
            }
            
            const removeCount = existingOutputEnd - removeStart + 1;
            lines.splice(removeStart, removeCount);
            
            // Adjust codeBlockEnd if it was after the removed section
            if (codeBlockEnd >= removeStart) {
                codeBlockEnd -= removeCount;
            }
        }
        
        // Insert new output after code block
        lines.splice(codeBlockEnd + 1, 0, ...outputLines);
        
        // Write back to file
        await app.vault.adapter.write(sourcePath, lines.join('\n'));
        
        new Notice(NOTICES.LATEX_SAVED(blockTitle));
    } catch (error) {
        console.error(CONSOLE.ERROR_SAVING_LATEX_FILE, error);
        new Notice(NOTICES.ERROR_SAVING_LATEX(getErrorMessage(error)));
    }
}

/**
 * Clears all saved LaTeX outputs from the currently active note.
 *
 * Scans the entire file for vcalc-output markers and removes all sections
 * found. This is useful for cleaning up a note before sharing or when
 * starting fresh with calculations.
 *
 * ## Behavior
 *
 * - Operates on the currently active markdown view
 * - Removes all `<!-- vcalc-output -->...<!-- /vcalc-output -->` sections
 * - Also removes blank callout lines (`> `) immediately before output sections
 * - Shows a Notice with the count of removed outputs
 *
 * @param app - Obsidian App instance for workspace and file access
 *
 * @example
 * ```typescript
 * // Clear all LaTeX from current note (e.g., from a command)
 * await clearAllSavedLatex(app);
 * // Shows Notice: 'Cleared 5 saved LaTeX output(s) from note!'
 * ```
 */
export async function clearAllSavedLatex(app: App): Promise<void> {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
        new Notice(NOTICES.NO_ACTIVE_VIEW);
        return;
    }

    const file = activeView.file;
    if (!file) return;

    try {
        let content = await app.vault.adapter.read(file.path);
        const lines = content.split('\n');
        
        // Find and remove all vcalc-output sections
        let newLines: string[] = [];
        let inOutput = false;
        let removedCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.includes('<!-- vcalc-output -->')) {
                inOutput = true;
                removedCount++;
                // Also remove blank line before output if present
                if (newLines.length > 0 && newLines[newLines.length - 1].match(/^>\s*$/)) {
                    newLines.pop();
                }
                continue;
            }
            
            if (line.includes('<!-- /vcalc-output -->')) {
                inOutput = false;
                continue;
            }
            
            if (!inOutput) {
                newLines.push(line);
            }
        }
        
        if (removedCount > 0) {
            await app.vault.adapter.write(file.path, newLines.join('\n'));
            new Notice(NOTICES.LATEX_CLEARED_COUNT(removedCount));
        } else {
            new Notice(NOTICES.NO_LATEX_IN_NOTE);
        }
    } catch (error) {
        console.error(CONSOLE.ERROR_CLEARING_SAVED_LATEX, error);
        new Notice(NOTICES.ERROR_CLEARING_LATEX(getErrorMessage(error)));
    }
}

/**
 * Clears saved LaTeX output for a specific calculation block.
 *
 * Locates the specified block by index and removes only its output section,
 * leaving other blocks' outputs untouched. Used by the "Clear" button on
 * individual callout blocks.
 *
 * @param app - Obsidian App instance for file access
 * @param sourcePath - Path to the markdown file
 * @param blockIndex - Zero-based index of the vcalc block in the file
 * @param blockTitle - Human-readable title for the Notice message
 *
 * @example
 * ```typescript
 * // Clear LaTeX for a specific block (e.g., from its Clear button)
 * await clearBlockSavedLatex(app, 'notes/physics.md', 2, 'Kinematics');
 * // Shows Notice: 'Cleared saved LaTeX for "Kinematics"'
 * ```
 */
export async function clearBlockSavedLatex(
    app: App,
    sourcePath: string, 
    blockIndex: number, 
    blockTitle: string
): Promise<void> {
    try {
        let content = await app.vault.adapter.read(sourcePath);
        const lines = content.split('\n');
        
        // Find the Nth vcalc block
        let currentBlockIndex = -1;
        let outputStart = -1;
        let outputEnd = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for vcalc callout start
            if (line.match(/^>\s*\[!vcalc\]/i)) {
                currentBlockIndex++;
                
                if (currentBlockIndex === blockIndex) {
                    // Found our block, now find the output section
                    for (let j = i + 1; j < lines.length; j++) {
                        const nextLine = lines[j];
                        
                        if (nextLine.includes('<!-- vcalc-output -->') && outputStart === -1) {
                            outputStart = j;
                            // Check for blank line before
                            if (outputStart > 0 && lines[outputStart - 1].match(/^>\s*$/)) {
                                outputStart--;
                            }
                        }
                        if (nextLine.includes('<!-- /vcalc-output -->')) {
                            outputEnd = j;
                            break;
                        }
                        
                        // Stop at next vcalc block or end of callout
                        if (nextLine.match(/^>\s*\[!vcalc\]/i)) {
                            break;
                        }
                        if (!nextLine.startsWith('>') && nextLine.trim() !== '') {
                            break;
                        }
                    }
                    break;
                }
            }
        }
        
        if (outputStart !== -1 && outputEnd !== -1) {
            lines.splice(outputStart, outputEnd - outputStart + 1);
            await app.vault.adapter.write(sourcePath, lines.join('\n'));
            new Notice(NOTICES.LATEX_CLEARED(blockTitle));
        } else {
            new Notice(NOTICES.NO_LATEX_FOUND);
        }
    } catch (error) {
        console.error(CONSOLE.ERROR_CLEARING_BLOCK_LATEX, error);
        new Notice(NOTICES.ERROR_CLEARING_BLOCK_LATEX(getErrorMessage(error)));
    }
}
