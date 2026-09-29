import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  runAgentApprovedActionContinuation,
  transitionAgentApprovedActionOutcome,
  type AgentActionRuntimeDecision,
  type AgentChatCommand,
  type AgentRuntimeToolResultEntry,
} from '../src/agent/index.ts';

const actionDecision: AgentActionRuntimeDecision = {
  postActionState: '',
  reason: 'insufficient-evidence',
  status: 'uncertain',
  terminalEvaluation: null,
};
const noRecovery = { action: 'no-recovery', reason: 'no-recovery-signal' } as const;

function createLatestEntry(options: {
  action?: string;
  actionOutcome?: 'changed' | 'uncertain';
  finalWindow?: boolean;
  postActionRecovery?: boolean;
  receiptStatus?: 'success' | 'unverified';
  tool?: 'execute_desktop_action' | 'execute_desktop_sequence';
} = {}): AgentRuntimeToolResultEntry {
  const tool = options.tool ?? 'execute_desktop_sequence';
  return {
    command: {
      capabilityId: 'desktop-input',
      instruction: 'Continue the current task',
      kind: 'tool-call',
      sourceText: '/agent continue the current task',
      toolCall: {
        goal: 'Continue the current task',
        input: options.action ? { action: options.action } : {},
        name: tool,
      },
    },
    result: {
      ok: true,
      ...(options.receiptStatus ? { receipt: { status: options.receiptStatus } } : {}),
      responseText: 'Approved action returned.',
      stateSummary: {
        ...(options.actionOutcome ? { actionEvidence: { outcome: options.actionOutcome } } : {}),
        structuredEvidence: {
          ...(options.finalWindow ? { finalWindow: { hwnd: 100, title: 'Example App' } } : {}),
          ...(options.postActionRecovery
            ? {
                postActionRecovery: {
                  nextArgs: { action: 'inspect_window_ui' },
                  nextTool: 'execute_desktop_observation',
                  reason: 'Refresh current controls.',
                  strategy: 'refresh-observation',
                },
              }
            : {}),
        },
      },
    },
  };
}

const approvalCommand: AgentChatCommand = {
  capabilityId: 'desktop-input',
  instruction: 'Activate the selected control',
  kind: 'tool-call',
  sourceText: '/agent activate the selected control',
  toolCall: {
    goal: 'Activate the selected control',
    input: { action: 'click', x: 320, y: 240 },
    name: 'execute_desktop_input',
  },
};
const approvalRoute = buildAgentPermissionRoute(approvalCommand);
assert.ok(approvalRoute.plan);
const approval = {
  command: approvalCommand,
  plan: approvalRoute.plan,
  reason: 'Actionable target found.',
  routeSummary: approvalRoute.summary,
};

const terminal = transitionAgentApprovedActionOutcome({
  actionDecision: {
    ...actionDecision,
    reason: 'terminal-completed',
    status: 'completed',
    terminalEvaluation: {
      finalAnswer: 'Target state verified.',
      kind: 'launched',
      postActionState: 'verified',
      status: 'completed',
      stepAction: 'final_answer',
      stepReason: 'Evidence Engine authorized completion.',
    },
  },
  approval,
  latestEntry: createLatestEntry(),
  recoveryDecision: noRecovery,
  taskState: { nextSubgoalAction: 'execute' },
});
assert.equal(terminal.kind, 'terminal');

const approvalOutcome = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval,
  latestEntry: createLatestEntry(),
  recoveryDecision: { action: 'failed-action', reason: 'action-failed' },
  taskState: { nextSubgoalAction: 'execute' },
});
assert.equal(approvalOutcome.kind, 'approval');

const stopped = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry(),
  recoveryDecision: { action: 'stop-needs-user', reason: 'permission-blocked' },
  taskState: { nextSubgoalAction: 'blocked' },
});
assert.equal(stopped.kind, 'stop-needs-user');

for (const recoveryDecision of [
  { action: 'failed-action', reason: 'action-failed' },
  { action: 'wait', reason: 'action-waiting' },
] as const) {
  const recovery = transitionAgentApprovedActionOutcome({
    actionDecision,
    approval: null,
    latestEntry: createLatestEntry(),
    recoveryDecision,
    taskState: { nextSubgoalAction: 'verify' },
  });
  assert.equal(recovery.kind, 'recovery');
}

