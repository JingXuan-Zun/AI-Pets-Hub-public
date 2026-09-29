import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type EvidenceInterpretationToProductionGateInput =
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'p0-source-alignment-checkpoint'
  | 'package-health-rollup'
  | 'positive-gate-precondition-closeout'
  | 'production-wiring-gate-closeout-summary'
  | 'real-corpus-evidence-interpretation-readiness'
  | 'real-production-like-evidence-readiness-reconciliation'
  | 'runtime-boundary-contract';

type EvidenceInterpretationState =
  | 'no-caller-owned-intake'
  | 'p0-real-exported-corpus-missing'
  | 'p0-real-production-like-sample-missing'
  | 'manual-evidence-package-not-ready'
  | 'source-aligned-but-evidence-incomplete'
  | 'manual-evidence-package-hypothetically-accepted';

type ProductionGateBlocker =
  | 'agent-session-v2-production-owner-retained'
  | 'broad-stop-payload-contract-promotion-blocked'
  | 'controller-policy-contracts-missing'
  | 'fixed-tool-chain-prohibited'
  | 'missing-real-or-production-like-traces'
  | 'permission-routing-ownership-not-delegated'
  | 'phase-port-payload-contracts-missing'
  | 'production-adapter-contracts-missing'
  | 'runtime-action-order-not-owned-by-v3'
  | 'tool-execution-ownership-not-delegated'
  | 'v3-pilot-shadow-debug-only';

type EvidenceInterpretationGateEffect =
  | 'could-only-inform-real-trace-blocker'
  | 'does-not-clear-non-evidence-blockers'
  | 'keeps-real-trace-blocker-open';

interface EvidenceInterpretationToProductionGateRow {
  blockersStillApplicable: readonly ProductionGateBlocker[];
  currentEvidencePackageState: 'not-ready';
  evidenceEffect: EvidenceInterpretationGateEffect;
  inputs: readonly EvidenceInterpretationToProductionGateInput[];
  isCurrentObservedState: boolean;
  mappingStatus: 'non-authoritative-gate-map';
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  state: EvidenceInterpretationState;
}

interface EvidenceInterpretationToProductionGateMappingCheckpoint {
  currentManualInterpretationDecision: 'manual-evidence-interpretation-not-ready';
  gate: 'evidence-interpretation-to-production-gate-mapping';
  isProductionWiringPlan: false;
  mappingAuthority: 'non-authoritative';
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly EvidenceInterpretationToProductionGateRow[];
  summaryDecision: 'mapping-only-positive-gate-remains-closed';
}

