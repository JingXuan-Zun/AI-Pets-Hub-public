import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let parallelModelCallCount = 0;
let activeToolCount = 0;
let maxActiveToolCount = 0;
const parallelModelInputs: string[] = [];
const parallelCommands: AgentChatCommand[] = [];

const parallelModelCaller: AgentSessionV2ModelCaller = async ({ systemInstruction, userInput }) => {
  parallelModelCallCount += 1;
  parallelModelInputs.push(userInput);
  assert.match(systemInstruction, /Before ask_user, first use available read-only observation tools/u);
  assert.match(systemInstruction, /preflight observation batch with tool_calls/u);
  assert.match(systemInstruction, /For faster response, combine independent read-only preflight observations/u);
  assert.match(systemInstruction, /the app permission UI will ask before changing the computer/u);
  assert.match(systemInstruction, /observe current running\/window\/default-app state first; add remembered preference only when/u);
  assert.match(systemInstruction, /Do not search the web unless the user explicitly asks/u);

  if (parallelModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_calls',
      reason: 'Need independent read-only observations before answering.',
      tools: [
        {
          args: {
            action: 'get_display_info',
          },
          reason: 'Read display layout.',
          tool: 'execute_desktop_observation',
        },
        {
          args: {
            action: 'get_system_info',
            includeDisplays: true,
          },
          reason: 'Read system hardware summary.',
          tool: 'execute_desktop_observation',
        },
      ],
      understanding: {
        neededCapability: 'parallel local observation',
        successCriteria: 'display and system facts are both observed',
        userNeed: 'user asks for current computer/display status',
      },
    });
  }

  assert.match(userInput, /parallel tool results/u);
  assert.match(userInput, /criticalFacts=/u);
  assert.match(userInput, /rawEvidencePreview|observationsPreview/u);
  assert.match(userInput, /Display result/u);
  assert.match(userInput, /System result/u);
  return JSON.stringify({
    action: 'final_answer',
    message: 'display and system information observed',
    understanding: {
      completedGoals: [
        'read display layout',
        'read system hardware summary',
      ],
      remainingGoals: [],
      successCriteria: 'display and system facts are both observed',
      userNeed: 'user asks for current computer/display status',
      verificationEvidence: [
        'Display result',
        'System result',
      ],
      verificationGaps: [],
      verificationStatus: 'satisfied',
    },
  });
};

const parallelResult = await runAgentProductionSession({
  modelCaller: parallelModelCaller,
  settings,
  sourceText: '/agent what are my current computer and display facts',
  toolExecutor: async (command) => {
    parallelCommands.push(command);
    activeToolCount += 1;
    maxActiveToolCount = Math.max(maxActiveToolCount, activeToolCount);
    await delay(40);
    activeToolCount -= 1;

    const toolAction = command.toolCall?.input.action;
    return {
      observations: [`${command.toolCall?.name}:${toolAction} observed`],
      ok: true,
      responseText: toolAction === 'get_display_info' ? 'Display result' : 'System result',
      verification: `${command.toolCall?.name}:${toolAction} verified`,
    };
  },
  userGoal: 'what are my current computer and display facts',
});

// The successful read-only batch satisfies the task, so the Runtime answers
// from every batch result without another model turn.
assert.equal(parallelResult.status, 'completed');
assert.equal(parallelModelCallCount, 1);
assert.equal(parallelResult.finalAnswer, 'Display result\nSystem result');
assert.equal(parallelResult.toolResults.length, 2);
assert.equal(parallelCommands.length, 2);
assert.equal(maxActiveToolCount, 2);
assert.equal(parallelResult.steps.some((step) => step.action === 'tool_calls'), true);

let rejectedModelCallCount = 0;
let rejectedToolCallCount = 0;
const rejectedInputs: string[] = [];
const rejectedResult = await runAgentProductionSession({
  modelCaller: async () => {
    rejectedModelCallCount += 1;
    assert.equal(rejectedModelCallCount, 1);
    return JSON.stringify({
      action: 'tool_calls',
      reason: 'Incorrectly tries to parallelize a launch action.',
      tools: [
        {
          args: {
            action: 'launch_local_app',
            target: 'browser',
          },
          reason: 'Launch browser.',
          tool: 'execute_desktop_action',
        },
      ],
    });
  },
  settings,
  sourceText: '/agent open browser',
  toolExecutor: async () => {
    rejectedToolCallCount += 1;
    throw new Error('approval-required tool must not run inside tool_calls');
  },
  userGoal: 'open browser',
});

assert.equal(rejectedResult.status, 'needs-approval');
assert.equal(rejectedResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(rejectedResult.pendingApproval?.command.toolCall?.input.stepsJson), /launch_local_app/u);
assert.match(rejectedResult.continuation.historyLines.join('\n'), /prepared merged approval-required tool_calls/u);
assert.equal(rejectedToolCallCount, 0);
assert.equal(rejectedInputs.length, 0);

console.log('agent session v2 parallel tools smoke ok');
