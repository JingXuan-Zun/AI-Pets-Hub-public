import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

let dedupeModelCallCount = 0;
const dedupeExecutedCommands: AgentChatCommand[] = [];
const dedupeModelInputs: string[] = [];

const dedupeModelCaller: AgentSessionV2ModelCaller = async ({ systemInstruction, userInput }) => {
  dedupeModelCallCount += 1;
  dedupeModelInputs.push(userInput);
  assert.match(systemInstruction, /prefer live local observation first/u);
  assert.match(systemInstruction, /Add memory recall only when the wording depends on stored preferences\/aliases\/history/u);

  if (dedupeModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_calls',
      reason: 'Observe current desktop state before deciding.',
      tools: [
        {
          args: {
            includeActiveWindow: true,
            includeDisplays: true,
            includeRunningApps: true,
          },
          reason: 'Read app/window/display state together.',
          tool: 'observe_windows_and_apps',
        },
        {
          args: {
            action: 'get_display_info',
          },
          reason: 'Display info requested separately by mistake.',
          tool: 'execute_desktop_observation',
        },
        {
          args: {
            action: 'get_active_window_info',
          },
          reason: 'Active window requested separately by mistake.',
          tool: 'execute_desktop_observation',
        },
        {
          args: {
            action: 'list_running_apps',
          },
          reason: 'Running apps requested separately by mistake.',
          tool: 'execute_desktop_action',
        },
        {
          args: {
            action: 'recall',
            query: 'default browser',
          },
          reason: 'Memory is not covered by window observation.',
          tool: 'execute_memory_action',
        },
      ],
    });
  }

  throw new Error('successful read-only parallel observations should complete before another model call');
};

const dedupeResult = await runAgentProductionSession({
  modelCaller: dedupeModelCaller,
  settings,
  sourceText: '/agent observe dedupe',
  toolExecutor: async (command) => {
    dedupeExecutedCommands.push(command);
    if (command.toolCall?.name === 'observe_windows_and_apps') {
      return {
        observations: [
          'Display observations: 2',
          'Running windows: 4',
          'Active process: chrome.exe',
        ],
        ok: true,
        responseText: 'Aggregate observation result',
        verification: 'aggregate observed',
      };
    }

    if (command.toolCall?.name === 'execute_memory_action') {
      return {
        observations: ['Memory query: default browser'],
        ok: true,
        responseText: 'Memory recall result',
        verification: 'memory observed',
      };
    }

    throw new Error(`Unexpected deduped command executed: ${command.toolCall?.name}`);
  },
  userGoal: 'observe dedupe',
});

assert.equal(dedupeResult.status, 'completed');
assert.equal(dedupeResult.finalAnswer, 'Aggregate observation result');
assert.equal(dedupeModelCallCount, 1);
assert.deepEqual(
  dedupeExecutedCommands.map((command) => command.toolCall?.name),
  ['observe_windows_and_apps', 'execute_memory_action'],
);
assert.ok(
  dedupeResult.toolResults.some((entry) => (
    entry.command.toolCall?.name === 'execute_desktop_observation'
    && entry.command.toolCall.input.action === 'list_running_apps'
    && entry.result.observations?.some((line) => line.includes('parallel dedupe'))
  )),
  'read-only execute_desktop_action list_running_apps should redirect to observation before parallel dedupe',
);
assert.equal(dedupeResult.toolResults.length, 5);
assert.ok(dedupeResult.toolResults.some((entry) => (
  entry.result.observations?.some((line) => line.includes('parallel dedupe'))
)));

let fallbackModelCallCount = 0;
const fallbackExecutedCommands: AgentChatCommand[] = [];

const fallbackResult = await runAgentProductionSession({
  modelCaller: async () => {
    fallbackModelCallCount += 1;
    if (fallbackModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_calls',
        reason: 'Try aggregate observation first.',
        tools: [
          {
            args: {
              includeDisplays: true,
            },
            reason: 'Aggregate display state.',
            tool: 'observe_windows_and_apps',
          },
          {
            args: {
              action: 'get_display_info',
            },
            reason: 'Fallback display fact.',
            tool: 'execute_desktop_observation',
          },
        ],
      });
    }

    throw new Error('a successful fallback read-only observation should complete before another model call');
  },
  settings,
  sourceText: '/agent observe fallback',
  toolExecutor: async (command) => {
    fallbackExecutedCommands.push(command);
    if (command.toolCall?.name === 'observe_windows_and_apps') {
      return {
        errorText: 'Aggregate failed',
        observations: ['Aggregate failed'],
        ok: false,
        responseText: 'Aggregate failed',
        verification: 'aggregate failed',
      };
    }

    return {
      observations: ['Display observations: 2'],
      ok: true,
      responseText: 'Display fallback result',
      verification: 'display fallback observed',
    };
  },
  userGoal: 'observe fallback',
});

assert.equal(fallbackResult.status, 'completed');
assert.equal(fallbackResult.finalAnswer, 'Display fallback result');
assert.equal(fallbackModelCallCount, 1);
assert.deepEqual(
  fallbackExecutedCommands.map((command) => `${command.toolCall?.name}:${command.toolCall?.input.action ?? ''}`),
  ['observe_windows_and_apps:', 'execute_desktop_observation:get_display_info'],
);

console.log('agent session v2 parallel observation dedupe smoke ok');
