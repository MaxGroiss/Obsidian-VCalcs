import { Plugin, MarkdownPostProcessorContext, Notice, MarkdownView, MarkdownRenderer, Component, WorkspaceLeaf, App, setIcon, addIcon } from 'obsidian';

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
    updateVariable as storeUpdateVariable,
    removeBlockVariables as storeRemoveBlockVariables
} from './stores/variable-store';

// Parser
import { parseVsetFromCodeBlock, getCalloutTitle, buildOptionsLine } from './callout/parser';

// Python execution (Pyodide WASM)
import { PyodideExecutor } from './python/pyodide-executor';

// File persistence
import {
    saveBlockLatexToFile,
    clearAllSavedLatex as fileClearAllSavedLatex,
    clearBlockSavedLatex as fileClearBlockSavedLatex
} from './file/latex-persistence';

// Type guards
import { getErrorMessage, extractSimplifiedError } from './utils/type-guards';

// Messages
import { NOTICES, UI, TOOLTIPS, CONSOLE } from './messages';


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

        // Register custom VCalc icons
        // Variables panel icon (VCalc logo + database cylinder)
        addIcon('vcalc-variables', `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g transform="matrix(.39462 0 0 .39462 13.885 7.5238)" stroke-linecap="round" stroke-linejoin="round" stroke-width="4.875"><path fill="currentColor" d="m12 1c-2.8223 0.04338-5.774 0.29645-8.3095 1.6397-1.084 0.55904-2.0633 1.8187-1.5579 3.0821 0.69454 1.5879 2.5238 2.1657 4.0587 2.6068 3.6715 0.88694 7.5604 0.89369 11.248 0.092507 1.5855-0.42023 3.4178-0.93347 4.3104-2.4377 0.67896-1.1752-0.11286-2.5834-1.1882-3.1883-2.3499-1.3914-5.1681-1.6713-7.8437-1.7863-0.23916-0.0059358-0.47839-0.0088551-0.71762-0.0088555zm0 2c2.4418 0.047086 4.9902 0.22936 7.2157 1.3232 0.90062 0.24952 0.9006 1.1041 0 1.3536-2.3641 1.1514-5.0739 1.3116-7.662 1.3193-2.3558-0.091889-4.8305-0.2822-6.9442-1.4196-1.327-0.57298 0.22175-1.3936 0.94508-1.6051 2.0537-0.75137 4.2731-0.95082 6.4454-0.97142z"/><path fill="currentColor" d="m3 4c-1.0943 0.025862-1.0192 1.18-1 1.9514 0.00402 4.4036-0.00804 8.8076 0.00604 13.211 0.16994 1.6914 1.9026 2.5612 3.3528 2.9948 3.5194 1.0024 7.2656 1.0261 10.872 0.54062 1.8185-0.33171 3.8495-0.69472 5.1577-2.1205 0.8577-0.92475 0.55631-2.2231 0.61155-3.3613v-12.216c-0.12484-1.6784-2.4035-0.86522-2 0.53518-0.0076 4.5204 0.01519 9.0427-0.01139 13.562-0.59088 0.86017-1.7452 1.076-2.6916 1.3555-3.4737 0.741-7.1203 0.741-10.594 0-0.94645-0.27954-2.1007-0.49534-2.6916-1.3555-0.026563-4.6977-0.0038033-9.3983-0.011388-14.097 0.012235-0.53636-0.46359-1.0122-1-1z"/><path fill="currentColor" d="m3 11c-1.7214 0.33398-0.86934 2.4698 0.16797 3.1074 1.9376 1.3436 4.3836 1.6044 6.6705 1.8185 3.2735 0.17296 6.6744 0.08538 9.765-1.1191 1.2266-0.48598 2.5478-1.5704 2.3714-3.0293-0.27278-1.2487-2.1593-0.80696-2.0369 0.43104-0.99594 1.0008-2.4976 1.2124-3.826 1.4792-3.3651 0.48424-6.8659 0.47188-10.159-0.4402-0.96948-0.28297-2.0554-0.75787-2.1712-1.871-0.18567-0.23565-0.48183-0.37827-0.78183-0.37651z"/></g><path fill="currentColor" d="m16.637 22.317c-0.04748-0.0068-0.22619-0.02935-0.39713-0.04998-1.8323-0.22106-4.2628-1.5308-4.3878-2.3645-0.11216-0.74791 0.61491-1.1812 1.1618-0.69229 1.8646 1.6669 4.7049 2.0749 6.8693 0.9868 0.65465-0.3291 1.9243-1.3421 1.8112-1.4451-0.01801-0.01641-0.27861-0.24278-0.57913-0.50307l-0.54639-0.47325-0.1636 0.15302c-2.043 1.911-6.0645 1.3343-7.1744-1.0288-0.39406-0.83904 0.67088-1.5404 1.272-0.83772 1.6372 1.9137 3.4786 2.096 5.1223 0.50714 0.83772-0.80979 0.90807-0.79427 2.4164 0.53285 1.2549 1.1042 1.3201 1.1925 1.2881 1.7455-0.05369 0.92736-1.948 2.4997-3.725 3.0919-0.92973 0.30983-2.2625 0.4794-2.9676 0.37756zm-7.8063-0.36857c-0.41281-0.11639-0.50945-0.24009-0.85786-1.0981-0.94017-2.3152-1.0585-2.6034-3.7848-9.2169-0.45021-1.0921-1.1527-2.8015-1.5612-3.7987-0.40845-0.99716-1.0159-2.4735-1.3499-3.2807-0.80566-1.9473-0.81968-2.2205-0.13246-2.5831l0.1768-0.09327 1.238-0.01023c1.7328-0.01438 1.7431-0.0097 2.1307 0.96478 0.07828 0.19678 0.34153 0.83952 0.58501 1.4283 0.24348 0.5888 0.85825 2.0806 1.3662 3.3152 0.50791 1.2346 1.0833 2.6332 1.2787 3.108 0.62073 1.5088 0.62898 1.527 0.65733 1.4504 0.08159-0.22043 1.4624-3.7701 2.038-5.2392 2.066-5.2728 8.311-6.7758 12.172-2.9293 1.0973 1.0932 1.0119 1.4885-0.64181 2.9716-1.4857 1.3324-1.7583 1.4115-2.5223 0.73124-0.61373-0.54639-0.9433-0.74647-1.3972-0.84823-1.5975-0.35814-2.6384 0.41841-3.4892 2.6031-0.09986 0.25641-0.44904 1.1422-0.77597 1.9684-0.32693 0.82621-0.78456 1.9917-1.017 2.59-0.2324 0.5983-0.60138 1.5229-0.81995 2.0547-0.21857 0.53182-0.78521 1.946-1.2592 3.1426-0.47399 1.1966-0.89943 2.24-0.94542 2.3187-0.21512 0.36816-0.68724 0.56367-1.0882 0.45063zm1.0849-4.402c1.3668-3.4205 1.8988-4.7695 3.3262-8.4339 0.6056-1.5547 0.82495-1.958 1.3983-2.5708 1.552-1.6588 3.9314-1.7628 5.7064-0.24939l0.15536 0.13246 0.67627-0.61153c0.78089-0.70613 0.75006-0.61098 0.3193-0.98525-2.5158-2.1859-6.4015-1.8206-8.4971 0.79873-0.49396 0.6174-0.47602 0.5775-2.1264 4.7289-1.874 4.7139-1.7009 4.3292-2.0242 4.4993-0.52037 0.27371-0.83884 0.03211-1.2199-0.92548-0.25771-0.6476-0.77446-1.9023-2.7591-6.6991-0.86443-2.0893-1.5793-3.8181-1.5886-3.8419-0.01516-0.03867-0.94193-0.06963-0.94193-0.03146 0 0.03738 4.4485 10.799 6.3618 15.39 0.17018 0.40836 0.3176 0.76967 0.32761 0.8029 0.03528 0.11716 0.06931 0.04023 0.8861-2.0038z" stroke-width="2.063"/></svg>`);

        // Editor panel icon (VCalc logo + code brackets < >)
        addIcon('vcalc-editor', `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="m16.637 22.317c-0.04748-0.0068-0.22619-0.02935-0.39713-0.04998-1.8323-0.22106-4.2628-1.5308-4.3878-2.3645-0.11216-0.74791 0.61491-1.1812 1.1618-0.69229 1.8646 1.6669 4.7049 2.0749 6.8693 0.9868 0.65465-0.3291 1.9243-1.3421 1.8112-1.4451-0.01801-0.01641-0.27861-0.24278-0.57913-0.50307l-0.54639-0.47325-0.1636 0.15302c-2.043 1.911-6.0645 1.3343-7.1744-1.0288-0.39406-0.83904 0.67088-1.5404 1.272-0.83772 1.6372 1.9137 3.4786 2.096 5.1223 0.50714 0.83772-0.80979 0.90807-0.79427 2.4164 0.53285 1.2549 1.1042 1.3201 1.1925 1.2881 1.7455-0.05369 0.92736-1.948 2.4997-3.725 3.0919-0.92973 0.30983-2.2625 0.4794-2.9676 0.37756zm-7.8063-0.36857c-0.41281-0.11639-0.50945-0.24009-0.85786-1.0981-0.94017-2.3152-1.0585-2.6034-3.7848-9.2169-0.45021-1.0921-1.1527-2.8015-1.5612-3.7987-0.40845-0.99716-1.0159-2.4735-1.3499-3.2807-0.80566-1.9473-0.81968-2.2205-0.13246-2.5831l0.1768-0.09327 1.238-0.01023c1.7328-0.01438 1.7431-0.0097 2.1307 0.96478 0.07828 0.19678 0.34153 0.83952 0.58501 1.4283 0.24348 0.5888 0.85825 2.0806 1.3662 3.3152 0.50791 1.2346 1.0833 2.6332 1.2787 3.108 0.62073 1.5088 0.62898 1.527 0.65733 1.4504 0.08159-0.22043 1.4624-3.7701 2.038-5.2392 2.066-5.2728 8.311-6.7758 12.172-2.9293 1.0973 1.0932 1.0119 1.4885-0.64181 2.9716-1.4857 1.3324-1.7583 1.4115-2.5223 0.73124-0.61373-0.54639-0.9433-0.74647-1.3972-0.84823-1.5975-0.35814-2.6384 0.41841-3.4892 2.6031-0.09986 0.25641-0.44904 1.1422-0.77597 1.9684-0.32693 0.82621-0.78456 1.9917-1.017 2.59-0.2324 0.5983-0.60138 1.5229-0.81995 2.0547-0.21857 0.53182-0.78521 1.946-1.2592 3.1426-0.47399 1.1966-0.89943 2.24-0.94542 2.3187-0.21512 0.36816-0.68724 0.56367-1.0882 0.45063zm1.0849-4.402c1.3668-3.4205 1.8988-4.7695 3.3262-8.4339 0.6056-1.5547 0.82495-1.958 1.3983-2.5708 1.552-1.6588 3.9314-1.7628 5.7064-0.24939l0.15536 0.13246 0.67627-0.61153c0.78089-0.70613 0.75006-0.61098 0.3193-0.98525-2.5158-2.1859-6.4015-1.8206-8.4971 0.79873-0.49396 0.6174-0.47602 0.5775-2.1264 4.7289-1.874 4.7139-1.7009 4.3292-2.0242 4.4993-0.52037 0.27371-0.83884 0.03211-1.2199-0.92548-0.25771-0.6476-0.77446-1.9023-2.7591-6.6991-0.86443-2.0893-1.5793-3.8181-1.5886-3.8419-0.01516-0.03867-0.94193-0.06963-0.94193-0.03146 0 0.03738 4.4485 10.799 6.3618 15.39 0.17018 0.40836 0.3176 0.76967 0.32761 0.8029 0.03528 0.11716 0.06931 0.04023 0.8861-2.0038z" stroke-width="2.063"/><g transform="matrix(.40692 0 0 .40692 14.048 7.117)" fill="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m15.293 5.293a1 1 0 0 0 0 1.4141l5.293 5.293-5.293 5.293a1 1 0 0 0 0 1.4141 1 1 0 0 0 1.4141 0l6-6a1.0001 1.0001 0 0 0 0-1.4141l-6-6a1 1 0 0 0-1.4141 0z"/><path d="m8 5a1 1 0 0 0-0.70703 0.29297l-6 6a1.0001 1.0001 0 0 0 0 1.4141l6 6a1 1 0 0 0 1.4141 0 1 1 0 0 0 0-1.4141l-5.293-5.293 5.293-5.293a1 1 0 0 0 0-1.4141 1 1 0 0 0-0.70703-0.29297z"/></g></svg>`);

        // Setup Pyodide loading callbacks
        const executor = PyodideExecutor.getInstance();
        executor.setLoadCallbacks(
            () => {
                // Show loading notice
                new Notice(NOTICES.PYTHON_LOADING, 0);
            },
            () => {
                // Clear loading notice and show success
                const notices = document.querySelectorAll('.notice');
                notices.forEach(notice => {
                    if (notice.textContent?.includes(NOTICES.PYTHON_LOADING.split('...')[0])) {
                        notice.remove();
                    }
                });
                new Notice(NOTICES.PYTHON_READY, TIMING.NOTICE_DURATION_MS);
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
        this.addRibbonIcon('vcalc-variables', 'VCalc Variables', () => {
            this.activateVariablesView();
        });

        // Add ribbon icon for editor
        this.addRibbonIcon('vcalc-editor', 'VCalc Editor', () => {
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

        console.log(CONSOLE.PLUGIN_LOADED);
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
                    console.error(CONSOLE.ERROR_RUNNING_AT_CURSOR, error);
                    new Notice(NOTICES.ERROR_RUNNING_CALCULATION(getErrorMessage(error)));
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
                    new Notice(NOTICES.VARIABLES_CLEARED(activeFile.basename));
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
                    console.error(CONSOLE.ERROR_RUNNING_ALL, error);
                    new Notice(NOTICES.ERROR_RUNNING_ALL_BLOCKS(getErrorMessage(error)));
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
                    console.error(CONSOLE.ERROR_SAVING_ALL, error);
                    new Notice(NOTICES.ERROR_SAVING_LATEX(getErrorMessage(error)));
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
                    console.error(CONSOLE.ERROR_RUN_AND_SAVE, error);
                    new Notice(NOTICES.ERROR_RUNNING_ALL_BLOCKS(getErrorMessage(error)));
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

    updateVariable(notePath: string, vset: string, varName: string, value: any, type: string, blockTitle: string, blockId: string | null = null) {
        storeUpdateVariable(this.variableStore, notePath, vset, varName, value, type, blockTitle, blockId);
        this.refreshVariablesView();
    }

    removeBlockVariables(notePath: string, vset: string, blockId: string) {
        storeRemoveBlockVariables(this.variableStore, notePath, vset, blockId);
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
                vsetBadge.title = TOOLTIPS.VSET_BADGE(vset);
                vsetBadge.setAttribute('data-vset-color', color.name);
                vsetBadge.style.setProperty('--vset-color', color.rgb);
                btnGroup.appendChild(vsetBadge);
            }
            
            // Toggle Code button
            if (this.settings.showToggleCodeButton) {
                const toggleCodeBtn = document.createElement('button');
                toggleCodeBtn.className = 'calc-toggle-btn calc-icon-btn';
                if (hidden) toggleCodeBtn.classList.add('calc-btn-active');
                toggleCodeBtn.title = TOOLTIPS.TOGGLE_CODE;
                setIcon(toggleCodeBtn, 'code');
                toggleCodeBtn.addEventListener('click', () => {
                    const preEl = callout.querySelector('pre');
                    if (preEl) {
                        preEl.classList.toggle('calc-hidden');
                        toggleCodeBtn.classList.toggle('calc-btn-active');
                    }
                });
                btnGroup.appendChild(toggleCodeBtn);
            }

            // Run button
            if (this.settings.showRunButton) {
                const runBtn = document.createElement('button');
                runBtn.className = 'calc-run-btn calc-icon-btn';
                runBtn.title = 'Run calculation';
                setIcon(runBtn, 'play');
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

                        const { id: blockId, code: pythonCode, vset: currentVset } = parseVsetFromCodeBlock(callout);
                        console.log(CONSOLE.RUNNING_BLOCK(blockIndex, currentVset));
                        await this.executeAndRender(pythonCode, callout, context, currentVset, blockId);
                    } catch (error) {
                        console.error(CONSOLE.ERROR_RUNNING_BLOCK, error);
                        new Notice(NOTICES.ERROR_RUNNING_CALCULATION(getErrorMessage(error)));
                    }
                });
                btnGroup.appendChild(runBtn);
            }

            // Clear button
            if (this.settings.showClearButton) {
                const clearBtn = document.createElement('button');
                clearBtn.className = 'calc-clear-title-btn calc-icon-btn';
                clearBtn.title = TOOLTIPS.CLEAR_SAVED_LATEX;
                setIcon(clearBtn, 'x');
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
                        console.error(CONSOLE.ERROR_CLEARING_LATEX, error);
                        new Notice(NOTICES.ERROR_CLEARING_LATEX(getErrorMessage(error)));
                    }
                });
                btnGroup.appendChild(clearBtn);
            }

            // Copy block button
            if (this.settings.showCopyBlockButton) {
                const copyBlockBtn = document.createElement('button');
                copyBlockBtn.className = 'calc-copy-block-btn calc-icon-btn';
                copyBlockBtn.title = TOOLTIPS.COPY_BLOCK;
                setIcon(copyBlockBtn, 'copy');
                copyBlockBtn.addEventListener('click', async () => {
                    try {
                        await this.copyBlockToClipboard(callout, customTitle);
                    } catch (error) {
                        console.error(CONSOLE.ERROR_COPYING, error);
                        new Notice(NOTICES.ERROR_COPYING_CLIPBOARD(getErrorMessage(error)));
                    }
                });
                btnGroup.appendChild(copyBlockBtn);
            }

            // VCalc logo (spacer for Obsidian's edit button)
            const logoWrapper = document.createElement('span');
            logoWrapper.className = 'vcalc-logo';
            logoWrapper.title = 'VCalc';
            logoWrapper.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="m16.459 22.504c-0.04748-0.0068-0.2262-0.02935-0.39714-0.04998-1.8323-0.22106-4.2628-1.5308-4.3878-2.3645-0.11216-0.74791 0.61491-1.1812 1.1618-0.69229 1.8646 1.6669 4.7049 2.0749 6.8693 0.9868 0.65465-0.3291 1.9243-1.3421 1.8112-1.4451-0.01801-0.01641-0.27862-0.24278-0.57913-0.50307l-0.54639-0.47325-0.1636 0.15302c-2.043 1.911-6.0645 1.3343-7.1744-1.0288-0.39406-0.83904 0.67088-1.5404 1.272-0.83772 1.6372 1.9137 3.4786 2.096 5.1223 0.50714 0.83772-0.80979 0.90807-0.79427 2.4164 0.53285 1.2549 1.1042 1.3201 1.1925 1.2881 1.7455-0.05369 0.92736-1.948 2.4997-3.725 3.0919-0.92973 0.30983-2.2625 0.4794-2.9676 0.37756zm-7.8063-0.36857c-0.41281-0.11639-0.50945-0.24009-0.85786-1.0981-0.94017-2.3152-1.0585-2.6034-3.7848-9.2169-0.45021-1.0921-1.1527-2.8015-1.5612-3.7987-0.40845-0.99716-1.0159-2.4735-1.3499-3.2807-0.80566-1.9473-0.81968-2.2205-0.13246-2.5831l0.1768-0.09327 1.238-0.01023c1.7328-0.01438 1.7431-0.0097 2.1307 0.96478 0.078277 0.19678 0.34153 0.83952 0.58501 1.4283 0.24348 0.5888 0.85825 2.0806 1.3662 3.3152 0.50791 1.2346 1.0833 2.6332 1.2787 3.108 0.62073 1.5088 0.62898 1.527 0.65733 1.4504 0.081586-0.22043 1.4624-3.7701 2.038-5.2392 2.066-5.2728 8.311-6.7758 12.172-2.9293 1.0973 1.0932 1.0119 1.4885-0.64181 2.9716-1.4857 1.3324-1.7583 1.4115-2.5223 0.73124-0.61373-0.54639-0.9433-0.74647-1.3972-0.84823-1.5975-0.35814-2.6384 0.41841-3.4892 2.6031-0.09986 0.25641-0.44904 1.1422-0.77597 1.9684-0.32693 0.82621-0.78456 1.9917-1.017 2.59-0.2324 0.5983-0.60138 1.5229-0.81995 2.0547-0.21857 0.53182-0.78521 1.946-1.2592 3.1426-0.47399 1.1966-0.89943 2.24-0.94542 2.3187-0.21512 0.36816-0.68724 0.56367-1.0882 0.45063zm1.0849-4.402c1.3668-3.4205 1.8988-4.7695 3.3262-8.4339 0.6056-1.5547 0.82495-1.958 1.3983-2.5708 1.552-1.6588 3.9314-1.7628 5.7064-0.24939l0.15536 0.13246 0.67627-0.61153c0.78089-0.70613 0.75006-0.61098 0.3193-0.98525-2.5158-2.1859-6.4015-1.8206-8.4971 0.79873-0.49396 0.6174-0.47602 0.5775-2.1264 4.7289-1.874 4.7139-1.7009 4.3292-2.0242 4.4993-0.52037 0.27371-0.83884 0.032105-1.2199-0.92548-0.25771-0.6476-0.77446-1.9023-2.7591-6.6991-0.86443-2.0893-1.5793-3.8181-1.5886-3.8419-0.015155-0.03867-0.94193-0.06963-0.94193-0.03146 0 0.03738 4.4485 10.799 6.3618 15.39 0.17018 0.40836 0.3176 0.76967 0.32761 0.8029 0.035283 0.11716 0.06931 0.04023 0.8861-2.0038z"/></svg>`;
            btnGroup.appendChild(logoWrapper);

            titleEl.appendChild(btnGroup);
        }
    }

    // ==================== Execution ====================

    async executeAndRender(code: string, callout: HTMLElement, context: MarkdownPostProcessorContext, vset: string | null = null, blockId: string | null = null) {
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

            // Clean up old variables from this block before adding new ones
            // This ensures deleted variables don't persist
            if (vset && blockId) {
                this.removeBlockVariables(context.sourcePath, vset, blockId);
            }

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
                            blockTitle,
                            blockId
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
                    badge.innerHTML = UI.BADGE_OUTDATED;
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
            summaryEl.textContent = UI.LATEX_SOURCE_SUMMARY;
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
            copyBtn.className = 'calc-copy-btn calc-text-btn';
            copyBtn.title = 'Copy LaTeX to clipboard';
            setIcon(copyBtn, 'clipboard-copy');
            const copyBtnText = document.createElement('span');
            copyBtnText.textContent = UI.BUTTON_COPY_LATEX;
            copyBtn.appendChild(copyBtnText);
            copyBtn.addEventListener('click', async () => {
                try {
                    if (!navigator.clipboard) {
                        throw new Error('Clipboard API not available');
                    }
                    await navigator.clipboard.writeText(`$$\n${latex}\n$$`);
                    copyBtnText.textContent = UI.BUTTON_COPIED;
                    setTimeout(() => { copyBtnText.textContent = UI.BUTTON_COPY_LATEX; }, TIMING.UI_FEEDBACK_RESET_MS);
                } catch (error) {
                    console.error(CONSOLE.ERROR_COPYING, error);
                    new Notice(NOTICES.ERROR_COPYING_CLIPBOARD(getErrorMessage(error)));
                    copyBtnText.textContent = UI.BUTTON_COPY_LATEX;
                }
            });
            btnContainer.appendChild(copyBtn);

            // Save button
            const saveBtn = document.createElement('button');
            saveBtn.className = 'calc-save-btn calc-text-btn';
            saveBtn.title = 'Save LaTeX to file';
            setIcon(saveBtn, 'save');
            const saveBtnText = document.createElement('span');
            saveBtnText.textContent = UI.BUTTON_SAVE_TO_FILE;
            saveBtn.appendChild(saveBtnText);
            saveBtn.addEventListener('click', async () => {
                try {
                    await saveBlockLatexToFile(this.app, callout, context.sourcePath, blockTitle);
                    saveBtnText.textContent = UI.BUTTON_SAVED;

                    const outdatedWrappers = callout.querySelectorAll('.calc-saved-outdated');
                    outdatedWrappers.forEach((wrapper) => wrapper.remove());

                    setTimeout(() => { saveBtnText.textContent = UI.BUTTON_SAVE_TO_FILE; }, TIMING.UI_FEEDBACK_RESET_MS);
                } catch (error) {
                    console.error(CONSOLE.ERROR_SAVING, error);
                    new Notice(NOTICES.ERROR_SAVING_FILE(getErrorMessage(error)));
                    saveBtnText.textContent = UI.BUTTON_SAVE_TO_FILE;
                }
            });
            btnContainer.appendChild(saveBtn);
            
            sourceContainer.appendChild(btnContainer);
            detailsEl.appendChild(sourceContainer);
            outputContainer.appendChild(detailsEl);

            new Notice(NOTICES.CALCULATION_RENDERED);

            // Auto-save if enabled
            if (this.settings.autoSaveOnRun) {
                await saveBlockLatexToFile(this.app, callout, context.sourcePath, blockTitle);
            }
        } catch (error) {
            const fullError = getErrorMessage(error);
            const simpleError = extractSimplifiedError(fullError);
            new Notice(NOTICES.ERROR_EXECUTING_CALCULATION(simpleError));
            console.error(CONSOLE.VCALC_ERROR, fullError);

            // Render error in output container so editor can detect it
            let outputContainer = callout.querySelector('.calc-output') as HTMLElement;
            if (!outputContainer) {
                outputContainer = document.createElement('div');
                outputContainer.className = 'calc-output';
                callout.querySelector('.callout-content')?.appendChild(outputContainer);
            }
            outputContainer.empty();

            const errorEl = document.createElement('div');
            errorEl.className = 'calc-error';
            errorEl.textContent = simpleError;
            outputContainer.appendChild(errorEl);
        }
    }

    // ==================== Copy Block ====================

    /**
     * Copy a vcalc block to clipboard with a new unique ID.
     * Reconstructs the markdown callout format from the DOM.
     */
    async copyBlockToClipboard(callout: HTMLElement, blockTitle: string) {
        // Parse current options from the block
        const { id: _oldId, code, vset, hidden, accentVset, bgStyle, compact } = parseVsetFromCodeBlock(callout);

        // Generate a new unique ID
        const newId = generateVCalcId();

        // Build the options line with new ID
        const optionsLine = buildOptionsLine({
            id: newId,
            vset,
            hidden,
            accentVset,
            bgStyle,
            compact
        });

        // Build the full callout markdown
        const calloutLines = [
            `> [!vcalc] ${blockTitle}`,
            '> ```python',
            `> ${optionsLine}`,
            ...code.split('\n').map(line => `> ${line}`),
            '> ```'
        ];

        const markdown = calloutLines.join('\n');

        // Copy to clipboard
        if (!navigator.clipboard) {
            throw new Error('Clipboard API not available');
        }
        await navigator.clipboard.writeText(markdown);
        new Notice(NOTICES.BLOCK_COPIED);
    }

    // ==================== Batch Operations ====================

    async runAllBlocks() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice(NOTICES.NO_ACTIVE_VIEW);
            return;
        }

        const container = activeView.containerEl;
        const callouts = container.querySelectorAll('.callout[data-callout="vcalc"]');

        if (callouts.length === 0) {
            new Notice(NOTICES.NO_BLOCKS_IN_NOTE);
            return;
        }

        new Notice(NOTICES.RUNNING_BLOCKS(callouts.length));
        
        const file = activeView.file;
        if (!file) return;
        
        for (let i = 0; i < callouts.length; i++) {
            const callout = callouts[i] as HTMLElement;
            callout.setAttribute('data-vcalc-index', String(i));

            const { id: blockId, code, vset } = parseVsetFromCodeBlock(callout);

            if (code.trim()) {
                try {
                    const context = {
                        sourcePath: file.path,
                        frontmatter: null,
                        docId: '',
                        getSectionInfo: () => null,
                        addChild: () => {}
                    } as unknown as MarkdownPostProcessorContext;

                    await this.executeAndRender(code, callout, context, vset, blockId);
                    await new Promise(resolve => setTimeout(resolve, TIMING.INTER_BLOCK_DELAY_MS));
                } catch (error) {
                    console.error(CONSOLE.ERROR_RUNNING_BLOCK_NUM(i + 1), error);
                }
            }
        }

        new Notice(NOTICES.ALL_BLOCKS_EXECUTED);
    }

    async saveAllLatexToFile() {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView) {
            new Notice(NOTICES.NO_ACTIVE_VIEW);
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
            new Notice(NOTICES.NO_OUTPUTS_TO_SAVE);
        } else {
            new Notice(NOTICES.LATEX_SAVED_COUNT(savedCount));
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
            new Notice(NOTICES.CURSOR_NOT_IN_BLOCK);
            return;
        }

        if (calloutEnd === -1) calloutEnd = lines.length;

        const calloutLines = lines.slice(calloutStart, calloutEnd);
        const codeMatch = calloutLines.join('\n').match(/```python\n([\s\S]*?)```/);

        if (!codeMatch) {
            new Notice(NOTICES.NO_CODE_IN_BLOCK);
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
            new Notice(NOTICES.CALCULATION_UPDATED);

        } catch (error) {
            const fullError = getErrorMessage(error);
            const simpleError = extractSimplifiedError(fullError);
            new Notice(NOTICES.ERROR_UPDATING_CALCULATION(simpleError));
            console.error(CONSOLE.VCALC_ERROR, fullError);
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

        console.log(CONSOLE.PLUGIN_UNLOADED);
    }
}
