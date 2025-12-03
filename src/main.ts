import { Plugin, MarkdownPostProcessorContext, Notice, MarkdownView, MarkdownRenderer, Component, WorkspaceLeaf, App } from 'obsidian';

// Types
import { CalcBlocksSettings, VariableStore, VariableSet, VSetColorMap, VSetColor } from './types';

// Constants
import { VCALC_VIEW_TYPE, VCALC_EDITOR_VIEW_TYPE, VCALC_ID_ATTRIBUTE, VSET_COLORS, DEFAULT_SETTINGS, generateVCalcId, TIMING } from './constants';

// Settings
import { VCalcSettingTab } from './settings';

// Views
import { VCalcVariablesView } from './views/variables-view';
import { VCalcEditorView } from './views/editor-view';

// Stores
import { 
    getVsetColorIndex as storeGetVsetColorIndex,
    getVsetColor as storeGetVsetColor,
    clearNoteVariables as storeClearNoteVariables,
    getVariables as storeGetVariables,
    setVariables as storeSetVariables,
    updateVariable as storeUpdateVariable
} from './stores/variable-store';

// Parser
import { parseVsetFromCodeBlock, getCalloutTitle } from './callout/parser';

// Python execution (Pyodide WASM)
import { PyodideExecutor } from './python/pyodide-executor';

// File persistence
import {
    saveBlockLatexToFile,
    clearAllSavedLatex as fileClearAllSavedLatex,
    clearBlockSavedLatex as fileClearBlockSavedLatex
} from './file/latex-persistence';

// Type guards
import { getErrorMessage } from './utils/type-guards';


export default class CalcBlocksPlugin extends Plugin {
    settings!: CalcBlocksSettings; // Initialized in onload via loadSettings()

    // Variable storage (in-memory, cleared on note close)
    public variableStore: VariableStore = {};

    // VSet color assignments per note (tracks order of appearance)
    public vsetColors: VSetColorMap = {};

    // Track components for cleanup
    private components: Set<Component> = new Set();

