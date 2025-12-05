import { ItemView, WorkspaceLeaf, MarkdownView, Notice, Modal, App, setIcon } from 'obsidian';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightActiveLine, ViewUpdate } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, CompletionContext, CompletionResult, acceptCompletion } from '@codemirror/autocomplete';
import { EditorViewPlugin } from '../types';
import { VCALC_EDITOR_VIEW_TYPE, VCALC_ID_ATTRIBUTE, MATH_FUNCTIONS, MATH_CONSTANTS, GREEK_LETTERS, generateVCalcId, TIMING, RETRY_LIMITS, SEARCH_LIMITS, UI_CONFIG } from '../constants';
import { parseVsetFromCodeBlock, buildOptionsLine } from '../callout/parser';
import { getErrorMessage } from '../utils/type-guards';
import { NOTICES, UI, TOOLTIPS, STATUS, CONSOLE } from '../messages';
import { saveBlockLatexToFile } from '../file/latex-persistence';

// Block info with ID as primary identifier
interface BlockInfo {
    id: string | null;
    index: number;
    title: string;
    vset: string | null;
    code: string;
    hidden: boolean;
    accentVset: boolean | null;
    bgStyle: string | null;
    compact: boolean | null;
}

// Constants
const MIRROR_CLASS = 'vcalc-editor-mirror';

export class VCalcEditorView extends ItemView {
    private plugin: EditorViewPlugin;
    private editorView: EditorView | null = null;
    private blockSelector: HTMLSelectElement | null = null;
    private statusBar: HTMLElement | null = null;
    private dirtyIndicator: HTMLElement | null = null;

    // Settings panel elements
    private settingsPanel: HTMLElement | null = null;
    private settingsToggleBtn: HTMLButtonElement | null = null;
    private vsetSelector: HTMLSelectElement | null = null;
    private bgSelector: HTMLSelectElement | null = null;
    private compactCheckbox: HTMLInputElement | null = null;
    private accentCheckbox: HTMLInputElement | null = null;
    private hiddenCheckbox: HTMLInputElement | null = null;
    private settingsPanelOpen: boolean = false;

    // Selected block - ID is primary, index is fallback
    private selectedBlockId: string | null = null;
    private selectedBlockIndex: number = -1;
    private selectedBlockVset: string | null = null;
    private selectedBlockLine: number = -1;  // Line number in markdown file (for hint-based lookup)

    // Current block options (for settings panel)
    private currentBlockHidden: boolean = false;
    private currentBlockAccentVset: boolean | null = null;
    private currentBlockBgStyle: string | null = null;
    private currentBlockCompact: boolean | null = null;
    
    // Editor state
    private isUpdatingEditor: boolean = false;
    private isDirty: boolean = false;
    private editorContent: string = '';
    private isDisconnected: boolean = true;  // Start disconnected until a block is selected

    // File write lock to prevent race conditions
    private isWriting: boolean = false;
    private writeQueue: Array<() => Promise<void>> = [];

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
        return 'vcalc-editor';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('vcalc-editor-container');

        // Header
        const header = container.createEl('div', { cls: 'vcalc-editor-header' });
        const selectorRow = header.createEl('div', { cls: 'vcalc-editor-selector-row' });
        selectorRow.createEl('span', { text: UI.EDITOR_LABEL_BLOCK, cls: 'vcalc-editor-label' });
        
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
        this.dirtyIndicator.title = TOOLTIPS.UNSAVED_CHANGES;

        const renameBtn = selectorRow.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-rename-btn vcalc-editor-icon-btn' });
        setIcon(renameBtn, 'pencil');
        renameBtn.title = TOOLTIPS.RENAME_BLOCK;
        renameBtn.addEventListener('click', () => this.renameCurrentBlock());

        const refreshBtn = selectorRow.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-refresh-btn vcalc-editor-icon-btn' });
        setIcon(refreshBtn, 'refresh-cw');
        refreshBtn.title = TOOLTIPS.REFRESH_BLOCK_LIST;
        refreshBtn.addEventListener('click', () => this.fullRefresh());

        // Settings toggle button
        this.settingsToggleBtn = selectorRow.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-settings-btn vcalc-editor-icon-btn' });
        setIcon(this.settingsToggleBtn, 'settings');
        this.settingsToggleBtn.title = TOOLTIPS.TOGGLE_SETTINGS;
        this.settingsToggleBtn.addEventListener('click', () => this.toggleSettingsPanel());

