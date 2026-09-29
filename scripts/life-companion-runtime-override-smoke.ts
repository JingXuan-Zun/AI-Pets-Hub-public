import { strict as assert } from 'node:assert';
import { DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE } from '../src/life-companion/lifeCompanionLlmBackoff.ts';
import {
  DEFAULT_LIFE_COMPANION_RUNTIME_OVERRIDE,
  lifeCompanionRuntimeOverrideStore,
} from '../src/life-companion/lifeCompanionRuntimeOverride.ts';
import { lifeCompanionRuntimeStatusStore } from '../src/life-companion/lifeCompanionRuntimeStatus.ts';
import { scheduleLifeCompanionRuntime } from '../src/life-companion/lifeCompanionRuntimeScheduler.ts';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings.ts';
import type { PetConfig } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const enabledConfig = {
  settings: {
    lifeCompanion: {
      ...DEFAULT_LIFE_COMPANION_SETTINGS,
      maxRandomIntervalMinutes: 10,
      minRandomIntervalMinutes: 10,
      proactiveEnabled: true,
      quietHoursEnabled: false,
      randomInteractionEnabled: true,
    },
  },
} as PetConfig;

const timerCalls: number[] = [];
const clearedTimerIds: number[] = [];
const originalWindow = globalThis.window;
(globalThis as typeof globalThis & { window: unknown }).window = {
  clearTimeout: (id: number) => {
    clearedTimerIds.push(id);
  },
  setTimeout: (_callback: () => void, delayMs: number) => {
    timerCalls.push(delayMs);
    return 100 + timerCalls.length;
  },
};

try {
  const baseRefs = {
    configRef: { current: enabledConfig },
    isDisposed: () => false,
    lastLlmTextPromptAtRef: { current: null },
    lastTextPromptAtRef: { current: null },
    llmBackoffStateRef: { current: { ...DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE } },
    scheduleNext: () => undefined,
  };

  scheduleLifeCompanionRuntime({
    ...baseRefs,
    addLog: () => undefined,
    override: DEFAULT_LIFE_COMPANION_RUNTIME_OVERRIDE,
    timerRef: { current: null },
  });
  assert.equal(timerCalls.length, 1);
  assert.equal(lifeCompanionRuntimeStatusStore.getSnapshot().phase, 'armed');

  lifeCompanionRuntimeOverrideStore.setManualSuspended(true, 1234);
  const suspendedOverride = lifeCompanionRuntimeOverrideStore.getSnapshot();
  const timerRef = { current: 777 };
  scheduleLifeCompanionRuntime({
    ...baseRefs,
    addLog: () => undefined,
    override: suspendedOverride,
    timerRef,
  });
  assert.deepEqual(clearedTimerIds, [777]);
  assert.equal(timerRef.current, null);
  assert.equal(timerCalls.length, 1);
  assert.equal(lifeCompanionRuntimeStatusStore.getSnapshot().phase, 'suspended');
  assert.equal(lifeCompanionRuntimeStatusStore.getSnapshot().nextInteractionAt, null);

  lifeCompanionRuntimeOverrideStore.setManualSuspended(false, 2000);
  assert.equal(lifeCompanionRuntimeOverrideStore.getSnapshot().manualSuspended, false);
  assert.equal(lifeCompanionRuntimeOverrideStore.getSnapshot().manualSuspendedAt, null);
} finally {
  (globalThis as typeof globalThis & { window: unknown }).window = originalWindow;
}

const { hookSource, controlsSource, progressSource } = readProjectSources({
  hookSource: 'src/hooks/useLifeCompanionScheduler.ts',
  controlsSource: 'src/components/settings/SettingsLifeCompanionRuntimeControls.tsx',
  progressSource: 'PROJECT_FEATURE_PROGRESS.md',
});

assert.match(hookSource, /useLifeCompanionRuntimeOverride/u);
assert.match(hookSource, /override\.manualSuspended/u);
assert.match(controlsSource, /setManualSuspended/u);
assert.match(controlsSource, /Pause/u);
assert.match(controlsSource, /Resume/u);
assert.match(progressSource, /manual pause\/resume/u);

console.log('life companion runtime override smoke passed');
