import assert from 'node:assert/strict';
import {
  createAgentRecoveryLoopState,
  decideAgentRecoveryTrigger,
  proposeAgentRecovery,
  transitionAgentRecoveryLoop,
  type AgentChatCommand,
  type AgentRecoveryProposalRequest,
} from '../src/agent/index.ts';

const triggerBase = {
  actionStatus: 'uncertain' as const,
  coverage: 'unknown' as const,
  latestTool: 'execute_desktop_observation',
  missingEvidence: false,
  permissionState: 'clear' as const,
  postActionState: 'unknown',
  receiptStatus: null,
  resultOk: true,
  terminalStatus: null,
};

assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  actionStatus: 'waiting',
  postActionState: 'loading',
}), { action: 'wait', reason: 'action-waiting' });
assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  actionStatus: 'failed',
  resultOk: false,
}), { action: 'failed-action', reason: 'action-failed' });
assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  actionStatus: 'needs-recovery',
  coverage: 'missing',
}), { action: 'automatic-observation', reason: 'action-needs-recovery' });
assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  receiptStatus: 'unverified',
}), { action: 'automatic-observation', reason: 'unverified-receipt' });
assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  actionStatus: 'blocked',
  terminalStatus: 'needs-user',
}), { action: 'stop-needs-user', reason: 'terminal-needs-user' });
assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  actionStatus: 'completed',
  terminalStatus: 'completed',
}), { action: 'no-recovery', reason: 'action-completed' });
assert.deepEqual(decideAgentRecoveryTrigger({
  ...triggerBase,
  permissionState: 'waiting-approval',
}), { action: 'no-recovery', reason: 'permission-pending' });

const request: AgentRecoveryProposalRequest = {
  kind: 'automatic-observation',
  latestEntry: null,
  sourceText: '/agent open Example Game',
  toolResults: [],
  userGoal: 'open Example Game',
};

function command(name: AgentChatCommand['toolCall']['name']): AgentChatCommand {
  return {
    capabilityId: 'desktop-observation',
    kind: 'tool-call',
    sourceText: request.sourceText,
    toolCall: {
      input: {},
      name,
    },
  };
}

const proposed = proposeAgentRecovery({
  adapters: {
    automaticObservation: () => command('observe_windows_and_apps'),
    failedAction: () => null,
  },
  request,
});
assert.equal(proposed.status, 'proposed');
assert.equal(proposed.command?.toolCall?.name, 'observe_windows_and_apps');

const notApplicable = proposeAgentRecovery({
  adapters: {
    automaticObservation: () => null,
    failedAction: () => null,
  },
  request,
});
assert.equal(notApplicable.status, 'not-applicable');
assert.equal(notApplicable.command, null);

const rejected = proposeAgentRecovery({
  adapters: {
    automaticObservation: () => command('execute_desktop_input'),
    failedAction: () => null,
  },
  request,
});
assert.equal(rejected.status, 'rejected');
assert.equal(rejected.command, null);
assert.match(rejected.reason, /side-effecting recovery tool execute_desktop_input/u);

const failedAction = proposeAgentRecovery({
  adapters: {
    automaticObservation: () => null,
    failedAction: () => command('execute_desktop_observation'),
  },
  request: {
    ...request,
    kind: 'failed-action',
  },
});
assert.equal(failedAction.status, 'proposed');
assert.equal(failedAction.command?.toolCall?.name, 'execute_desktop_observation');

const initialLoop = createAgentRecoveryLoopState({ evidenceCount: 2, maxTransitions: 2 });
assert.equal(initialLoop.transitionIndex, 1);
assert.equal(
  transitionAgentRecoveryLoop(initialLoop, {
    cancellationRequested: false,
    terminalAvailable: false,
    type: 'iteration-check',
  }).action,
  'request-proposal',
);
assert.equal(
  transitionAgentRecoveryLoop(initialLoop, {
    cancellationRequested: true,
    terminalAvailable: false,
    type: 'iteration-check',
  }).action,
  'stop-cancelled',
);
assert.equal(
  transitionAgentRecoveryLoop(initialLoop, {
    cancellationRequested: false,
    terminalAvailable: true,
    type: 'iteration-check',
  }).action,
  'stop-terminal',
);
assert.equal(
  transitionAgentRecoveryLoop(initialLoop, {
    proposalStatus: 'not-applicable',
    type: 'proposal-resolved',
  }).action,
  'stop-no-proposal',
);
assert.equal(
  transitionAgentRecoveryLoop(initialLoop, {
    proposalStatus: 'rejected',
    type: 'proposal-resolved',
  }).action,
  'stop-proposal-rejected',
);
const continuedLoop = transitionAgentRecoveryLoop(initialLoop, {
  evidenceCount: 3,
  executed: true,
  type: 'execution-finished',
});
assert.equal(continuedLoop.action, 'continue');
assert.equal(continuedLoop.state.transitionIndex, 2);
assert.equal(continuedLoop.state.executed, true);
assert.equal(
  transitionAgentRecoveryLoop(initialLoop, {
    evidenceCount: 2,
    executed: true,
    type: 'execution-finished',
  }).action,
  'stop-no-new-evidence',
);
assert.equal(
  transitionAgentRecoveryLoop(continuedLoop.state, {
    evidenceCount: 4,
    executed: true,
    type: 'execution-finished',
  }).action,
  'stop-limit-reached',
);

console.log('agent recovery controller smoke ok');