const evidenceInterpretationToProductionGateMappingCheckpoint = {
  currentManualInterpretationDecision: 'manual-evidence-interpretation-not-ready',
  gate: 'evidence-interpretation-to-production-gate-mapping',
  isProductionWiringPlan: false,
  mappingAuthority: 'non-authoritative',
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockersStillApplicable: ['missing-real-or-production-like-traces'],
      currentEvidencePackageState: 'not-ready',
      evidenceEffect: 'keeps-real-trace-blocker-open',
      inputs: [
        'intake-readiness-gate-report',
        'p0-intake-target-status-report',
        'real-corpus-evidence-interpretation-readiness',
      ],
      isCurrentObservedState: true,
      mappingStatus: 'non-authoritative-gate-map',
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      state: 'no-caller-owned-intake',
    },
    {
      blockersStillApplicable: ['missing-real-or-production-like-traces'],
      currentEvidencePackageState: 'not-ready',
      evidenceEffect: 'keeps-real-trace-blocker-open',
      inputs: [
        'p0-intake-target-status-report',
        'p0-real-evidence-closeout-report',
        'real-production-like-evidence-readiness-reconciliation',
      ],
      isCurrentObservedState: true,
      mappingStatus: 'non-authoritative-gate-map',
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      state: 'p0-real-production-like-sample-missing',
    },
    {
      blockersStillApplicable: ['missing-real-or-production-like-traces'],
      currentEvidencePackageState: 'not-ready',
      evidenceEffect: 'keeps-real-trace-blocker-open',
      inputs: [
        'p0-intake-target-status-report',
        'p0-real-evidence-closeout-report',
        'p0-source-alignment-checkpoint',
      ],
      isCurrentObservedState: true,
      mappingStatus: 'non-authoritative-gate-map',
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      state: 'p0-real-exported-corpus-missing',
    },
    {
      blockersStillApplicable: ['missing-real-or-production-like-traces'],
      currentEvidencePackageState: 'not-ready',
      evidenceEffect: 'keeps-real-trace-blocker-open',
      inputs: [
        'p0-source-alignment-checkpoint',
        'package-health-rollup',
        'real-corpus-evidence-interpretation-readiness',
      ],
      isCurrentObservedState: true,
      mappingStatus: 'non-authoritative-gate-map',
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      state: 'source-aligned-but-evidence-incomplete',
    },
    {
      blockersStillApplicable: ['missing-real-or-production-like-traces'],
      currentEvidencePackageState: 'not-ready',
      evidenceEffect: 'keeps-real-trace-blocker-open',
      inputs: [
        'package-health-rollup',
        'real-corpus-evidence-interpretation-readiness',
        'real-production-like-evidence-readiness-reconciliation',
      ],
      isCurrentObservedState: true,
      mappingStatus: 'non-authoritative-gate-map',
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      state: 'manual-evidence-package-not-ready',
    },
    {
      blockersStillApplicable: [
        'agent-session-v2-production-owner-retained',
        'v3-pilot-shadow-debug-only',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'broad-stop-payload-contract-promotion-blocked',
        'phase-port-payload-contracts-missing',
        'permission-routing-ownership-not-delegated',
        'tool-execution-ownership-not-delegated',
        'runtime-action-order-not-owned-by-v3',
        'fixed-tool-chain-prohibited',
      ],
      currentEvidencePackageState: 'not-ready',
      evidenceEffect: 'does-not-clear-non-evidence-blockers',
      inputs: [
        'positive-gate-precondition-closeout',
        'production-wiring-gate-closeout-summary',
        'runtime-boundary-contract',
      ],
      isCurrentObservedState: false,
      mappingStatus: 'non-authoritative-gate-map',
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      state: 'manual-evidence-package-hypothetically-accepted',
    },
  ],
  summaryDecision: 'mapping-only-positive-gate-remains-closed',
} as const satisfies EvidenceInterpretationToProductionGateMappingCheckpoint;

