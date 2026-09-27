import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS,
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS,
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3PilotInitialState,
  createAgentSessionV3RuntimeBoundaryContract,
  createAgentSessionV3RuntimePhasePortContext,
  getAgentSessionV3RuntimeBoundaryStopSemantic,
  getAgentSessionV3RuntimePhaseSideEffectLimit,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryPorts,
  type AgentSessionV3RuntimePhasePortResult,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  boundarySource,
  indexSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  indexSource: 'src/agent/legacy/index.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export interface AgentSessionV3RuntimeBoundaryContract/u);
assert.match(boundarySource, /export interface AgentSessionV3RuntimeBoundaryStopSemantic/u);
assert.match(boundarySource, /export interface AgentSessionV3RuntimeStopEvidenceField/u);
assert.match(boundarySource, /export type AgentSessionV3RuntimePhasePort/u);
assert.match(boundarySource, /export type AgentSessionV3RuntimeBoundaryPorts/u);
assert.match(boundarySource, /AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS/u);
assert.match(boundarySource, /AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT/u);
assert.match(boundarySource, /productionAuthority: false/u);
assert.match(boundarySource, /contract-only/u);
assert.match(boundarySource, /no required ordered tool workflow/u);
assert.match(indexSource, /export \* from '\.\.\/agentSessionV3RuntimeBoundary'/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|evaluateAgentToolAction|toolExecutor/u,
  'V3 runtime boundary contract should not call production v2 runtime, permission, or execution modules.',
);
assert.doesNotMatch(
  boundarySource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'V3 runtime boundary contract should not name concrete desktop tools.',
);
assert.doesNotMatch(
  boundarySource,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify/iu,
  'V3 runtime boundary contract should not define a fixed workflow chain.',
);

const contract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(contract.version, 1);
assert.equal(contract.mode, 'contract-only');
assert.equal(contract.authority, 'none');
assert.equal(contract.productionAuthority, false);
assert.deepEqual(contract.guardrails, AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS);
assert.deepEqual(contract.stopSemantics, AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS);
assert.deepEqual(contract.stopEvidenceContract, AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT);
assert.equal(getAgentSessionV3RuntimeBoundaryStopSemantic('event').reason, 'continue-with-event');
assert.equal(getAgentSessionV3RuntimeBoundaryStopSemantic('event').requiresControllerDecision, false);
assert.equal(getAgentSessionV3RuntimeBoundaryStopSemantic('waiting').reason, 'waiting-for-phase-event');
assert.equal(getAgentSessionV3RuntimeBoundaryStopSemantic('waiting').requiresControllerDecision, true);
assert.equal(getAgentSessionV3RuntimeBoundaryStopSemantic('blocked').reason, 'blocked-by-phase');
assert.equal(getAgentSessionV3RuntimeBoundaryStopSemantic('blocked').requiresControllerDecision, true);
assert.deepEqual(getAgentSessionV3RuntimeStopEvidenceFields('continue-with-event'), []);
assert.deepEqual(getAgentSessionV3RuntimeStopEvidenceFields('cancelled'), []);
assert.ok(getAgentSessionV3RuntimeStopEvidenceFields('blocked-by-phase').length >= 4);
assert.ok(getAgentSessionV3RuntimeStopEvidenceFields('invalid-transition').length >= 4);
assert.ok(getAgentSessionV3RuntimeStopEvidenceFields('transition-budget-exhausted').length >= 4);
assert.ok(getAgentSessionV3RuntimeStopEvidenceFields('runtime-failed').length >= 4);
assert.ok(getAgentSessionV3RuntimeStopEvidenceFields('waiting-for-phase-event').length >= 4);

for (const phase of [
  'init',
  'model_decision',
  'prepare_command',
  'needs_approval',
  'execute_transaction',
  'evaluate',
  'recover',
] as const) {
  const limit = getAgentSessionV3RuntimePhaseSideEffectLimit(phase);
  assert.equal(limit.phase, phase);
  assert.deepEqual(limit, AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS[phase]);
  assert.ok(
    limit.forbiddenAuthority.includes('define a required ordered tool workflow'),
    `${phase} should forbid fixed workflow authority.`,
  );
}

assert.deepEqual(contract.phaseLimits.model_decision.allowedScopes, ['model-call', 'trace-recording']);
assert.deepEqual(contract.phaseLimits.prepare_command.allowedScopes, [
  'command-preparation',
  'permission-route-consumption',
  'trace-recording',
]);
assert.deepEqual(contract.phaseLimits.execute_transaction.allowedScopes, [
  'transaction-execution',
  'trace-recording',
  'progress-emission',
]);
assert.deepEqual(contract.phaseLimits.recover.allowedScopes, ['recovery-planning', 'trace-recording']);

const context = createAgentSessionV3RuntimePhasePortContext({
  phase: 'model_decision',
  state: createAgentSessionV3PilotInitialState(),
  transitionCount: 0,
  transitions: [],
});
assert.equal(context.boundaryMode, 'contract-only');
assert.equal(context.phase, 'model_decision');
assert.deepEqual(context.sideEffectLimit.allowedScopes, ['model-call', 'trace-recording']);

const ports: AgentSessionV3RuntimeBoundaryPorts = {
  init: () => ({
    event: {
      reason: 'contract smoke only',
      type: 'start',
    },
    kind: 'event',
  }),
  model_decision: () => ({
    kind: 'waiting',
    reason: 'contract does not call the model by itself',
  }),
};
const initResult = ports.init?.(createAgentSessionV3RuntimePhasePortContext({
  phase: 'init',
  state: createAgentSessionV3PilotInitialState(),
  transitionCount: 0,
  transitions: [],
}));
assert.deepEqual(initResult, {
  event: {
    reason: 'contract smoke only',
    type: 'start',
  },
  kind: 'event',
} satisfies AgentSessionV3RuntimePhasePortResult);

assert.match(preflightAuditText, /`?V3RuntimeBoundary`? contract draft/u);
assert.match(preflightAuditText, /phase ports and side-effect limits/u);
assert.match(preflightAuditText, /without implementing a controller/u);
assert.match(statusText, /V3 runtime boundary contract.*Completed/u);
assert.match(statusText, /agentSessionV3RuntimeBoundary\.ts/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-contract-smoke\.ts/u);

console.log('agent session v3 runtime boundary contract smoke ok');
