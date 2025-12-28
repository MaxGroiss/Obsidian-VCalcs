/**
 * @fileoverview Plugin settings tab for VCalc.
 *
 * This module provides the Settings tab UI that appears in Obsidian's settings
 * panel. It allows users to configure VCalc behavior, display options, and
 * appearance without editing configuration files directly.
 *
 * ## Settings Categories
 *
 * | Category | Settings |
 * |----------|----------|
 * | Behavior | Auto-save on Run |
 * | Display | Show Symbolic, Show Substitution, Show Result |
 * | Appearance | Background Style, Compact Mode |
 * | VSet Colors | Sync Accent with VSet Color |
 * | Editor | Autocomplete Accept Key |
 * | Buttons | Show Run, Toggle Code, Clear, Copy Block |
 *
 * ## Architecture
 *
 * The settings tab uses a `SettingsProvider` interface to decouple from the
 * main plugin class, enabling easier testing and clearer dependencies.
 *
 * @module settings
 * @see {@link types#CalcBlocksSettings} for the settings interface
 * @see {@link constants#DEFAULT_SETTINGS} for default values
 * @see {@link messages#SETTINGS} for all UI text
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import { CalcBlocksSettings } from './types';
import { VSET_COLORS } from './constants';
import { SETTINGS } from './messages';

/**
 * Interface for the plugin features needed by the settings tab.
 *
 * Decouples the settings tab from the main plugin class, allowing for
 * easier testing with mock providers.
 */
export interface SettingsProvider {
    /** Current plugin settings object */
    settings: CalcBlocksSettings;
    /** Persists settings to disk */
    saveSettings(): Promise<void>;
}

/**
 * Settings tab for VCalc plugin configuration.
 *
 * Renders the settings UI in Obsidian's settings panel and handles
 * persisting changes to disk when users modify settings.
 *
 * @example
 * ```typescript
 * // In main plugin onload()
 * this.addSettingTab(new VCalcSettingTab(this.app, this));
 * ```
 */
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

        // Button Visibility Section
        containerEl.createEl('h3', { text: SETTINGS.HEADER_BUTTON_VISIBILITY });

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_RUN_BUTTON_NAME)
            .setDesc(SETTINGS.SHOW_RUN_BUTTON_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showRunButton)
                .onChange(async (value) => {
                    this.provider.settings.showRunButton = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_TOGGLE_CODE_NAME)
            .setDesc(SETTINGS.SHOW_TOGGLE_CODE_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showToggleCodeButton)
                .onChange(async (value) => {
                    this.provider.settings.showToggleCodeButton = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_CLEAR_BUTTON_NAME)
            .setDesc(SETTINGS.SHOW_CLEAR_BUTTON_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showClearButton)
                .onChange(async (value) => {
                    this.provider.settings.showClearButton = value;
                    await this.provider.saveSettings();
                }));

        new Setting(containerEl)
            .setName(SETTINGS.SHOW_COPY_BLOCK_NAME)
            .setDesc(SETTINGS.SHOW_COPY_BLOCK_DESC)
            .addToggle(toggle => toggle
                .setValue(this.provider.settings.showCopyBlockButton)
                .onChange(async (value) => {
                    this.provider.settings.showCopyBlockButton = value;
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
