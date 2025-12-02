import { ItemView, WorkspaceLeaf, App } from 'obsidian';
import { VariableStore, VSetColor } from '../types';
import { VCALC_VIEW_TYPE } from '../constants';

// Interface for what we need from the plugin
export interface VariablesViewPlugin {
    app: App;
    variableStore: VariableStore;
    getVsetColor(notePath: string, vsetName: string): VSetColor;
    clearNoteVariables(notePath: string): void;
}

export class VCalcVariablesView extends ItemView {
    private plugin: VariablesViewPlugin;
    private selectedVset: string = '';

    constructor(leaf: WorkspaceLeaf, plugin: VariablesViewPlugin) {
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
