import { ItemView, WorkspaceLeaf, MarkdownView, Notice } from 'obsidian';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { EditorViewPlugin } from '../types';
import { VCALC_EDITOR_VIEW_TYPE, VCALC_ID_ATTRIBUTE, MATH_FUNCTIONS, MATH_CONSTANTS, GREEK_LETTERS, generateVCalcId } from '../constants';
import { parseVsetFromCodeBlock, buildOptionsLine } from '../callout/parser';

// Block info with ID as primary identifier
interface BlockInfo {
    id: string | null;
    index: number;
    title: string;
    vset: string | null;
    code: string;
}

// Constants
const MIRROR_CHECK_INTERVAL = 300;
const IDLE_SAVE_DELAY = 2500;
const MIRROR_CLASS = 'vcalc-editor-mirror';

export class VCalcEditorView extends ItemView {
    private plugin: EditorViewPlugin;
    private editorView: EditorView | null = null;
    private blockSelector: HTMLSelectElement | null = null;
    private statusBar: HTMLElement | null = null;
    private dirtyIndicator: HTMLElement | null = null;
    
    // Selected block - ID is primary, index is fallback
    private selectedBlockId: string | null = null;
    private selectedBlockIndex: number = -1;
    private selectedBlockVset: string | null = null;
    
    // Editor state
    private isUpdatingEditor: boolean = false;
    private isDirty: boolean = false;
    private editorContent: string = '';
    
