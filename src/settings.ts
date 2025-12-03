import { App, PluginSettingTab, Setting } from 'obsidian';
import { CalcBlocksSettings } from './types';
import { VSET_COLORS } from './constants';

// Interface for what we need from the plugin
export interface SettingsProvider {
    settings: CalcBlocksSettings;
    saveSettings(): Promise<void>;
}

export class VCalcSettingTab extends PluginSettingTab {
    private provider: SettingsProvider;

    constructor(app: App, plugin: SettingsProvider & { manifest: { id: string } }) {
        super(app, plugin as any);
        this.provider = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'VCalc Settings' });

        // Info about Pyodide
        const infoEl = containerEl.createEl('div', { cls: 'setting-item-description' });
        infoEl.innerHTML = '💡 <strong>Python Execution:</strong> VCalc uses Pyodide (Python in WebAssembly) - no Python installation required!';
        infoEl.style.marginBottom = '1em';
        infoEl.style.padding = '0.5em';
        infoEl.style.backgroundColor = 'var(--background-secondary)';
        infoEl.style.borderRadius = '4px';

        // Behavior Settings Section
        containerEl.createEl('h3', { text: 'Behavior' });

        new Setting(containerEl)
            .setName('Auto-save on Run')
            .setDesc('Automatically save LaTeX output to file when running a calculation')
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.autoSaveOnRun)
                .onChange(async (value) => {
                    this.provider.settings.autoSaveOnRun = value;
                    await this.provider.saveSettings();
                }));

        // Display Settings Section
        containerEl.createEl('h3', { text: 'Display Options' });

        new Setting(containerEl)
            .setName('Show Symbolic Expression')
            .setDesc('Show the symbolic form of the equation (e.g., z = x + y)')
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showSymbolic)
                .onChange(async (value) => {
                    this.provider.settings.showSymbolic = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Substitution Step')
            .setDesc('Show values substituted into the equation (e.g., z = 5 + 10)')
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showSubstitution)
                .onChange(async (value) => {
                    this.provider.settings.showSubstitution = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Show Result')
            .setDesc('Show the final calculated result (e.g., z = 15)')
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showResult)
                .onChange(async (value) => {
                    this.provider.settings.showResult = value;
                    await this.provider.saveSettings();
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
                .setValue(this.provider.settings.backgroundStyle)
                .onChange(async (value) => {
                    this.provider.settings.backgroundStyle = value as 'default' | 'transparent' | 'subtle' | 'solid';
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Compact Mode')
            .setDesc('Reduce padding and margins for a more compact layout')
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.compactMode)
                .onChange(async (value) => {
                    this.provider.settings.compactMode = value;
                    await this.provider.saveSettings();
                }));

        // Color Palette Info
        containerEl.createEl('h3', { text: 'Variable Set Colors' });
        
        new Setting(containerEl)
            .setName('Sync Accent with VSet Color')
            .setDesc('Match the callout accent (left border and title) color to the variable set color. Can also be set per-block with "accent:vset" or "accent:default".')
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.syncAccentWithVset)
                .onChange(async (value) => {
                    this.provider.settings.syncAccentWithVset = value;
                    await this.provider.saveSettings();
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
