import assert from 'node:assert/strict';
import {
  createAgentStaleOuterApprovalSkippedResult,
  createAgentToolCommand,
  isAgentVerifiedTargetWindowObservation,
  resolveAgentDesktopAutoRecoveryQuery,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';
import { runAgentProductionSession } from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const sourceText = '/agent open Example Workspace and verify its window appears';
const userGoal = 'Open Example Workspace and verify its window appears';
const target = 'Example Workspace';

const staleOuterCommand: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: {
      action: 'launch_local_app',
      target,
    },
    name: 'execute_desktop_action',
  },
};

const skippedResult = createAgentStaleOuterApprovalSkippedResult({
  command: staleOuterCommand,
  responseText: 'Skipped stale duplicate outer action.',
});
const followUp = skippedResult.followUpAction;
assert.equal(followUp?.kind, 'run-command');
if (!followUp || followUp.kind !== 'run-command') {
  throw new Error('expected stale outer skip to schedule a read-only observation');
}

assert.equal(followUp.command.toolCall?.name, 'execute_desktop_observation');
assert.equal(
  followUp.command.toolCall?.input.query,
  target,
  'stale skip must preserve the concrete target instead of replacing it with a generic observation sentence',
);

const waitingResult: AgentChatCommandResult = {
  ok: true,
  receipt: {
    evidenceLines: ['Launch target window still needs verification.'],
    status: 'unverified',
    summaryLines: ['Waiting for target window.'],
    title: 'Post-action observation',
    toolName: 'execute_desktop_observation',
    verification: 'Target window is not verified yet.',
  },
  responseText: 'Waiting for target window.',
  stateSummary: {
    structuredEvidence: {
      postActionState: 'waiting_window',
      status: 'unverified',
      targetMatched: target,
    },
  },
  verification: 'Target window is not verified yet.',
};
const waitingEntry: AgentRuntimeToolResultEntry = {
  command: followUp.command,
  result: waitingResult,
};

assert.equal(resolveAgentDesktopAutoRecoveryQuery({
  latestEntry: waitingEntry,
  sourceText,
  userGoal,
}), target);

const windowObservationCommand = createAgentToolCommand({
  args: {
    forceRefresh: true,
    includeActiveWindow: true,
    includeRunningApps: true,
    query: target,
    recoveryPostActionState: 'waiting_window',
  },
  sourceText,
  toolName: 'observe_windows_and_apps',
  userGoal,
});
const verifiedWindowEntry: AgentRuntimeToolResultEntry = {
  command: windowObservationCommand,
  result: {
    observations: [
      `Running 1. ExampleWorkspace.exe pid=42 hwnd=314 title="${target}"`,
    ],
    ok: true,
    receipt: {
      evidenceLines: [`Active title: ${target}`],
      status: 'success',
      summaryLines: ['Running: 1'],
      title: 'Window/app observation',
      toolName: 'observe_windows_and_apps',
      verification: `Observed ${target} as a running window.`,
    },
    responseText: `Observed ${target} as a running window.`,
    stateSummary: {
      structuredEvidence: {
        finalWindow: {
          hwnd: 314,
          pid: 42,
          processName: 'ExampleWorkspace.exe',
          title: target,
        },
        status: 'success',
        targetMatched: target,
      },
      verificationEvidence: [`Observed ${target} as a running window.`],
    },
    verification: `Observed ${target} as a running window.`,
  },
};

assert.equal(
  isAgentVerifiedTargetWindowObservation(verifiedWindowEntry),
  true,
  'targeted recovery window evidence must be accepted as verified target-window evidence',
);

const executedRecoveryTools: string[] = [];
let modelCallCount = 0;
const completedResult = await runAgentProductionSession({
  approvedToolResult: {
    command: staleOuterCommand,
    result: skippedResult,
  },
  maxSteps: 10,
  modelCaller: async () => {
    modelCallCount += 1;
    throw new Error('model should not be called when deterministic window recovery can verify the target');
  },
  settings: {} as PetConfig['settings'],
  sourceText,
  toolExecutor: async (command) => {
    const toolName = command.toolCall?.name ?? command.kind;
    executedRecoveryTools.push(toolName);
    if (toolName === 'observe_windows_and_apps') {
      return verifiedWindowEntry.result;
    }
    assert.equal(toolName, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.query, target);
    return waitingResult;
  },
  userGoal,
});

assert.equal(modelCallCount, 0);
assert.ok(
  executedRecoveryTools.includes('observe_windows_and_apps'),
  `expected deterministic target-window read, got ${executedRecoveryTools.join(', ')}`,
);
assert.equal(completedResult.status, 'completed');
assert.match(completedResult.continuation.historyLines.join('\n'), /verified-target-window/u);

console.log('agent stale outer target evidence continuation smoke ok');
