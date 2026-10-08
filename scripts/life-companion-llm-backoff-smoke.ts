import { strict as assert } from 'node:assert';
import {
  applyLifeCompanionLlmBackoffFailure,
  clearLifeCompanionLlmBackoff,
  DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE,
  isLifeCompanionLlmBackoffActive,
} from '../src/life-companion/lifeCompanionLlmBackoff.ts';
import { createLifeCompanionRuntimeStatusSnapshot } from '../src/life-companion/lifeCompanionRuntimeStatus.ts';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const settings = {
  ...DEFAULT_LIFE_COMPANION_SETTINGS,
  llmTextPromptCooldownMinutes: 60,
  llmTextPromptEnabled: true,
  proactiveEnabled: true,
  randomInteractionEnabled: true,
  textPromptEnabled: true,
};

const firstFailure = applyLifeCompanionLlmBackoffFailure(
  DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE,
  'network failed',
  1000,
);
assert.equal(firstFailure.failureCount, 1);
assert.equal(firstFailure.retryAfter, 1000 + 30 * 60 * 1000);
assert.equal(isLifeCompanionLlmBackoffActive(firstFailure, 1000 + 29 * 60 * 1000), true);
assert.equal(isLifeCompanionLlmBackoffActive(firstFailure, 1000 + 30 * 60 * 1000), false);

const secondFailure = applyLifeCompanionLlmBackoffFailure(firstFailure, 'again', 2000);
assert.equal(secondFailure.failureCount, 2);
assert.equal(secondFailure.retryAfter, 2000 + 60 * 60 * 1000);
assert.deepEqual(clearLifeCompanionLlmBackoff(), DEFAULT_LIFE_COMPANION_LLM_BACKOFF_STATE);

const runtimeStatus = createLifeCompanionRuntimeStatusSnapshot({
  lastLlmTextPromptAt: 1000,
  llmBackoffRetryAfter: firstFailure.retryAfter,
  llmLastErrorMessage: firstFailure.lastErrorMessage,
  now: 1000 + 10 * 60 * 1000,
  settings,
});
assert.equal(runtimeStatus.llmTextPromptState, 'backoff');
assert.equal(runtimeStatus.llmLastErrorMessage, 'network failed');

const {
  controller: controllerSource,
  row: rowSource,
  runner: runnerSource,
  runtimeScheduler: runtimeSchedulerSource,
} = readProjectSources({
  controller: 'src/life-companion/lifeCompanionLlmPromptController.ts',
  row: 'src/components/settings/SettingsLifeCompanionRuntimeStatusRow.tsx',
  runner: 'src/life-companion/lifeCompanionInteractionRunner.ts',
  runtimeScheduler: 'src/life-companion/lifeCompanionRuntimeScheduler.ts',
});

assert.match(controllerSource, /isLifeCompanionLlmBackoffActive/u);
assert.match(controllerSource, /applyLifeCompanionLlmBackoffFailure/u);
assert.match(controllerSource, /clearLifeCompanionLlmBackoff/u);
assert.match(runtimeSchedulerSource, /llmBackoffStateRef/u);
assert.match(runnerSource, /llm-backoff/u);
assert.match(rowSource, /llmBackoffRetryAfter/u);
assert.match(rowSource, /llmLastErrorMessage/u);

console.log('life companion llm backoff smoke passed');
