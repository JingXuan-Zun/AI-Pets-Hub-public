import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  runAgentProductionSession,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let timingModelCallCount = 0;
const timingModelCaller: AgentSessionV2ModelCaller = async () => {
  timingModelCallCount += 1;
  await delay(10);

  if (timingModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        action: 'get_display_info',
      },
      reason: 'Need one read-only observation.',
      tool: 'execute_desktop_observation',
    });
  }

  return JSON.stringify({
    action: 'final_answer',
    message: 'timing done',
  });
};

const timingResult = await runAgentProductionSession({
  maxDurationMs: 10_000,
  modelCaller: timingModelCaller,
  settings,
  sourceText: '/agent timing smoke',
  toolExecutor: async () => {
    await delay(10);
    return {
      ok: true,
      responseText: 'display ok',
      verification: 'display verified',
    };
  },
  userGoal: 'timing smoke',
});

assert.equal(timingResult.status, 'completed');
assert.ok(timingResult.timing);
assert.equal(timingResult.timing?.modelCallCount, 2);
assert.equal(timingResult.timing?.toolCallCount, 1);
assert.ok((timingResult.timing?.modelDurationMs ?? 0) >= 1);
assert.ok((timingResult.timing?.toolDurationMs ?? 0) >= 1);
assert.equal(timingResult.toolResults[0]?.timing?.kind, 'tool');
assert.equal(timingResult.steps.some((step) => step.timing?.kind === 'model'), true);

const durationBudgetResult = await runAgentProductionSession({
  maxDurationMs: 1,
  modelCaller: async () => {
    await delay(5);
    return JSON.stringify({
      action: 'final_answer',
      message: 'too slow',
    });
  },
  settings,
  sourceText: '/agent duration budget smoke',
  userGoal: 'duration budget smoke',
});

assert.equal(durationBudgetResult.status, 'budget-exceeded');
assert.equal(durationBudgetResult.timing?.stopReason, 'max-duration');

let resumedModelCallCount = 0;
const resumedAfterOldBudgetResult = await runAgentProductionSession({
  continuation: {
    historyLines: ['Previous run stopped near the duration budget.'],
    sourceText: '/agent continue previous desktop task',
    steps: [],
    timing: {
      accumulatedElapsedMs: 120_000,
      elapsedMs: 120_000,
      entries: [],
      maxDurationMs: 90_000,
      maxModelCalls: 6,
      maxToolCalls: 16,
      modelCallCount: 6,
      modelDurationMs: 80_000,
      startedAt: Date.now() - 120_000,
      stopReason: 'max-duration',
      toolCallCount: 16,
      toolDurationMs: 40_000,
      updatedAt: Date.now(),
    },
    toolResults: [],
    userGoal: 'continue previous desktop task',
  },
  maxDurationMs: 10_000,
  modelCaller: async () => {
    resumedModelCallCount += 1;
    return JSON.stringify({
      action: 'final_answer',
      message: 'resumed with a fresh interactive budget',
    });
  },
  settings,
  sourceText: '/agent continue previous desktop task',
  userGoal: 'continue previous desktop task',
});

assert.equal(resumedModelCallCount, 1);
assert.equal(resumedAfterOldBudgetResult.status, 'completed');
assert.equal(resumedAfterOldBudgetResult.timing?.stopReason ?? null, null);
assert.ok((resumedAfterOldBudgetResult.timing?.elapsedMs ?? 0) < 10_000);
assert.ok((resumedAfterOldBudgetResult.timing?.accumulatedElapsedMs ?? 0) >= 120_000);

const toolBudgetResult = await runAgentProductionSession({
  maxToolCalls: 0,
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      action: 'get_display_info',
    },
    reason: 'Need one tool.',
    tool: 'execute_desktop_observation',
  }),
  settings,
  sourceText: '/agent tool budget smoke',
  toolExecutor: async () => {
    throw new Error('tool must not run when budget is zero');
  },
  userGoal: 'tool budget smoke',
});

assert.equal(toolBudgetResult.status, 'budget-exceeded');
assert.equal(toolBudgetResult.timing?.stopReason, 'max-tool-calls');
assert.equal(toolBudgetResult.timing?.toolCallCount, 0);

console.log('agent session v2 budget timing smoke ok');
