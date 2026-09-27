import { strict as assert } from 'node:assert';
import {
  createLifeCompanionDraftFromState,
  createLifeCompanionDraftPrompt,
  isLifeCompanionQuietHour,
  resolveLifeCompanionSchedulerDelayMs,
  shouldScheduleLifeCompanionInteraction,
  shouldPublishLifeCompanionTextPrompt,
  shouldGenerateLifeCompanionLlmTextPrompt,
} from '../src/life-companion/lifeCompanionScheduler.ts';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const enabledSettings = {
  ...DEFAULT_LIFE_COMPANION_SETTINGS,
  maxRandomIntervalMinutes: 20,
  minRandomIntervalMinutes: 10,
  proactiveEnabled: true,
  quietHoursEnabled: true,
  quietHoursEnd: '09:00',
  quietHoursStart: '23:00',
  randomInteractionEnabled: true,
  llmTextPromptCooldownMinutes: 60,
  llmTextPromptEnabled: true,
  textPromptCooldownMinutes: 30,
  textPromptEnabled: true,
};

assert.equal(shouldScheduleLifeCompanionInteraction(DEFAULT_LIFE_COMPANION_SETTINGS), false);
assert.equal(
  shouldScheduleLifeCompanionInteraction(enabledSettings, new Date('2026-07-01T10:00:00')),
  true,
);
assert.equal(
  shouldScheduleLifeCompanionInteraction(enabledSettings, new Date('2026-07-01T23:30:00')),
  false,
);
assert.equal(isLifeCompanionQuietHour(enabledSettings, new Date('2026-07-01T08:59:00')), true);
assert.equal(isLifeCompanionQuietHour(enabledSettings, new Date('2026-07-01T09:00:00')), false);
assert.equal(resolveLifeCompanionSchedulerDelayMs(enabledSettings, () => -1), 10 * 60 * 1000);
assert.equal(resolveLifeCompanionSchedulerDelayMs(enabledSettings, () => 2), 20 * 60 * 1000);
assert.equal(shouldPublishLifeCompanionTextPrompt({
  lastPromptAt: null,
  now: 1000,
  settings: enabledSettings,
}), true);
assert.equal(shouldPublishLifeCompanionTextPrompt({
  lastPromptAt: 1000,
  now: 1000 + 29 * 60 * 1000,
  settings: enabledSettings,
}), false);
assert.equal(shouldPublishLifeCompanionTextPrompt({
  lastPromptAt: 1000,
  now: 1000 + 30 * 60 * 1000,
  settings: enabledSettings,
}), true);
assert.equal(shouldGenerateLifeCompanionLlmTextPrompt({
  lastPromptAt: null,
  now: 1000,
  settings: enabledSettings,
}), true);
assert.equal(shouldGenerateLifeCompanionLlmTextPrompt({
  lastPromptAt: 1000,
  now: 1000 + 59 * 60 * 1000,
  settings: enabledSettings,
}), false);
assert.equal(shouldGenerateLifeCompanionLlmTextPrompt({
  lastPromptAt: 1000,
  now: 1000 + 60 * 60 * 1000,
  settings: enabledSettings,
}), true);

assert.match(
  createLifeCompanionDraftPrompt({
    affectionLevel: 'normal',
    hungerLevel: 'critical',
    mood: 'hungry',
    proactiveReady: true,
    summary: 'mood=hungry',
  }, '小玲'),
  /小玲.*饿/u,
);

const draft = createLifeCompanionDraftFromState(
  { affection: 15, fatigue: 5, hunger: 18 },
  enabledSettings,
  '小玲',
);
assert.equal(draft.status.mood, 'distant');
assert.match(draft.prompt, /小玲/u);

const {
  backoffSource,
  hookSource,
  interactionRunnerSource,
  llmControllerSource,
  llmPromptSource,
  progressSource,
  publisherSource,
  runtimeOverrideSource,
  runtimeSchedulerSource,
  runtimeSource,
  schedulerSource,
  speechControllerSource,
  startupGreetingSource,
  soakSource,
} = readProjectSources({
  backoffSource: 'src/life-companion/lifeCompanionLlmBackoff.ts',
  hookSource: 'src/hooks/useLifeCompanionScheduler.ts',
  interactionRunnerSource: 'src/life-companion/lifeCompanionInteractionRunner.ts',
  llmControllerSource: 'src/life-companion/lifeCompanionLlmPromptController.ts',
  llmPromptSource: 'src/life-companion/lifeCompanionLlmPrompt.ts',
  progressSource: 'PROJECT_FEATURE_PROGRESS.md',
  publisherSource: 'src/life-companion/lifeCompanionTextPromptPublisher.ts',
  runtimeOverrideSource: 'src/life-companion/lifeCompanionRuntimeOverride.ts',
  runtimeSchedulerSource: 'src/life-companion/lifeCompanionRuntimeScheduler.ts',
  runtimeSource: 'src/hooks/usePetRuntimeState.ts',
  schedulerSource: 'src/life-companion/lifeCompanionScheduler.ts',
  speechControllerSource: 'src/hooks/usePetRuntimeSpeechController.ts',
  startupGreetingSource: 'src/life-companion/startupGreetingLlm.ts',
  soakSource: 'scripts/life-companion-runtime-soak.ts',
});

