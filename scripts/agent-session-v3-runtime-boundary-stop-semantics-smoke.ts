import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS,
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS,
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeBoundaryStopSemantic,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimePhasePortResultKind,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  boundarySource,
  contractSmokeSource,
  compatibilitySmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  contractSmokeSource: 'scripts/agent-session-v3-runtime-boundary-contract-smoke.ts',
  compatibilitySmokeSource: 'scripts/agent-session-v3-runtime-boundary-harness-compatibility-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export type AgentSessionV3RuntimeBoundaryStopReason/u);
assert.match(boundarySource, /export interface AgentSessionV3RuntimeBoundaryStopSemantic/u);
assert.match(boundarySource, /AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS/u);
assert.match(boundarySource, /getAgentSessionV3RuntimeBoundaryStopSemantic/u);
assert.match(boundarySource, /waiting\/blocked results require explicit controller stop semantics before production/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|evaluateAgentSessionV2PostActionTerminal|toolExecutor/u,
  'Stop semantics contract should not call production v2 runtime, permission, evaluation, or execution modules.',
);
assert.doesNotMatch(
  boundarySource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'Stop semantics contract should not name concrete desktop tools.',
);
assert.doesNotMatch(
  boundarySource,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify/iu,
  'Stop semantics contract should not define a fixed workflow chain.',
);

const expectedStopReasons = [
  'blocked-by-phase',
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'runtime-failed',
  'transition-budget-exhausted',
  'waiting-for-phase-event',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

assert.deepEqual([...expectedStopReasons].sort(), [
  'blocked-by-phase',
  'cancelled',
  'continue-with-event',
  'invalid-transition',
  'runtime-failed',
  'transition-budget-exhausted',
  'waiting-for-phase-event',
].sort());

const expectedPortKinds = ['blocked', 'event', 'waiting'] as const satisfies readonly AgentSessionV3RuntimePhasePortResultKind[];
assert.deepEqual(Object.keys(AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS).sort(), [...expectedPortKinds].sort());

assert.deepEqual(getAgentSessionV3RuntimeBoundaryStopSemantic('event'), {
  isTerminal: false,
  portResultKind: 'event',
  reason: 'continue-with-event',
  requiresControllerDecision: false,
  summary: 'The phase adapter produced a pilot event that may be applied to the state machine.',
});
assert.deepEqual(getAgentSessionV3RuntimeBoundaryStopSemantic('waiting'), {
  isTerminal: false,
  portResultKind: 'waiting',
  reason: 'waiting-for-phase-event',
  requiresControllerDecision: true,
  summary: 'The phase adapter needs more input or time; a future controller must decide whether to wait, poll, or pause.',
});
assert.deepEqual(getAgentSessionV3RuntimeBoundaryStopSemantic('blocked'), {
  isTerminal: false,
  portResultKind: 'blocked',
  reason: 'blocked-by-phase',
  requiresControllerDecision: true,
  summary: 'The phase adapter could not produce a safe event; a future controller must decide pause, fail, or recover.',
});

const contract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(contract.productionAuthority, false);
assert.equal(contract.mode, 'contract-only');
assert.deepEqual(contract.stopSemantics, AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS);
assert.ok(
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS.includes(
    'waiting/blocked results require explicit controller stop semantics before production',
  ),
);

assert.match(contractSmokeSource, /stopSemantics/u);
assert.match(contractSmokeSource, /getAgentSessionV3RuntimeBoundaryStopSemantic/u);
assert.match(compatibilitySmokeSource, /waiting result has no production stop-channel yet/u);
assert.match(compatibilitySmokeSource, /blocked result needs explicit future stop semantics/u);

assert.match(preflightAuditText, /Stop Semantics Contract Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-stop-semantics-smoke\.ts/u);
assert.match(preflightAuditText, /continue-with-event/u);
assert.match(preflightAuditText, /waiting-for-phase-event/u);
assert.match(preflightAuditText, /blocked-by-phase/u);
assert.match(preflightAuditText, /not a controller/u);
assert.match(statusText, /V3 runtime boundary stop-semantics contract.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-stop-semantics-smoke\.ts/u);

console.log('agent session v3 runtime boundary stop semantics smoke ok');
