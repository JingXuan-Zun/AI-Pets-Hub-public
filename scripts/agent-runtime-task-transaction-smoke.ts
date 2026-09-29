import assert from 'node:assert/strict';

import {
  buildAgentPermissionRoute,
  cancelAgentProductionRuntime,
  createAgentRuntimeTaskTransactionState,
  isAgentRuntimeTaskTransactionTerminal,
  transitionAgentRuntimeTaskTransaction,
  type AgentChatCommand,
  type AgentRuntimePendingApproval,
} from '../src/agent/index.ts';

const sourceText = '/agent open Example App';
const userGoal = 'Open Example App';
const command: AgentChatCommand = {
  capabilityId: 'app-launcher',
  instruction: userGoal,
  kind: 'tool-call',
  sourceText,
  toolCall: {
    goal: userGoal,
    input: { query: 'Example App' },
    name: 'launch_local_app',
  },
};
const plan = buildAgentPermissionRoute(command).plan;
assert.ok(plan);

let transaction = createAgentRuntimeTaskTransactionState();
let transition = transitionAgentRuntimeTaskTransaction({
  event: { sourceText, type: 'start', userGoal },
  previous: transaction,
});
assert.equal(transition.accepted, true);
assert.equal(transition.state.phase, 'running');
assert.ok(transition.state.taskState?.runId);
transaction = transition.state;

const cancelledThroughProductionEntry = cancelAgentProductionRuntime({
  continuation: {
    historyLines: [],
    sourceText,
    steps: [],
    taskState: transaction.taskState,
    taskTransaction: transaction,
    traceEvents: [],
    toolResults: [],
    userGoal,
  },
});
assert.equal(cancelledThroughProductionEntry.accepted, true);
assert.equal(cancelledThroughProductionEntry.continuation.taskTransaction?.phase, 'cancelled');
assert.equal(cancelledThroughProductionEntry.continuation.taskState?.state, 'cancelled');

const duplicateStart = transitionAgentRuntimeTaskTransaction({
  event: { sourceText, type: 'start', userGoal },
  previous: transaction,
});
assert.equal(duplicateStart.accepted, false);
assert.equal(duplicateStart.state.lastError, 'transaction-start-not-idle');

const approval: AgentRuntimePendingApproval = {
  command,
  plan,
  reason: 'Approval required.',
  routeSummary: 'Approval required.',
  runId: transaction.taskState?.runId,
  taskId: transaction.taskState?.taskId,
};
transaction = transitionAgentRuntimeTaskTransaction({
  event: {
    approval,
    resultStatus: 'needs-approval',
    sourceText,
    type: 'result',
    userGoal,
  },
  previous: transaction,
}).state;
assert.equal(transaction.phase, 'waiting_approval');

transaction = transitionAgentRuntimeTaskTransaction({
  event: { approval, type: 'approve' },
  previous: transaction,
}).state;
assert.equal(transaction.phase, 'resuming');
assert.equal(transaction.taskState?.lastTransitionKind, 'approval-granted');

transaction = transitionAgentRuntimeTaskTransaction({
  event: { type: 'resume' },
  previous: transaction,
}).state;
assert.equal(transaction.phase, 'running');

transaction = transitionAgentRuntimeTaskTransaction({
  event: {
    resultStatus: 'completed',
    sourceText,
    type: 'result',
    userGoal,
  },
  previous: transaction,
}).state;
assert.equal(transaction.phase, 'succeeded');
assert.equal(isAgentRuntimeTaskTransactionTerminal(transaction), true);

const terminalCancel = transitionAgentRuntimeTaskTransaction({
  event: { sourceText, type: 'cancel', userGoal },
  previous: transaction,
});
assert.equal(terminalCancel.accepted, false);
assert.equal(terminalCancel.state.lastError, 'transaction-cancel-terminal');

const cancelled = transitionAgentRuntimeTaskTransaction({
  event: { sourceText, type: 'cancel', userGoal },
  previous: createAgentRuntimeTaskTransactionState(),
});
assert.equal(cancelled.accepted, true);
assert.equal(cancelled.state.phase, 'cancelled');
assert.equal(cancelled.state.taskState?.state, 'cancelled');

console.log('agent runtime task transaction smoke ok');
