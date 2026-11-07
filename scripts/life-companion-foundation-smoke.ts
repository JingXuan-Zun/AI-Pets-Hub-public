import { strict as assert } from 'node:assert';
import {
  DEFAULT_LIFE_COMPANION_SETTINGS,
  normalizeLifeCompanionSettings,
} from '../src/life-companion/lifeCompanionSettings.ts';
import { readProjectSources } from './smokeTestHarness.ts';

// Life-companion settings and where they show up. Since 2026-11-06 proactive chat is one switch;
// when a character speaks first is decided by the cognition layer (proactive-speech-smoke).
const defaultSettings = DEFAULT_LIFE_COMPANION_SETTINGS;
assert.equal(defaultSettings.proactiveEnabled, false);
assert.equal(defaultSettings.startupGreetingEnabled, true);
assert.equal(defaultSettings.affectionEnabled, true);
assert.equal(defaultSettings.hungerEnabled, true);
assert.equal(defaultSettings.feelingsNeverDrop, true);

const normalized = normalizeLifeCompanionSettings({
  proactiveEnabled: true,
  quietHoursEnd: 'bad',
  quietHoursStart: '22:30',
  randomInteractionEnabled: true,
  textPromptCooldownMinutes: 4,
});
assert.equal(normalized.quietHoursStart, '22:30');
assert.equal(normalized.quietHoursEnd, '09:00');
assert.equal(normalized.proactiveEnabled, true);
assert.equal('randomInteractionEnabled' in normalized, false, 'old proactive knobs are dropped');
assert.equal('textPromptCooldownMinutes' in normalized, false, 'old proactive knobs are dropped');

const {
  controlsSource,
  constantsSource,
  growthControllerSource,
  normalizationSource,
  panelSource,
  statusSource,
  settingsPanelSource,
} = readProjectSources({
  controlsSource: 'src/components/settings/SettingsDesktopActivityAwarenessTab.tsx',
  constantsSource: 'src/constants.ts',
  growthControllerSource: 'src/life-companion/lifeCompanionGrowthController.ts',
  normalizationSource: 'src/petConfigNormalization.ts',
  panelSource: 'src/components/settings/SettingsLifeCompanionPanel.tsx',
  statusSource: 'src/components/settings/SettingsProactiveSpeechStatus.tsx',
  settingsPanelSource: 'src/components/SettingsPanel.tsx',
});

assert.match(constantsSource, /lifeCompanion: \{ \.\.\.DEFAULT_LIFE_COMPANION_SETTINGS \}/u);
assert.match(growthControllerSource, /applyLifeCompanionPassiveGrowthTick/u);
assert.match(growthControllerSource, /applyLifeCompanionFoodConsumedGrowth/u);
assert.match(normalizationSource, /lifeCompanion: normalizeLifeCompanionSettings\(rawSettings\.lifeCompanion\)/u);
assert.match(controlsSource, /SettingsLifeCompanionPanel/u);
assert.match(controlsSource, /settings=\{lifeCompanion\}/u);
assert.match(controlsSource, /title="主动找你聊天"/u);
assert.match(controlsSource, /<SettingsProactiveSpeechStatus \/>/u);
assert.match(statusSource, /setManualSuspended/u, 'the user can pause proactive speech');
assert.match(statusSource, /现在没开口/u, 'the panel says why nobody is speaking');
assert.match(settingsPanelSource, /noDragRegionStyle,/u);
for (const label of ['安静时段', '开机打招呼', '会饿', '好感度']) assert.match(panelSource, new RegExp(label, 'u'));
assert.doesNotMatch(panelSource, /Proactive|Random|LLM prompt/u, 'no English debug knobs');
assert.ok(growthControllerSource.split(/\r?\n/u).length <= 140);

console.log('life companion foundation smoke passed');