        // Settings Panel (initially hidden)
        this.settingsPanel = header.createEl('div', { cls: 'vcalc-editor-settings-panel' });
        this.settingsPanel.style.display = 'none';
        this.createSettingsPanel(this.settingsPanel);

        // Editor
        const editorContainer = container.createEl('div', { cls: 'vcalc-editor-codemirror' });
        this.initializeEditor(editorContainer);

        // Buttons
        const buttonBar = container.createEl('div', { cls: 'vcalc-editor-buttons' });

        const runBtn = buttonBar.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-run-btn' });
        setIcon(runBtn, 'play');
        runBtn.appendChild(document.createTextNode(' ' + UI.BUTTON_RUN));
        runBtn.title = 'Run calculation (Ctrl+Enter)';
        runBtn.addEventListener('click', () => this.runCurrentBlock());

        const saveBtn = buttonBar.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-save-btn' });
        setIcon(saveBtn, 'save');
        saveBtn.appendChild(document.createTextNode(' ' + UI.BUTTON_SAVE_TO_FILE));
        saveBtn.title = 'Save LaTeX output to file';
        saveBtn.addEventListener('click', () => this.saveLatexToFile());

        const disconnectBtn = buttonBar.createEl('button', { cls: 'vcalc-editor-btn vcalc-editor-disconnect-btn' });
        setIcon(disconnectBtn, 'unplug');
        disconnectBtn.appendChild(document.createTextNode(' ' + UI.EDITOR_BUTTON_DISCONNECT));
        disconnectBtn.title = 'Disconnect from current block';
        disconnectBtn.addEventListener('click', () => this.handleDisconnect());

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

        // Build autocomplete accept keybindings based on setting
        const autocompleteKeyBindings: { key: string; run: typeof acceptCompletion }[] = [];
        const acceptKeySetting = this.plugin.settings.autocompleteAcceptKey;

