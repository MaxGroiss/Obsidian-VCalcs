import { Plugin, MarkdownPostProcessorContext, Notice, MarkdownView, MarkdownRenderer, Component, ItemView, WorkspaceLeaf, PluginSettingTab, Setting, App } from 'obsidian';
import { spawn } from 'child_process';
import * as path from 'path';

// Variable storage types
interface VariableInfo {
    value: any;
    type: string;
    blockTitle: string;
    timestamp: number;
}

interface VariableSet {
    [varName: string]: VariableInfo;
}

interface NoteVariables {
    [vsetName: string]: VariableSet;
}

interface VariableStore {
    [notePath: string]: NoteVariables;
}

// VSet color tracking per note
interface VSetColorMap {
    [notePath: string]: { [vsetName: string]: number };
}

// Color palette for vset badges
const VSET_COLORS = [
    { name: 'green', rgb: '100, 200, 150' },
    { name: 'blue', rgb: '100, 150, 255' },
    { name: 'orange', rgb: '255, 160, 80' },
    { name: 'purple', rgb: '180, 130, 255' },
    { name: 'teal', rgb: '80, 200, 200' },
    { name: 'pink', rgb: '255, 130, 180' },
    { name: 'yellow', rgb: '230, 200, 80' },
    { name: 'red', rgb: '255, 120, 120' },
];

interface CalcBlocksSettings {
    pythonPath: string;
    showSymbolic: boolean;
    showSubstitution: boolean;
    showResult: boolean;
    autoSaveOnRun: boolean;
    syncAccentWithVset: boolean;
    backgroundStyle: 'default' | 'transparent' | 'subtle' | 'solid';
    compactMode: boolean;
}

const DEFAULT_SETTINGS: CalcBlocksSettings = {
    pythonPath: 'python3',
    showSymbolic: true,
    showSubstitution: true,
    showResult: true,
    autoSaveOnRun: false,
    syncAccentWithVset: false,
    backgroundStyle: 'default',
    compactMode: false
};

// Sidebar view identifier
const VCALC_VIEW_TYPE = 'vcalc-variables-view';

export default class CalcBlocksPlugin extends Plugin {
    settings: CalcBlocksSettings;
    
    // Path to our Python converter script (bundled with plugin)
    private converterScript: string;
    
    // Variable storage (in-memory, cleared on note close)
    public variableStore: VariableStore = {};
    
    // VSet color assignments per note (tracks order of appearance)
    public vsetColors: VSetColorMap = {};

