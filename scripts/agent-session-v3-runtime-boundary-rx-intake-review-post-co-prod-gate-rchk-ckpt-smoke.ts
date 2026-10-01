import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckInput =
  | 'caller-owned-post-handoff-closeout-summary'
  | 'caller-owned-post-handoff-consistency'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'post-closeout-production-gate-recheck'
  | 'production-authority-drift-final-guard'
  | 'production-wiring-gate-closeout-summary'
  | 'real-corpus-evidence-interpretation-readiness'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract';

type CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckSignal =
  | 'caller-owned-closeout-keeps-positive-gate-closed'
  | 'evidence-mapping-still-negative'
  | 'non-evidence-blockers-still-remain'
  | 'p0-real-exported-corpus-still-missing'
  | 'manual-interpretation-still-not-ready'
  | 'runtime-boundary-still-non-authoritative'
  | 'no-production-wiring-plan'
  | 'fixed-tool-chain-prohibition-preserved';

type CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckGuard =
  | 'post-closeout-gate-recheck-only'
  | 'explicit-dir-only'
  | 'manual-review-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

type CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckBlocker =
  | 'agent-session-v2-production-owner-retained'
  | 'controller-policy-contracts-missing'
  | 'manual-interpretation-not-ready'
  | 'missing-real-or-production-like-traces'
  | 'no-explicit-real-exported-intake'
  | 'non-evidence-blockers-remain'
  | 'package-health-missing-real-evidence'
  | 'p0-real-exported-corpus-missing'
  | 'production-adapter-contracts-missing'
  | 'production-gate-closed'
  | 'runtime-action-order-not-owned-by-v3';

interface CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckRow {
  blockersNow: readonly CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckBlocker[];
  gateStatus: 'closed-after-caller-owned-recheck';
  guards: readonly CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckGuard[];
  inputs: readonly CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckSignal;
}

interface CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-closeout-production-gate-recheck';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckRow[];
  summaryDecision: 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing';
}