        if (acceptKeySetting === 'tab' || acceptKeySetting === 'both') {
            autocompleteKeyBindings.push({ key: 'Tab', run: acceptCompletion });
        }
        if (acceptKeySetting === 'enter' || acceptKeySetting === 'both') {
            autocompleteKeyBindings.push({ key: 'Enter', run: acceptCompletion });
        }

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
                    ...autocompleteKeyBindings,
                    ...defaultKeymap,
                    ...historyKeymap,
                    { key: 'Ctrl-Enter', run: () => { this.runCurrentBlock(); return true; } },
                    { key: 'Cmd-Enter', run: () => { this.runCurrentBlock(); return true; } },
                    { key: 'Ctrl-s', run: () => { this.saveCodeToFile(); return true; } },
                    { key: 'Cmd-s', run: () => { this.saveCodeToFile(); return true; } },
                ]),
                EditorView.updateListener.of((update: ViewUpdate) => {
                    if (update.docChanged && !this.isUpdatingEditor) {
                        this.onEditorChange();
                    }
                }),
                EditorView.theme({
                    '&': { height: '100%', fontSize: `${UI_CONFIG.EDITOR_FONT_SIZE_PX}px` },
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

        // Get all callouts for searching
        const callouts = this.getAllCallouts();

        // If we have a cached index hint, check that position first
        if (this.selectedBlockIndex >= 0 && this.selectedBlockIndex < callouts.length) {
            const hintCallout = callouts[this.selectedBlockIndex];
            const { id: blockId } = parseVsetFromCodeBlock(hintCallout);
            if (blockId === id) {
                return hintCallout;
            }
        }

        // Fallback: parse each callout's code to find the ID
        for (let i = 0; i < callouts.length; i++) {
            const callout = callouts[i];
            const { id: blockId } = parseVsetFromCodeBlock(callout);
            if (blockId === id) {
                // Update cached index for next time
                this.selectedBlockIndex = i;
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
            if (callout) {
                // Update cached index to current DOM position
                const callouts = this.getAllCallouts();
                const newIndex = callouts.indexOf(callout);
                if (newIndex !== -1) {
                    this.selectedBlockIndex = newIndex;
                }
                return callout;
            }
        }
        // Only fall back to index if we have no ID (legacy blocks without IDs)
        if (this.selectedBlockIndex >= 0 && !this.selectedBlockId) {
            return this.getCalloutByIndex(this.selectedBlockIndex);
        }
        return null;
    }

    private getBlockInfoFromCallout(callout: HTMLElement, index: number): BlockInfo {
        const titleEl = callout.querySelector('.callout-title-inner');
        const title = titleEl?.textContent || 'Unnamed Block';
        const { id, code, vset, hidden, accentVset, bgStyle, compact } = parseVsetFromCodeBlock(callout);

        return { id, index, title, vset, code, hidden, accentVset, bgStyle, compact };
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
        indicator.innerHTML = UI.MIRROR_INDICATOR;
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
        }, TIMING.MIRROR_CHECK_INTERVAL_MS);
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
            this.blockSelector.createEl('option', { text: UI.SELECTOR_NO_ACTIVE_NOTE, value: '-1' });
            this.setEditorText(`# ${UI.SELECTOR_NO_ACTIVE_NOTE}`);
            this.updateStatus(UI.SELECTOR_NO_ACTIVE_NOTE);
            return;
        }

        const container = this.getMarkdownContainer();

        // Retry if container not ready yet
        if (!container && retryCount < RETRY_LIMITS.MAX_BLOCK_RETRIES) {
            setTimeout(() => this.fullRefresh(retryCount + 1), TIMING.BLOCK_RETRY_DELAY_MS);
            return;
        }

        const callouts = this.getAllCallouts();

        // Retry if no callouts but we expect some (container exists but maybe not rendered yet)
        if (callouts.length === 0 && container && retryCount < RETRY_LIMITS.MAX_BLOCK_RETRIES) {
            setTimeout(() => this.fullRefresh(retryCount + 1), TIMING.BLOCK_RETRY_DELAY_MS);
            return;
        }
        
        if (callouts.length === 0) {
            this.blockSelector.createEl('option', { text: UI.SELECTOR_NO_BLOCKS, value: '-1' });
            this.setEditorText(`# ${UI.SELECTOR_NO_BLOCKS}`);
            this.updateStatus(UI.SELECTOR_NO_BLOCKS);
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
            // Only set the dropdown value if NOT disconnected
            if (!this.isDisconnected) {
                this.blockSelector.value = selectedOption.value;
                // Auto-connect to first block if no block currently selected
                if (!this.selectedBlockId && this.selectedBlockIndex < 0) {
                    const id = selectedOption.getAttribute('data-id');
                    const index = parseInt(selectedOption.value, 10);
                    this.connectToBlock(id, index);
                }
            } else {
                // When disconnected, reset dropdown to show no selection
                this.blockSelector.selectedIndex = -1;
            }
        }

        // Show appropriate status based on connection state
        if (this.isDisconnected) {
            this.updateStatus('Disconnected');
        } else {
            this.updateStatus(`${callouts.length} block(s) in ${activeFile.basename}`);
        }
    }

    private async switchToBlock(id: string | null, index: number) {
        // Skip if already connected to this exact block (and not disconnected)
        if (!this.isDisconnected && id === this.selectedBlockId && index === this.selectedBlockIndex) return;

        await this.disconnectFromBlock();

        // Wait for Obsidian to re-render after potential file write
        await new Promise(resolve => setTimeout(resolve, TIMING.DOM_STABILIZATION_DELAY_MS));

        this.connectToBlock(id, index);
    }

    private connectToBlock(id: string | null, index: number) {
        // Clear disconnected state when connecting to a block
        this.isDisconnected = false;

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

        // Build full code including options line with all block options
        const fullCode = buildOptionsLine({
            id: info.id || generateVCalcId(),
            vset: info.vset,
            hidden: info.hidden,
            accentVset: info.accentVset,
            bgStyle: info.bgStyle,
            compact: info.compact
        }) + '\n' + info.code;

        this.editorContent = fullCode;
        this.setEditorText(fullCode);

        // Update settings panel with current block options
        this.updateSettingsPanel(info);

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
            await this.safeWriteToFile();
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
            this.safeWriteToFile();
        }, TIMING.IDLE_SAVE_DELAY_MS);
    }

    private updateDirtyIndicator() {
        if (this.dirtyIndicator) {
            this.dirtyIndicator.classList.toggle('vcalc-editor-dirty-visible', this.isDirty);
        }
    }

    // ==================== File Operations ====================

    /**
     * Enqueue a write operation to prevent race conditions
     */
    private async safeWriteToFile(): Promise<boolean> {
        return new Promise((resolve) => {
            this.writeQueue.push(async () => {
                const result = await this.writeToFile();
                resolve(result);
            });
            this.processWriteQueue();
        });
    }

    /**
     * Process the write queue sequentially
     */
    private async processWriteQueue() {
        if (this.isWriting || this.writeQueue.length === 0) return;

        this.isWriting = true;
        while (this.writeQueue.length > 0) {
            const write = this.writeQueue.shift();
            if (write) {
                await write();
            }
        }
        this.isWriting = false;
    }

    /**
     * Internal write method - should only be called through safeWriteToFile
     */
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
                        for (let j = i + 1; j < lines.length && j < i + SEARCH_LIMITS.BLOCK_ID_LOOKAHEAD; j++) {
                            if (lines[j].includes(`id=${this.selectedBlockId}`)) {
                                foundById = true;
                                break;
                            }
                            if (!lines[j].startsWith('>')) break;
                        }
                    }
                    
                    if (foundById || currentBlockIndex === this.selectedBlockIndex) {
                        targetBlockIndex = currentBlockIndex;
                        this.selectedBlockLine = i;  // Cache line number for faster lookup

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

            console.error(CONSOLE.COULD_NOT_FIND_BLOCK_SAVE);
            return false;
        } catch (error) {
            console.error(CONSOLE.ERROR_WRITING_FILE, error);
            new Notice(NOTICES.ERROR_SAVING_BLOCK(getErrorMessage(error)));
            return false;
        }
    }

    /**
     * Immediately save the code to the markdown file (triggered by Ctrl+S).
     */
    private async saveCodeToFile() {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }

        if (await this.safeWriteToFile()) {
            new Notice(NOTICES.CODE_SAVED);
        }
    }

    /**
     * Save the LaTeX output of the current block to the markdown file.
     */
    private async saveLatexToFile() {
        if (!this.selectedBlockId && this.selectedBlockIndex < 0) {
            new Notice(NOTICES.NO_BLOCK_SELECTED);
            return;
        }

        const callout = this.getSelectedCallout();
        if (!callout) {
            new Notice(NOTICES.BLOCK_NOT_FOUND);
            return;
        }

        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice(NOTICES.NO_ACTIVE_VIEW);
            return;
        }

        const info = this.getBlockInfoFromCallout(callout, this.selectedBlockIndex);
        await saveBlockLatexToFile(this.plugin.app, callout, activeFile.path, info.title);

        // Remove outdated badge after saving (same as callout button)
        const outdatedWrappers = callout.querySelectorAll('.calc-saved-outdated');
        outdatedWrappers.forEach((wrapper) => wrapper.remove());
    }

    /**
     * Handle disconnect button click - disconnect from current block and reset editor.
     */
    private async handleDisconnect() {
        await this.disconnectFromBlock();
        this.isDisconnected = true;
        this.setEditorText('# Select a block to edit');
        this.updateStatus('Disconnected');
        this.fullRefresh();
    }

    // ==================== Actions ====================

    /**
     * Run the currently selected block.
     * After execution, keeps focus in the editor and scrolls to show the output.
     * Shows execution time and variable count in the status bar.
     */
    private async runCurrentBlock() {
        if (!this.selectedBlockId && this.selectedBlockIndex < 0) {
            new Notice(NOTICES.NO_BLOCK_SELECTED);
            return;
        }

        // Save first
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        await this.safeWriteToFile();

        // Wait for Obsidian to process the file change
        await new Promise(resolve => setTimeout(resolve, TIMING.POST_RUN_RERENDER_DELAY_MS));

        // Find the Run button
        const callout = this.getSelectedCallout();
        if (!callout) {
            new Notice(NOTICES.BLOCK_NOT_FOUND);
            return;
        }

        const runBtn = callout.querySelector('.calc-run-btn') as HTMLButtonElement | null;
        if (runBtn) {
            // Track execution time
            const startTime = performance.now();
            this.updateStatus(STATUS.RUNNING);

            runBtn.click();

            // Wait for execution to complete and output to render
            await new Promise(resolve => setTimeout(resolve, TIMING.POST_WRITE_SETTLE_DELAY_MS));

            const executionTime = Math.round(performance.now() - startTime);

            // Focus the VCalc editor to take focus away from the MarkdownView
            if (this.editorView) {
                this.editorView.focus();
            }

            // Scroll the callout's output into view (not the code block)
            this.scrollToOutput(callout);

            // Check for errors and update status with execution details
            const { hasError, errorMessage } = this.checkForExecutionError(callout);
            const variableCount = this.getVariableCount();

            this.updateExecutionStatus(!hasError, executionTime, variableCount, errorMessage);
        } else {
            new Notice(NOTICES.RUN_BUTTON_NOT_FOUND);
        }
    }

    /**
     * Scroll the markdown view to show the output of a callout.
     * Scrolls to the output container rather than the code block.
     */
    private scrollToOutput(callout: HTMLElement) {
        // Find the output container (rendered math)
        const output = callout.querySelector('.calc-output');
        if (output) {
            // Scroll the output into view with some margin at the top
            output.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // If no output yet, scroll to the callout itself
            callout.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    /**
     * Prompt the user to rename the currently selected block.
     * Updates the callout title in the markdown file.
     */
    private async renameCurrentBlock() {
        if (!this.selectedBlockId && this.selectedBlockIndex < 0) {
            new Notice(NOTICES.NO_BLOCK_SELECTED);
            return;
        }

        const callout = this.getSelectedCallout();
        if (!callout) {
            new Notice(NOTICES.BLOCK_NOT_FOUND);
            return;
        }

        // Get current title
        const info = this.getBlockInfoFromCallout(callout, this.selectedBlockIndex);
        const currentTitle = info.title;

        // Prompt for new title
        const newTitle = await this.promptForTitle(currentTitle);
        if (!newTitle || newTitle === currentTitle) {
            return; // User cancelled or no change
        }

        // Save any pending changes first
        if (this.isDirty) {
            await this.safeWriteToFile();
        }

        // Update the title in the file
        const success = await this.updateBlockTitle(newTitle);
        if (success) {
            new Notice(NOTICES.BLOCK_RENAMED(newTitle));
            // Refresh to show new title in dropdown
            await new Promise(resolve => setTimeout(resolve, TIMING.DOM_STABILIZATION_DELAY_MS));
            this.fullRefresh();
        }
    }

    /**
     * Show a prompt dialog for entering a new block title.
     */
    private promptForTitle(currentTitle: string): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new RenameModal(this.plugin.app, currentTitle, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }

    /**
     * Update the block title in the markdown file.
     */
    private async updateBlockTitle(newTitle: string): Promise<boolean> {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return false;

        try {
            let content = await this.plugin.app.vault.read(activeFile);
            const lines = content.split('\n');

            // Find the block by ID first, then by index
            let currentBlockIndex = -1;

            for (let i = 0; i < lines.length; i++) {
                const match = lines[i].match(/^>\s*\[!vcalc\]\s*(.*)/i);
                if (match) {
                    currentBlockIndex++;

                    // Check if this block has our ID
                    let foundById = false;
                    if (this.selectedBlockId) {
                        for (let j = i + 1; j < lines.length && j < i + SEARCH_LIMITS.BLOCK_ID_LOOKAHEAD; j++) {
                            if (lines[j].includes(`id=${this.selectedBlockId}`)) {
                                foundById = true;
                                break;
                            }
                            if (!lines[j].startsWith('>')) break;
                        }
                    }

                    if (foundById || currentBlockIndex === this.selectedBlockIndex) {
                        // Update the title line
                        lines[i] = `> [!vcalc] ${newTitle}`;
                        await this.plugin.app.vault.modify(activeFile, lines.join('\n'));
                        return true;
                    }
                }
            }

            console.error(CONSOLE.COULD_NOT_FIND_BLOCK_RENAME);
            return false;
        } catch (error) {
            console.error(CONSOLE.ERROR_RENAMING, error);
            new Notice(NOTICES.ERROR_RENAMING_BLOCK(getErrorMessage(error)));
            return false;
        }
    }

    /**
     * Update the status bar with a simple message.
     */
    private updateStatus(message: string) {
        if (this.statusBar) {
            this.statusBar.textContent = message;
            this.statusBar.className = 'vcalc-editor-status';
        }
    }

    /**
     * Update the status bar with execution result information.
     * Shows success/error status, execution time, and variable count.
     */
    private updateExecutionStatus(success: boolean, executionTimeMs: number, variableCount: number, errorMessage?: string) {
        if (!this.statusBar) return;

        // Clear existing classes and set base class
        this.statusBar.className = 'vcalc-editor-status';

        if (success) {
            this.statusBar.classList.add('vcalc-status-success');
            const timeStr = executionTimeMs < TIMING.MS_SECONDS_THRESHOLD
                ? `${executionTimeMs}ms`
                : `${(executionTimeMs / TIMING.MS_SECONDS_THRESHOLD).toFixed(2)}s`;

            const varText = STATUS.VARIABLE_COUNT(variableCount);
            this.statusBar.textContent = STATUS.SUCCESS(timeStr, varText);
        } else {
            this.statusBar.classList.add('vcalc-status-error');
            const shortError = errorMessage
                ? (errorMessage.length > UI_CONFIG.ERROR_MESSAGE_MAX_LENGTH ? errorMessage.substring(0, UI_CONFIG.ERROR_MESSAGE_TRUNCATE_TO) + '...' : errorMessage)
                : STATUS.EXECUTION_FAILED;
            this.statusBar.textContent = STATUS.ERROR(shortError);
            this.statusBar.title = errorMessage || STATUS.EXECUTION_FAILED;
        }
    }

    /**
     * Get the number of variables in the current vset.
     */
    private getVariableCount(): number {
        if (!this.selectedBlockVset) return 0;

        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (!activeFile) return 0;

        const vars = this.plugin.getVariables(activeFile.path, this.selectedBlockVset);
        return vars ? Object.keys(vars).length : 0;
    }

    /**
     * Check if the execution resulted in an error by examining the output.
     */
    private checkForExecutionError(callout: HTMLElement): { hasError: boolean; errorMessage?: string } {
        // Check for error class on output
        const output = callout.querySelector('.calc-output');
        if (!output) {
            return { hasError: false };
        }

        // Check for error message in output
        const errorEl = output.querySelector('.calc-error, .error, [class*="error"]');
        if (errorEl) {
            return {
                hasError: true,
                errorMessage: errorEl.textContent?.trim() || STATUS.EXECUTION_ERROR
            };
        }

        // Check if output is empty (might indicate silent failure)
        const hasContent = output.querySelector('.calc-math-wrapper, .math-block');
        if (!hasContent && output.textContent?.trim() === '') {
            return { hasError: false }; // Empty but not necessarily an error
        }

        return { hasError: false };
    }

    // ==================== Settings Panel ====================

    /**
     * Toggle the visibility of the settings panel.
     */
    private toggleSettingsPanel() {
        this.settingsPanelOpen = !this.settingsPanelOpen;
        if (this.settingsPanel) {
            this.settingsPanel.style.display = this.settingsPanelOpen ? 'block' : 'none';
        }
        if (this.settingsToggleBtn) {
            this.settingsToggleBtn.classList.toggle('vcalc-settings-btn-active', this.settingsPanelOpen);
        }
    }

    /**
     * Create the settings panel UI elements.
     */
    private createSettingsPanel(container: HTMLElement) {
        // Variable Set row
        const vsetRow = container.createEl('div', { cls: 'vcalc-settings-row' });
        vsetRow.createEl('label', { text: UI.SETTINGS_VSET_LABEL, cls: 'vcalc-settings-label' });
        this.vsetSelector = vsetRow.createEl('select', { cls: 'vcalc-settings-select' });
        this.vsetSelector.addEventListener('change', () => this.onSettingChange());

        // Background row
        const bgRow = container.createEl('div', { cls: 'vcalc-settings-row' });
        bgRow.createEl('label', { text: UI.SETTINGS_BG_LABEL, cls: 'vcalc-settings-label' });
        this.bgSelector = bgRow.createEl('select', { cls: 'vcalc-settings-select' });
        this.bgSelector.createEl('option', { text: UI.SETTINGS_BG_DEFAULT, value: '' });
        this.bgSelector.createEl('option', { text: UI.SETTINGS_BG_TRANSPARENT, value: 'transparent' });
        this.bgSelector.createEl('option', { text: UI.SETTINGS_BG_SUBTLE, value: 'subtle' });
        this.bgSelector.createEl('option', { text: UI.SETTINGS_BG_SOLID, value: 'solid' });
        this.bgSelector.addEventListener('change', () => this.onSettingChange());

        // Checkboxes row
        const checkboxRow = container.createEl('div', { cls: 'vcalc-settings-row vcalc-settings-checkboxes' });

        // Compact checkbox
        const compactLabel = checkboxRow.createEl('label', { cls: 'vcalc-settings-checkbox-label' });
        this.compactCheckbox = compactLabel.createEl('input', { type: 'checkbox' });
        compactLabel.createSpan({ text: UI.SETTINGS_COMPACT_LABEL });
        this.compactCheckbox.addEventListener('change', () => this.onSettingChange());

        // Accent checkbox
        const accentLabel = checkboxRow.createEl('label', { cls: 'vcalc-settings-checkbox-label' });
        this.accentCheckbox = accentLabel.createEl('input', { type: 'checkbox' });
        accentLabel.createSpan({ text: UI.SETTINGS_ACCENT_LABEL });
        this.accentCheckbox.addEventListener('change', () => this.onSettingChange());

        // Hidden checkbox
        const hiddenLabel = checkboxRow.createEl('label', { cls: 'vcalc-settings-checkbox-label' });
        this.hiddenCheckbox = hiddenLabel.createEl('input', { type: 'checkbox' });
        hiddenLabel.createSpan({ text: UI.SETTINGS_HIDDEN_LABEL });
        this.hiddenCheckbox.addEventListener('change', () => this.onSettingChange());

        // Apply button row
        const applyRow = container.createEl('div', { cls: 'vcalc-settings-row vcalc-settings-apply-row' });
        const applyBtn = applyRow.createEl('button', {
            text: UI.SETTINGS_APPLY_BUTTON,
            cls: 'vcalc-editor-btn vcalc-settings-apply-btn'
        });
        applyBtn.addEventListener('click', () => this.applySettings());
    }

    /**
     * Update the settings panel with the current block's options.
     */
    private updateSettingsPanel(info: BlockInfo) {
        // Update vset selector options
        this.populateVsetSelector(info.vset);

        // Update background selector
        if (this.bgSelector) {
            this.bgSelector.value = info.bgStyle || '';
        }

        // Update checkboxes
        if (this.compactCheckbox) {
            this.compactCheckbox.checked = info.compact === true;
        }
        if (this.accentCheckbox) {
            this.accentCheckbox.checked = info.accentVset === true;
        }
        if (this.hiddenCheckbox) {
            this.hiddenCheckbox.checked = info.hidden;
        }

        // Store current values
        this.currentBlockHidden = info.hidden;
        this.currentBlockAccentVset = info.accentVset;
        this.currentBlockBgStyle = info.bgStyle;
        this.currentBlockCompact = info.compact;
    }

    /**
     * Populate the vset selector with available variable sets.
     */
    private populateVsetSelector(currentVset: string | null) {
        if (!this.vsetSelector) return;

        this.vsetSelector.empty();

        // Add "none" option
        const noneOption = this.vsetSelector.createEl('option', { text: UI.SETTINGS_VSET_NONE, value: '' });
        if (!currentVset) noneOption.selected = true;

        // Get existing vsets from the current file
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile) {
            const noteVars = this.plugin.variableStore[activeFile.path];
            if (noteVars) {
                const vsets = Object.keys(noteVars);
                for (const vset of vsets) {
                    const option = this.vsetSelector.createEl('option', { text: vset, value: vset });
                    if (vset === currentVset) option.selected = true;
                }
            }
        }

        // If current vset exists but wasn't in the store (new block), add it
        if (currentVset && this.vsetSelector.value !== currentVset) {
            const option = this.vsetSelector.createEl('option', { text: currentVset, value: currentVset });
            option.selected = true;
        }

        // Add "Create new..." option
        this.vsetSelector.createEl('option', { text: UI.SETTINGS_VSET_CREATE_NEW, value: '__new__' });
    }

    /**
     * Handle changes to settings panel controls.
     */
    private onSettingChange() {
        // Handle "Create new" vset selection
        if (this.vsetSelector?.value === '__new__') {
            this.promptForNewVset();
            return;
        }

        // Gather current settings
        const newVset = this.vsetSelector?.value || null;
        const newBgStyle = this.bgSelector?.value || null;
        const newCompact = this.compactCheckbox?.checked || false;
        const newAccentVset = this.accentCheckbox?.checked || false;
        const newHidden = this.hiddenCheckbox?.checked || false;

        // Update internal state
        this.selectedBlockVset = newVset;
        this.currentBlockBgStyle = newBgStyle;
        this.currentBlockCompact = newCompact ? true : null;
        this.currentBlockAccentVset = newAccentVset ? true : null;
        this.currentBlockHidden = newHidden;

        // Rebuild the options line in the editor
        this.updateEditorOptionsLine();
    }

    /**
     * Prompt for a new variable set name.
     */
    private async promptForNewVset() {
        const newName = await this.promptForVsetName();
        if (newName) {
            // Add the new vset to the selector and select it
            if (this.vsetSelector) {
                // Insert before the "Create new..." option
                const createOption = this.vsetSelector.querySelector('option[value="__new__"]');
                const newOption = this.vsetSelector.createEl('option', { text: newName, value: newName });
                if (createOption) {
                    this.vsetSelector.insertBefore(newOption, createOption);
                }
                this.vsetSelector.value = newName;
                this.onSettingChange();
            }
        } else {
            // User cancelled, revert to previous selection
            if (this.vsetSelector) {
                this.vsetSelector.value = this.selectedBlockVset || '';
            }
        }
    }

    /**
     * Show a prompt dialog for entering a new vset name.
     */
    private promptForVsetName(): Promise<string | null> {
        return new Promise((resolve) => {
            const modal = new VsetNameModal(this.plugin.app, (result) => {
                resolve(result);
            });
            modal.open();
        });
    }

    /**
     * Update the options line in the editor content.
     */
    private updateEditorOptionsLine() {
        if (!this.editorView || !this.selectedBlockId) return;

        const currentText = this.getEditorText();
        const lines = currentText.split('\n');

        // Build new options line
        const newOptionsLine = buildOptionsLine({
            id: this.selectedBlockId,
            vset: this.selectedBlockVset,
            hidden: this.currentBlockHidden,
            accentVset: this.currentBlockAccentVset,
            bgStyle: this.currentBlockBgStyle,
            compact: this.currentBlockCompact
        });

        // Replace the first line if it's an options line, otherwise prepend
        if (lines.length > 0 && lines[0].startsWith('# vcalc:')) {
            lines[0] = newOptionsLine;
        } else {
            lines.unshift(newOptionsLine);
        }

        const newText = lines.join('\n');
        if (newText !== currentText) {
            this.setEditorText(newText);
            this.editorContent = newText;
            this.isDirty = true;
            this.updateDirtyIndicator();
            this.updateMirrorContent();
        }
    }

    /**
     * Apply settings by saving and running the block.
     */
    private async applySettings() {
        // First save any pending changes
        if (this.isDirty) {
            await this.safeWriteToFile();
        }
        // Then run the block to apply visual changes
        await this.runCurrentBlock();
    }
}

