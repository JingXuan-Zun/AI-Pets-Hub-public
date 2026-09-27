import { strict as assert } from 'node:assert';
import {
  applyLifeCompanionLlmBackoffFailure,
  DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE,
} from '../src/life-companion/lifeCompanionLlmBackoff.ts';
import {
  createLifeCompanionRuntimeStatusSnapshot,
  type LifeCompanionRuntimeStatus,
} from '../src/life-companion/lifeCompanionRuntimeStatus.ts';
import {
  resolveLifeCompanionSchedulerDelayMs,
  shouldScheduleLifeCompanionInteraction,
} from '../src/life-companion/lifeCompanionScheduler.ts';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings.ts';

const MINUTE_MS = 60 * 1000;

const enabledSettings = {
  ...DEFAULT_LIFE_COMPANION_SETTINGS,
  llmTextPromptCooldownMinutes: 60,
  llmTextPromptEnabled: true,
  maxRandomIntervalMinutes: 20,
  minRandomIntervalMinutes: 10,
  proactiveEnabled: true,
  quietHoursEnabled: true,
  quietHoursEnd: '09:00',
  quietHoursStart: '23:00',
  randomInteractionEnabled: true,
  textPromptCooldownMinutes: 30,
  textPromptEnabled: true,
};

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<T, number>>((counts, value) => ({
    ...counts,
    [value]: (counts[value] ?? 0) + 1,
  }), {} as Record<T, number>);
}

function atHour(hour: number) {
  return new Date(`2026-07-01T${String(hour).padStart(2, '0')}:00:00`).getTime();
}

function createHourlyStatus(hour: number) {
  const now = atHour(hour);
  return createLifeCompanionRuntimeStatusSnapshot({
    lastLlmTextPromptAt: null,
    lastTextPromptAt: null,
    nextInteractionAt: shouldScheduleLifeCompanionInteraction(enabledSettings, new Date(now))
      ? now + resolveLifeCompanionSchedulerDelayMs(enabledSettings, () => 0.5)
      : null,
    now,
    settings: enabledSettings,
  });
}

const baseNow = atHour(10);
const deterministicDelayMs = resolveLifeCompanionSchedulerDelayMs(enabledSettings, () => 0.5);
assert.equal(deterministicDelayMs, 15 * MINUTE_MS);

const disabled = createLifeCompanionRuntimeStatusSnapshot({
  now: baseNow,
  settings: DEFAULT_LIFE_COMPANION_SETTINGS,
});
assert.equal(disabled.phase, 'disabled');
assert.equal(disabled.textPromptState, 'off');
assert.equal(disabled.llmTextPromptState, 'off');

const armed = createLifeCompanionRuntimeStatusSnapshot({
  lastLlmTextPromptAt: null,
  lastTextPromptAt: null,
  nextInteractionAt: baseNow + deterministicDelayMs,
  now: baseNow,
  settings: enabledSettings,
});
assert.equal(armed.phase, 'armed');
assert.equal(armed.nextInteractionAt, baseNow + deterministicDelayMs);
assert.equal(armed.textPromptState, 'ready');
assert.equal(armed.llmTextPromptState, 'ready');

const cooldown = createLifeCompanionRuntimeStatusSnapshot({
  lastEvent: 'llm-published',
  lastEventAt: baseNow,
  lastLlmTextPromptAt: baseNow,
  lastTextPromptAt: baseNow,
  now: baseNow + 10 * MINUTE_MS,
  settings: enabledSettings,
});
assert.equal(cooldown.textPromptState, 'cooldown');
assert.equal(cooldown.llmTextPromptState, 'cooldown');

const failure = applyLifeCompanionLlmBackoffFailure(
  DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE,
  'network failed',
  baseNow + 20 * MINUTE_MS,
);
const backoff = createLifeCompanionRuntimeStatusSnapshot({
  lastEvent: 'llm-error',
  lastEventAt: baseNow + 20 * MINUTE_MS,
  lastLlmTextPromptAt: baseNow + 20 * MINUTE_MS,
  llmBackoffRetryAfter: failure.retryAfter,
  llmLastErrorMessage: failure.lastErrorMessage,
  now: baseNow + 25 * MINUTE_MS,
  settings: enabledSettings,
});
assert.equal(backoff.llmTextPromptState, 'backoff');
assert.equal(backoff.llmLastErrorMessage, 'network failed');

const retryReady = createLifeCompanionRuntimeStatusSnapshot({
  lastLlmTextPromptAt: baseNow + 20 * MINUTE_MS,
  llmBackoffRetryAfter: failure.retryAfter,
  now: Number(failure.retryAfter) + 30 * MINUTE_MS,
  settings: enabledSettings,
});
assert.equal(retryReady.llmTextPromptState, 'ready');

const hourlyStatuses = Array.from({ length: 24 }, (_, hour) => createHourlyStatus(hour));
const phaseCounts = countBy(hourlyStatuses.map((status) => status.phase));
const textStateCounts = countBy([disabled, armed, cooldown, backoff, retryReady]
  .map((status) => status.textPromptState));
const llmStateCounts = countBy([disabled, armed, cooldown, backoff, retryReady]
  .map((status) => status.llmTextPromptState));

assert.equal(phaseCounts['quiet-hours'], 10);
assert.equal(phaseCounts.armed, 14);
assert.equal(textStateCounts.off, 1);
assert.equal(textStateCounts.ready, 3);
assert.equal(textStateCounts.cooldown, 1);
assert.equal(llmStateCounts.off, 1);
assert.equal(llmStateCounts.ready, 2);
assert.equal(llmStateCounts.cooldown, 1);
assert.equal(llmStateCounts.backoff, 1);

hourlyStatuses.forEach((status: LifeCompanionRuntimeStatus) => {
  if (status.phase === 'quiet-hours') {
    assert.equal(status.nextInteractionAt, null);
  }
  if (status.phase === 'armed') {
    assert.equal(typeof status.nextInteractionAt, 'number');
  }
});

console.log(JSON.stringify({
  kind: 'life-companion-runtime-soak',
  llmStateCounts,
  phaseCounts,
  rounds: hourlyStatuses.length + 5,
  status: 'healthy',
  textStateCounts,
}, null, 2));
