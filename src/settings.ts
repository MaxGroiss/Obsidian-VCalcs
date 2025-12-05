import { App, PluginSettingTab, Setting } from 'obsidian';
import { CalcBlocksSettings } from './types';
import { VSET_COLORS } from './constants';
import { SETTINGS } from './messages';

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

        containerEl.createEl('h2', { text: SETTINGS.HEADER_MAIN });

        // Info about Pyodide
        const infoEl = containerEl.createEl('div', { cls: 'setting-item-description' });
        infoEl.innerHTML = SETTINGS.INFO_PYODIDE;
        infoEl.style.marginBottom = '1em';
        infoEl.style.padding = '0.5em';
        infoEl.style.backgroundColor = 'var(--background-secondary)';
        infoEl.style.borderRadius = '4px';

        // Behavior Settings Section
        containerEl.createEl('h3', { text: SETTINGS.HEADER_BEHAVIOR });

        new Setting(containerEl)
            .setName(SETTINGS.AUTOSAVE_NAME)
            .setDesc(SETTINGS.AUTOSAVE_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.autoSaveOnRun)
                .onChange(async (value) => {
                    this.provider.settings.autoSaveOnRun = value;
                    await this.provider.saveSettings();
                }));

        // Display Settings Section
        containerEl.createEl('h3', { text: SETTINGS.HEADER_DISPLAY });

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_SYMBOLIC_NAME)
            .setDesc(SETTINGS.SHOW_SYMBOLIC_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showSymbolic)
                .onChange(async (value) => {
                    this.provider.settings.showSymbolic = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_SUBSTITUTION_NAME)
            .setDesc(SETTINGS.SHOW_SUBSTITUTION_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showSubstitution)
                .onChange(async (value) => {
                    this.provider.settings.showSubstitution = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_RESULT_NAME)
            .setDesc(SETTINGS.SHOW_RESULT_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showResult)
                .onChange(async (value) => {
                    this.provider.settings.showResult = value;
                    await this.provider.saveSettings();
                }));

        // Appearance Section
        containerEl.createEl('h3', { text: SETTINGS.HEADER_APPEARANCE });

        new Setting(containerEl)
            .setName(SETTINGS.BACKGROUND_NAME)
            .setDesc(SETTINGS.BACKGROUND_DESC)
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
            .setName(SETTINGS.COMPACT_NAME)
            .setDesc(SETTINGS.COMPACT_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.compactMode)
                .onChange(async (value) => {
                    this.provider.settings.compactMode = value;
                    await this.provider.saveSettings();
                }));

        // Color Palette Info
        containerEl.createEl('h3', { text: SETTINGS.HEADER_VSET_COLORS });

        new Setting(containerEl)
            .setName(SETTINGS.ACCENT_SYNC_NAME)
            .setDesc(SETTINGS.ACCENT_SYNC_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.syncAccentWithVset)
                .onChange(async (value) => {
                    this.provider.settings.syncAccentWithVset = value;
                    await this.provider.saveSettings();
                }));

        // Editor Settings Section
        containerEl.createEl('h3', { text: 'Editor' });

        new Setting(containerEl)
            .setName(SETTINGS.AUTOCOMPLETE_KEY_NAME)
            .setDesc(SETTINGS.AUTOCOMPLETE_KEY_DESC)
            .addDropdown(dropdown => dropdown
                .addOption('tab', 'Tab only')
                .addOption('enter', 'Enter only')
                .addOption('both', 'Tab and Enter')
                .setValue(this.provider.settings.autocompleteAcceptKey)
                .onChange(async (value) => {
                    this.provider.settings.autocompleteAcceptKey = value as 'tab' | 'enter' | 'both';
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