    async onload() {
        await this.loadSettings();
        
        // Write the Python converter script to plugin folder
        await this.setupConverterScript();

        // Register the sidebar view
        this.registerView(
            VCALC_VIEW_TYPE,
            (leaf) => new VCalcVariablesView(leaf, this)
        );

        // Add ribbon icon for variable viewer
        this.addRibbonIcon('calculator', 'VCalc Variables', () => {
            this.activateVariablesView();
        });

        // Register the callout post-processor for [!vcalc] blocks
        this.registerMarkdownPostProcessor((element, context) => {
            this.processCalculationCallouts(element, context);
        });

        // Add command to insert a new calculation block
        this.addCommand({
            id: 'insert-calc-block',
            name: 'Insert VCalc Block',
            editorCallback: (editor) => {
                const template = `> [!vcalc] Calculation\n> \`\`\`python\n> # {vset:main}\n> x = 5\n> y = 10\n> z = x + y\n> \`\`\`\n`;
                editor.replaceSelection(template);
            }
        });

        // Add command to run calculation under cursor
        this.addCommand({
            id: 'run-calc-block',
            name: 'Run VCalc Block',
            editorCallback: async (editor, ctx) => {
                const view = ctx instanceof MarkdownView ? ctx : this.app.workspace.getActiveViewOfType(MarkdownView);
                if (view) {
                    await this.runCalculationAtCursor(editor, view);
                }
            }
        });

        // Add command to open variables panel
        this.addCommand({
            id: 'open-variables-panel',
            name: 'Open Variables Panel',
            callback: () => {
                this.activateVariablesView();
            }
        });

        // Add command to clear variables for current note
        this.addCommand({
            id: 'clear-note-variables',
            name: 'Clear Variables for Current Note',
            callback: () => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    this.clearNoteVariables(activeFile.path);
                    new Notice('Variables cleared for ' + activeFile.basename);
                }
            }
        });

        // Add command to run all VCalc blocks in current note
        this.addCommand({
            id: 'run-all-vcalc-blocks',
            name: 'Run All VCalc Blocks',
            callback: async () => {
                await this.runAllBlocks();
            }
        });

        // Add command to save all LaTeX outputs to file
        this.addCommand({
            id: 'save-all-latex',
            name: 'Save All LaTeX to File',
            callback: async () => {
                await this.saveAllLatexToFile();
            }
        });

        // Add command to run all and save all
        this.addCommand({
            id: 'run-and-save-all',
            name: 'Run & Save All VCalc Blocks',
            callback: async () => {
                await this.runAllBlocks();
                await this.saveAllLatexToFile();
            }
        });

        // Add command to clear all saved LaTeX from current note
        this.addCommand({
            id: 'clear-all-saved-latex',
            name: 'Clear All Saved LaTeX from Note',
            callback: async () => {
                await this.clearAllSavedLatex();
            }
        });

        // Listen for file close events to clear variables
        this.registerEvent(
            this.app.workspace.on('file-open', (file) => {
                // Refresh the variables view when switching files
                this.refreshVariablesView();
            })
        );

        // Add settings tab
        this.addSettingTab(new VCalcSettingTab(this.app, this));

        console.log('VCalc plugin loaded');
    }

    // Get or assign a color index for a vset in a specific note
    getVsetColorIndex(notePath: string, vsetName: string): number {
        if (!this.vsetColors[notePath]) {
            this.vsetColors[notePath] = {};
        }
        
        if (this.vsetColors[notePath][vsetName] === undefined) {
            // Assign next available color index
            const usedIndices = Object.values(this.vsetColors[notePath]);
            this.vsetColors[notePath][vsetName] = usedIndices.length % VSET_COLORS.length;
        }
        
        return this.vsetColors[notePath][vsetName];
    }

    getVsetColor(notePath: string, vsetName: string): { name: string, rgb: string } {
        const index = this.getVsetColorIndex(notePath, vsetName);
        return VSET_COLORS[index];
    }

    async activateVariablesView() {
        const { workspace } = this.app;
        
        let leaf = workspace.getLeavesOfType(VCALC_VIEW_TYPE)[0];
        
        if (!leaf) {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VCALC_VIEW_TYPE,
                    active: true,
                });
                leaf = rightLeaf;
            }
        }
        
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    refreshVariablesView() {
        const leaves = this.app.workspace.getLeavesOfType(VCALC_VIEW_TYPE);
        leaves.forEach((leaf) => {
            const view = leaf.view as VCalcVariablesView;
            view.refresh();
        });
    }

    clearNoteVariables(notePath: string) {
        delete this.variableStore[notePath];
        this.refreshVariablesView();
    }

    getVariables(notePath: string, vset: string): VariableSet {
        return this.variableStore[notePath]?.[vset] || {};
    }

    setVariables(notePath: string, vset: string, variables: VariableSet) {
        if (!this.variableStore[notePath]) {
            this.variableStore[notePath] = {};
        }
        this.variableStore[notePath][vset] = variables;
        this.refreshVariablesView();
    }

    updateVariable(notePath: string, vset: string, varName: string, value: any, type: string, blockTitle: string) {
        if (!this.variableStore[notePath]) {
            this.variableStore[notePath] = {};
        }
        if (!this.variableStore[notePath][vset]) {
            this.variableStore[notePath][vset] = {};
        }
        this.variableStore[notePath][vset][varName] = {
            value,
            type,
            blockTitle,
            timestamp: Date.now()
        };
        this.refreshVariablesView();
    }

    async saveBlockLatexToFile(callout: HTMLElement, sourcePath: string, blockTitle: string) {
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
            let content = await this.app.vault.adapter.read(sourcePath);
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
            await this.app.vault.adapter.write(sourcePath, lines.join('\n'));
            
            new Notice(`LaTeX saved for "${blockTitle}"`);
        } catch (error) {
            console.error('Error saving LaTeX to file:', error);
            new Notice(`Error saving: ${(error as Error).message}`);
        }
    }

    async runAllBlocks() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active markdown view');
            return;
        }

        // Get all vcalc callouts in the preview
        const container = activeView.containerEl;
        const callouts = container.querySelectorAll('.callout[data-callout="vcalc"]');
        
        if (callouts.length === 0) {
            new Notice('No VCalc blocks found in this note');
            return;
        }

        new Notice(`Running ${callouts.length} VCalc block(s)...`);
        
        // Get context from the view
        const file = activeView.file;
        if (!file) return;
        
        // Run each block in order
        for (let i = 0; i < callouts.length; i++) {
            const callout = callouts[i] as HTMLElement;
            
            // Assign block index
            callout.setAttribute('data-vcalc-index', String(i));
            
            const { code, vset } = this.parseVsetFromCodeBlock(callout);
            
            if (code.trim()) {
                try {
                    // Create a minimal context
                    const context = {
                        sourcePath: file.path,
                        frontmatter: null,
                        docId: '',
                        getSectionInfo: () => null,
                        addChild: () => {}
                    } as unknown as MarkdownPostProcessorContext;
                    
                    await this.executeAndRender(code, callout, context, vset);
                    
                    // Small delay between blocks to ensure order
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (error) {
                    console.error(`Error running block ${i + 1}:`, error);
                }
            }
        }
        
        new Notice('All VCalc blocks executed!');
    }

    async saveAllLatexToFile() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active markdown view');
            return;
        }

        const file = activeView.file;
        if (!file) return;

        // Get all vcalc callouts that have rendered output
        const container = activeView.containerEl;
        const callouts = container.querySelectorAll('.callout[data-callout="vcalc"]');
        
        let savedCount = 0;
        
        for (const callout of Array.from(callouts)) {
            const latex = callout.getAttribute('data-vcalc-latex');
            if (latex) {
                const titleInner = callout.querySelector('.callout-title-inner');
                const blockTitle = titleInner?.textContent || 'Unnamed Block';
                
                await this.saveBlockLatexToFile(callout as HTMLElement, file.path, blockTitle);
                savedCount++;
                
                // Small delay between saves
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        if (savedCount === 0) {
            new Notice('No rendered outputs to save. Run blocks first.');
        } else {
            new Notice(`Saved ${savedCount} LaTeX output(s) to file!`);
        }
    }

    async clearAllSavedLatex() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active markdown view');
            return;
        }

        const file = activeView.file;
        if (!file) return;

        try {
            let content = await this.app.vault.adapter.read(file.path);
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
                await this.app.vault.adapter.write(file.path, newLines.join('\n'));
                new Notice(`Cleared ${removedCount} saved LaTeX output(s) from note!`);
            } else {
                new Notice('No saved LaTeX outputs found in this note.');
            }
        } catch (error) {
            console.error('Error clearing saved LaTeX:', error);
            new Notice(`Error: ${(error as Error).message}`);
        }
    }

    async clearBlockSavedLatex(sourcePath: string, blockIndex: number, blockTitle: string) {
        try {
            let content = await this.app.vault.adapter.read(sourcePath);
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
                await this.app.vault.adapter.write(sourcePath, lines.join('\n'));
                new Notice(`Cleared saved LaTeX for "${blockTitle}"`);
            } else {
                new Notice('No saved LaTeX found for this block.');
            }
        } catch (error) {
            console.error('Error clearing block LaTeX:', error);
            new Notice(`Error: ${(error as Error).message}`);
        }
    }


    async setupConverterScript() {
        // The Python script will be in the plugin's directory
        const pluginDir = (this.app.vault.adapter as any).basePath + '/.obsidian/plugins/obsidian-calcblocks';
        this.converterScript = path.join(pluginDir, 'python_to_latex.py');
        
        // We'll create this script if it doesn't exist
        // In production, it would be bundled with the plugin
    }

    processCalculationCallouts(element: HTMLElement, context: MarkdownPostProcessorContext) {
        // Find all callouts with [!vcalc] type
        const callouts = element.querySelectorAll('.callout[data-callout="vcalc"]');
        
        callouts.forEach((callout) => {
            this.enhanceCalculationCallout(callout as HTMLElement, context);
        });
    }

    parseVsetFromCodeBlock(callout: HTMLElement): { 
        code: string, 
        vset: string | null, 
        hidden: boolean, 
        accentVset: boolean | null,
        bgStyle: string | null,
        compact: boolean | null
    } {
        // Look for the code block's language class which contains the vset parameter
        // Obsidian renders ```python {vset:main} as a code element with classes
        const codeBlock = callout.querySelector('pre > code');
        if (!codeBlock) return { code: '', vset: null, hidden: false, accentVset: null, bgStyle: null, compact: null };
        
        const code = codeBlock.textContent || '';
        
        // Check the class list for language-python or similar
        // The {vset:xxx} might be in the raw markdown, so we need to parse it
        // from the code block's first line or from the pre element's data attributes
        
        // Method 1: Check if Obsidian put it in a data attribute
        const preEl = callout.querySelector('pre');
        const dataLine = preEl?.getAttribute('data-line') || '';
        
        // Method 2: Check the first line of code for a comment with options
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

    enhanceCalculationCallout(callout: HTMLElement, context: MarkdownPostProcessorContext) {
        // Find the code block inside the callout
        const codeBlock = callout.querySelector('pre > code');
        if (!codeBlock) return;

        // Parse vset and options from code block
        const { vset, hidden, accentVset, bgStyle, compact } = this.parseVsetFromCodeBlock(callout);
        
        // Apply hidden state if specified in code
        const preEl = callout.querySelector('pre');
        if (hidden && preEl) {
            preEl.classList.add('calc-hidden');
        }
        
        // Apply background style (per-block overrides global)
        const effectiveBgStyle = bgStyle || this.settings.backgroundStyle;
        if (effectiveBgStyle !== 'default') {
            callout.classList.add(`vcalc-bg-${effectiveBgStyle}`);
        }
        
        // Apply compact mode (per-block overrides global)
        const isCompact = compact !== null ? compact : this.settings.compactMode;
        if (isCompact) {
            callout.classList.add('vcalc-compact');
        }
        
        // Apply vset color to accent (border + title only) if enabled
        const shouldSyncAccent = accentVset !== null ? accentVset : this.settings.syncAccentWithVset;
        if (vset && shouldSyncAccent) {
            const color = this.getVsetColor(context.sourcePath, vset);
            callout.classList.add('vcalc-accent-synced');
            (callout as HTMLElement).style.setProperty('--vcalc-accent-color', color.rgb);
        }

        // Get the custom title (user-defined text after [!vcalc])
        const titleInner = callout.querySelector('.callout-title-inner');
        const customTitle = titleInner?.textContent || 'Calculation';

        // Add buttons to the callout title
        const titleEl = callout.querySelector('.callout-title');
        if (titleEl && !titleEl.querySelector('.calc-btn-group')) {
            // Create button group
            const btnGroup = document.createElement('div');
            btnGroup.className = 'calc-btn-group';
            
            // Show vset badge if defined
            if (vset) {
                const color = this.getVsetColor(context.sourcePath, vset);
                const vsetBadge = document.createElement('span');
                vsetBadge.className = 'calc-vset-badge';
                vsetBadge.textContent = vset;
                vsetBadge.title = `Variable Set: ${vset}`;
                vsetBadge.setAttribute('data-vset-color', color.name);
                vsetBadge.style.setProperty('--vset-color', color.rgb);
                btnGroup.appendChild(vsetBadge);
            }
            
            // Toggle Code button
            const toggleCodeBtn = document.createElement('button');
            toggleCodeBtn.className = 'calc-toggle-btn';
            if (hidden) {
                toggleCodeBtn.classList.add('calc-btn-active');
            }
            toggleCodeBtn.textContent = '< >';
            toggleCodeBtn.title = 'Toggle Code (add "hidden" to options to persist)';
            toggleCodeBtn.addEventListener('click', () => {
                const preEl = callout.querySelector('pre');
                if (preEl) {
                    preEl.classList.toggle('calc-hidden');
                    toggleCodeBtn.classList.toggle('calc-btn-active');
                }
            });
            btnGroup.appendChild(toggleCodeBtn);
            
            // Run button
            const runBtn = document.createElement('button');
            runBtn.className = 'calc-run-btn';
            runBtn.textContent = 'Run';
            runBtn.addEventListener('click', async () => {
                // Calculate block index by finding all vcalc callouts and our position
                const allCallouts = document.querySelectorAll('.callout[data-callout="vcalc"]');
                let blockIndex = -1;
                for (let i = 0; i < allCallouts.length; i++) {
                    if (allCallouts[i] === callout) {
                        blockIndex = i;
                        break;
                    }
                }
                callout.setAttribute('data-vcalc-index', String(blockIndex));
                
                // Get the code fresh at click time (in case user edited it)
                const { code: pythonCode, vset: currentVset } = this.parseVsetFromCodeBlock(callout);
                console.log('CalcBlocks: Running block', blockIndex, 'with vset:', currentVset, pythonCode);
                await this.executeAndRender(pythonCode, callout, context, currentVset);
            });
            btnGroup.appendChild(runBtn);
            
            // Clear button (to remove saved LaTeX from file)
            const clearBtn = document.createElement('button');
            clearBtn.className = 'calc-clear-title-btn';
            clearBtn.textContent = '✕';
            clearBtn.title = 'Clear saved LaTeX from file';
            clearBtn.addEventListener('click', async () => {
                // Calculate block index
                const allCallouts = document.querySelectorAll('.callout[data-callout="vcalc"]');
                let blockIndex = -1;
                for (let i = 0; i < allCallouts.length; i++) {
                    if (allCallouts[i] === callout) {
                        blockIndex = i;
                        break;
                    }
                }
                
                await this.clearBlockSavedLatex(context.sourcePath, blockIndex, customTitle);
                
                // Remove outdated markers if present
                const outdatedWrappers = callout.querySelectorAll('.calc-saved-outdated');
                outdatedWrappers.forEach((wrapper) => wrapper.remove());
            });
            btnGroup.appendChild(clearBtn);
            
            titleEl.appendChild(btnGroup);
        }
    }

    async executeAndRender(code: string, callout: HTMLElement, context: MarkdownPostProcessorContext, vset: string | null = null) {
        try {
            // Get block title for variable tracking
            const titleInner = callout.querySelector('.callout-title-inner');
            const blockTitle = titleInner?.textContent || 'Unnamed Block';
            
            // Get existing variables from vset if available
            let existingVars: VariableSet = {};
            if (vset) {
                existingVars = this.getVariables(context.sourcePath, vset);
            }
            
            // Execute Python and get both LaTeX and new variables
            const { latex, variables } = await this.pythonToLatexWithVars(code, existingVars);
            
            // Store the latex on the callout element for later saving
            callout.setAttribute('data-vcalc-latex', latex);
            
            // Save new variables to vset
            if (vset && variables) {
                for (const [varName, varData] of Object.entries(variables)) {
                    this.updateVariable(
                        context.sourcePath,
                        vset,
                        varName,
                        varData.value,
                        varData.type,
                        blockTitle
                    );
                }
            }
            
            // Check for existing saved output from the file (rendered by Obsidian)
            // This would be any math block inside callout-content that's not in our .calc-output
            const calloutContent = callout.querySelector('.callout-content');
            if (calloutContent) {
                // Find saved output - only target top-level .math-block elements (not nested mjx-container)
                const existingMathBlocks = calloutContent.querySelectorAll('.math-block');
                existingMathBlocks.forEach((mathBlock) => {
                    // Skip if it's inside our output container
                    if (mathBlock.closest('.calc-output')) return;
                    
                    // Skip if already marked as outdated
                    if (mathBlock.closest('.calc-saved-outdated')) return;
                    
                    // Wrap in outdated container
                    const wrapper = document.createElement('div');
                    wrapper.className = 'calc-saved-outdated';
                    
                    const badge = document.createElement('div');
                    badge.className = 'calc-outdated-badge';
                    badge.innerHTML = '⚠️ Saved output (outdated) - <em>click Save to update</em>';
                    wrapper.appendChild(badge);
                    
                    // Move the math block into the wrapper
                    mathBlock.parentNode?.insertBefore(wrapper, mathBlock);
                    wrapper.appendChild(mathBlock);
                });
            }

            // Find or create the output container
            let outputContainer = callout.querySelector('.calc-output') as HTMLElement;
            if (!outputContainer) {
                outputContainer = document.createElement('div');
                outputContainer.className = 'calc-output';
                callout.querySelector('.callout-content')?.appendChild(outputContainer);
            }

            // Clear previous output
            outputContainer.empty();
            
            // Create wrapper for the rendered math
            const mathWrapper = document.createElement('div');
            mathWrapper.className = 'calc-math-wrapper';
            outputContainer.appendChild(mathWrapper);
            
            // Create the markdown string with proper LaTeX delimiters
            const markdownContent = `$$\n${latex}\n$$`;
            
            // Use Obsidian's MarkdownRenderer to render the LaTeX
            const component = new Component();
            component.load();
            await MarkdownRenderer.render(
                this.app,
                markdownContent,
                mathWrapper,
                context.sourcePath,
                component
            );

            // Add collapsible LaTeX source section
            const detailsEl = document.createElement('details');
            detailsEl.className = 'calc-latex-source';
            
            const summaryEl = document.createElement('summary');
            summaryEl.textContent = 'LaTeX Source';
            detailsEl.appendChild(summaryEl);
            
            const sourceContainer = document.createElement('div');
            sourceContainer.className = 'calc-source-content';
            
            // The actual LaTeX code (copyable)
            const codeEl = document.createElement('pre');
            const codeInner = document.createElement('code');
            codeInner.textContent = `$$\n${latex}\n$$`;
            codeEl.appendChild(codeInner);
            sourceContainer.appendChild(codeEl);
            
            // Button container for Copy and Save
            const btnContainer = document.createElement('div');
            btnContainer.className = 'calc-source-buttons';
            
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'calc-copy-btn';
            copyBtn.textContent = 'Copy LaTeX';
            copyBtn.addEventListener('click', async () => {
                await navigator.clipboard.writeText(`$$\n${latex}\n$$`);
                copyBtn.textContent = 'Copied!';
                setTimeout(() => { copyBtn.textContent = 'Copy LaTeX'; }, 2000);
            });
            btnContainer.appendChild(copyBtn);
            
            // Save to File button
            const saveBtn = document.createElement('button');
            saveBtn.className = 'calc-save-btn';
            saveBtn.textContent = 'Save to File';
            saveBtn.addEventListener('click', async () => {
                await this.saveBlockLatexToFile(callout, context.sourcePath, blockTitle);
                saveBtn.textContent = 'Saved!';
                
                // Remove outdated markers after saving
                const outdatedWrappers = callout.querySelectorAll('.calc-saved-outdated');
                outdatedWrappers.forEach((wrapper) => wrapper.remove());
                
                setTimeout(() => { saveBtn.textContent = 'Save to File'; }, 2000);
            });
            btnContainer.appendChild(saveBtn);
            
            sourceContainer.appendChild(btnContainer);
            detailsEl.appendChild(sourceContainer);
            outputContainer.appendChild(detailsEl);

            new Notice('Calculation rendered!');
            
            // Auto-save if setting is enabled
            if (this.settings.autoSaveOnRun) {
                await this.saveBlockLatexToFile(callout, context.sourcePath, blockTitle);
            }
        } catch (error) {
            new Notice(`Error: ${(error as Error).message}`);
            console.error('CalcBlocks error:', error);
        }
    }

    async pythonToLatexWithVars(code: string, existingVars: VariableSet): Promise<{ latex: string, variables: { [key: string]: { value: any, type: string } } }> {
        return new Promise((resolve, reject) => {
            // Build variable injection code
            let varInjection = '';
            for (const [varName, varInfo] of Object.entries(existingVars)) {
                const val = varInfo.value;
                if (typeof val === 'string') {
                    varInjection += `${varName} = "${val}"\n`;
                } else if (typeof val === 'number' || typeof val === 'boolean') {
                    varInjection += `${varName} = ${val}\n`;
                } else if (val === null) {
                    varInjection += `${varName} = None\n`;
                } else {
                    varInjection += `${varName} = ${JSON.stringify(val)}\n`;
                }
            }
            
            // Build display options
            const displayOptions = {
                showSymbolic: this.settings.showSymbolic,
                showSubstitution: this.settings.showSubstitution,
                showResult: this.settings.showResult
            };
            
            // Spawn Python process with our converter script
            const pythonCode = this.generateConverterCodeWithVars(code, varInjection, displayOptions);
            
            const proc = spawn(this.settings.pythonPath, ['-c', pythonCode]);
            
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data: Buffer) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });

            proc.on('close', (exitCode: number) => {
                if (exitCode === 0) {
                    try {
                        // Parse JSON output: { latex: "...", variables: {...} }
                        const result = JSON.parse(stdout.trim());
                        resolve(result);
                    } catch (e) {
                        // Fallback: treat as plain latex string (old format)
                        resolve({ latex: stdout.trim(), variables: {} });
                    }
                } else {
                    reject(new Error(stderr || `Python exited with code ${exitCode}`));
                }
            });

            proc.on('error', (err: Error) => {
                reject(new Error(`Failed to start Python: ${err.message}`));
            });
        });
    }

    async pythonToLatex(code: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Spawn Python process with our converter script
            const pythonCode = this.generateConverterCode(code);
            
            const proc = spawn(this.settings.pythonPath, ['-c', pythonCode]);
            
            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (exitCode) => {
                if (exitCode === 0) {
                    resolve(stdout.trim());
                } else {
                    reject(new Error(stderr || `Python exited with code ${exitCode}`));
                }
            });

            proc.on('error', (err) => {
                reject(new Error(`Failed to start Python: ${err.message}`));
            });
        });
    }

    generateConverterCode(userCode: string): string {
        // Escape the user code for embedding in Python string
        const escapedCode = userCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        
        return `
import ast
import math
import sys

# Make math functions available
from math import sqrt, sin, cos, tan, log, log10, exp, pi, e, atan, asin, acos

def expr_to_latex(node, namespace=None):
    """Convert an AST expression node to LaTeX string."""
    if namespace is None:
        namespace = {}
    
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        # Convert variable names: x_1 -> x_{1}, Gamma_L -> \\Gamma_{L}
        name = node.id
        # Handle Greek letters
        greek = {'alpha': '\\\\alpha', 'beta': '\\\\beta', 'gamma': '\\\\gamma', 
                 'Gamma': '\\\\Gamma', 'delta': '\\\\delta', 'Delta': '\\\\Delta',
                 'epsilon': '\\\\epsilon', 'zeta': '\\\\zeta', 'eta': '\\\\eta',
                 'theta': '\\\\theta', 'Theta': '\\\\Theta', 'lambda': '\\\\lambda',
                 'Lambda': '\\\\Lambda', 'mu': '\\\\mu', 'nu': '\\\\nu', 'xi': '\\\\xi',
                 'pi': '\\\\pi', 'Pi': '\\\\Pi', 'rho': '\\\\rho', 'sigma': '\\\\sigma',
                 'Sigma': '\\\\Sigma', 'tau': '\\\\tau', 'phi': '\\\\phi', 'Phi': '\\\\Phi',
                 'chi': '\\\\chi', 'psi': '\\\\psi', 'Psi': '\\\\Psi', 'omega': '\\\\omega',
                 'Omega': '\\\\Omega'}
        
        # Check for subscript pattern: var_subscript
        if '_' in name:
            parts = name.split('_', 1)
            base = greek.get(parts[0], parts[0])
            return f"{base}_{{{parts[1]}}}"
        return greek.get(name, name)
    
    elif isinstance(node, ast.BinOp):
        left = expr_to_latex(node.left, namespace)
        right = expr_to_latex(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\\\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
        elif isinstance(node.op, ast.Mod):
            return f"{left} \\\\mod {right}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = expr_to_latex(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        elif isinstance(node.op, ast.UAdd):
            return f"+{operand}"
    
    elif isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
        args = [expr_to_latex(arg, namespace) for arg in node.args]
        
        # Special function rendering
        if func_name == 'sqrt':
            return f"\\\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\\\left|{args[0]}\\\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'ln', 'exp'):
            return f"\\\\{func_name}\\\\left({args[0]}\\\\right)"
        elif func_name == 'log10':
            return f"\\\\log_{{10}}\\\\left({args[0]}\\\\right)"
        elif func_name == 'pow':
            return f"{args[0]}^{{{args[1]}}}"
        else:
            return f"\\\\text{{{func_name}}}({', '.join(args)})"
    
    elif isinstance(node, ast.Compare):
        left = expr_to_latex(node.left, namespace)
        result = left
        for op, comparator in zip(node.ops, node.comparators):
            right = expr_to_latex(comparator, namespace)
            if isinstance(op, ast.Eq):
                result += f" = {right}"
            elif isinstance(op, ast.Lt):
                result += f" < {right}"
            elif isinstance(op, ast.Gt):
                result += f" > {right}"
            elif isinstance(op, ast.LtE):
                result += f" \\\\leq {right}"
            elif isinstance(op, ast.GtE):
                result += f" \\\\geq {right}"
        return result
    
    return str(ast.dump(node))

def substitute_values(node, namespace):
    """Create LaTeX with values substituted."""
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        val = namespace.get(node.id, node.id)
        if isinstance(val, float):
            return f"{val:.4g}"
        return str(val)
    
    elif isinstance(node, ast.BinOp):
        left = substitute_values(node.left, namespace)
        right = substitute_values(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\\\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = substitute_values(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        return operand
    
    elif isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
        args = [substitute_values(arg, namespace) for arg in node.args]
        
        if func_name == 'sqrt':
            return f"\\\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\\\left|{args[0]}\\\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'exp'):
            return f"\\\\{func_name}\\\\left({args[0]}\\\\right)"
        else:
            return f"\\\\text{{{func_name}}}({', '.join(args)})"
    
    return str(node)

def python_to_latex(code):
    """Main conversion function."""
    tree = ast.parse(code)
    namespace = {'sqrt': sqrt, 'abs': abs, 'sin': sin, 'cos': cos, 'tan': tan,
                 'log': log, 'log10': log10, 'exp': exp, 'pi': pi, 'e': e,
                 'atan': atan, 'asin': asin, 'acos': acos}
    
    latex_lines = []
    
    for node in tree.body:
        # Only process assignments
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                continue
            
            var_name = target.id
            expr = node.value
            
            # Execute to get value
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<string>', 'exec'), namespace)
            value = namespace[var_name]
            
            # Format result value
            if isinstance(value, float):
                value_str = f"{value:.4g}"
            else:
                value_str = str(value)
            
            # Convert variable name to LaTeX
            var_latex = expr_to_latex(target, namespace)
            
            # Check if it's a simple constant assignment
            if isinstance(expr, ast.Constant):
                latex_lines.append(f"{var_latex} &= {value_str}")
            else:
                # Full equation: var = symbolic = substituted = result
                symbolic = expr_to_latex(expr, namespace)
                substituted = substitute_values(expr, namespace)
                
                # Only show substitution if different from symbolic
                if substituted != symbolic:
                    latex_lines.append(f"{var_latex} &= {symbolic} = {substituted} = {value_str}")
                else:
                    latex_lines.append(f"{var_latex} &= {symbolic} = {value_str}")
        
        # Silently ignore other statements (print, import, etc.)
    
    # Build aligned environment
    if latex_lines:
        # Add extra spacing before calculations (after simple assignments)
        result = "\\\\begin{aligned}\\n"
        for i, line in enumerate(latex_lines):
            if i > 0:
                # Check if previous was simple assignment and this is calculation
                result += "\\\\\\\\\\n" if "= " in latex_lines[i-1] and latex_lines[i-1].count("=") == 1 else "\\\\\\\\[8pt]\\n"
            result += line
        result += "\\n\\\\end{aligned}"
        return result
    
    return ""

# Execute
code = '''${escapedCode}'''
try:
    result = python_to_latex(code)
    print(result)
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;
    }

    generateConverterCodeWithVars(userCode: string, varInjection: string, displayOptions: { showSymbolic: boolean, showSubstitution: boolean, showResult: boolean }): string {
        // Escape the user code and var injection for embedding in Python string
        const escapedCode = userCode.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        const escapedVars = varInjection.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        
        // Convert display options to Python booleans
        const showSymbolic = displayOptions.showSymbolic ? 'True' : 'False';
        const showSubstitution = displayOptions.showSubstitution ? 'True' : 'False';
        const showResult = displayOptions.showResult ? 'True' : 'False';
        
        return `
import ast
import math
import sys
import json

# Display options
SHOW_SYMBOLIC = ${showSymbolic}
SHOW_SUBSTITUTION = ${showSubstitution}
SHOW_RESULT = ${showResult}

# Make math functions available
from math import sqrt, sin, cos, tan, log, log10, exp, pi, e, atan, asin, acos

def expr_to_latex(node, namespace=None):
    """Convert an AST expression node to LaTeX string."""
    if namespace is None:
        namespace = {}
    
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        name = node.id
        greek = {'alpha': '\\\\alpha', 'beta': '\\\\beta', 'gamma': '\\\\gamma', 
                 'Gamma': '\\\\Gamma', 'delta': '\\\\delta', 'Delta': '\\\\Delta',
                 'epsilon': '\\\\epsilon', 'zeta': '\\\\zeta', 'eta': '\\\\eta',
                 'theta': '\\\\theta', 'Theta': '\\\\Theta', 'lambda': '\\\\lambda',
                 'Lambda': '\\\\Lambda', 'mu': '\\\\mu', 'nu': '\\\\nu', 'xi': '\\\\xi',
                 'pi': '\\\\pi', 'Pi': '\\\\Pi', 'rho': '\\\\rho', 'sigma': '\\\\sigma',
                 'Sigma': '\\\\Sigma', 'tau': '\\\\tau', 'phi': '\\\\phi', 'Phi': '\\\\Phi',
                 'chi': '\\\\chi', 'psi': '\\\\psi', 'Psi': '\\\\Psi', 'omega': '\\\\omega',
                 'Omega': '\\\\Omega'}
        
        if '_' in name:
            parts = name.split('_', 1)
            base = greek.get(parts[0], parts[0])
            return f"{base}_{{{parts[1]}}}"
        return greek.get(name, name)
    
    elif isinstance(node, ast.BinOp):
        left = expr_to_latex(node.left, namespace)
        right = expr_to_latex(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\\\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
        elif isinstance(node.op, ast.Mod):
            return f"{left} \\\\mod {right}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = expr_to_latex(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        elif isinstance(node.op, ast.UAdd):
            return f"+{operand}"
    
    elif isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
        args = [expr_to_latex(arg, namespace) for arg in node.args]
        
        if func_name == 'sqrt':
            return f"\\\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\\\left|{args[0]}\\\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'ln', 'exp'):
            return f"\\\\{func_name}\\\\left({args[0]}\\\\right)"
        elif func_name == 'log10':
            return f"\\\\log_{{10}}\\\\left({args[0]}\\\\right)"
        elif func_name == 'pow':
            return f"{args[0]}^{{{args[1]}}}"
        else:
            return f"\\\\text{{{func_name}}}({', '.join(args)})"
    
    elif isinstance(node, ast.Compare):
        left = expr_to_latex(node.left, namespace)
        result = left
        for op, comparator in zip(node.ops, node.comparators):
            right = expr_to_latex(comparator, namespace)
            if isinstance(op, ast.Eq):
                result += f" = {right}"
            elif isinstance(op, ast.Lt):
                result += f" < {right}"
            elif isinstance(op, ast.Gt):
                result += f" > {right}"
            elif isinstance(op, ast.LtE):
                result += f" \\\\leq {right}"
            elif isinstance(op, ast.GtE):
                result += f" \\\\geq {right}"
        return result
    
    return str(ast.dump(node))

def substitute_values(node, namespace):
    """Create LaTeX with values substituted."""
    if isinstance(node, ast.Constant):
        return str(node.value)
    
    elif isinstance(node, ast.Name):
        val = namespace.get(node.id, node.id)
        if isinstance(val, float):
            return f"{val:.4g}"
        return str(val)
    
    elif isinstance(node, ast.BinOp):
        left = substitute_values(node.left, namespace)
        right = substitute_values(node.right, namespace)
        
        if isinstance(node.op, ast.Add):
            return f"{left} + {right}"
        elif isinstance(node.op, ast.Sub):
            return f"{left} - {right}"
        elif isinstance(node.op, ast.Mult):
            return f"{left} \\\\cdot {right}"
        elif isinstance(node.op, ast.Div):
            return f"\\\\frac{{{left}}}{{{right}}}"
        elif isinstance(node.op, ast.Pow):
            return f"{left}^{{{right}}}"
    
    elif isinstance(node, ast.UnaryOp):
        operand = substitute_values(node.operand, namespace)
        if isinstance(node.op, ast.USub):
            return f"-{operand}"
        return operand
    
    elif isinstance(node, ast.Call):
        func_name = node.func.id if isinstance(node.func, ast.Name) else str(node.func)
        args = [substitute_values(arg, namespace) for arg in node.args]
        
        if func_name == 'sqrt':
            return f"\\\\sqrt{{{args[0]}}}"
        elif func_name == 'abs':
            return f"\\\\left|{args[0]}\\\\right|"
        elif func_name in ('sin', 'cos', 'tan', 'log', 'exp'):
            return f"\\\\{func_name}\\\\left({args[0]}\\\\right)"
        else:
            return f"\\\\text{{{func_name}}}\\\\left({', '.join(args)}\\\\right)"
    
    return expr_to_latex(node, namespace)

def python_to_latex_with_vars(code, existing_vars_code):
    """Main conversion function that returns latex and variables."""
    # First inject existing variables
    namespace = {'sqrt': sqrt, 'abs': abs, 'sin': sin, 'cos': cos, 'tan': tan,
                 'log': log, 'log10': log10, 'exp': exp, 'pi': pi, 'e': e,
                 'atan': atan, 'asin': asin, 'acos': acos, 'j': 1j}
    
    if existing_vars_code:
        exec(existing_vars_code, namespace)
    
    tree = ast.parse(code)
    
    latex_lines = []
    new_variables = {}
    
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if not isinstance(target, ast.Name):
                continue
            
            var_name = target.id
            expr = node.value
            
            # Execute to get value
            exec(compile(ast.Module(body=[node], type_ignores=[]), '<string>', 'exec'), namespace)
            value = namespace[var_name]
            
            # Store variable info
            var_type = type(value).__name__
            new_variables[var_name] = {'value': value if not isinstance(value, complex) else str(value), 'type': var_type}
            
            # Format result value
            if isinstance(value, float):
                value_str = f"{value:.4g}"
            elif isinstance(value, complex):
                value_str = f"({value.real:.4g} + {value.imag:.4g}j)"
            else:
                value_str = str(value)
            
            # Convert variable name to LaTeX
            var_latex = expr_to_latex(target, namespace)
            
            # Build the equation based on display options
            # Check if simple constant assignment
            if isinstance(expr, ast.Constant):
                # For constants, just show var = value
                latex_lines.append(f"{var_latex} &= {value_str}")
            else:
                symbolic = expr_to_latex(expr, namespace)
                substituted = substitute_values(expr, namespace)
                
                # Build equation parts based on settings
                parts = [var_latex, "&="]
                
                if SHOW_SYMBOLIC:
                    parts.append(symbolic)
                
                if SHOW_SUBSTITUTION and substituted != symbolic:
                    if SHOW_SYMBOLIC:
                        parts.append("=")
                    parts.append(substituted)
                
                if SHOW_RESULT:
                    if SHOW_SYMBOLIC or SHOW_SUBSTITUTION:
                        parts.append("=")
                    parts.append(value_str)
                
                # If nothing is shown, at least show the result
                if not SHOW_SYMBOLIC and not SHOW_SUBSTITUTION and not SHOW_RESULT:
                    parts.append(value_str)
                
                latex_lines.append(" ".join(parts))
    
    # Build aligned environment
    latex = ""
    if latex_lines:
        latex = "\\\\begin{aligned}\\n"
        for i, line in enumerate(latex_lines):
            if i > 0:
                latex += "\\\\\\\\\\n" if "= " in latex_lines[i-1] and latex_lines[i-1].count("=") == 1 else "\\\\\\\\[8pt]\\n"
            latex += line
        latex += "\\n\\\\end{aligned}"
    
    return latex, new_variables

# Execute
code = '''${escapedCode}'''
existing_vars = '''${escapedVars}'''
try:
    latex, variables = python_to_latex_with_vars(code, existing_vars)
    result = json.dumps({'latex': latex, 'variables': variables})
    print(result)
except Exception as ex:
    print(f"Error: {ex}", file=sys.stderr)
    sys.exit(1)
`;
    }

    async runCalculationAtCursor(editor: any, view: MarkdownView) {
        const cursor = editor.getCursor();
        const content = editor.getValue();
        const lines = content.split('\n');
        
        // Find the calculation callout containing the cursor
        let calloutStart = -1;
        let calloutEnd = -1;
        let inCallout = false;
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].match(/^>\s*\[!vcalc\]/i)) {
                calloutStart = i;
                inCallout = true;
            } else if (inCallout && !lines[i].startsWith('>')) {
                calloutEnd = i;
                inCallout = false;
                
                if (cursor.line >= calloutStart && cursor.line < calloutEnd) {
                    break;
                }
                calloutStart = -1;
            }
        }
        
        if (calloutStart === -1) {
            new Notice('Cursor is not inside a calculation block');
            return;
        }
        
        if (calloutEnd === -1) calloutEnd = lines.length;
        
        // Extract Python code from the callout
        const calloutLines = lines.slice(calloutStart, calloutEnd);
        const codeMatch = calloutLines.join('\n').match(/```python\n([\s\S]*?)```/);
        
        if (!codeMatch) {
            new Notice('No Python code found in calculation block');
            return;
        }
        
        // Remove the "> " prefix from each line of code
        const pythonCode = codeMatch[1].split('\n').map((line: string) => 
            line.startsWith('> ') ? line.slice(2) : line
        ).join('\n').trim();
        
        try {
            const latex = await this.pythonToLatex(pythonCode);
            
            // Find where to insert/update the LaTeX output
            const outputMarker = '> <!-- calc-output -->';
            let outputStart = -1;
            let outputEnd = -1;
            
            for (let i = calloutStart; i < calloutEnd; i++) {
                if (lines[i].includes('<!-- calc-output -->')) {
                    outputStart = i;
                }
                if (lines[i].includes('<!-- /calc-output -->')) {
                    outputEnd = i + 1;
                    break;
                }
            }
            
            // Build the new output block
            const outputBlock = [
                '> <!-- calc-output -->',
                '> $$',
                ...latex.split('\n').map((l: string) => `> ${l}`),
                '> $$',
                '> <!-- /calc-output -->'
            ].join('\n');
            
            if (outputStart !== -1 && outputEnd !== -1) {
                // Replace existing output
                lines.splice(outputStart, outputEnd - outputStart, outputBlock);
            } else {
                // Insert new output before callout end (after code block)
                const codeBlockEnd = calloutLines.findIndex((l: string) => l.match(/^>\s*```\s*$/)) + calloutStart + 1;
                lines.splice(codeBlockEnd, 0, outputBlock);
            }
            
            editor.setValue(lines.join('\n'));
            new Notice('Calculation updated!');
            
        } catch (error) {
            new Notice(`Error: ${error.message}`);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

// Sidebar View for Variables
class VCalcVariablesView extends ItemView {
    plugin: CalcBlocksPlugin;
    private selectedVset: string = '';

    constructor(leaf: WorkspaceLeaf, plugin: CalcBlocksPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VCALC_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'VCalc Variables';
    }

    getIcon(): string {
        return 'calculator';
    }

    async onOpen() {
        this.refresh();
    }

    async onClose() {
        // Nothing to clean up
    }

    refresh() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Header
        const header = container.createEl('div', { cls: 'vcalc-sidebar-header' });
        header.createEl('h4', { text: 'VCalc Variables' });
        
        // Get active file
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            container.createEl('p', { text: 'No active note', cls: 'vcalc-no-vars' });
            return;
        }
        
        const notePath = activeFile.path;
        const noteVars = this.plugin.variableStore[notePath];
        
        if (!noteVars || Object.keys(noteVars).length === 0) {
            container.createEl('p', { 
                text: 'No variables yet. Run a VCalc block to see variables here.',
                cls: 'vcalc-no-vars'
            });
            return;
        }
        
        // File name
        header.createEl('div', { text: activeFile.basename, cls: 'vcalc-filename' });
        
        // VSet tabs
        const vsets = Object.keys(noteVars);
        if (vsets.length > 0 && !this.selectedVset) {
            this.selectedVset = vsets[0];
        }
        
        const tabsContainer = container.createEl('div', { cls: 'vcalc-tabs' });
        vsets.forEach(vsetName => {
            const color = this.plugin.getVsetColor(notePath, vsetName);
            const tab = tabsContainer.createEl('button', {
                text: vsetName,
                cls: `vcalc-tab ${this.selectedVset === vsetName ? 'vcalc-tab-active' : ''}`
            });
            tab.style.setProperty('--vset-color', color.rgb);
            tab.addEventListener('click', () => {
                this.selectedVset = vsetName;
                this.refresh();
            });
        });
        
        // Variables list
        const varsContainer = container.createEl('div', { cls: 'vcalc-vars-list' });
        const selectedVars = noteVars[this.selectedVset];
        
        if (!selectedVars || Object.keys(selectedVars).length === 0) {
            varsContainer.createEl('p', { text: 'No variables in this set', cls: 'vcalc-no-vars' });
            return;
        }
        
        for (const [varName, varInfo] of Object.entries(selectedVars)) {
            const varEl = varsContainer.createEl('div', { cls: 'vcalc-var-item' });
            
            // Variable name and value
            const varHeader = varEl.createEl('div', { cls: 'vcalc-var-header' });
            varHeader.createEl('span', { text: varName, cls: 'vcalc-var-name' });
            varHeader.createEl('span', { text: ' = ', cls: 'vcalc-var-equals' });
            varHeader.createEl('span', { 
                text: String(varInfo.value), 
                cls: 'vcalc-var-value' 
            });
            
            // Source block
            const sourceEl = varEl.createEl('div', { cls: 'vcalc-var-source' });
            sourceEl.createEl('span', { text: `↳ ${varInfo.blockTitle}` });
        }
        
        // Clear button
        const clearBtn = container.createEl('button', {
            text: 'Clear All Variables',
            cls: 'vcalc-clear-btn'
        });
        clearBtn.addEventListener('click', () => {
            this.plugin.clearNoteVariables(notePath);
            this.refresh();
        });
    }
}

