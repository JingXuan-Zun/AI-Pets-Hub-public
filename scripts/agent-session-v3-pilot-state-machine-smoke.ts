import assert from 'node:assert/strict';
import {
  advanceAgentSessionV3PilotState,
  createAgentSessionV3PilotInitialState,
  isAgentSessionV3PilotTerminalPhase,
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotPhase,
  type AgentSessionV3PilotState,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const { stateMachineSource, indexSource } = readProjectSources({
  stateMachineSource: 'src/agent/agentSessionV3PilotStateMachine.ts',
  indexSource: 'src/agent/legacy/index.ts',
});

assert.match(
  stateMachineSource,
  /export function advanceAgentSessionV3PilotState/u,
  'v3 pilot state machine should live in its own module.',
);
assert.match(
  indexSource,
  /export \* from '\.\.\/agentSessionV3PilotStateMachine'/u,
  'v3 pilot state machine should be exported through the agent barrel.',
);
assert.doesNotMatch(
  stateMachineSource,
  /execute_desktop|observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|toolCall\.name/u,
  'v3 pilot state machine should not encode concrete tools or a fixed tool chain.',
);
assert.doesNotMatch(
  stateMachineSource,
  /runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|createAgentSessionV2PendingApprovalAssembly/u,
  'v3 pilot state machine should not call execution modules directly; adapters should do that outside the pure transition module.',
);

function apply(
  state: AgentSessionV3PilotState,
  event: AgentSessionV3PilotEvent,
  expectedPhase: AgentSessionV3PilotPhase,
) {
  const transition = advanceAgentSessionV3PilotState(state, event);
  assert.equal(transition.accepted, true, transition.reason);
  assert.equal(transition.state.phase, expectedPhase);
  assert.equal(transition.to, expectedPhase);
  return transition.state;
}

let state = createAgentSessionV3PilotInitialState();
assert.equal(state.phase, 'init');
assert.equal(state.revision, 0);
assert.equal(state.recoveryCount, 0);

state = apply(state, { type: 'start' }, 'model_decision');
state = apply(state, {
  route: 'prepare-command',
  type: 'model-decision-accepted',
}, 'prepare_command');
state = apply(state, {
  route: 'execute',
  type: 'command-prepared',
}, 'execute_transaction');
state = apply(state, {
  ok: true,
  type: 'transaction-finished',
}, 'evaluate');
state = apply(state, {
  reason: 'post-action evidence completed the task',
  type: 'evaluation-completed',
}, 'done');
assert.equal(state.terminal?.status, 'completed');
assert.equal(isAgentSessionV3PilotTerminalPhase(state.phase), true);

const rejectedAfterDone = advanceAgentSessionV3PilotState(state, { type: 'start' });
assert.equal(rejectedAfterDone.accepted, false);
assert.equal(rejectedAfterDone.state, state);

let approvalState = createAgentSessionV3PilotInitialState();
approvalState = apply(approvalState, { type: 'start' }, 'model_decision');
approvalState = apply(approvalState, {
  route: 'prepare-command',
  type: 'model-decision-accepted',
}, 'prepare_command');
approvalState = apply(approvalState, {
  route: 'approval',
  type: 'command-prepared',
}, 'needs_approval');
approvalState = apply(approvalState, { type: 'approval-granted' }, 'execute_transaction');

let deniedState = createAgentSessionV3PilotInitialState();
deniedState = apply(deniedState, { type: 'start' }, 'model_decision');
deniedState = apply(deniedState, {
  route: 'prepare-command',
  type: 'model-decision-accepted',
}, 'prepare_command');
deniedState = apply(deniedState, {
  route: 'approval',
  type: 'command-prepared',
}, 'needs_approval');
deniedState = apply(deniedState, {
  reason: 'user did not approve the action',
  type: 'approval-denied',
}, 'done');
assert.equal(deniedState.terminal?.status, 'needs-user');

let recoveryState = createAgentSessionV3PilotInitialState();
recoveryState = apply(recoveryState, { type: 'start' }, 'model_decision');
recoveryState = apply(recoveryState, { type: 'model-output-invalid' }, 'recover');
assert.equal(recoveryState.recoveryCount, 1);
recoveryState = apply(recoveryState, { type: 'recovery-model-requested' }, 'model_decision');
recoveryState = apply(recoveryState, {
  route: 'prepare-command',
  type: 'model-decision-accepted',
}, 'prepare_command');
recoveryState = apply(recoveryState, { type: 'command-unavailable' }, 'recover');
assert.equal(recoveryState.recoveryCount, 2);
recoveryState = apply(recoveryState, {
  route: 'execute',
  type: 'recovery-command-prepared',
}, 'execute_transaction');

let terminalDecisionState = createAgentSessionV3PilotInitialState();
terminalDecisionState = apply(terminalDecisionState, { type: 'start' }, 'model_decision');
terminalDecisionState = apply(terminalDecisionState, {
  route: 'terminal',
  terminalStatus: 'needs-user',
  type: 'model-decision-accepted',
}, 'done');
assert.equal(terminalDecisionState.terminal?.status, 'needs-user');

let cancelledState = createAgentSessionV3PilotInitialState();
cancelledState = apply(cancelledState, { type: 'start' }, 'model_decision');
cancelledState = apply(cancelledState, {
  route: 'prepare-command',
  type: 'model-decision-accepted',
}, 'prepare_command');
cancelledState = apply(cancelledState, {
  route: 'execute',
  type: 'command-prepared',
}, 'execute_transaction');
cancelledState = apply(cancelledState, {
  reason: 'session was cancelled',
  type: 'cancel',
}, 'done');
assert.equal(cancelledState.terminal?.status, 'cancelled');

console.log('agent session v3 pilot state machine smoke ok');
