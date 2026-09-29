import assert from 'node:assert/strict';
import {
  advanceAgentTaskRuntimeV4,
  createAgentTaskRuntimeV4ApprovalGrant,
  createAgentTaskRuntimeV4Context,
  createAgentTaskRuntimeV4TaskSpec,
  hasAgentTaskRuntimeV4ApprovalFor,
} from '../src/agent/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  runtimeSource,
  contractSource,
  indexSource,
} = readProjectSources({
  contractSource: 'src/agent/agentTaskRuntimeV4Contract.ts',
  indexSource: 'src/agent/index.ts',
  runtimeSource: 'src/agent/agentTaskRuntimeV4.ts',
});

assert.match(runtimeSource, /export function createAgentTaskRuntimeV4Context/u);
assert.match(runtimeSource, /export function advanceAgentTaskRuntimeV4/u);
assert.match(runtimeSource, /export function hasAgentTaskRuntimeV4ApprovalFor/u);
assert.match(runtimeSource, /Only the evidence engine may mark a V4 task succeeded/u);
assert.match(indexSource, /export \* from '\.\/agentTaskRuntimeV4';/u);

assert.doesNotMatch(
  runtimeSource,
  /runAgentSessionV2|buildAgentPermissionRoute|toolExecutor|execute_desktop_input|execute_desktop_sequence|locate_screen_elements|SendInput|SetCursorPos/u,
  'V4 skeleton must not call production session, permission, concrete tools, or input backend.',
);
assert.match(contractSource, /Action dispatch must be followed by evidence collection and outcome verification/u);

const task = createAgentTaskRuntimeV4TaskSpec({
  constraints: ['login if required', 'verify game process or launcher state'],
  goal: 'Launch League of Legends from WeGame',
  id: 'task-v4-smoke-launch-lol',
  intent: 'launch-game',
  target: 'WeGame',
});
let context = createAgentTaskRuntimeV4Context({ task });
assert.equal(context.currentState, 'initialized');
assert.equal(context.transitionCount, 0);
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['observe', 'locate', 'verify', 'wait', 'retry'],
  context,
}), true);
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['mouse'],
  context,
  nowMs: 1000,
}), false);

let result = advanceAgentTaskRuntimeV4(context, {
  actor: 'task-runtime',
  kind: 'start',
  reason: 'task accepted by runtime',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'observing');
context = result.context;

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'task-runtime',
  evidence: {
    kind: 'window',
    source: 'observe',
    summary: 'WeGame window visible',
    timestampMs: 1000,
    verified: true,
  },
  kind: 'observation-collected',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'resolving_target');
assert.equal(result.context.evidence.length, 1);
context = result.context;

const invalidLocateSuccess = advanceAgentTaskRuntimeV4(context, {
  actor: 'target-resolver',
  kind: 'outcome-verified',
});
assert.equal(invalidLocateSuccess.accepted, false);
assert.match(invalidLocateSuccess.reason, /not valid/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'target-resolver',
  evidence: {
    kind: 'visual',
    source: 'locate',
    summary: 'Login button target resolved at screen coordinate',
    timestampMs: 1100,
    verified: true,
  },
  kind: 'target-resolved',
  targetSummary: 'login button',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'target_resolved');
assert.equal(result.context.lastTargetSummary, 'login button');
context = result.context;

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'approval-manager',
  kind: 'approval-required',
  reason: 'mouse click side effect requires task approval',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'waiting_approval');
context = result.context;

const wrongTaskGrant = createAgentTaskRuntimeV4ApprovalGrant({
  approvedAtMs: 1200,
  capabilities: ['mouse'],
  taskId: 'other-task',
});
const wrongTaskResult = advanceAgentTaskRuntimeV4(context, {
  actor: 'approval-manager',
  approvalGrant: wrongTaskGrant,
  capabilities: ['mouse'],
  kind: 'approval-granted',
  nowMs: 1300,
});
assert.equal(wrongTaskResult.accepted, false);
assert.match(wrongTaskResult.reason, /taskId/u);

const grant = createAgentTaskRuntimeV4ApprovalGrant({
  approvedAtMs: 1200,
  capabilities: ['mouse', 'keyboard', 'launch'],
  expiresAtMs: 5000,
  taskId: task.id,
});
assert.equal(grant.scope, 'task');
result = advanceAgentTaskRuntimeV4(context, {
  actor: 'approval-manager',
  approvalGrant: grant,
  capabilities: ['mouse'],
  kind: 'approval-granted',
  nowMs: 1300,
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'executing');
assert.equal(result.context.approvalGrants.length, 1);
assert.equal(hasAgentTaskRuntimeV4ApprovalFor({
  capabilities: ['mouse'],
  context: result.context,
  nowMs: 1300,
}), true);
context = result.context;

const invalidExecutorSuccess = advanceAgentTaskRuntimeV4(context, {
  actor: 'action-executor',
  kind: 'outcome-verified',
});
assert.equal(invalidExecutorSuccess.accepted, false);
assert.match(invalidExecutorSuccess.reason, /not valid/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'action-executor',
  capabilities: ['mouse'],
  evidence: {
    kind: 'input',
    source: 'execute',
    summary: 'Mouse click dispatched to login button',
    timestampMs: 1400,
    verified: null,
  },
  kind: 'action-dispatched',
  nowMs: 1400,
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'collecting_evidence');
context = result.context;

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'evidence-engine',
  evidence: {
    kind: 'visual',
    source: 'post-action',
    summary: 'Login state changed',
    timestampMs: 1800,
    verified: true,
  },
  kind: 'evidence-collected',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'verifying_outcome');
context = result.context;

const blockedSuccess = advanceAgentTaskRuntimeV4(context, {
  actor: 'action-executor',
  kind: 'outcome-verified',
});
assert.equal(blockedSuccess.accepted, false);
assert.match(blockedSuccess.reason, /Only the evidence engine/u);

result = advanceAgentTaskRuntimeV4(context, {
  actor: 'evidence-engine',
  kind: 'outcome-verified',
  reason: 'launcher reached logged-in or game launchable state',
});
assert.equal(result.accepted, true);
assert.equal(result.context.currentState, 'succeeded');
assert.equal(result.context.transitionCount, 8);

const recoveryTask = createAgentTaskRuntimeV4TaskSpec({
  goal: 'Locate login button',
  id: 'task-v4-smoke-recovery',
  intent: 'resolve-target',
  target: 'WeGame',
});
let recoveryContext = createAgentTaskRuntimeV4Context({ task: recoveryTask });
for (const event of [
  { actor: 'task-runtime' as const, kind: 'start' as const },
  { actor: 'task-runtime' as const, kind: 'observation-collected' as const },
  {
    actor: 'target-resolver' as const,
    blocker: 'target not resolved',
    kind: 'target-not-resolved' as const,
  },
]) {
  const recoveryResult = advanceAgentTaskRuntimeV4(recoveryContext, event);
  assert.equal(recoveryResult.accepted, true);
  recoveryContext = recoveryResult.context;
}
assert.equal(recoveryContext.currentState, 'local_recovering');
assert.equal(recoveryContext.localRecoveryCount, 1);
assert.equal(recoveryContext.lastBlocker, 'target not resolved');

console.log('agent runtime v4 skeleton smoke ok');
