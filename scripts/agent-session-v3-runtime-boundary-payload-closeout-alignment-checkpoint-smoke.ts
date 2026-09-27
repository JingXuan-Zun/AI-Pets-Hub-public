import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type PayloadCloseoutAlignmentFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type PayloadCloseoutAlignmentDecision =
  | 'not-applicable'
  | 'pre-contract-deferred';

type PayloadCloseoutAlignmentCoverage =
  | 'adapter-closeout'
  | 'phase-port-closeout';

interface PayloadCloseoutAlignmentRow {
  adapterDecision: PayloadCloseoutAlignmentDecision;
  coverage: readonly PayloadCloseoutAlignmentCoverage[];
  family: PayloadCloseoutAlignmentFamily;
  phasePortDecision: PayloadCloseoutAlignmentDecision | 'outside-phase-port-closeout';
  formalContractReady: false;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  remainsPreContractAuditOnly: true;
}

const payloadCloseoutAlignmentRows = [
  {
    adapterDecision: 'not-applicable',
    coverage: ['adapter-closeout'],
    family: 'success',
    formalContractReady: false,
    phasePortDecision: 'outside-phase-port-closeout',
    productionReady: false,
    reason: 'continue-with-event',
    remainsPreContractAuditOnly: true,
  },
  {
    adapterDecision: 'pre-contract-deferred',
    coverage: ['adapter-closeout', 'phase-port-closeout'],
    family: 'waiting',
    formalContractReady: false,
    phasePortDecision: 'pre-contract-deferred',
    productionReady: false,
    reason: 'waiting-for-phase-event',
    remainsPreContractAuditOnly: true,
  },
  {
    adapterDecision: 'pre-contract-deferred',
    coverage: ['adapter-closeout', 'phase-port-closeout'],
    family: 'blocked',
    formalContractReady: false,
    phasePortDecision: 'pre-contract-deferred',
    productionReady: false,
    reason: 'blocked-by-phase',
    remainsPreContractAuditOnly: true,
  },
  {
    adapterDecision: 'pre-contract-deferred',
    coverage: ['adapter-closeout', 'phase-port-closeout'],
    family: 'failure',
    formalContractReady: false,
    phasePortDecision: 'pre-contract-deferred',
    productionReady: false,
    reason: 'runtime-failed',
    remainsPreContractAuditOnly: true,
  },
] as const satisfies readonly PayloadCloseoutAlignmentRow[];

const excludedReasons = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function rowForFamily(family: PayloadCloseoutAlignmentFamily) {
  return payloadCloseoutAlignmentRows.find((row) => row.family === family);
}

const {
  adapterCloseoutSmokeSource,
  alignmentSmokeSource,
  boundarySource,
  expansionConsistencySmokeSource,
  formalGateSmokeSource,
  phasePortCloseoutSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  adapterCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-pre-contract-closeout-checkpoint-smoke.ts',
  alignmentSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-alignment-checkpoint-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  expansionConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-expansion-consistency-checkpoint-smoke.ts',
  formalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-formal-contract-gate-checkpoint-smoke.ts',
  phasePortCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  payloadCloseoutAlignmentRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Payload closeout alignment should cover every adapter-payload closeout family.',
);
assert.deepEqual(rowForFamily('success')?.coverage, ['adapter-closeout']);
assert.deepEqual(rowForFamily('success')?.adapterDecision, 'not-applicable');
assert.deepEqual(rowForFamily('success')?.phasePortDecision, 'outside-phase-port-closeout');
assert.equal(getAgentSessionV3RuntimeStopEvidenceFields('continue-with-event').length, 0);

for (const family of ['waiting', 'blocked', 'failure'] as const) {
  const row = rowForFamily(family);
  assert.ok(row, `${family} should be covered by payload closeout alignment.`);
  assert.deepEqual(row.coverage, ['adapter-closeout', 'phase-port-closeout']);
  assert.equal(row.adapterDecision, 'pre-contract-deferred');
  assert.equal(row.phasePortDecision, 'pre-contract-deferred');
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);
  assert.ok(getAgentSessionV3RuntimeStopEvidenceFields(row.reason).length > 0);
}

for (const row of payloadCloseoutAlignmentRows) {
  assert.equal(row.formalContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsPreContractAuditOnly, true);
  assert.ok(row.coverage.includes('adapter-closeout'));
}

for (const excludedReason of excludedReasons) {
  assert.equal(
    payloadCloseoutAlignmentRows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside payload closeout alignment.`,
  );
}

assert.match(adapterCloseoutSmokeSource, /Adapter-payload closeout should cover every adapter-payload family exactly once/u);
assert.match(adapterCloseoutSmokeSource, /pre-contract audit coverage only/u);
assert.match(phasePortCloseoutSmokeSource, /Phase-port payload closeout should cover waiting, blocked, and failure exactly once/u);
assert.match(phasePortCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(formalGateSmokeSource, /not sufficient to introduce a formal adapter-payload TypeScript contract/u);
assert.match(expansionConsistencySmokeSource, /no expansion row becomes formal-contract-ready or production-ready/u);

const serializedAlignment = JSON.stringify(payloadCloseoutAlignmentRows);
assert.doesNotMatch(
  serializedAlignment,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Payload closeout alignment should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedAlignment,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Payload closeout alignment should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedAlignment,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Payload closeout alignment should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedAlignment,
  /implementationQueue|orderedSteps|runtimeAuthority|productionReady":true|formalContractReady":true|experimental-adapter/u,
  'Payload closeout alignment should remain pre-contract audit coverage only.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Payload closeout alignment should not add formal payload types to the production boundary.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Payload closeout alignment must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  alignmentSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Payload closeout alignment should not call production v2 modules.',
);

assert.match(preflightAuditText, /Payload Closeout Alignment Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-payload-closeout-alignment-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /adapter-payload and phase-port payload closeouts agree/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary payload closeout alignment checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-payload-closeout-alignment-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary payload closeout alignment checkpoint smoke ok');