const targetResolution = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry(),
  recoveryDecision: noRecovery,
  taskState: { nextSubgoalAction: 'execute' },
});
assert.equal(targetResolution.kind, 'target-resolution');

const recoveryTargetResolution = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry({ actionOutcome: 'changed' }),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  taskState: null,
});
assert.equal(recoveryTargetResolution.kind, 'target-resolution');

const inputVerificationBeforeRecovery = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry(),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  taskState: null,
});
assert.equal(inputVerificationBeforeRecovery.kind, 'verification');

const explicitRecovery = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry({ postActionRecovery: true }),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  taskState: null,
});
assert.equal(explicitRecovery.kind, 'recovery');

const blockedStateRecovery = transitionAgentApprovedActionOutcome({
  actionDecision: { ...actionDecision, postActionState: 'blocked' },
  approval: null,
  latestEntry: createLatestEntry(),
  recoveryDecision: { action: 'automatic-observation', reason: 'action-needs-recovery' },
  taskState: null,
});
assert.equal(blockedStateRecovery.kind, 'recovery');

const errorStateRecovery = transitionAgentApprovedActionOutcome({
  actionDecision: { ...actionDecision, postActionState: 'error' },
  approval: null,
  latestEntry: createLatestEntry(),
  recoveryDecision: { action: 'automatic-observation', reason: 'unverified-receipt' },
  taskState: null,
});
assert.equal(errorStateRecovery.kind, 'recovery');

const missingOuterWindowRecovery = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry({ tool: 'execute_desktop_action' }),
  recoveryDecision: { action: 'automatic-observation', reason: 'unverified-receipt' },
  taskState: null,
});
assert.equal(missingOuterWindowRecovery.kind, 'recovery');

const confirmedOuterWindowTargetResolution = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry({
    action: 'launch_local_app',
    receiptStatus: 'success',
    tool: 'execute_desktop_action',
  }),
  recoveryDecision: { action: 'automatic-observation', reason: 'action-needs-recovery' },
  taskState: null,
});
assert.equal(confirmedOuterWindowTargetResolution.kind, 'target-resolution');

const focusedWindowTargetResolution = transitionAgentApprovedActionOutcome({
  actionDecision: { ...actionDecision, postActionState: 'launched' },
  approval: null,
  latestEntry: createLatestEntry({ action: 'focus_window', tool: 'execute_desktop_action' }),
  recoveryDecision: { action: 'automatic-observation', reason: 'insufficient-evidence' },
  taskState: null,
});
assert.equal(focusedWindowTargetResolution.kind, 'target-resolution');

const verification = transitionAgentApprovedActionOutcome({
  actionDecision,
  approval: null,
  latestEntry: createLatestEntry({ finalWindow: true, tool: 'execute_desktop_action' }),
  recoveryDecision: noRecovery,
  taskState: { nextSubgoalAction: 'verify' },
});
assert.equal(verification.kind, 'verification');

const adapterCalls: string[] = [];
const createAdapter = (kind: string, finalResult: string | null = null) => async () => {
  adapterCalls.push(kind);
  return { executed: true, finalResult };
};
const continuation = await runAgentApprovedActionContinuation({
  actionDecision,
  adapters: {
    approval: createAdapter('approval'),
    planning: createAdapter('planning'),
    recovery: createAdapter('recovery'),
    refine: createAdapter('refine'),
    targetResolution: createAdapter('targetResolution', 'target-resolution-ran'),
    terminal: createAdapter('terminal'),
    verification: createAdapter('verification'),
  },
  approval: null,
  latestEntry: createLatestEntry(),
  recoveryDecision: noRecovery,
  stepIndex: 9,
  taskState: { nextSubgoalAction: 'execute' },
});
assert.deepEqual(adapterCalls, ['targetResolution']);
assert.equal(continuation.adapterKind, 'targetResolution');
assert.equal(continuation.transition.kind, 'target-resolution');
assert.equal(continuation.finalResult, 'target-resolution-ran');
assert.equal(continuation.loopDecision.action, 'return-final');

console.log('agent approved action outcome runtime smoke ok');