const sharedInputs = [
  'caller-owned-post-handoff-closeout-summary',
  'caller-owned-post-handoff-consistency',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'post-closeout-production-gate-recheck',
  'production-wiring-gate-closeout-summary',
  'production-authority-drift-final-guard',
  'real-corpus-evidence-interpretation-readiness',
  'package-health-rollup',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckInput[];

const callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-closeout-production-gate-recheck',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockersNow: [
        'production-gate-closed',
        'missing-real-or-production-like-traces',
        'no-explicit-real-exported-intake',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'explicit-dir-only',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'caller-owned-closeout-keeps-positive-gate-closed',
    },
    {
      blockersNow: [
        'missing-real-or-production-like-traces',
        'p0-real-exported-corpus-missing',
        'package-health-missing-real-evidence',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'manual-review-only',
        'no-required-report-order',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'evidence-mapping-still-negative',
    },
    {
      blockersNow: [
        'non-evidence-blockers-remain',
        'agent-session-v2-production-owner-retained',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'runtime-action-order-not-owned-by-v3',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'no-runtime-authority',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'non-evidence-blockers-still-remain',
    },
    {
      blockersNow: [
        'p0-real-exported-corpus-missing',
        'no-explicit-real-exported-intake',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'explicit-dir-only',
        'no-sample-collection',
        'no-auto-fill',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-real-exported-corpus-still-missing',
    },
    {
      blockersNow: [
        'manual-interpretation-not-ready',
        'package-health-missing-real-evidence',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'manual-review-only',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-interpretation-still-not-ready',
    },
    {
      blockersNow: [
        'agent-session-v2-production-owner-retained',
        'production-gate-closed',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'no-runtime-authority',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'runtime-boundary-still-non-authoritative',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'non-evidence-blockers-remain',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'no-runtime-action-order',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'no-production-wiring-plan',
    },
    {
      blockersNow: [
        'runtime-action-order-not-owned-by-v3',
        'non-evidence-blockers-remain',
      ],
      gateStatus: 'closed-after-caller-owned-recheck',
      guards: [
        'post-closeout-gate-recheck-only',
        'no-required-report-order',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'fixed-tool-chain-prohibition-preserved',
    },
  ],
  summaryDecision: 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing',
} as const satisfies CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckSignal) {
  const row = callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned real-exported post-closeout gate recheck checkpoint.`);
  return row;
}

function rowsForGuard(guard: CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckGuard) {
  return callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.rows
    .filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: CallerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckBlocker) {
  return callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.rows
    .filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const postHandoffCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-handoff-co-sum-ckpt-smoke.ts',
);
const postHandoffConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-handoff-consistency-checkpoint-smoke.ts',
);
const mappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const nonEvidenceInventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const genericPostCloseoutRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);
const gateCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const authorityDriftSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.productionAuthority, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.productionReady, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.summaryDecision,
  'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing',
);

assert.deepEqual(
  callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'caller-owned-closeout-keeps-positive-gate-closed',
    'evidence-mapping-still-negative',
    'fixed-tool-chain-prohibition-preserved',
    'manual-interpretation-still-not-ready',
    'no-production-wiring-plan',
    'non-evidence-blockers-still-remain',
    'p0-real-exported-corpus-still-missing',
    'runtime-boundary-still-non-authoritative',
  ],
);

for (const row of callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.rows) {
  assert.equal(row.gateStatus, 'closed-after-caller-owned-recheck');
  assert.equal(row.interpretationReadyNow, false);
  assert.equal(row.manualInterpretationOnly, true);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.blockersNow.length > 0);
  assert.ok(row.guards.length > 0);
}

assert.equal(
  rowsForGuard('post-closeout-gate-recheck-only').length,
  callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint.rows.length,
);
assert.ok(rowsForGuard('explicit-dir-only').length >= 2);
assert.ok(rowsForGuard('manual-review-only').length >= 2);
assert.ok(rowsForGuard('no-sample-collection').length >= 1);
assert.ok(rowsForGuard('no-auto-fill').length >= 1);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-required-report-order').length >= 2);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 3);
assert.ok(rowsForGuard('no-production-readiness').length >= 4);
assert.ok(rowsForGuard('no-runtime-authority').length >= 3);

assert.ok(rowsForBlocker('production-gate-closed').length >= 3);
assert.ok(rowsForBlocker('missing-real-or-production-like-traces').length >= 2);
assert.ok(rowsForBlocker('p0-real-exported-corpus-missing').length >= 2);
assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 2);
assert.ok(rowsForBlocker('package-health-missing-real-evidence').length >= 2);
assert.ok(rowsForBlocker('manual-interpretation-not-ready').length >= 1);
assert.ok(rowsForBlocker('non-evidence-blockers-remain').length >= 3);
assert.ok(rowsForBlocker('agent-session-v2-production-owner-retained').length >= 2);
assert.ok(rowsForBlocker('production-adapter-contracts-missing').length >= 1);
assert.ok(rowsForBlocker('controller-policy-contracts-missing').length >= 1);
assert.ok(rowsForBlocker('runtime-action-order-not-owned-by-v3').length >= 2);

assert.equal(rowForSignal('caller-owned-closeout-keeps-positive-gate-closed').positiveGateAllowed, false);
assert.ok(rowForSignal('evidence-mapping-still-negative').blockersNow.includes('missing-real-or-production-like-traces'));
assert.ok(rowForSignal('non-evidence-blockers-still-remain').blockersNow.includes('non-evidence-blockers-remain'));
assert.ok(rowForSignal('p0-real-exported-corpus-still-missing').blockersNow.includes('p0-real-exported-corpus-missing'));
assert.ok(rowForSignal('manual-interpretation-still-not-ready').blockersNow.includes('manual-interpretation-not-ready'));
assert.equal(rowForSignal('runtime-boundary-still-non-authoritative').productionAuthority, false);
assert.equal(rowForSignal('no-production-wiring-plan').isProductionWiringPlan, false);
assert.equal(rowForSignal('fixed-tool-chain-prohibition-preserved').isExecutionOrder, false);

assertContains(
  postHandoffCloseoutSmokeSource,
  'real-exported-review-readiness-post-handoff-closed-evidence-still-missing',
  'caller-owned post-handoff closeout summary',
);
assertContains(
  postHandoffCloseoutSmokeSource,
  'production-gate-still-closed',
  'caller-owned post-handoff closeout summary',
);
assertContains(
  postHandoffCloseoutSmokeSource,
  'post-handoff-closeout-remains-non-production',
  'caller-owned post-handoff closeout summary',
);
assertContains(
  postHandoffConsistencySmokeSource,
  'post-handoff-aligns-with-production-gate-mapping',
  'caller-owned post-handoff consistency',
);
assertContains(mappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence interpretation mapping smoke');
assertContains(mappingSmokeSource, 'does-not-clear-non-evidence-blockers', 'evidence interpretation mapping smoke');
assertContains(mappingSmokeSource, 'manual-evidence-package-hypothetically-accepted', 'evidence interpretation mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');
assertContains(nonEvidenceInventorySmokeSource, 'agent-session-v2-production-owner-retained', 'non-evidence inventory smoke');
assertContains(nonEvidenceInventorySmokeSource, 'production-adapter-contracts-missing', 'non-evidence inventory smoke');
assertContains(nonEvidenceInventorySmokeSource, 'controller-policy-contracts-missing', 'non-evidence inventory smoke');
assertContains(nonEvidenceInventorySmokeSource, 'runtime-action-order-not-owned-by-v3', 'non-evidence inventory smoke');
assertContains(genericPostCloseoutRecheckSmokeSource, 'post-closeout-positive-gate-remains-closed', 'generic post-closeout gate recheck smoke');
assertContains(genericPostCloseoutRecheckSmokeSource, 'fixed-tool-chain-prohibition-preserved', 'generic post-closeout gate recheck smoke');
assertContains(gateCloseoutSummarySmokeSource, 'production-wiring-deferred', 'gate closeout summary smoke');
assertContains(authorityDriftSmokeSource, 'no-production-authority-drift-detected', 'authority drift smoke');

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.readyForProductionRuntime, false);

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.deepEqual(p0TargetStatus.p0TargetGapKinds, [
  'real-production-like-sample',
  'real-exported-corpus',
]);
assert.deepEqual(
  p0TargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status, signal.missingReason]),
  [
    ['real-production-like-sample', 'missing', 'no explicit intake directories supplied'],
    ['real-exported-corpus', 'missing', 'no explicit intake directories supplied'],
  ],
);

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Closeout Production Gate Recheck Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-closeout production gate recheck checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-review-post-co-prod-gate-rchk-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(callerOwnedRealExportedReviewReadinessPostCloseoutGateRecheckCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReadyNow":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned post-closeout gate recheck must not grant interpretation readiness, production readiness, or authority now.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Caller-owned post-closeout gate recheck must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Caller-owned post-closeout gate recheck should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned post-closeout gate recheck should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned post-closeout gate recheck should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Caller-owned post-closeout gate recheck should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned post-closeout gate recheck must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned post-closeout gate recheck must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-closeout production gate recheck checkpoint smoke ok');
