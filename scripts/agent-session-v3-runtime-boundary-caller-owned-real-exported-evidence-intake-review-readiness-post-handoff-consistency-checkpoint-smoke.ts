import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyInput =
  | 'caller-owned-review-readiness-closeout-summary'
  | 'caller-owned-review-readiness-final-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'intake-readiness-gate-report'
  | 'p0-intake-handoff-consistency'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'real-corpus-evidence-interpretation-readiness'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract';

type CallerOwnedRealExportedReviewReadinessPostHandoffConsistencySignal =
  | 'post-handoff-aligns-with-review-closeout'
  | 'post-handoff-aligns-with-p0-intake'
  | 'post-handoff-aligns-with-interpretation-readiness'
  | 'post-handoff-aligns-with-production-gate-mapping'
  | 'post-handoff-keeps-real-exported-corpus-missing'
  | 'post-handoff-remains-non-production';

type CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyGuard =
  | 'post-handoff-consistency-only'
  | 'explicit-dir-only'
  | 'manual-review-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

type CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyBlocker =
  | 'manual-interpretation-not-ready'
  | 'no-explicit-real-exported-intake'
  | 'no-positive-sample-accepted'
  | 'package-health-missing-real-evidence'
  | 'p0-real-exported-corpus-missing'
  | 'production-gate-closed';

interface CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyRow {
  blockersNow: readonly CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyBlocker[];
  consistencyStatus: 'consistent-and-currently-blocked';
  guards: readonly CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyGuard[];
  inputs: readonly CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedRealExportedReviewReadinessPostHandoffConsistencySignal;
}

interface CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-handoff-consistency';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyRow[];
  summaryDecision: 'real-exported-review-readiness-post-handoff-consistent-evidence-still-missing';
}