/**
 * Modal dialog for entering a new vset name.
 */
class VsetNameModal extends Modal {
    private result: string = '';
    private onSubmit: (result: string | null) => void;

    constructor(app: App, onSubmit: (result: string | null) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('vcalc-rename-modal');

        contentEl.createEl('h3', { text: 'New Variable Set' });

        const inputContainer = contentEl.createEl('div', { cls: 'vcalc-rename-input-container' });
        const input = inputContainer.createEl('input', {
            type: 'text',
            cls: 'vcalc-rename-input',
            placeholder: 'e.g., physics, main, data'
        });
        input.addEventListener('input', (e: Event) => {
            this.result = (e.target as HTMLInputElement).value;
        });
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit();
            }
        });

        const buttonContainer = contentEl.createEl('div', { cls: 'vcalc-rename-buttons' });

        const cancelBtn = buttonContainer.createEl('button', { text: UI.MODAL_BUTTON_CANCEL });
        cancelBtn.addEventListener('click', () => {
            this.onSubmit(null);
            this.close();
        });

        const submitBtn = buttonContainer.createEl('button', { text: 'Create', cls: 'mod-cta' });
        submitBtn.addEventListener('click', () => this.submit());

        input.focus();
    }

    private submit() {
        const trimmed = this.result.trim().replace(/\s+/g, '_'); // Replace spaces with underscores
        if (trimmed && /^\w+$/.test(trimmed)) {
            this.onSubmit(trimmed);
        } else {
            this.onSubmit(null);
        }
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Modal dialog for renaming a block.
 */
class RenameModal extends Modal {
    private result: string;
    private onSubmit: (result: string | null) => void;

    constructor(app: App, currentTitle: string, onSubmit: (result: string | null) => void) {
        super(app);
        this.result = currentTitle;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.addClass('vcalc-rename-modal');

        contentEl.createEl('h3', { text: UI.MODAL_RENAME_TITLE });

        const inputContainer = contentEl.createEl('div', { cls: 'vcalc-rename-input-container' });
        const input = inputContainer.createEl('input', {
            type: 'text',
            cls: 'vcalc-rename-input',
            value: this.result
        });
        input.addEventListener('input', (e: Event) => {
            this.result = (e.target as HTMLInputElement).value;
        });
        input.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.submit();
            }
        });

        const buttonContainer = contentEl.createEl('div', { cls: 'vcalc-rename-buttons' });

        const cancelBtn = buttonContainer.createEl('button', { text: UI.MODAL_BUTTON_CANCEL });
        cancelBtn.addEventListener('click', () => {
            this.onSubmit(null);
            this.close();
        });

        const submitBtn = buttonContainer.createEl('button', { text: UI.MODAL_BUTTON_RENAME, cls: 'mod-cta' });
        submitBtn.addEventListener('click', () => this.submit());

        // Focus the input
        input.focus();
        input.select();
    }

    private submit() {
        const trimmed = this.result.trim();
        if (trimmed) {
            this.onSubmit(trimmed);
        } else {
            this.onSubmit(null);
        }
        this.close();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
