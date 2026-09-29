import { strict as assert } from 'node:assert';
import { readProjectSources } from './smokeTestHarness.ts';
import { SETTINGS_CONTROL_CENTER_MODULES } from '../src/components/settings/settingsControlCenterNavigation.ts';

const extensionModule = SETTINGS_CONTROL_CENTER_MODULES.find((module) => module.id === 'platform');
assert.ok(extensionModule);
assert.equal(extensionModule.pages.some((page) => page.id === 'platform-plugins'), false);
const harnessPage = extensionModule.pages.find((page) => page.id === 'extension-deepseek-harness');
assert.ok(harnessPage);
assert.match(harnessPage.description, /Agent Runtime/u);
const pluginPage = extensionModule.pages.find((page) => page.id === 'extension-plugins');
assert.ok(pluginPage);
assert.match(pluginPage.description, /管理/u);

const { panelSource, hubSource, navigationSource } = readProjectSources({
  panelSource: 'src/components/SettingsPanel.tsx',
  hubSource: 'src/components/settings/SettingsExtensionHubTab.tsx',
  navigationSource: 'src/components/settings/settingsControlCenterNavigation.ts',
});
assert.doesNotMatch(panelSource, /SettingsPluginMarketplaceTab/u);
assert.doesNotMatch(panelSource, /platform-plugins/u);
assert.match(panelSource, /extension-plugins/u);
assert.match(panelSource, /extension-deepseek-harness/u);
assert.match(hubSource, /SettingsPluginMarketplaceTab/u);
assert.doesNotMatch(hubSource, /导入 Skill|parseAgentExternalSkillImport|PluginDirectory/u);
assert.equal(extensionModule.pages.find((page) => page.id === 'platform-skills-api')?.label, 'Skills');
const { skillsSource, routeSource } = readProjectSources({
  skillsSource: 'src/components/settings/SettingsSkillDirectory.tsx',
  routeSource: 'src/components/settings/SettingsPlatformCapabilityTabs.tsx',
});
assert.match(skillsSource, /导入 Skill/u);
assert.match(routeSource, /SettingsSkillDirectory currentPetId=\{currentPetId\}/u);
assert.match(panelSource, /SettingsPlatformSkillApiTab localConfig=\{localConfig\} currentPetId=\{selectedPetSlot.id\}/u);
assert.doesNotMatch(hubSource, /SettingsAgentSkillPackageExchangePreview/u);
assert.doesNotMatch(hubSource, /导入 DeepSeek Harness/u);
assert.doesNotMatch(navigationSource, /插件管理/u);

console.log('settings plugin navigation smoke passed');
