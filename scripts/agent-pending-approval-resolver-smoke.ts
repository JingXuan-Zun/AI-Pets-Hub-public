import assert from 'node:assert/strict';
import {
  resolveAgentRuntimePendingFollowUpApproval,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentRuntimeResult,
} from '../src/agent/index.ts';

const baseCommand: AgentChatCommand = {
  capabilityId: 'desktop-observation',
  instruction: 'Inspect Example Launcher',
  kind: 'tool-call',
  sourceText: '/agent start Example Game inside Example Launcher',
  toolCall: {
    input: { query: 'Example Launcher' },
    name: 'observe_windows_and_apps',
  },
};
const launchCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: 'Open Example Launcher',
  kind: 'tool-call',
  sourceText: baseCommand.sourceText,
  toolCall: {
    goal: 'Start Example Game inside Example Launcher',
    input: { query: 'Example Launcher' },
    name: 'launch_local_app',
  },
};

function runtimeResult(status: AgentRuntimeResult['status']): AgentRuntimeResult {
  const continuation = {
    historyLines: [],
    sourceText: baseCommand.sourceText,
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'Start Example Game inside Example Launcher',
  };
  return {
    continuation,
    finalAnswer: status,
    sourceText: continuation.sourceText,
    status,
    steps: [],
    traceEvents: [],
    toolResults: [],
  };
}

function followUpResult(command: AgentChatCommand): AgentChatCommandResult {
  return {
    followUpActions: [{
      command,
      kind: 'run-command',
      label: 'Continue task',
      requiresApproval: command.toolCall?.name === 'launch_local_app',
    }],
    ok: true,
    responseText: 'More work is available.',
  };
}

const pending = resolveAgentRuntimePendingFollowUpApproval({
  command: baseCommand,
  result: followUpResult(launchCommand),
  runtimeResult: runtimeResult('completed'),
  sourceText: baseCommand.sourceText,
  userGoal: 'Start Example Game inside Example Launcher',
});
assert.equal(pending?.command.toolCall?.name, 'launch_local_app');
assert.equal(pending?.source, 'result-follow-up');

const readOnly = resolveAgentRuntimePendingFollowUpApproval({
  command: baseCommand,
  result: followUpResult(baseCommand),
  runtimeResult: runtimeResult('completed'),
  sourceText: baseCommand.sourceText,
  userGoal: 'Start Example Game inside Example Launcher',
});
assert.equal(readOnly, null);

const alreadyWaiting = runtimeResult('needs-approval');
alreadyWaiting.pendingApproval = {
  command: launchCommand,
  plan: pending!.plan,
  reason: 'already pending',
  routeSummary: 'needs approval',
};
assert.equal(resolveAgentRuntimePendingFollowUpApproval({
  command: baseCommand,
  result: followUpResult(launchCommand),
  runtimeResult: alreadyWaiting,
  sourceText: baseCommand.sourceText,
  userGoal: 'Start Example Game inside Example Launcher',
}), null);

console.log('agent pending approval resolver smoke ok');
