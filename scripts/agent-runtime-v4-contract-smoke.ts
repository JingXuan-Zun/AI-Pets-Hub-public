import assert from 'node:assert/strict';
import {
  AGENT_TASK_RUNTIME_V4_GUARDRAILS,
  AGENT_TASK_RUNTIME_V4_TRANSITION_TABLE,
  canAgentTaskRuntimeV4ActorMarkSucceeded,
  canAgentTaskRuntimeV4PlannerOwnCapability,
  createAgentTaskRuntimeV4Contract,
  createAgentTaskRuntimeV4Transition,
  getAgentTaskRuntimeV4ApprovalScope,
  getAgentTaskRuntimeV4NextState,
  isAgentTaskRuntimeV4ReadOnlyCapability,
  isAgentTaskRuntimeV4SideEffectCapability,
  isAgentTaskRuntimeV4TransitionAllowed,
  type AgentTaskRuntimeV4Capability,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  contractSource,
  indexSource,
} = readProjectSources({
  contractSource: 'src/agent/agentTaskRuntimeV4Contract.ts',
  indexSource: 'src/agent/index.ts',
});

assert.match(contractSource, /export type AgentTaskRuntimeV4State/u);
assert.match(contractSource, /export interface AgentTaskRuntimeV4TaskSpec/u);
assert.match(contractSource, /export interface AgentTaskRuntimeV4Context/u);
assert.match(contractSource, /export function createAgentTaskRuntimeV4Contract/u);
assert.match(indexSource, /export \* from '\.\/agentTaskRuntimeV4Contract';/u);

assert.doesNotMatch(
  contractSource,
  /runAgentSessionV2|buildAgentPermissionRoute|toolExecutor|execute_desktop_input|execute_desktop_sequence|locate_screen_elements/u,
  'V4 contract must not call production session, permission, execution, or concrete desktop tool modules.',
);

const contract = createAgentTaskRuntimeV4Contract();
assert.equal(contract.version, 4);
assert.equal(contract.productionAuthority, false);
assert.deepEqual(contract.guardrails, [...AGENT_TASK_RUNTIME_V4_GUARDRAILS]);
assert.deepEqual(contract.transitionTable, AGENT_TASK_RUNTIME_V4_TRANSITION_TABLE);

const readOnlyCapabilities = [
  'observe',
  'locate',
  'verify',
  'wait',
  'retry',
] as const satisfies readonly AgentTaskRuntimeV4Capability[];
for (const capability of readOnlyCapabilities) {
  assert.equal(isAgentTaskRuntimeV4ReadOnlyCapability(capability), true);
  assert.equal(isAgentTaskRuntimeV4SideEffectCapability(capability), false);
}
assert.equal(getAgentTaskRuntimeV4ApprovalScope(readOnlyCapabilities), 'none');

const sideEffectCapabilities = [
  'mouse',
  'keyboard',
  'launch',
  'focus',
  'window_control',
  'close',
  'filesystem_mutation',
] as const satisfies readonly AgentTaskRuntimeV4Capability[];
for (const capability of sideEffectCapabilities) {
  assert.equal(isAgentTaskRuntimeV4SideEffectCapability(capability), true);
  assert.equal(getAgentTaskRuntimeV4ApprovalScope([capability]), 'task');
}
assert.equal(getAgentTaskRuntimeV4ApprovalScope(['install']), 'step');
assert.equal(getAgentTaskRuntimeV4ApprovalScope(['network_mutation']), 'step');

for (const capability of [...readOnlyCapabilities, ...sideEffectCapabilities, 'install', 'network_mutation'] as const) {
  assert.equal(
    canAgentTaskRuntimeV4PlannerOwnCapability(capability),
    false,
    `Planner must not own ${capability}; it should describe task intent only.`,
  );
}

assert.equal(getAgentTaskRuntimeV4NextState('initialized', 'start'), 'observing');
assert.equal(getAgentTaskRuntimeV4NextState('observing', 'observation-collected'), 'resolving_target');
assert.equal(getAgentTaskRuntimeV4NextState('resolving_target', 'target-resolved'), 'target_resolved');
assert.equal(getAgentTaskRuntimeV4NextState('resolving_target', 'target-not-resolved'), 'local_recovering');
assert.equal(getAgentTaskRuntimeV4NextState('target_resolved', 'approval-required'), 'waiting_approval');
assert.equal(getAgentTaskRuntimeV4NextState('target_resolved', 'approval-granted'), 'executing');
assert.equal(getAgentTaskRuntimeV4NextState('waiting_approval', 'approval-granted'), 'executing');
assert.equal(getAgentTaskRuntimeV4NextState('executing', 'action-dispatched'), 'collecting_evidence');
assert.equal(getAgentTaskRuntimeV4NextState('collecting_evidence', 'evidence-collected'), 'verifying_outcome');
assert.equal(getAgentTaskRuntimeV4NextState('verifying_outcome', 'outcome-verified'), 'succeeded');

assert.equal(
  isAgentTaskRuntimeV4TransitionAllowed('resolving_target', 'outcome-verified'),
  false,
  'Locate/target resolution must not mark a task succeeded.',
);
assert.equal(
  getAgentTaskRuntimeV4NextState('target_resolved', 'outcome-verified'),
  null,
  'Resolved target must not jump to terminal success or character reply.',
);
assert.equal(
  getAgentTaskRuntimeV4NextState('executing', 'outcome-verified'),
  null,
  'Executor dispatch must not mark success before evidence collection and verification.',
);
assert.equal(
  getAgentTaskRuntimeV4NextState('executing', 'action-dispatched'),
  'collecting_evidence',
  'Dispatch must move to evidence collection.',
);

const targetResolvedTransition = createAgentTaskRuntimeV4Transition({
  actor: 'target-resolver',
  from: 'resolving_target',
  kind: 'target-resolved',
  reason: 'visual target candidate resolved',
});
assert.deepEqual(targetResolvedTransition, {
  actor: 'target-resolver',
  from: 'resolving_target',
  kind: 'target-resolved',
  reason: 'visual target candidate resolved',
  to: 'target_resolved',
});

const invalidExecutorSuccess = createAgentTaskRuntimeV4Transition({
  actor: 'action-executor',
  from: 'executing',
  kind: 'outcome-verified',
});
assert.equal(invalidExecutorSuccess, null);
assert.equal(canAgentTaskRuntimeV4ActorMarkSucceeded('evidence-engine'), true);
assert.equal(canAgentTaskRuntimeV4ActorMarkSucceeded('action-executor'), false);
assert.equal(canAgentTaskRuntimeV4ActorMarkSucceeded('planner'), false);

assert.match(contractSource, /Observe, locate, verify, wait, and retry are read-only/u);
assert.match(contractSource, /Locate success resolves a target; it must not complete the task/u);
assert.match(contractSource, /Action dispatch must be followed by evidence collection and outcome verification/u);
assert.match(contractSource, /Only the evidence engine may mark a task succeeded/u);
assert.match(contractSource, /The same approved task should reuse approval/u);

console.log('agent runtime v4 contract smoke ok');
