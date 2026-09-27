import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS,
  type AgentSessionV2Status,
  type AgentSessionV3PilotRunnerStatus,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type StopReasonAlignmentStatus =
  | 'aligned'
  | 'internal-continuation'
  | 'missing-production-mapping'
  | 'partial';

interface StopReasonAlignmentRow {
  notes: string;
  pilotRunnerStatuses: AgentSessionV3PilotRunnerStatus[];
  productionMappingRequired: boolean;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  status: StopReasonAlignmentStatus;
  v2Statuses: AgentSessionV2Status[];
}

const stopReasonAlignmentRows = [
  {
    notes: 'A phase-port event continues through the state machine; it is not a runner stop or v2 final status.',
    pilotRunnerStatuses: [],
    productionMappingRequired: false,
    reason: 'continue-with-event',
    status: 'internal-continuation',
    v2Statuses: [],
  },
  {
    notes: 'Pilot runner has waiting-for-event; v2 has needs-approval for one known wait shape, but generic waiting still needs controller policy.',
    pilotRunnerStatuses: ['waiting-for-event'],
    productionMappingRequired: true,
    reason: 'waiting-for-phase-event',
    status: 'partial',
    v2Statuses: ['needs-approval'],
  },
  {
    notes: 'Blocked is distinct from waiting in the boundary contract but has no distinct pilot runner or v2 final status yet.',
    pilotRunnerStatuses: [],
    productionMappingRequired: true,
    reason: 'blocked-by-phase',
    status: 'missing-production-mapping',
    v2Statuses: [],
  },
  {
    notes: 'Pilot runner can report invalid-transition; v2 has no strict equivalent because AgentSessionV2 is still the production orchestrator.',
    pilotRunnerStatuses: ['invalid-transition'],
    productionMappingRequired: true,
    reason: 'invalid-transition',
    status: 'partial',
    v2Statuses: [],
  },
  {
    notes: 'Pilot transition-limit resembles v2 max-steps or budget-exceeded, but existing shadow agreement intentionally marks those as no strict mapping.',
    pilotRunnerStatuses: ['transition-limit'],
    productionMappingRequired: true,
    reason: 'transition-budget-exhausted',
    status: 'partial',
    v2Statuses: ['budget-exceeded', 'max-steps'],
  },
  {
    notes: 'Pilot terminal/cancelled and v2 cancelled already have a strict terminal-state agreement path.',
    pilotRunnerStatuses: ['terminal'],
    productionMappingRequired: false,
    reason: 'cancelled',
    status: 'aligned',
    v2Statuses: ['cancelled'],
  },
  {
    notes: 'Pilot terminal/failed aligns with v2 failed, while driver-failed still needs explicit production failure mapping.',
    pilotRunnerStatuses: ['driver-failed', 'terminal'],
    productionMappingRequired: true,
    reason: 'runtime-failed',
    status: 'partial',
    v2Statuses: ['failed'],
  },
] as const satisfies readonly StopReasonAlignmentRow[];

const {
  boundarySource,
  runnerSource,
  sessionSource,
  agreementSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  runnerSource: 'src/agent/agentSessionV3PilotRunner.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  agreementSource: 'src/agent/agentSessionV3PilotShadowAgreement.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

assert.match(boundarySource, /export type AgentSessionV3RuntimeBoundaryStopReason/u);
assert.match(runnerSource, /export type AgentSessionV3PilotRunnerStatus/u);
assert.match(sessionSource, /export type AgentSessionV2Status/u);
assert.match(agreementSource, /no-strict-terminal-mapping/u);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Boundary stop-reason alignment should not add production v2 runtime, permission, or execution calls.',
);
assert.doesNotMatch(
  boundarySource,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action/u,
  'Boundary stop-reason alignment should not add concrete desktop tools.',
);
assert.doesNotMatch(
  preflightAuditText,
  /readyForProductionRuntime=true|production runtime readiness:\s*`?yes`?/iu,
  'Preflight audit should not claim production runtime readiness.',
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
assert.deepEqual(
  stopReasonAlignmentRows.map((row) => row.reason).sort(),
  [...expectedStopReasons].sort(),
);
assert.deepEqual(
  Object.values(AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS)
    .map((semantic) => semantic.reason)
    .sort(),
  ['blocked-by-phase', 'continue-with-event', 'waiting-for-phase-event'].sort(),
  'Port-result stop semantics should remain narrower than the full future stop-reason set.',
);

const expectedPilotStatuses = [
  'driver-failed',
  'invalid-transition',
  'terminal',
  'transition-limit',
  'waiting-for-event',
] as const satisfies readonly AgentSessionV3PilotRunnerStatus[];
for (const status of expectedPilotStatuses) {
  assert.match(runnerSource, new RegExp(`'${status}'`, 'u'));
}

const expectedV2Statuses = [
  'budget-exceeded',
  'cancelled',
  'completed',
  'failed',
  'max-steps',
  'needs-approval',
  'needs-user',
] as const satisfies readonly AgentSessionV2Status[];
for (const status of expectedV2Statuses) {
  assert.match(sessionSource, new RegExp(`'${status}'`, 'u'));
}

const rowByReason = new Map(stopReasonAlignmentRows.map((row) => [row.reason, row]));
assert.equal(rowByReason.get('continue-with-event')?.status, 'internal-continuation');
assert.equal(rowByReason.get('continue-with-event')?.productionMappingRequired, false);
assert.deepEqual(rowByReason.get('waiting-for-phase-event')?.pilotRunnerStatuses, ['waiting-for-event']);
assert.deepEqual(rowByReason.get('waiting-for-phase-event')?.v2Statuses, ['needs-approval']);
assert.equal(rowByReason.get('blocked-by-phase')?.status, 'missing-production-mapping');
assert.deepEqual(rowByReason.get('transition-budget-exhausted')?.v2Statuses, ['budget-exceeded', 'max-steps']);
assert.equal(rowByReason.get('transition-budget-exhausted')?.productionMappingRequired, true);
assert.deepEqual(rowByReason.get('cancelled')?.v2Statuses, ['cancelled']);
assert.equal(rowByReason.get('cancelled')?.productionMappingRequired, false);
assert.deepEqual(rowByReason.get('runtime-failed')?.pilotRunnerStatuses, ['driver-failed', 'terminal']);

assert.match(agreementSource, /case 'budget-exceeded':[\s\S]*case 'max-steps':[\s\S]*return \['no-strict-terminal-mapping'\]/u);
assert.match(agreementSource, /case 'cancelled':[\s\S]*return \['terminal:cancelled'\]/u);
assert.match(agreementSource, /case 'failed':[\s\S]*return \['terminal:failed'\]/u);
assert.match(agreementSource, /case 'needs-approval':[\s\S]*return \['waiting:needs_approval', 'terminal:needs-user'\]/u);

assert.match(preflightAuditText, /Stop Reason Alignment Audit Status/u);
assert.match(preflightAuditText, /continue-with-event/u);
assert.match(preflightAuditText, /transition-budget-exhausted/u);
assert.match(preflightAuditText, /budget-exceeded/u);
assert.match(preflightAuditText, /max-steps/u);
assert.match(preflightAuditText, /no strict production mapping/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary stop-reason alignment audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-stop-reason-alignment-smoke\.ts/u);

console.log('agent session v3 runtime boundary stop reason alignment smoke ok');
