import { strict as assert } from 'node:assert';
import {
  DEFAULT_LIFE_COMPANION_SETTINGS,
  createLifeCompanionStatus,
  normalizeLifeCompanionSettings,
} from '../src/life-companion/lifeCompanionSettings.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const defaultSettings = DEFAULT_LIFE_COMPANION_SETTINGS;
assert.equal(defaultSettings.proactiveEnabled, false);
assert.equal(defaultSettings.startupGreetingEnabled, true);
assert.equal(defaultSettings.randomInteractionEnabled, false);
assert.equal(defaultSettings.affectionEnabled, true);
assert.equal(defaultSettings.hungerEnabled, true);
assert.equal(defaultSettings.llmTextPromptEnabled, false);
assert.equal(defaultSettings.llmTextPromptCooldownMinutes, 240);
assert.equal(defaultSettings.textPromptEnabled, false);
assert.equal(defaultSettings.textPromptCooldownMinutes, 120);

const normalized = normalizeLifeCompanionSettings({
  maxRandomIntervalMinutes: 1,
  minRandomIntervalMinutes: '12',
  proactiveEnabled: true,
  quietHoursEnd: 'bad',
  quietHoursStart: '22:30',
  randomInteractionEnabled: true,
  llmTextPromptCooldownMinutes: 12,
  llmTextPromptEnabled: true,
  textPromptCooldownMinutes: 4,
  textPromptEnabled: true,
});
assert.equal(normalized.minRandomIntervalMinutes, 12);
assert.equal(normalized.maxRandomIntervalMinutes, 12);
assert.equal(normalized.quietHoursStart, '22:30');
assert.equal(normalized.quietHoursEnd, '09:00');
assert.equal(normalized.proactiveEnabled, true);
assert.equal(normalized.randomInteractionEnabled, true);
assert.equal(normalized.llmTextPromptCooldownMinutes, 30);
assert.equal(normalized.llmTextPromptEnabled, true);
assert.equal(normalized.textPromptCooldownMinutes, 15);
assert.equal(normalized.textPromptEnabled, true);

const hungryStatus = createLifeCompanionStatus(
  { affection: 72, fatigue: 10, hunger: 94 },
  normalized,
);
assert.equal(hungryStatus.mood, 'hungry');
assert.equal(hungryStatus.hungerLevel, 'critical');
assert.equal(hungryStatus.proactiveReady, true);
assert.match(hungryStatus.summary, /proactive=ready/u);

const {
  controlsSource,
  constantsSource,
  growthControllerSource,
  growthStatusSource,
  normalizationSource,
  panelSource,
  fieldsSource,
  growthStatusRowSource,
  runtimeControlsSource,
  settingsPanelSource,
  guideSource,
} = readProjectSources({
  controlsSource: 'src/components/settings/SettingsControlsTab.tsx',
  constantsSource: 'src/constants.ts',
  growthControllerSource: 'src/life-companion/lifeCompanionGrowthController.ts',
  growthStatusSource: 'src/life-companion/lifeCompanionGrowthStatus.ts',
  normalizationSource: 'src/petConfigNormalization.ts',
  panelSource: 'src/components/settings/SettingsLifeCompanionPanel.tsx',
  fieldsSource: 'src/components/settings/SettingsLifeCompanionFields.tsx',
  growthStatusRowSource: 'src/components/settings/SettingsLifeCompanionGrowthStatusRow.tsx',
  runtimeControlsSource: 'src/components/settings/SettingsLifeCompanionRuntimeControls.tsx',
  settingsPanelSource: 'src/components/SettingsPanel.tsx',
  guideSource: 'PROJECT_NEW_FEATURE_INTEGRATION_GUIDE.md',
});

assert.match(constantsSource, /DEFAULT_LIFE_COMPANION_SETTINGS/u);
assert.match(constantsSource, /lifeCompanion: \{ \.\.\.DEFAULT_LIFE_COMPANION_SETTINGS \}/u);
assert.match(growthControllerSource, /applyLifeCompanionPassiveGrowthTick/u);
assert.match(growthControllerSource, /applyLifeCompanionFoodConsumedGrowth/u);
assert.match(growthControllerSource, /getLifeCompanionReachedStatMilestones/u);
assert.match(growthStatusSource, /createLifeCompanionGrowthStatus/u);
assert.match(normalizationSource, /normalizeLifeCompanionSettings/u);
assert.match(normalizationSource, /lifeCompanion: normalizeLifeCompanionSettings\(rawSettings\.lifeCompanion\)/u);
assert.match(controlsSource, /SettingsLifeCompanionPanel/u);
assert.match(controlsSource, /settings=\{localConfig\.settings\.lifeCompanion\}/u);
assert.match(settingsPanelSource, /noDragRegionStyle,/u);
assert.match(panelSource, /createLifeCompanionStatus/u);
assert.match(panelSource, /SettingsLifeCompanionGrowthStatusRow/u);
assert.match(panelSource, /SettingsLifeCompanionRuntimeControls/u);
assert.match(growthStatusRowSource, /createLifeCompanionGrowthStatus/u);
assert.match(runtimeControlsSource, /setManualSuspended/u);
assert.match(fieldsSource, /Proactive/u);
assert.match(fieldsSource, /Startup (?:LLM )?greeting/u);
assert.match(fieldsSource, /Random/u);
assert.match(fieldsSource, /Text prompt/u);
assert.match(fieldsSource, /Text cooldown/u);
assert.match(fieldsSource, /LLM prompt/u);
assert.match(fieldsSource, /LLM cooldown/u);
assert.match(fieldsSource, /Affection/u);
assert.match(fieldsSource, /Hunger/u);
assert.match(guideSource, /Life companion/u);
assert.ok(panelSource.split(/\r?\n/u).length <= 90);
assert.ok(fieldsSource.split(/\r?\n/u).length <= 180);
assert.ok(growthStatusRowSource.split(/\r?\n/u).length <= 80);
assert.ok(runtimeControlsSource.split(/\r?\n/u).length <= 80);
assert.ok(growthControllerSource.split(/\r?\n/u).length <= 140);

console.log('life companion foundation smoke passed');