// Settings Tab
class VCalcSettingTab extends PluginSettingTab {
    plugin: CalcBlocksPlugin;

    constructor(app: App, plugin: CalcBlocksPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'VCalc Settings' });

        // Python Settings Section
        containerEl.createEl('h3', { text: 'Python Configuration' });

        new Setting(containerEl)
            .setName('Python Path')
            .setDesc('Path to Python executable (e.g., python3, python, or full path)')
            .addText(text => text
                .setPlaceholder('python3')
                .setValue(this.plugin.settings.pythonPath)
                .onChange(async (value) => {
                    this.plugin.settings.pythonPath = value || 'python3';
                    await this.plugin.saveSettings();
                }));

        // Behavior Settings Section
        containerEl.createEl('h3', { text: 'Behavior' });

        new Setting(containerEl)
            .setName('Auto-save on Run')
            .setDesc('Automatically save LaTeX output to file when running a calculation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSaveOnRun)
                .onChange(async (value) => {
                    this.plugin.settings.autoSaveOnRun = value;
                    await this.plugin.saveSettings();
                }));

        // Display Settings Section
        containerEl.createEl('h3', { text: 'Display Options' });

        new Setting(containerEl)
            .setName('Show Symbolic Expression')
            .setDesc('Show the symbolic form of the equation (e.g., z = x + y)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showSymbolic)
                .onChange(async (value) => {
                    this.plugin.settings.showSymbolic = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Substitution Step')
            .setDesc('Show values substituted into the equation (e.g., z = 5 + 10)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showSubstitution)
                .onChange(async (value) => {
                    this.plugin.settings.showSubstitution = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Result')
            .setDesc('Show the final calculated result (e.g., z = 15)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.showResult)
                .onChange(async (value) => {
                    this.plugin.settings.showResult = value;
                    await this.plugin.saveSettings();
                }));

        // Appearance Section
        containerEl.createEl('h3', { text: 'Appearance' });

        new Setting(containerEl)
            .setName('Background Style')
            .setDesc('Control the background opacity of VCalc blocks')
            .addDropdown(dropdown => dropdown
                .addOption('default', 'Default')
                .addOption('subtle', 'Subtle')
                .addOption('solid', 'Solid')
                .addOption('transparent', 'Transparent')
                .setValue(this.plugin.settings.backgroundStyle)
                .onChange(async (value) => {
                    this.plugin.settings.backgroundStyle = value as 'default' | 'transparent' | 'subtle' | 'solid';
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Compact Mode')
            .setDesc('Reduce padding and margins for a more compact layout')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.compactMode)
                .onChange(async (value) => {
                    this.plugin.settings.compactMode = value;
                    await this.plugin.saveSettings();
                }));

        // Color Palette Info
        containerEl.createEl('h3', { text: 'Variable Set Colors' });
        
        new Setting(containerEl)
            .setName('Sync Accent with VSet Color')
            .setDesc('Match the callout accent (left border and title) color to the variable set color. Can also be set per-block with "accent:vset" or "accent:default".')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.syncAccentWithVset)
                .onChange(async (value) => {
                    this.plugin.settings.syncAccentWithVset = value;
                    await this.plugin.saveSettings();
                }));
        
        const colorInfo = containerEl.createEl('div', { cls: 'vcalc-color-info' });
        colorInfo.createEl('p', { 
            text: 'Variable sets are automatically assigned colors based on their order of appearance in each note:' 
        });
        
        const colorList = colorInfo.createEl('div', { cls: 'vcalc-color-list' });
        VSET_COLORS.forEach((color, index) => {
            const colorItem = colorList.createEl('span', { cls: 'vcalc-color-sample' });
            colorItem.style.setProperty('--sample-color', color.rgb);
            colorItem.textContent = `${index + 1}. ${color.name}`;
        });
    }
}