const sharedInputs = [
  'caller-owned-review-readiness-final-handoff',
  'caller-owned-review-readiness-closeout-summary',
  'p0-intake-handoff-consistency',
  'real-corpus-evidence-interpretation-readiness',
  'evidence-interpretation-to-production-gate-mapping',
  'package-health-rollup',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyInput[];

const callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-handoff-consistency',
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
        'no-explicit-real-exported-intake',
        'manual-interpretation-not-ready',
      ],
      consistencyStatus: 'consistent-and-currently-blocked',
      guards: [
        'post-handoff-consistency-only',
        'explicit-dir-only',
        'manual-review-only',
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
      signal: 'post-handoff-aligns-with-review-closeout',
    },
    {
      blockersNow: [
        'p0-real-exported-corpus-missing',
        'no-explicit-real-exported-intake',
      ],
      consistencyStatus: 'consistent-and-currently-blocked',
      guards: [
        'post-handoff-consistency-only',
        'explicit-dir-only',
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
      signal: 'post-handoff-aligns-with-p0-intake',
    },
    {
      blockersNow: [
        'manual-interpretation-not-ready',
        'package-health-missing-real-evidence',
      ],
      consistencyStatus: 'consistent-and-currently-blocked',
      guards: [
        'post-handoff-consistency-only',
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
      signal: 'post-handoff-aligns-with-interpretation-readiness',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'package-health-missing-real-evidence',
      ],
      consistencyStatus: 'consistent-and-currently-blocked',
      guards: [
        'post-handoff-consistency-only',
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
      signal: 'post-handoff-aligns-with-production-gate-mapping',
    },
    {
      blockersNow: [
        'p0-real-exported-corpus-missing',
        'no-positive-sample-accepted',
        'no-explicit-real-exported-intake',
      ],
      consistencyStatus: 'consistent-and-currently-blocked',
      guards: [
        'post-handoff-consistency-only',
        'explicit-dir-only',
        'no-sample-collection',
        'no-auto-fill',
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
      signal: 'post-handoff-keeps-real-exported-corpus-missing',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'manual-interpretation-not-ready',
      ],
      consistencyStatus: 'consistent-and-currently-blocked',
      guards: [
        'post-handoff-consistency-only',
        'no-required-report-order',
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
      signal: 'post-handoff-remains-non-production',
    },
  ],
  summaryDecision: 'real-exported-review-readiness-post-handoff-consistent-evidence-still-missing',
} as const satisfies CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedRealExportedReviewReadinessPostHandoffConsistencySignal) {
  const row = callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned real-exported review readiness post-handoff consistency checkpoint.`);
  return row;
}

function rowsForGuard(guard: CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyGuard) {
  return callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.rows
    .filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: CallerOwnedRealExportedReviewReadinessPostHandoffConsistencyBlocker) {
  return callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.rows
    .filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const finalHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-final-handoff-checkpoint-smoke.ts',
);
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-closeout-summary-checkpoint-smoke.ts',
);
const p0HandoffConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-handoff-consistency-checkpoint-smoke.ts',
);
const interpretationReadinessSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-corpus-evidence-interpretation-readiness-checkpoint-smoke.ts',
);
const productionGateMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
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

assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.productionAuthority, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.productionReady, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.summaryDecision,
  'real-exported-review-readiness-post-handoff-consistent-evidence-still-missing',
);

assert.deepEqual(
  callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'post-handoff-aligns-with-interpretation-readiness',
    'post-handoff-aligns-with-p0-intake',
    'post-handoff-aligns-with-production-gate-mapping',
    'post-handoff-aligns-with-review-closeout',
    'post-handoff-keeps-real-exported-corpus-missing',
    'post-handoff-remains-non-production',
  ],
);

for (const row of callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'consistent-and-currently-blocked');
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
  rowsForGuard('post-handoff-consistency-only').length,
  callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint.rows.length,
);
assert.ok(rowsForGuard('explicit-dir-only').length >= 3);
assert.ok(rowsForGuard('manual-review-only').length >= 2);
assert.ok(rowsForGuard('no-sample-collection').length >= 1);
assert.ok(rowsForGuard('no-auto-fill').length >= 1);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-required-report-order').length >= 2);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 1);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 2);

assert.ok(rowsForBlocker('p0-real-exported-corpus-missing').length >= 2);
assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 3);
assert.ok(rowsForBlocker('manual-interpretation-not-ready').length >= 3);
assert.ok(rowsForBlocker('package-health-missing-real-evidence').length >= 2);
assert.ok(rowsForBlocker('no-positive-sample-accepted').length >= 1);
assert.ok(rowsForBlocker('production-gate-closed').length >= 2);

assert.ok(rowForSignal('post-handoff-aligns-with-review-closeout').inputs.includes('caller-owned-review-readiness-closeout-summary'));
assert.ok(rowForSignal('post-handoff-aligns-with-p0-intake').inputs.includes('p0-intake-handoff-consistency'));
assert.ok(rowForSignal('post-handoff-aligns-with-interpretation-readiness').inputs.includes('real-corpus-evidence-interpretation-readiness'));
assert.ok(rowForSignal('post-handoff-aligns-with-production-gate-mapping').inputs.includes('evidence-interpretation-to-production-gate-mapping'));
assert.ok(rowForSignal('post-handoff-keeps-real-exported-corpus-missing').blockersNow.includes('p0-real-exported-corpus-missing'));
assert.equal(rowForSignal('post-handoff-remains-non-production').positiveGateAllowed, false);

assertContains(
  finalHandoffSmokeSource,
  'real-exported-review-readiness-handed-off-evidence-still-missing',
  'caller-owned review readiness final handoff',
);
assertContains(
  finalHandoffSmokeSource,
  'closed-review-readiness-chain-handed-to-p0-intake',
  'caller-owned review readiness final handoff',
);
assertContains(
  finalHandoffSmokeSource,
  'closed-review-readiness-chain-handed-to-interpretation-readiness',
  'caller-owned review readiness final handoff',
);
assertContains(
  finalHandoffSmokeSource,
  'p0-real-exported-corpus-still-missing',
  'caller-owned review readiness final handoff',
);
assertContains(
  finalHandoffSmokeSource,
  'manual-interpretation-still-not-ready',
  'caller-owned review readiness final handoff',
);
assertContains(
  finalHandoffSmokeSource,
  'production-gate-mapping-still-negative',
  'caller-owned review readiness final handoff',
);
assertContains(
  finalHandoffSmokeSource,
  'final-handoff-remains-non-production',
  'caller-owned review readiness final handoff',
);
assertContains(
  closeoutSummarySmokeSource,
  'real-exported-review-readiness-closed-currently-missing',
  'caller-owned review readiness closeout summary',
);
assertContains(
  closeoutSummarySmokeSource,
  'review-readiness-chain-closed-current-readout',
  'caller-owned review readiness closeout summary',
);
assertContains(
  p0HandoffConsistencySmokeSource,
  'handoff-consistent-but-evidence-still-missing',
  'P0 real-evidence intake handoff consistency',
);
assertContains(
  p0HandoffConsistencySmokeSource,
  'same-manual-interpretation-boundary',
  'P0 real-evidence intake handoff consistency',
);
assertContains(
  interpretationReadinessSmokeSource,
  'manual-evidence-interpretation-not-ready',
  'real-corpus interpretation readiness',
);
assertContains(
  interpretationReadinessSmokeSource,
  'p0-target-real-exported-corpus-missing',
  'real-corpus interpretation readiness',
);
assertContains(
  productionGateMappingSmokeSource,
  'mapping-only-positive-gate-remains-closed',
  'evidence interpretation to production gate mapping',
);
assertContains(
  productionGateMappingSmokeSource,
  'does-not-clear-non-evidence-blockers',
  'evidence interpretation to production gate mapping',
);

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

assertContains(runbookText, 'This runbook describes the caller-owned manual flow', 'runbook');
assertContains(runbookText, 'Always pass each directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Handoff Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-handoff consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-handoff-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(callerOwnedRealExportedReviewReadinessPostHandoffConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReadyNow":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned real-exported review readiness post-handoff consistency must not grant interpretation readiness, production readiness, or authority now.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Caller-owned real-exported review readiness post-handoff consistency must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Caller-owned real-exported review readiness post-handoff consistency should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned real-exported review readiness post-handoff consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned real-exported review readiness post-handoff consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Caller-owned real-exported review readiness post-handoff consistency should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned real-exported review readiness post-handoff consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned real-exported review readiness post-handoff consistency must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-handoff consistency checkpoint smoke ok');