    // Timers
    private idleTimer: NodeJS.Timeout | null = null;
    private mirrorCheckInterval: NodeJS.Timeout | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: EditorViewPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VCALC_EDITOR_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'VCalc Editor';
    }

    getIcon(): string {
        return 'code';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('vcalc-editor-container');

        // Header
        const header = container.createEl('div', { cls: 'vcalc-editor-header' });
        const selectorRow = header.createEl('div', { cls: 'vcalc-editor-selector-row' });
        selectorRow.createEl('span', { text: 'Block:', cls: 'vcalc-editor-label' });
        
        this.blockSelector = selectorRow.createEl('select', { cls: 'vcalc-editor-select' });
        this.blockSelector.addEventListener('change', () => {
            const selectedOption = this.blockSelector!.selectedOptions[0];
            if (selectedOption) {
                const id = selectedOption.getAttribute('data-id');
                const index = parseInt(selectedOption.value, 10);
                this.switchToBlock(id, index);
            }
        });

        this.dirtyIndicator = selectorRow.createEl('span', { cls: 'vcalc-editor-dirty-indicator' });
        this.dirtyIndicator.title = 'Unsaved changes';
        
        const refreshBtn = selectorRow.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-refresh-btn' });
        refreshBtn.innerHTML = '↻';
        refreshBtn.title = 'Refresh block list';
        refreshBtn.addEventListener('click', () => this.fullRefresh());

        // Editor
        const editorContainer = container.createEl('div', { cls: 'vcalc-editor-codemirror' });
        this.initializeEditor(editorContainer);

        // Buttons
        const buttonBar = container.createEl('div', { cls: 'vcalc-editor-buttons' });
        
        const runBtn = buttonBar.createEl('button', { text: 'Run', cls: 'vcalc-editor-btn vcalc-editor-run-btn' });
        runBtn.addEventListener('click', () => this.runCurrentBlock());
        
        const saveBtn = buttonBar.createEl('button', { text: 'Save to File', cls: 'vcalc-editor-btn vcalc-editor-save-btn' });
        saveBtn.addEventListener('click', () => this.saveToFile());

        // Status
        this.statusBar = container.createEl('div', { cls: 'vcalc-editor-status' });
        this.updateStatus('Ready');

        // Initial refresh
        this.fullRefresh();

        // File change listener
        this.registerEvent(
            this.plugin.app.workspace.on('file-open', () => {
                this.disconnectFromBlock();
                this.fullRefresh();
            })
        );
    }

    async onClose() {
        this.stopMirrorCheck();
        await this.disconnectFromBlock();
        if (this.editorView) {
            this.editorView.destroy();
        }
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }
    }

    private initializeEditor(container: HTMLElement) {
        const vcalcCompletion = (context: CompletionContext): CompletionResult | null => {
            const word = context.matchBefore(/\w*/);
            if (!word || (word.from === word.to && !context.explicit)) {
                return null;
            }

            const options: { label: string; type: string; detail?: string }[] = [];

            for (const func of MATH_FUNCTIONS) {
                options.push({ label: func, type: 'function', detail: 'math function' });
            }
            for (const constant of MATH_CONSTANTS) {
                options.push({ label: constant, type: 'constant', detail: 'constant' });
            }
            for (const letter of GREEK_LETTERS) {
                options.push({ label: letter, type: 'variable', detail: 'greek letter' });
            }

            // Variables from current vset
            if (this.selectedBlockVset) {
                const activeFile = this.plugin.app.workspace.getActiveFile();
                if (activeFile) {
                    const vars = this.plugin.getVariables(activeFile.path, this.selectedBlockVset);
                    if (vars) {
                        for (const varName of Object.keys(vars)) {
                            options.push({
                                label: varName,
                                type: 'variable',
                                detail: `${this.selectedBlockVset}: ${vars[varName].value}`
                            });
                        }
                    }
                }
            }

            return { from: word.from, options, validFor: /^\w*$/ };
        };

        const startState = EditorState.create({
            doc: '# Select a block to edit',
            extensions: [
                lineNumbers(),
                highlightActiveLineGutter(),
                highlightActiveLine(),
                history(),
                bracketMatching(),
                python(),
                syntaxHighlighting(defaultHighlightStyle),
                autocompletion({ override: [vcalcCompletion] }),
                keymap.of([
                    ...defaultKeymap,
                    ...historyKeymap,
                    { key: 'Ctrl-Enter', run: () => { this.runCurrentBlock(); return true; } },
                    { key: 'Cmd-Enter', run: () => { this.runCurrentBlock(); return true; } },
                    { key: 'Ctrl-s', run: () => { this.saveToFile(); return true; } },
                    { key: 'Cmd-s', run: () => { this.saveToFile(); return true; } },
                ]),
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged && !this.isUpdatingEditor) {
                        this.onEditorChange();
                    }
                }),
                EditorView.theme({
                    '&': { height: '100%', fontSize: '14px' },
                    '.cm-scroller': { overflow: 'auto' },
                    '.cm-content': { fontFamily: 'var(--font-monospace)', padding: '8px 0' },
                    '.cm-line': { padding: '0 8px' }
                })
            ]
        });

        this.editorView = new EditorView({
            state: startState,
            parent: container
        });
    }

    // ==================== DOM Helpers ====================

    private getMarkdownContainer(): HTMLElement | null {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return null;
        
        // Find the markdown view that has this file open (not necessarily the active view)
        const leaves = this.plugin.app.workspace.getLeavesOfType('markdown');
        for (const leaf of leaves) {
            const view = leaf.view as MarkdownView;
            if (view.file?.path === activeFile.path) {
                return view.containerEl;
            }
        }
        
        // Fallback to active view
        const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
        return activeView?.containerEl ?? null;
    }

    private getAllCallouts(): HTMLElement[] {
        const container = this.getMarkdownContainer();
        if (!container) return [];
        return Array.from(container.querySelectorAll('.callout[data-callout="vcalc"]')) as HTMLElement[];
    }

    private getCalloutById(id: string): HTMLElement | null {
        // First try the fast path: DOM attribute
        const container = this.getMarkdownContainer();
        if (!container) {
            return null;
        }
        
        const byAttr = container.querySelector(`.callout[data-callout="vcalc"][${VCALC_ID_ATTRIBUTE}="${id}"]`) as HTMLElement | null;
        if (byAttr) {
            return byAttr;
        }
        
        // Fallback: parse each callout's code to find the ID
        const callouts = this.getAllCallouts();
        for (const callout of callouts) {
            const { id: blockId } = parseVsetFromCodeBlock(callout);
            if (blockId === id) {
                return callout;
            }
        }
        
        return null;
    }

    private getCalloutByIndex(index: number): HTMLElement | null {
        const callouts = this.getAllCallouts();
        if (index < 0 || index >= callouts.length) return null;
        return callouts[index];
    }

    private getSelectedCallout(): HTMLElement | null {
        // Try by ID first (searches both DOM attr and code)
        if (this.selectedBlockId) {
            const callout = this.getCalloutById(this.selectedBlockId);
            if (callout) return callout;
        }
        // Fall back to index
        if (this.selectedBlockIndex >= 0) {
            return this.getCalloutByIndex(this.selectedBlockIndex);
        }
        return null;
    }

    private getBlockInfoFromCallout(callout: HTMLElement, index: number): BlockInfo {
        const titleEl = callout.querySelector('.callout-title-inner');
        const title = titleEl?.textContent || 'Unnamed Block';
        const { id, code, vset } = parseVsetFromCodeBlock(callout);
        
        return { id, index, title, vset, code };
    }

    // ==================== Mirror Management ====================

    private removeAllMirrors() {
        // Remove ALL mirrors from the document
        document.querySelectorAll(`.${MIRROR_CLASS}`).forEach(m => m.remove());
        
        // Show all hidden code blocks
        document.querySelectorAll('pre[style*="display: none"]').forEach(b => {
            (b as HTMLElement).style.display = '';
        });
    }

    private applyMirrorToCallout(callout: HTMLElement): boolean {
        const codeBlock = callout.querySelector('pre') as HTMLElement | null;
        if (!codeBlock) return false;

        // Check if mirror already exists
        if (callout.querySelector(`.${MIRROR_CLASS}`)) {
            return true;
        }

        // Create mirror
        const mirror = document.createElement('div');
        mirror.className = MIRROR_CLASS;

        const indicator = document.createElement('div');
        indicator.className = 'vcalc-editor-mirror-indicator';
        indicator.innerHTML = '✏️ Editing in VCalc Editor';
        mirror.appendChild(indicator);

        const codeDisplay = document.createElement('pre');
        codeDisplay.className = 'vcalc-editor-mirror-code';
        const codeInner = document.createElement('code');
        codeInner.textContent = this.editorContent;
        codeDisplay.appendChild(codeInner);
        mirror.appendChild(codeDisplay);

        // Hide original and insert mirror
        codeBlock.style.display = 'none';
        codeBlock.parentNode?.insertBefore(mirror, codeBlock);

        return true;
    }

    private updateMirrorContent() {
        const callout = this.getSelectedCallout();
        if (!callout) return;

        const codeInner = callout.querySelector(`.${MIRROR_CLASS} code`);
        if (codeInner) {
            codeInner.textContent = this.editorContent;
        }
    }

    private startMirrorCheck() {
        this.stopMirrorCheck();
        this.mirrorCheckInterval = setInterval(() => {
            this.ensureMirrorExists();
        }, MIRROR_CHECK_INTERVAL);
    }

    private stopMirrorCheck() {
        if (this.mirrorCheckInterval) {
            clearInterval(this.mirrorCheckInterval);
            this.mirrorCheckInterval = null;
        }
    }

    private ensureMirrorExists() {
        if (!this.selectedBlockId && this.selectedBlockIndex < 0) return;

        const callout = this.getSelectedCallout();
        if (!callout) return;

        const hasMirror = callout.querySelector(`.${MIRROR_CLASS}`) !== null;
        
        if (!hasMirror) {
            this.removeAllMirrors();
            this.applyMirrorToCallout(callout);
        }
    }

    // ==================== Block Selection ====================

    private fullRefresh(retryCount: number = 0) {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        
        if (!this.blockSelector) return;
        this.blockSelector.empty();

        if (!activeFile) {
            this.blockSelector.createEl('option', { text: 'No active note', value: '-1' });
            this.setEditorText('# No active note');
            this.updateStatus('No active note');
            return;
        }

        const container = this.getMarkdownContainer();
        
        // Retry if container not ready yet (up to 3 times with 100ms delay)
        if (!container && retryCount < 3) {
            setTimeout(() => this.fullRefresh(retryCount + 1), 100);
            return;
        }

        const callouts = this.getAllCallouts();
        
        // Retry if no callouts but we expect some (container exists but maybe not rendered yet)
        if (callouts.length === 0 && container && retryCount < 3) {
            setTimeout(() => this.fullRefresh(retryCount + 1), 100);
            return;
        }
        
        if (callouts.length === 0) {
            this.blockSelector.createEl('option', { text: 'No VCalc blocks found', value: '-1' });
            this.setEditorText('# No VCalc blocks in this note');
            this.updateStatus('No blocks found');
            return;
        }

        // Build dropdown
        callouts.forEach((callout, index) => {
            const info = this.getBlockInfoFromCallout(callout, index);
            
            const option = this.blockSelector!.createEl('option', {
                text: `${index + 1}. ${info.title}${info.vset ? ` [${info.vset}]` : ''}`
            });
            option.value = String(index);
            if (info.id) {
                option.setAttribute('data-id', info.id);
            }
        });

        // Restore selection or select first
        let selectedOption: HTMLOptionElement | null = null;
        
        if (this.selectedBlockId) {
            selectedOption = this.blockSelector.querySelector(`option[data-id="${this.selectedBlockId}"]`);
        }
        if (!selectedOption && this.selectedBlockIndex >= 0) {
            selectedOption = this.blockSelector.querySelector(`option[value="${this.selectedBlockIndex}"]`);
        }
        if (!selectedOption && callouts.length > 0) {
            selectedOption = this.blockSelector.querySelector('option');
        }
        
        if (selectedOption) {
            this.blockSelector.value = selectedOption.value;
            if (!this.selectedBlockId && this.selectedBlockIndex < 0) {
                // Auto-connect to first block
                const id = selectedOption.getAttribute('data-id');
                const index = parseInt(selectedOption.value, 10);
                this.connectToBlock(id, index);
            }
        }

        this.updateStatus(`${callouts.length} block(s) in ${activeFile.basename}`);
    }

    private async switchToBlock(id: string | null, index: number) {
        if (id === this.selectedBlockId && index === this.selectedBlockIndex) return;

        await this.disconnectFromBlock();
        
        // Wait for Obsidian to re-render after potential file write
        await new Promise(resolve => setTimeout(resolve, 150));
        
        this.connectToBlock(id, index);
    }

    private connectToBlock(id: string | null, index: number) {
        // Try by ID first, then fall back to index
        let callout: HTMLElement | null = null;
        if (id) {
            callout = this.getCalloutById(id);
        }
        if (!callout) {
            callout = this.getCalloutByIndex(index);
        }
        
        if (!callout) {
            return;
        }

        const info = this.getBlockInfoFromCallout(callout, index);
        
        this.selectedBlockId = info.id;
        this.selectedBlockIndex = index;
        this.selectedBlockVset = info.vset;

        // Build full code including options line
        let fullCode = buildOptionsLine({
            id: info.id || generateVCalcId(),
            vset: info.vset
        }) + '\n' + info.code;

        this.editorContent = fullCode;
        this.setEditorText(fullCode);

        // Apply mirror
        this.removeAllMirrors();
        this.applyMirrorToCallout(callout);

        this.isDirty = false;
        this.updateDirtyIndicator();
        this.updateStatus(`Editing: ${info.title}${info.vset ? ` [${info.vset}]` : ''}`);

        this.startMirrorCheck();
    }

    private async disconnectFromBlock() {
        this.stopMirrorCheck();

        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        if (this.isDirty) {
            await this.writeToFile();
        }

        this.removeAllMirrors();

        this.selectedBlockId = null;
        this.selectedBlockIndex = -1;
        this.selectedBlockVset = null;
        this.isDirty = false;
        this.updateDirtyIndicator();
    }

    // ==================== Editor Management ====================

    private setEditorText(text: string) {
        if (!this.editorView) return;

        this.isUpdatingEditor = true;
        this.editorView.dispatch({
            changes: {
                from: 0,
                to: this.editorView.state.doc.length,
                insert: text
            }
        });
        this.isUpdatingEditor = false;
    }

    private getEditorText(): string {
        if (!this.editorView) return '';
        return this.editorView.state.doc.toString();
    }

    private onEditorChange() {
        this.editorContent = this.getEditorText();
        this.updateMirrorContent();

        this.isDirty = true;
        this.updateDirtyIndicator();

        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = setTimeout(() => {
            this.writeToFile();
        }, IDLE_SAVE_DELAY);
    }

    private updateDirtyIndicator() {
        if (this.dirtyIndicator) {
            this.dirtyIndicator.classList.toggle('vcalc-editor-dirty-visible', this.isDirty);
        }
    }

    // ==================== File Operations ====================

    private async writeToFile(): Promise<boolean> {
        if (!this.selectedBlockId && this.selectedBlockIndex < 0) return false;

        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return false;

        const newCode = this.editorContent;

        try {
            let content = await this.plugin.app.vault.read(activeFile);
            const lines = content.split('\n');

            // Find the block by ID first, then by index
            let targetBlockIndex = -1;
            let currentBlockIndex = -1;
            
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].match(/^>\s*\[!vcalc\]/i)) {
                    currentBlockIndex++;
                    
                    // Check if this block has our ID
                    let foundById = false;
                    if (this.selectedBlockId) {
                        for (let j = i + 1; j < lines.length && j < i + 10; j++) {
                            if (lines[j].includes(`id=${this.selectedBlockId}`)) {
                                foundById = true;
                                break;
                            }
                            if (!lines[j].startsWith('>')) break;
                        }
                    }
                    
                    if (foundById || currentBlockIndex === this.selectedBlockIndex) {
                        targetBlockIndex = currentBlockIndex;
                        
                        // Find code block boundaries
                        let codeStart = -1;
                        let codeEnd = -1;
                        
                        for (let j = i + 1; j < lines.length; j++) {
                            if (lines[j].match(/^>\s*```python/i) && codeStart === -1) {
                                codeStart = j;
                            } else if (lines[j].match(/^>\s*```\s*$/) && codeStart !== -1) {
                                codeEnd = j;
                                break;
                            }
                            if (!lines[j].startsWith('>') && lines[j].trim() !== '') break;
                        }
                        
                        if (codeStart !== -1 && codeEnd !== -1) {
                            const newCodeLines = newCode.split('\n').map(line => `> ${line}`);
                            lines.splice(codeStart + 1, codeEnd - codeStart - 1, ...newCodeLines);
                            
                            await this.plugin.app.vault.modify(activeFile, lines.join('\n'));
                            
                            this.isDirty = false;
                            this.updateDirtyIndicator();
                            this.updateStatus('Saved');
                            
                            return true;
                        }
                        break;
                    }
                }
            }

            console.error('Could not find block to save');
            return false;
        } catch (error) {
            console.error('Error writing to file:', error);
            new Notice(`Error saving: ${(error as Error).message}`);
            return false;
        }
    }

    private async saveToFile() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        if (await this.writeToFile()) {
            new Notice('Code saved to file');
        }
    }

    // ==================== Actions ====================

    private async runCurrentBlock() {
        if (!this.selectedBlockId && this.selectedBlockIndex < 0) {
            new Notice('No block selected');
            return;
        }

        // Save first
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        await this.writeToFile();

        // Wait for Obsidian to process
        await new Promise(resolve => setTimeout(resolve, 250));

        // Find the Run button
        const callout = this.getSelectedCallout();
        if (!callout) {
            new Notice('Block not found');
            return;
        }

        const runBtn = callout.querySelector('.calc-run-btn') as HTMLButtonElement | null;
        if (runBtn) {
            runBtn.click();
            this.updateStatus('Executed');
        } else {
            new Notice('Run button not found');
        }
    }

    private updateStatus(message: string) {
        if (this.statusBar) {
            this.statusBar.textContent = message;
        }
    }
}