assert.match(runtimeSource, /useLifeCompanionScheduler/u);
assert.match(runtimeSource, /startupGreetingEnabled/u);
assert.match(runtimeSource, /enqueueStartupGreeting\(\)/u);
assert.doesNotMatch(runtimeSource, /personality\.greeting\.trim/u);
assert.match(runtimeSource, /startupGreetingTimerRef/u);
assert.match(runtimeSource, /1200/u);
assert.match(runtimeSource, /cleanupAutoSpeech/u);
assert.match(runtimeSource, /desktopPetChatStore\.getState/u);
assert.match(speechControllerSource, /getStartupGreetingLlmResponse/u);
assert.match(speechControllerSource, /启动模型问候/u);
assert.match(speechControllerSource, /AbortController/u);
assert.match(speechControllerSource, /waitForChatIdle/u);
assert.match(speechControllerSource, /启动问候已发送/u);
assert.match(startupGreetingSource, /getPetResponseStrict/u);
assert.match(startupGreetingSource, /webSearchEnabled:\s*false/u);
assert.match(startupGreetingSource, /'block'/u);
assert.match(startupGreetingSource, /人格名称/u);
assert.match(hookSource, /scheduleLifeCompanionRuntime/u);
assert.doesNotMatch(hookSource, /addMessage\(/u);
assert.doesNotMatch(hookSource, /enqueueTriggeredPetSpeech/u);
assert.doesNotMatch(hookSource, /queueAnimationToolTrigger/u);
assert.match(publisherSource, /desktopPetChatStore\.setStatusMessage/u);
assert.match(publisherSource, /desktopPetChatStore\.setInputValue/u);
assert.match(publisherSource, /desktopPetChatStore\.addMessage/u);
assert.match(publisherSource, /textPromptAllowed/u);
assert.doesNotMatch(publisherSource, /speakText|queueAnimationToolTrigger|enqueueTriggeredPetSpeech|mcp/iu);
assert.match(llmPromptSource, /getPetResponse/u);
assert.match(llmPromptSource, /'block'/u);
assert.match(llmPromptSource, /Do not ask to search the web, open apps, run commands, play voice, or trigger skills/u);
assert.doesNotMatch(llmPromptSource, /speakText|queueAnimationToolTrigger|enqueueTriggeredPetSpeech|mcp/iu);
assert.match(llmControllerSource, /shouldGenerateLifeCompanionLlmTextPrompt/u);
assert.match(runtimeSchedulerSource, /runLifeCompanionInteraction/u);
assert.match(runtimeSchedulerSource, /publishLifeCompanionRuntimeStatus/u);
assert.match(runtimeSchedulerSource, /resolveLifeCompanionSchedulerDelayMs/u);
assert.match(runtimeSchedulerSource, /manualSuspended/u);
assert.match(runtimeOverrideSource, /setManualSuspended/u);
assert.match(interactionRunnerSource, /publishLifeCompanionPrompt/u);
assert.match(interactionRunnerSource, /resolveLifeCompanionLlmPrompt/u);
assert.match(interactionRunnerSource, /shouldPublishLifeCompanionTextPrompt/u);
assert.match(backoffSource, /applyLifeCompanionLlmBackoffFailure/u);
assert.match(schedulerSource, /shouldScheduleLifeCompanionInteraction/u);
assert.match(schedulerSource, /isLifeCompanionQuietHour/u);
assert.match(soakSource, /life-companion-runtime-soak/u);
assert.match(soakSource, /phaseCounts/u);
assert.match(soakSource, /llmStateCounts/u);
assert.match(progressSource, /Proactive interaction scheduler \| 70%/u);
assert.match(progressSource, /Proactive text prompt path \| 48%/u);
assert.match(progressSource, /src\/life-companion\/lifeCompanionRuntimeScheduler\.ts/u);
assert.match(progressSource, /src\/life-companion\/lifeCompanionRuntimeOverride\.ts/u);
assert.ok(hookSource.split(/\r?\n/u).length <= 80);
assert.ok(schedulerSource.split(/\r?\n/u).length <= 180);
assert.ok(publisherSource.split(/\r?\n/u).length <= 120);
assert.ok(llmPromptSource.split(/\r?\n/u).length <= 90);
assert.ok(llmControllerSource.split(/\r?\n/u).length <= 110);
assert.ok(interactionRunnerSource.split(/\r?\n/u).length <= 90);
assert.ok(runtimeSchedulerSource.split(/\r?\n/u).length <= 150);
assert.ok(backoffSource.split(/\r?\n/u).length <= 80);

console.log('life companion scheduler smoke passed');
