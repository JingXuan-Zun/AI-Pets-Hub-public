import assert from 'node:assert/strict';
import {
  runAgentSessionV3ExperimentalChatRunner,
  type AgentChatCommand,
  type AgentSessionV2ContinuationState,
  type AgentSessionV2ToolResultEntry,
} from '../src/agent/legacy/index.ts';

const sourceText = '/agent Open WeGame and log in';
const userGoal = 'Open WeGame and log in';
const observationCommand: AgentChatCommand = {
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: { includeRunningApps: true, query: 'WeGame' },
    name: 'observe_windows_and_apps',
  },
};
const observationEntry: AgentSessionV2ToolResultEntry = {
  command: observationCommand,
  result: {
    ok: true,
    responseText: 'Running sample: wegame pid=6828 hwnd=29953666 title="WeGame".',
    verification: 'Window/app observation returned running windows.',
  },
};
const continuation: AgentSessionV2ContinuationState = {
  historyLines: ['WeGame is running but login is incomplete.'],
  sourceText,
  steps: [],
  traceEvents: [],
  toolResults: [observationEntry],
  userGoal,
};
const focusCommand: AgentChatCommand = {
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: { action: 'focus_window', hwnd: 29953666, target: 'WeGame' },
    name: 'execute_desktop_action',
  },
};
const approvedFocus: AgentSessionV2ToolResultEntry = {
  command: focusCommand,
  result: {
    ok: true,
    responseText: 'Focused matching window: WeGame.',
    stateSummary: {
      structuredEvidence: {
        finalWindow: { hwnd: 29953666, processName: 'wegame', title: 'WeGame' },
        status: 'success',
        targetMatched: 'WeGame',
      },
    },
    verification: 'Window focused: wegame',
  },
};

const result = await runAgentSessionV3ExperimentalChatRunner({
  approvedToolResult: approvedFocus,
  continuation,
  modelCaller: async () => {
    assert.fail('Approved focus should evaluate before any new model call.');
  },
  settings: {},
  sourceText,
  toolExecutor: async () => {
    assert.fail('Approved focus must not execute twice.');
  },
  userGoal,
});

assert.notEqual(result.status, 'completed');
assert.equal(result.toolResults.length, 2);
assert.equal(result.toolResults[0]?.command.toolCall?.name, 'observe_windows_and_apps');
assert.equal(result.toolResults[1]?.command.toolCall?.input.action, 'focus_window');
assert.match(result.continuation.historyLines.join('\n'), /missingCoverage=.*in-app-action/u);

console.log('agent session v3 focus login continuation coverage smoke ok');
