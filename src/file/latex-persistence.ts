import { App, Notice, MarkdownView } from 'obsidian';

/**
 * Save LaTeX output for a specific block to the file.
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
        new Notice('No LaTeX output to save. Run the block first.');
        return;
    }

    if (blockIndex === null) {
        new Notice('Could not identify the block. Please run it first.');
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
            new Notice('Could not find the calculation block in file.');
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
        
        new Notice(`LaTeX saved for "${blockTitle}"`);
    } catch (error) {
        console.error('Error saving LaTeX to file:', error);
        new Notice(`Error saving: ${(error as Error).message}`);
    }
}

/**
 * Clear all saved LaTeX from the current note.
 */
export async function clearAllSavedLatex(app: App): Promise<void> {
    const activeView = app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
        new Notice('No active markdown view');
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
            new Notice(`Cleared ${removedCount} saved LaTeX output(s) from note!`);
        } else {
            new Notice('No saved LaTeX outputs found in this note.');
        }
    } catch (error) {
        console.error('Error clearing saved LaTeX:', error);
        new Notice(`Error: ${(error as Error).message}`);
    }
}

/**
 * Clear saved LaTeX for a specific block.
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
            new Notice(`Cleared saved LaTeX for "${blockTitle}"`);
        } else {
            new Notice('No saved LaTeX found for this block.');
        }
    } catch (error) {
        console.error('Error clearing block LaTeX:', error);
        new Notice(`Error: ${(error as Error).message}`);
    }
}