function rowForState(state: EvidenceInterpretationState) {
  const row = evidenceInterpretationToProductionGateMappingCheckpoint.rows.find((candidate) => candidate.state === state);
  assert.ok(row, `${state} should exist in the evidence interpretation to production gate mapping checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: ProductionGateBlocker) {
  return evidenceInterpretationToProductionGateMappingCheckpoint.rows
    .filter((row) => row.blockersStillApplicable.includes(blocker));
}

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const interpretationReadinessSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-corpus-evidence-interpretation-readiness-checkpoint-smoke.ts',
);
const sourceAlignmentSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
);
const evidenceReadinessReconciliationSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-production-like-evidence-readiness-reconciliation-checkpoint-smoke.ts',
);
const positiveGateCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({ projectRoot });
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
const p0IntakeTargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
  projectRoot,
});
const p0RealEvidenceCloseout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
  projectRoot,
});
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
  projectRoot,
});

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(evidenceInterpretationToProductionGateMappingCheckpoint.mappingAuthority, 'non-authoritative');
assert.equal(evidenceInterpretationToProductionGateMappingCheckpoint.currentManualInterpretationDecision, 'manual-evidence-interpretation-not-ready');
assert.equal(evidenceInterpretationToProductionGateMappingCheckpoint.productionAuthority, false);
assert.equal(evidenceInterpretationToProductionGateMappingCheckpoint.productionReady, false);
assert.equal(evidenceInterpretationToProductionGateMappingCheckpoint.positiveGateAllowed, false);
assert.equal(evidenceInterpretationToProductionGateMappingCheckpoint.isProductionWiringPlan, false);
assert.equal(
  evidenceInterpretationToProductionGateMappingCheckpoint.summaryDecision,
  'mapping-only-positive-gate-remains-closed',
);

assert.deepEqual(
  evidenceInterpretationToProductionGateMappingCheckpoint.rows.map((row) => row.state).sort(),
  [
    'manual-evidence-package-hypothetically-accepted',
    'manual-evidence-package-not-ready',
    'no-caller-owned-intake',
    'p0-real-exported-corpus-missing',
    'p0-real-production-like-sample-missing',
    'source-aligned-but-evidence-incomplete',
  ],
);

for (const row of evidenceInterpretationToProductionGateMappingCheckpoint.rows) {
  assert.equal(row.mappingStatus, 'non-authoritative-gate-map');
  assert.equal(row.currentEvidencePackageState, 'not-ready');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockersStillApplicable.length > 0);
}

assert.equal(rowForState('no-caller-owned-intake').isCurrentObservedState, true);
assert.equal(rowForState('p0-real-production-like-sample-missing').isCurrentObservedState, true);
assert.equal(rowForState('p0-real-exported-corpus-missing').isCurrentObservedState, true);
assert.equal(rowForState('source-aligned-but-evidence-incomplete').isCurrentObservedState, true);
assert.equal(rowForState('manual-evidence-package-not-ready').isCurrentObservedState, true);
assert.equal(rowForState('manual-evidence-package-hypothetically-accepted').isCurrentObservedState, false);

assert.equal(rowForState('no-caller-owned-intake').evidenceEffect, 'keeps-real-trace-blocker-open');
assert.equal(rowForState('manual-evidence-package-hypothetically-accepted').evidenceEffect, 'does-not-clear-non-evidence-blockers');
assert.ok(rowForState('source-aligned-but-evidence-incomplete').inputs.includes('p0-source-alignment-checkpoint'));
assert.ok(rowForState('manual-evidence-package-hypothetically-accepted').inputs.includes('positive-gate-precondition-closeout'));
assert.ok(rowForState('manual-evidence-package-hypothetically-accepted').inputs.includes('production-wiring-gate-closeout-summary'));
assert.equal(
  rowForState('manual-evidence-package-hypothetically-accepted')
    .blockersStillApplicable.includes('missing-real-or-production-like-traces'),
  false,
);

assert.ok(rowsForBlocker('missing-real-or-production-like-traces').length >= 5);
assert.ok(rowsForBlocker('agent-session-v2-production-owner-retained').length === 1);
assert.ok(rowsForBlocker('v3-pilot-shadow-debug-only').length === 1);
assert.ok(rowsForBlocker('production-adapter-contracts-missing').length === 1);
assert.ok(rowsForBlocker('controller-policy-contracts-missing').length === 1);
assert.ok(rowsForBlocker('runtime-action-order-not-owned-by-v3').length === 1);
assert.ok(rowsForBlocker('fixed-tool-chain-prohibited').length === 1);

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.readyForProductionRuntime, false);
assert.equal(nextTarget.status, 'target-needed');
assert.equal(nextTarget.nextPriority, 'P0');
assert.equal(nextTarget.readyForProductionRuntime, false);
assert.deepEqual(
  nextTarget.targets
    .filter((target) => target.priority === 'P0')
    .map((target) => target.gapKind),
  [
    'real-production-like-sample',
    'real-exported-corpus',
  ],
);
assert.equal(p0IntakeTargetStatus.status, 'no-intake-dirs');
assert.equal(p0IntakeTargetStatus.readyForProductionRuntime, false);
assert.deepEqual(
  p0IntakeTargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status]),
  [
    ['real-production-like-sample', 'missing'],
    ['real-exported-corpus', 'missing'],
  ],
);
assert.equal(p0RealEvidenceCloseout.status, 'no-intake-dirs');
assert.equal(p0RealEvidenceCloseout.readyForProductionRuntime, false);
assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);

assertContains(interpretationReadinessSmokeSource, 'manual-evidence-interpretation-not-ready', 'interpretation readiness smoke');
assertContains(interpretationReadinessSmokeSource, 'source-alignment-not-evidence-complete', 'interpretation readiness smoke');
assertContains(sourceAlignmentSmokeSource, 'source-alignment-remains-non-production', 'source alignment smoke');
assertContains(sourceAlignmentSmokeSource, 'p0-source-alignment-still-blocks-production-wiring', 'source alignment smoke');
assertContains(evidenceReadinessReconciliationSmokeSource, 'missing-real-or-production-like-traces', 'evidence readiness reconciliation smoke');
assertContains(positiveGateCloseoutSmokeSource, 'positive-gate-remains-closed', 'positive gate closeout smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');

assertContains(auditText, 'Evidence Interpretation To Production Gate Mapping Checkpoint Status', 'preflight audit');
assertContains(auditText, 'mapping-only positive gate remains closed', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary evidence-interpretation-to-production-gate mapping checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(evidenceInterpretationToProductionGateMappingCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Evidence interpretation mapping checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Evidence interpretation mapping checkpoint must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Evidence interpretation mapping checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Evidence interpretation mapping checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Evidence interpretation mapping checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Evidence interpretation mapping checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Evidence interpretation mapping checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Evidence interpretation mapping checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary evidence interpretation to production gate mapping checkpoint smoke ok');
