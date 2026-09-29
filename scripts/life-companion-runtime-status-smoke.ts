import { strict as assert } from 'node:assert';
import {
  createLifeCompanionRuntimeStatusSnapshot,
  DEFAULT_LIFE_COMPANION_RUNTIME_STATUS,
} from '../src/life-companion/lifeCompanionRuntimeStatus.ts';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const enabledSettings = {
  ...DEFAULT_LIFE_COMPANION_SETTINGS,
  proactiveEnabled: true,
  quietHoursEnd: '09:00',
  quietHoursStart: '23:00',
  randomInteractionEnabled: true,
  llmTextPromptCooldownMinutes: 60,
  llmTextPromptEnabled: true,
  textPromptCooldownMinutes: 30,
  textPromptEnabled: true,
};

assert.equal(DEFAULT_LIFE_COMPANION_RUNTIME_STATUS.phase, 'disabled');
assert.equal(DEFAULT_LIFE_COMPANION_RUNTIME_STATUS.llmTextPromptState, 'off');
assert.equal(DEFAULT_LIFE_COMPANION_RUNTIME_STATUS.textPromptState, 'off');

const armed = createLifeCompanionRuntimeStatusSnapshot({
  lastTextPromptAt: null,
  nextInteractionAt: 2000,
  now: new Date('2026-07-01T10:00:00').getTime(),
  settings: enabledSettings,
});
assert.equal(armed.phase, 'armed');
assert.equal(armed.llmTextPromptState, 'ready');
assert.equal(armed.textPromptState, 'ready');
assert.equal(armed.nextInteractionAt, 2000);

const quiet = createLifeCompanionRuntimeStatusSnapshot({
  lastTextPromptAt: null,
  now: new Date('2026-07-01T23:30:00').getTime(),
  settings: enabledSettings,
});
assert.equal(quiet.phase, 'quiet-hours');
assert.match(quiet.detail, /quiet 23:00-09:00/u);

const suspended = createLifeCompanionRuntimeStatusSnapshot({
  nextInteractionAt: 2000,
  now: new Date('2026-07-01T10:00:00').getTime(),
  override: {
    manualSuspended: true,
    manualSuspendedAt: 1000,
    updatedAt: 1000,
  },
  settings: enabledSettings,
});
assert.equal(suspended.phase, 'suspended');
assert.equal(suspended.detail, 'manual suspend');

const cooling = createLifeCompanionRuntimeStatusSnapshot({
  lastEvent: 'text-published',
  lastLlmTextPromptAt: 1000,
  llmBackoffRetryAfter: 1000 + 90 * 60 * 1000,
  llmLastErrorMessage: 'network failed',
  lastEventAt: 1000,
  lastTextPromptAt: 1000,
  now: 1000 + 10 * 60 * 1000,
  settings: enabledSettings,
});
assert.equal(cooling.textPromptState, 'cooldown');
assert.equal(cooling.llmTextPromptState, 'backoff');
assert.equal(cooling.llmLastErrorMessage, 'network failed');
assert.equal(cooling.lastEvent, 'text-published');

const {
  hookSource,
  panelSource,
  controlsSource,
  runnerSource,
  overrideSource,
  runtimeSchedulerSource,
  rowSource,
  progressSource,
} = readProjectSources({
  hookSource: 'src/hooks/useLifeCompanionScheduler.ts',
  panelSource: 'src/components/settings/SettingsLifeCompanionPanel.tsx',
  controlsSource: 'src/components/settings/SettingsLifeCompanionRuntimeControls.tsx',
  runnerSource: 'src/life-companion/lifeCompanionInteractionRunner.ts',
  overrideSource: 'src/life-companion/lifeCompanionRuntimeOverride.ts',
  runtimeSchedulerSource: 'src/life-companion/lifeCompanionRuntimeScheduler.ts',
  rowSource: 'src/components/settings/SettingsLifeCompanionRuntimeStatusRow.tsx',
  progressSource: 'PROJECT_FEATURE_PROGRESS.md',
});

assert.match(hookSource, /scheduleLifeCompanionRuntime/u);
assert.match(runtimeSchedulerSource, /lifeCompanionRuntimeStatusStore/u);
assert.match(runtimeSchedulerSource, /nextInteractionAt/u);
assert.match(runtimeSchedulerSource, /event: result\.event/u);
assert.match(runtimeSchedulerSource, /manualSuspended/u);
assert.match(runnerSource, /llm-published/u);
assert.match(overrideSource, /setManualSuspended/u);
assert.match(panelSource, /SettingsLifeCompanionRuntimeStatusRow/u);
assert.match(panelSource, /SettingsLifeCompanionRuntimeControls/u);
assert.match(controlsSource, /lifeCompanionRuntimeOverrideStore/u);
assert.match(controlsSource, /Pause/u);
assert.match(controlsSource, /Resume/u);
assert.match(rowSource, /useLifeCompanionRuntimeStatus/u);
assert.match(rowSource, /runtime/u);
assert.match(rowSource, /llmTextPromptState/u);
assert.match(rowSource, /textPromptState/u);
assert.match(rowSource, /suspended/u);
assert.match(progressSource, /runtime status row/u);
assert.match(progressSource, /LLM failure retry timing, backoff runtime visibility/u);
assert.ok(rowSource.split(/\r?\n/u).length <= 80);

console.log('life companion runtime status smoke passed');
