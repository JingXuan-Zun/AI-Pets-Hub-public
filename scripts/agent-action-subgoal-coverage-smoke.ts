import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  commitAgentTaskRuntimeState,
  createAgentAttemptedActionCoverage,
  createAgentRuntimeWaitingApprovalSnapshot,
  runAgentApprovedActionLifecycle,
  selectAgentTaskRuntimeNextSubgoal,
  type AgentChatCommand,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

function sequenceCommand(
  completion: 'intermediate' | 'terminal',
  targetRef: string,
): AgentChatCommand {
  return {
    capabilityId: 'desktop-sequence',
    instruction: 'Open the requested target inside the launcher',
    kind: 'tool-call',
    sourceText: '/agent open Target App inside Launcher',
    toolCall: {
      actionScope: {
        completion,
        subgoalId: `${completion}:${targetRef.toLowerCase().replace(/\s+/gu, '-')}`,
        targetRef,
        taskGoalId: 'goal:open-target-app-inside-launcher',
      },
      goal: 'Open Target App inside Launcher',
      input: {
        stepsJson: JSON.stringify([{
          args: { action: 'click', x: 800, y: 450 },
          tool: 'execute_desktop_input',
        }]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function successfulSequenceEntry(
  completion: 'intermediate' | 'terminal',
  targetRef: string,
): AgentRuntimeToolResultEntry {
  return {
    command: sequenceCommand(completion, targetRef),
    result: {
      ok: true,
      responseText: `${targetRef} action confirmed.`,
      stateSummary: {
        structuredEvidence: {
          postActionState: 'launched',
          status: 'success',
          targetMatched: targetRef,
          visualActionReadiness: 'ready',
        },
        verificationEvidence: [`${targetRef} action was verified.`],
      },
      verification: `${targetRef} action confirmed and opened.`,
    },
  };
}

const postActionObservation: AgentRuntimeToolResultEntry = {
  command: {
    capabilityId: 'desktop-observation',
    instruction: 'Verify the current window',
    kind: 'tool-call',
    sourceText: '/agent open Target App inside Launcher',
    toolCall: {
      goal: 'Open Target App inside Launcher',
      input: { action: 'wait_and_observe' },
      name: 'execute_desktop_observation',
    },
  },
  result: {
    ok: true,
    responseText: 'Launcher window changed after the intermediate action.',
    verification: 'The launcher window is visible and changed.',
  },
};

const dependencies = {
  getPostActionState: (entry: AgentRuntimeToolResultEntry | null) => (
    entry?.command.toolCall?.name === 'execute_desktop_observation' ? 'launched' : ''
  ),
  isAutoRecoveryReadCommand: () => false,
  isAutoRecoveryWaitCommand: () => false,
  isPostApprovalVerificationCommand: (command: AgentChatCommand) => (
    command.toolCall?.name === 'execute_desktop_observation'
  ),
  isVerifiedTargetWindowObservation: (entry: AgentRuntimeToolResultEntry) => (
    entry.command.toolCall?.name === 'execute_desktop_observation'
  ),
};

const intermediateCoverage = createAgentAttemptedActionCoverage({
  dependencies,
  toolResults: [
    successfulSequenceEntry('intermediate', 'Login continuation'),
    postActionObservation,
  ],
});
assert.equal(intermediateCoverage.has('desktop-input'), true);
assert.equal(
  intermediateCoverage.has('in-app-action'),
  false,
  'An intermediate subgoal and its follow-up verification must not complete the root in-app goal.',
);

const terminalCoverage = createAgentAttemptedActionCoverage({
  dependencies,
  toolResults: [successfulSequenceEntry('terminal', 'Target App launch button')],
});
assert.equal(terminalCoverage.has('desktop-input'), true);
assert.equal(
  terminalCoverage.has('in-app-action'),
  true,
  'Verified terminal subgoal evidence should complete the requested in-app action coverage.',
);

console.log('agent action subgoal coverage smoke ok');

const scopedCommand = sequenceCommand('intermediate', 'Login continuation');
const scopedRoute = buildAgentPermissionRoute(scopedCommand);
assert.ok(scopedRoute.plan);
const waitingResult = createAgentRuntimeWaitingApprovalSnapshot({
  command: scopedCommand,
  continuation: {
    historyLines: [],
    sourceText: scopedCommand.sourceText,
    steps: [],
    traceEvents: [],
    toolResults: [],
    userGoal: 'Open Target App inside Launcher',
  },
  plan: scopedRoute.plan,
});

const approvedAction = await runAgentApprovedActionLifecycle({
  command: scopedCommand,
  execute: async (_command, executingResult) => {
    assert.equal(
      executingResult.taskState?.subgoals?.find((subgoal) => subgoal.id === 'intermediate:login-continuation')?.status,
      'in_progress',
    );
    return {
      ok: true,
      receipt: { status: 'success' },
      responseText: 'Input dispatched.',
    };
  },
  waitingResult,
});
assert.equal(approvedAction.runtimeResult.taskState?.currentSubgoalId, 'intermediate:login-continuation');
assert.equal(
  approvedAction.runtimeResult.taskState?.subgoals?.find((subgoal) => subgoal.id === 'intermediate:login-continuation')?.status,
  'dispatched',
);
assert.equal(approvedAction.runtimeResult.taskState?.nextSubgoalAction, 'execute');
assert.equal(approvedAction.runtimeResult.taskState?.nextSubgoalId, 'goal:open-target-app-inside-launcher');

const completedResult = commitAgentTaskRuntimeState({
  ...approvedAction.runtimeResult,
  finalAnswer: 'Target App opened.',
  pendingApproval: null,
  status: 'completed' as const,
});
assert.equal(completedResult.taskState?.subgoals?.every((subgoal) => subgoal.status === 'completed'), true);
assert.equal(completedResult.taskState?.nextSubgoalAction, 'complete');

const failedAction = await runAgentApprovedActionLifecycle({
  command: scopedCommand,
  execute: async () => ({
    errorText: 'Input backend rejected the action.',
    ok: false,
    responseText: 'Input backend rejected the action.',
  }),
  waitingResult,
});
assert.equal(
  failedAction.runtimeResult.taskState?.subgoals?.find((subgoal) => subgoal.id === 'intermediate:login-continuation')?.status,
  'blocked',
);
assert.equal(failedAction.runtimeResult.taskState?.nextSubgoalAction, 'blocked');

const terminalCommand = sequenceCommand('terminal', 'Target App launch button');
const terminalRoute = buildAgentPermissionRoute(terminalCommand);
assert.ok(terminalRoute.plan);
const terminalAction = await runAgentApprovedActionLifecycle({
  command: terminalCommand,
  execute: async () => ({
    ok: true,
    receipt: { status: 'success' },
    responseText: 'Terminal input dispatched.',
  }),
  waitingResult: createAgentRuntimeWaitingApprovalSnapshot({
    command: terminalCommand,
    continuation: waitingResult.continuation,
    plan: terminalRoute.plan,
  }),
});
assert.equal(terminalAction.runtimeResult.taskState?.nextSubgoalAction, 'verify');
assert.equal(
  selectAgentTaskRuntimeNextSubgoal(terminalAction.runtimeResult.taskState!).action,
  'verify',
);

console.log('agent action subgoal task-state smoke ok');