    async onload() {
        await this.loadSettings();

        // Setup Pyodide loading callbacks
        const executor = PyodideExecutor.getInstance();
        executor.setLoadCallbacks(
            () => {
                // Show loading notice
                new Notice('Loading Python environment (first time only)...', 0);
            },
            () => {
                // Clear loading notice and show success
                const notices = document.querySelectorAll('.notice');
                notices.forEach(notice => {
                    if (notice.textContent?.includes('Loading Python environment')) {
                        notice.remove();
                    }
                });
                new Notice('Python environment ready!', 3000);
            }
        );

        // Register the sidebar views
        this.registerView(
            VCALC_VIEW_TYPE,
            (leaf) => new VCalcVariablesView(leaf, this)
        );

        this.registerView(
            VCALC_EDITOR_VIEW_TYPE,
            (leaf) => new VCalcEditorView(leaf, this)
        );

        // Add ribbon icon for variable viewer
        this.addRibbonIcon('calculator', 'VCalc Variables', () => {
            this.activateVariablesView();
        });

        // Add ribbon icon for editor
        this.addRibbonIcon('code', 'VCalc Editor', () => {
            this.activateEditorView();
        });

        // Register the callout post-processor for [!vcalc] blocks
        this.registerMarkdownPostProcessor((element, context) => {
            this.processCalculationCallouts(element, context);
        });

        // Register commands
        this.registerCommands();

        // Listen for file changes
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.refreshVariablesView();
            })
        );

        // Add settings tab
        this.addSettingTab(new VCalcSettingTab(this.app, this));

        console.log('VCalc plugin loaded');
    }

    private registerCommands() {
        // Insert a new calculation block
        this.addCommand({
            id: 'insert-calc-block',
            name: 'Insert VCalc Block',
            editorCallback: (editor) => {
                const id = generateVCalcId();
                const template = `> [!vcalc] Calculation\n> \`\`\`python\n> # vcalc: id=${id} vset=main\n> x = 5\n> y = 10\n> z = x + y\n> \`\`\`\n`;
                editor.replaceSelection(template);
            }
        });

        // Run calculation under cursor
        this.addCommand({
            id: 'run-calc-block',
            name: 'Run VCalc Block',
            editorCallback: async (editor, ctx) => {
                try {
                    const view = ctx instanceof MarkdownView ? ctx : this.app.workspace.getActiveViewOfType(MarkdownView);
                    if (view) {
                        await this.runCalculationAtCursor(editor, view);
                    }
                } catch (error) {
                    console.error('VCalc: Error running calculation at cursor:', error);
                    new Notice(`Error running calculation: ${getErrorMessage(error)}`);
                }
            }
        });

        // Open variables panel
        this.addCommand({
            id: 'open-variables-panel',
            name: 'Open Variables Panel',
            callback: () => {
                this.activateVariablesView();
            }
        });

        // Open editor panel
        this.addCommand({
            id: 'open-editor-panel',
            name: 'Open Editor Panel',
            callback: () => {
                this.activateEditorView();
            }
        });

        // Clear variables for current note
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

        // Run all VCalc blocks
        this.addCommand({
            id: 'run-all-vcalc-blocks',
            name: 'Run All VCalc Blocks',
            callback: async () => {
                try {
                    await this.runAllBlocks();
                } catch (error) {
                    console.error('VCalc: Error running all blocks:', error);
                    new Notice(`Error running all blocks: ${getErrorMessage(error)}`);
                }
            }
        });

        // Save all LaTeX outputs
        this.addCommand({
            id: 'save-all-latex',
            name: 'Save All LaTeX to File',
            callback: async () => {
                try {
                    await this.saveAllLatexToFile();
                } catch (error) {
                    console.error('VCalc: Error saving all LaTeX:', error);
                    new Notice(`Error saving all LaTeX: ${getErrorMessage(error)}`);
                }
            }
        });

        // Run all and save all
        this.addCommand({
            id: 'run-and-save-all',
            name: 'Run & Save All VCalc Blocks',
            callback: async () => {
                try {
                    await this.runAllBlocks();
                    await this.saveAllLatexToFile();
                } catch (error) {
                    console.error('VCalc: Error running and saving all:', error);
                    new Notice(`Error running and saving all: ${getErrorMessage(error)}`);
                }
            }
        });

        // Clear all saved LaTeX
        this.addCommand({
            id: 'clear-all-saved-latex',
            name: 'Clear All Saved LaTeX from Note',
            callback: async () => {
                await fileClearAllSavedLatex(this.app);
            }
        });
    }

    // ==================== Variable Store Methods ====================

    getVsetColorIndex(notePath: string, vsetName: string): number {
        return storeGetVsetColorIndex(this.vsetColors, notePath, vsetName);
    }

    getVsetColor(notePath: string, vsetName: string): VSetColor {
        return storeGetVsetColor(this.vsetColors, notePath, vsetName);
    }

    clearNoteVariables(notePath: string) {
        storeClearNoteVariables(this.variableStore, notePath);
        this.refreshVariablesView();
    }

    getVariables(notePath: string, vset: string): VariableSet {
        return storeGetVariables(this.variableStore, notePath, vset);
    }

    setVariables(notePath: string, vset: string, variables: VariableSet) {
        storeSetVariables(this.variableStore, notePath, vset, variables);
        this.refreshVariablesView();
    }

    updateVariable(notePath: string, vset: string, varName: string, value: any, type: string, blockTitle: string) {
        storeUpdateVariable(this.variableStore, notePath, vset, varName, value, type, blockTitle);
        this.refreshVariablesView();
    }

    // ==================== View Methods ====================

    async activateVariablesView() {
        const leaves = this.app.workspace.getLeavesOfType(VCALC_VIEW_TYPE);
        
        if (leaves.length === 0) {
            const rightLeaf = this.app.workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VCALC_VIEW_TYPE,
                    active: true
                });
            }
        }
        
        const leaf = this.app.workspace.getLeavesOfType(VCALC_VIEW_TYPE)[0];
        if (leaf) {
            this.app.workspace.revealLeaf(leaf);
            const view = leaf.view as VCalcVariablesView;
            view.refresh();
        }
    }

    async activateEditorView() {
        const leaves = this.app.workspace.getLeavesOfType(VCALC_EDITOR_VIEW_TYPE);
        
        if (leaves.length === 0) {
            const rightLeaf = this.app.workspace.getRightLeaf(false);
            if (rightLeaf) {
                await rightLeaf.setViewState({
                    type: VCALC_EDITOR_VIEW_TYPE,
                    active: true
                });
            }
        }
        
        const leaf = this.app.workspace.getLeavesOfType(VCALC_EDITOR_VIEW_TYPE)[0];
        if (leaf) {
            this.app.workspace.revealLeaf(leaf);
        }
    }

    refreshVariablesView() {
        const leaves = this.app.workspace.getLeavesOfType(VCALC_VIEW_TYPE);
        for (const leaf of leaves) {
            const view = leaf.view;
            if (view && typeof (view as any).refresh === 'function') {
                (view as VCalcVariablesView).refresh();
            }
        }
    }

    // ==================== Callout Processing ====================

    processCalculationCallouts(element: HTMLElement, context: MarkdownPostProcessorContext) {
        const callouts = element.querySelectorAll('.callout[data-callout="vcalc"]');
        callouts.forEach((callout) => {
            this.enhanceCalculationCallout(callout as HTMLElement, context);
        });
    }

    enhanceCalculationCallout(callout: HTMLElement, context: MarkdownPostProcessorContext) {
        const codeBlock = callout.querySelector('pre > code');
        if (!codeBlock) return;

        // Parse options from code block
        const { id, vset, hidden, accentVset, bgStyle, compact } = parseVsetFromCodeBlock(callout);
        
        // Apply block ID to DOM for reliable lookup
        if (id) {
            callout.setAttribute(VCALC_ID_ATTRIBUTE, id);
        }
        
        // Apply hidden state
        const preEl = callout.querySelector('pre');
        if (hidden && preEl) {
            preEl.classList.add('calc-hidden');
        }
        
        // Apply background style
        const effectiveBgStyle = bgStyle || this.settings.backgroundStyle;
        if (effectiveBgStyle !== 'default') {
            callout.classList.add(`vcalc-bg-${effectiveBgStyle}`);
        }
        
        // Apply compact mode
        const isCompact = compact !== null ? compact : this.settings.compactMode;
        if (isCompact) {
            callout.classList.add('vcalc-compact');
        }
        
        // Apply vset color to accent
        const shouldSyncAccent = accentVset !== null ? accentVset : this.settings.syncAccentWithVset;
        if (vset && shouldSyncAccent) {
            const color = this.getVsetColor(context.sourcePath, vset);
            callout.classList.add('vcalc-accent-synced');
            callout.style.setProperty('--vcalc-accent-color', color.rgb);
        }

        const customTitle = getCalloutTitle(callout);

        // Add buttons to the callout title
        const titleEl = callout.querySelector('.callout-title');
        if (titleEl && !titleEl.querySelector('.calc-btn-group')) {
            const btnGroup = document.createElement('div');
            btnGroup.className = 'calc-btn-group';
            
            // VSet badge
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
            if (hidden) toggleCodeBtn.classList.add('calc-btn-active');
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
                try {
                    const allCallouts = document.querySelectorAll('.callout[data-callout="vcalc"]');
                    let blockIndex = -1;
                    for (let i = 0; i < allCallouts.length; i++) {
                        if (allCallouts[i] === callout) {
                            blockIndex = i;
                            break;
                        }
                    }
                    callout.setAttribute('data-vcalc-index', String(blockIndex));

                    const { code: pythonCode, vset: currentVset } = parseVsetFromCodeBlock(callout);
                    console.log('VCalc: Running block', blockIndex, 'with vset:', currentVset);
                    await this.executeAndRender(pythonCode, callout, context, currentVset);
                } catch (error) {
                    console.error('VCalc: Error running block:', error);
                    new Notice(`Error running calculation: ${getErrorMessage(error)}`);
                }
            });
            btnGroup.appendChild(runBtn);
            
            // Clear button
            const clearBtn = document.createElement('button');
            clearBtn.className = 'calc-clear-title-btn';
            clearBtn.textContent = '✕';
            clearBtn.title = 'Clear saved LaTeX from file';
            clearBtn.addEventListener('click', async () => {
                try {
                    const allCallouts = document.querySelectorAll('.callout[data-callout="vcalc"]');
                    let blockIndex = -1;
                    for (let i = 0; i < allCallouts.length; i++) {
                        if (allCallouts[i] === callout) {
                            blockIndex = i;
                            break;
                        }
                    }

                    await fileClearBlockSavedLatex(this.app, context.sourcePath, blockIndex, customTitle);

                    const outdatedWrappers = callout.querySelectorAll('.calc-saved-outdated');
                    outdatedWrappers.forEach((wrapper) => wrapper.remove());
                } catch (error) {
                    console.error('VCalc: Error clearing saved LaTeX:', error);
                    new Notice(`Error clearing saved LaTeX: ${getErrorMessage(error)}`);
                }
            });
            btnGroup.appendChild(clearBtn);
            
            titleEl.appendChild(btnGroup);
        }
    }

    // ==================== Execution ====================

    async executeAndRender(code: string, callout: HTMLElement, context: MarkdownPostProcessorContext, vset: string | null = null) {
        try {
            const blockTitle = getCalloutTitle(callout);
            
            // Get existing variables from vset
            let existingVars: VariableSet = {};
            if (vset) {
                existingVars = this.getVariables(context.sourcePath, vset);
            }
            
            // Execute Python with Pyodide
            const displayOptions = {
                showSymbolic: this.settings.showSymbolic,
                showSubstitution: this.settings.showSubstitution,
                showResult: this.settings.showResult
            };

            const executor = PyodideExecutor.getInstance();
            const { latex, variables } = await executor.pythonToLatexWithVars(
                code,
                existingVars,
                displayOptions
            );
            
            // Store the latex on the callout element
            callout.setAttribute('data-vcalc-latex', latex);
            
            // Save new variables to vset
            if (vset && variables) {
                for (const [varName, varData] of Object.entries(variables)) {
                    // Type guard for variable data
                    if (varData && typeof varData === 'object' && 'value' in varData && 'type' in varData) {
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
            }
            
            // Mark existing saved output as outdated
            const calloutContent = callout.querySelector('.callout-content');
            if (calloutContent) {
                const existingMathBlocks = calloutContent.querySelectorAll('.math-block');
                existingMathBlocks.forEach((mathBlock) => {
                    if (mathBlock.closest('.calc-output')) return;
                    if (mathBlock.closest('.calc-saved-outdated')) return;
                    
                    const wrapper = document.createElement('div');
                    wrapper.className = 'calc-saved-outdated';
                    
                    const badge = document.createElement('div');
                    badge.className = 'calc-outdated-badge';
                    badge.innerHTML = '⚠️ Saved output (outdated) - <em>click Save to update</em>';
                    wrapper.appendChild(badge);
                    
                    mathBlock.parentNode?.insertBefore(wrapper, mathBlock);
                    wrapper.appendChild(mathBlock);
                });
            }

            // Find or create output container
            let outputContainer = callout.querySelector('.calc-output') as HTMLElement;
            if (!outputContainer) {
                outputContainer = document.createElement('div');
                outputContainer.className = 'calc-output';
                callout.querySelector('.callout-content')?.appendChild(outputContainer);
            }

            outputContainer.empty();
            
            // Render LaTeX
            const mathWrapper = document.createElement('div');
            mathWrapper.className = 'calc-math-wrapper';
            outputContainer.appendChild(mathWrapper);
            
            const markdownContent = `$$\n${latex}\n$$`;
            const component = new Component();
            component.load();
            this.components.add(component); // Track for cleanup
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
            
            const codeEl = document.createElement('pre');
            const codeInner = document.createElement('code');
            codeInner.textContent = `$$\n${latex}\n$$`;
            codeEl.appendChild(codeInner);
            sourceContainer.appendChild(codeEl);
            
            // Button container
            const btnContainer = document.createElement('div');
            btnContainer.className = 'calc-source-buttons';
            
            // Copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'calc-copy-btn';
            copyBtn.textContent = 'Copy LaTeX';
            copyBtn.addEventListener('click', async () => {
                try {
                    if (!navigator.clipboard) {
                        throw new Error('Clipboard API not available');
                    }
                    await navigator.clipboard.writeText(`$$\n${latex}\n$$`);
                    copyBtn.textContent = 'Copied!';
                    setTimeout(() => { copyBtn.textContent = 'Copy LaTeX'; }, TIMING.UI_FEEDBACK_RESET_MS);
                } catch (error) {
                    console.error('VCalc: Error copying to clipboard:', error);
                    new Notice(`Error copying to clipboard: ${getErrorMessage(error)}`);
                    copyBtn.textContent = 'Copy LaTeX';
                }
            });
            btnContainer.appendChild(copyBtn);

            // Save button
            const saveBtn = document.createElement('button');
            saveBtn.className = 'calc-save-btn';
            saveBtn.textContent = 'Save to File';
            saveBtn.addEventListener('click', async () => {
                try {
                    await saveBlockLatexToFile(this.app, callout, context.sourcePath, blockTitle);
                    saveBtn.textContent = 'Saved!';

                    const outdatedWrappers = callout.querySelectorAll('.calc-saved-outdated');
                    outdatedWrappers.forEach((wrapper) => wrapper.remove());

                    setTimeout(() => { saveBtn.textContent = 'Save to File'; }, TIMING.UI_FEEDBACK_RESET_MS);
                } catch (error) {
                    console.error('VCalc: Error saving to file:', error);
                    new Notice(`Error saving to file: ${getErrorMessage(error)}`);
                    saveBtn.textContent = 'Save to File';
                }
            });
            btnContainer.appendChild(saveBtn);
            
            sourceContainer.appendChild(btnContainer);
            detailsEl.appendChild(sourceContainer);
            outputContainer.appendChild(detailsEl);

            new Notice('Calculation rendered!');
            
            // Auto-save if enabled
            if (this.settings.autoSaveOnRun) {
                await saveBlockLatexToFile(this.app, callout, context.sourcePath, blockTitle);
            }
        } catch (error) {
            new Notice(`Error executing calculation: ${getErrorMessage(error)}`);
            console.error('VCalc error:', error);
        }
    }

    // ==================== Batch Operations ====================

    async runAllBlocks() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice('No active markdown view');
            return;
        }

        const container = activeView.containerEl;
        const callouts = container.querySelectorAll('.callout[data-callout="vcalc"]');
        
        if (callouts.length === 0) {
            new Notice('No VCalc blocks found in this note');
            return;
        }

        new Notice(`Running ${callouts.length} VCalc block(s)...`);
        
        const file = activeView.file;
        if (!file) return;
        
        for (let i = 0; i < callouts.length; i++) {
            const callout = callouts[i] as HTMLElement;
            callout.setAttribute('data-vcalc-index', String(i));
            
            const { code, vset } = parseVsetFromCodeBlock(callout);
            
            if (code.trim()) {
                try {
                    const context = {
                        sourcePath: file.path,
                        frontmatter: null,
                        docId: '',
                        getSectionInfo: () => null,
                        addChild: () => {}
                    } as unknown as MarkdownPostProcessorContext;
                    
                    await this.executeAndRender(code, callout, context, vset);
                    await new Promise(resolve => setTimeout(resolve, TIMING.INTER_BLOCK_DELAY_MS));
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

        const container = activeView.containerEl;
        const callouts = container.querySelectorAll('.callout[data-callout="vcalc"]');
        
        let savedCount = 0;
        
        for (const callout of Array.from(callouts)) {
            const latex = callout.getAttribute('data-vcalc-latex');
            if (latex) {
                const blockTitle = getCalloutTitle(callout as HTMLElement);
                await saveBlockLatexToFile(this.app, callout as HTMLElement, file.path, blockTitle);
                savedCount++;
                await new Promise(resolve => setTimeout(resolve, TIMING.BLOCK_SAVE_DELAY_MS));
            }
        }
        
        if (savedCount === 0) {
            new Notice('No rendered outputs to save. Run blocks first.');
        } else {
            new Notice(`Saved ${savedCount} LaTeX output(s) to file!`);
        }
    }

    async runCalculationAtCursor(editor: any, view: MarkdownView) {
        const cursor = editor.getCursor();
        const content = editor.getValue();
        const lines = content.split('\n');
        
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
        
        const calloutLines = lines.slice(calloutStart, calloutEnd);
        const codeMatch = calloutLines.join('\n').match(/```python\n([\s\S]*?)```/);
        
        if (!codeMatch) {
            new Notice('No Python code found in calculation block');
            return;
        }
        
        const pythonCode = codeMatch[1].split('\n').map((line: string) => 
            line.startsWith('> ') ? line.slice(2) : line
        ).join('\n').trim();
        
        try {
            const executor = PyodideExecutor.getInstance();
            const latex = await executor.pythonToLatex(pythonCode);
            
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
            
            const outputBlock = [
                '> <!-- calc-output -->',
                '> $$',
                ...latex.split('\n').map((l: string) => `> ${l}`),
                '> $$',
                '> <!-- /calc-output -->'
            ].join('\n');
            
            if (outputStart !== -1 && outputEnd !== -1) {
                lines.splice(outputStart, outputEnd - outputStart, outputBlock);
            } else {
                const codeBlockEnd = calloutLines.findIndex((l: string) => l.match(/^>\s*```\s*$/)) + calloutStart + 1;
                lines.splice(codeBlockEnd, 0, outputBlock);
            }
            
            editor.setValue(lines.join('\n'));
            new Notice('Calculation updated!');
            
        } catch (error) {
            new Notice(`Error updating calculation: ${getErrorMessage(error)}`);
        }
    }

    // ==================== Settings ====================

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Plugin unload - cleanup all resources
     */
    onUnload() {
        // Unload all tracked components
        for (const component of this.components) {
            component.unload();
        }
        this.components.clear();

        // Clear all variable storage
        this.variableStore = {};
        this.vsetColors = {};

        // Remove all DOM mirrors (in case any are still present)
        document.querySelectorAll('.vcalc-editor-mirror').forEach(mirror => mirror.remove());

        // Restore any hidden pre elements
        document.querySelectorAll('pre[style*="display: none"]').forEach(pre => {
            (pre as HTMLElement).style.display = '';
        });

        console.log('VCalc plugin unloaded');
    }
}
