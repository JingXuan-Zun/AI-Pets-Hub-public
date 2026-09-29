import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedRealExportedIntakeReviewReadinessInput =
  | 'accepted-intake-criteria-consistency'
  | 'accepted-intake-readiness-criteria'
  | 'field-completeness-audit'
  | 'handoff-closeout-summary'
  | 'intake-filling-support-report'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'positive-sample-expectation'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract'
  | 'source-declaration-preflight';

type CallerOwnedRealExportedIntakeReviewReadinessSignal =
  | 'review-intake-must-be-explicit-caller-owned-dir'
  | 'review-intake-must-declare-real-exported-source'
  | 'review-intake-must-declare-real-exported-status'
  | 'review-intake-must-have-exported-corpus-references'
  | 'review-intake-must-pass-field-and-runbook-gates'
  | 'review-intake-must-be-reviewable-not-production-ready'
  | 'review-readiness-remains-non-production';

type CallerOwnedRealExportedIntakeReviewReadinessGuard =
  | 'review-readiness-criteria-only'
  | 'explicit-dir-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

type CallerOwnedRealExportedIntakeReviewReadinessBlocker =
  | 'field-completeness-not-run'
  | 'manual-interpretation-not-ready'
  | 'no-explicit-real-exported-intake'
  | 'no-positive-sample-accepted'
  | 'p0-real-exported-corpus-missing'
  | 'production-gate-closed'
  | 'runbook-not-run'
  | 'source-declaration-not-supplied'
  | 'validator-not-run';

interface CallerOwnedRealExportedIntakeReviewReadinessRow {
  blockersNow: readonly CallerOwnedRealExportedIntakeReviewReadinessBlocker[];
  guards: readonly CallerOwnedRealExportedIntakeReviewReadinessGuard[];
  inputs: readonly CallerOwnedRealExportedIntakeReviewReadinessInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  readinessStatus: 'criteria-defined-currently-missing';
  requiredEvidence: readonly string[];
  signal: CallerOwnedRealExportedIntakeReviewReadinessSignal;
}

interface CallerOwnedRealExportedIntakeReviewReadinessCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedRealExportedIntakeReviewReadinessRow[];
  summaryDecision: 'real-exported-review-readiness-criteria-defined-currently-missing';
}

const sharedInputs = [
  'handoff-closeout-summary',
  'positive-sample-expectation',
  'accepted-intake-readiness-criteria',
  'accepted-intake-criteria-consistency',
  'source-declaration-preflight',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'field-completeness-audit',
  'p0-real-evidence-closeout-report',
  'runbook-completion-report',
  'intake-filling-support-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedRealExportedIntakeReviewReadinessInput[];

const callerOwnedRealExportedIntakeReviewReadinessCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness',
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
      guards: [
        'review-readiness-criteria-only',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'caller supplies explicit --dir',
        'intake directory remains caller-owned',
        'reports do not discover directories',
      ],
      signal: 'review-intake-must-be-explicit-caller-owned-dir',
    },
    {
      blockersNow: [
        'source-declaration-not-supplied',
        'p0-real-exported-corpus-missing',
      ],
      guards: [
        'review-readiness-criteria-only',
        'explicit-dir-only',
        'no-sample-collection',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'Sample source is real-exported',
        'source declaration preflight status is consistent',
        '--expected-source real-exported is satisfied',
      ],
      signal: 'review-intake-must-declare-real-exported-source',
    },
    {
      blockersNow: [
        'source-declaration-not-supplied',
        'p0-real-exported-corpus-missing',
      ],
      guards: [
        'review-readiness-criteria-only',
        'explicit-dir-only',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'Sample source status is real-exported-evidence',
        'real-exported maps to real-exported-evidence',
        'P0 real-exported-corpus signal can become reviewable',
      ],
      signal: 'review-intake-must-declare-real-exported-status',
    },
    {
      blockersNow: [
        'validator-not-run',
        'p0-real-exported-corpus-missing',
      ],
      guards: [
        'review-readiness-criteria-only',
        'explicit-dir-only',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'real-corpus-manifest.json has source paths',
        'corpus-batch-index.json references the real corpus manifest',
        'validator is not missing or empty',
      ],
      signal: 'review-intake-must-have-exported-corpus-references',
    },
    {
      blockersNow: [
        'field-completeness-not-run',
        'runbook-not-run',
        'manual-interpretation-not-ready',
      ],
      guards: [
        'review-readiness-criteria-only',
        'explicit-dir-only',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'field completeness has no open required sample-note, manifest, or index fields',
        'runbook completion is ready-for-manual-review or explicitly reviewable',
        'intake readiness gate is ready-for-manual-review or review-needed without blockers',
      ],
      signal: 'review-intake-must-pass-field-and-runbook-gates',
    },
    {
      blockersNow: [
        'no-positive-sample-accepted',
        'production-gate-closed',
      ],
      guards: [
        'review-readiness-criteria-only',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'ready-for-manual-review means manual interpretation only',
        'production readiness remains false',
        'positive production gate remains closed',
      ],
      signal: 'review-intake-must-be-reviewable-not-production-ready',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'manual-interpretation-not-ready',
      ],
      guards: [
        'review-readiness-criteria-only',
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
      readinessStatus: 'criteria-defined-currently-missing',
      requiredEvidence: [
        'review readiness does not choose tools',
        'review readiness does not route permissions',
        'review readiness does not execute recovery',
      ],
      signal: 'review-readiness-remains-non-production',
    },
  ],
  summaryDecision: 'real-exported-review-readiness-criteria-defined-currently-missing',
} as const satisfies CallerOwnedRealExportedIntakeReviewReadinessCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedRealExportedIntakeReviewReadinessSignal) {
  const row = callerOwnedRealExportedIntakeReviewReadinessCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the caller-owned real-exported review readiness checkpoint.`);
  return row;
}

function rowsForGuard(guard: CallerOwnedRealExportedIntakeReviewReadinessGuard) {
  return callerOwnedRealExportedIntakeReviewReadinessCheckpoint.rows
    .filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: CallerOwnedRealExportedIntakeReviewReadinessBlocker) {
  return callerOwnedRealExportedIntakeReviewReadinessCheckpoint.rows
    .filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const handoffCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-expectation-handoff-closeout-summary-checkpoint-smoke.ts',
);
const positiveExpectationSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-sample-expectation-checkpoint-smoke.ts',
);
const acceptedCriteriaSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-readiness-criteria-checkpoint-smoke.ts',
);
const acceptedCriteriaConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-consistency-checkpoint-smoke.ts',
);
const sourceDeclarationSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
);
const p0TargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const intakeTemplateSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({ projectRoot });
const fieldCompleteness = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });
const runbookCompletion = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.productionAuthority, false);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.productionReady, false);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedRealExportedIntakeReviewReadinessCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedRealExportedIntakeReviewReadinessCheckpoint.summaryDecision,
  'real-exported-review-readiness-criteria-defined-currently-missing',
);

assert.deepEqual(
  callerOwnedRealExportedIntakeReviewReadinessCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'review-intake-must-be-explicit-caller-owned-dir',
    'review-intake-must-be-reviewable-not-production-ready',
    'review-intake-must-declare-real-exported-source',
    'review-intake-must-declare-real-exported-status',
    'review-intake-must-have-exported-corpus-references',
    'review-intake-must-pass-field-and-runbook-gates',
    'review-readiness-remains-non-production',
  ],
);

for (const row of callerOwnedRealExportedIntakeReviewReadinessCheckpoint.rows) {
  assert.equal(row.readinessStatus, 'criteria-defined-currently-missing');
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
  assert.ok(row.requiredEvidence.length > 0);
}

assert.equal(
  rowsForGuard('review-readiness-criteria-only').length,
  callerOwnedRealExportedIntakeReviewReadinessCheckpoint.rows.length,
);
assert.ok(rowsForGuard('explicit-dir-only').length >= 5);
assert.ok(rowsForGuard('no-sample-collection').length >= 1);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-required-report-order').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 1);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 2);

assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 1);
assert.ok(rowsForBlocker('source-declaration-not-supplied').length >= 2);
assert.ok(rowsForBlocker('p0-real-exported-corpus-missing').length >= 3);
assert.ok(rowsForBlocker('validator-not-run').length >= 1);
assert.ok(rowsForBlocker('field-completeness-not-run').length >= 1);
assert.ok(rowsForBlocker('runbook-not-run').length >= 1);
assert.ok(rowsForBlocker('manual-interpretation-not-ready').length >= 3);
assert.ok(rowsForBlocker('no-positive-sample-accepted').length >= 1);
assert.ok(rowsForBlocker('production-gate-closed').length >= 2);

assert.ok(rowForSignal('review-intake-must-be-explicit-caller-owned-dir').requiredEvidence.includes('caller supplies explicit --dir'));
assert.ok(rowForSignal('review-intake-must-declare-real-exported-source').requiredEvidence.includes('Sample source is real-exported'));
assert.ok(rowForSignal('review-intake-must-declare-real-exported-status').requiredEvidence.includes('Sample source status is real-exported-evidence'));
assert.ok(rowForSignal('review-intake-must-have-exported-corpus-references').requiredEvidence.includes('real-corpus-manifest.json has source paths'));
assert.ok(rowForSignal('review-intake-must-pass-field-and-runbook-gates').requiredEvidence.some((evidence) => evidence.includes('field completeness')));
assert.ok(rowForSignal('review-intake-must-be-reviewable-not-production-ready').requiredEvidence.includes('production readiness remains false'));
assert.equal(rowForSignal('review-readiness-remains-non-production').positiveGateAllowed, false);

assertContains(
  handoffCloseoutSmokeSource,
  'real-exported-positive-expectation-handoff-closed-interpretation-not-ready',
  'handoff closeout summary',
);
assertContains(
  positiveExpectationSmokeSource,
  'real-exported-positive-sample-expectation-defined-no-sample-accepted',
  'positive sample expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-intake-must-declare-real-exported-source',
  'positive sample expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-intake-must-declare-real-exported-status',
  'positive sample expectation checkpoint',
);
assertContains(
  acceptedCriteriaSmokeSource,
  'criteria-defined-but-no-accepted-intake-yet',
  'accepted-intake criteria checkpoint',
);
assertContains(
  acceptedCriteriaConsistencySmokeSource,
  'criteria-consistent-but-no-accepted-intake-yet',
  'accepted-intake criteria consistency checkpoint',
);

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
const realExportedFillingItem = fillingSupport.fillingItems.find((item) => item.gapKind === 'real-exported-corpus');
assert.ok(realExportedFillingItem, 'real-exported-corpus filling item should exist.');
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-source'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-source-status'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'corpus-paths'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'validator-status'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'p0-real-exported-signal'));
assert.ok(realExportedFillingItem.manifestFields.includes('sources[].path'));
assert.ok(realExportedFillingItem.indexFields.includes('batches[].manifestPath'));

assert.equal(fieldCompleteness.status, 'no-intake-dirs');
assert.equal(fieldCompleteness.readyForProductionRuntime, false);
assert.equal(fieldCompleteness.intakeCount, 0);
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-exported-corpus')));

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.deepEqual(
  p0TargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status, signal.missingReason]),
  [
    ['real-production-like-sample', 'missing', 'no explicit intake directories supplied'],
    ['real-exported-corpus', 'missing', 'no explicit intake directories supplied'],
  ],
);

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.equal(intakeReadinessGate.intakeCount, 0);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');
assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')));

assert.equal(runbookCompletion.status, 'no-intake-dirs');
assert.equal(runbookCompletion.readyForProductionRuntime, false);
assert.equal(runbookCompletion.intakeCount, 0);

assert.match(sourceDeclarationSource, /sampleSource === 'real-exported'/u);
assert.match(sourceDeclarationSource, /return 'real-exported-evidence'/u);
assert.match(sourceDeclarationSource, /expectedSampleSource/u);
assert.match(sourceDeclarationSource, /expected-source real-exported/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSource === 'real-exported'/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSourceStatus === 'real-exported-evidence'/u);
assert.match(p0TargetStatusSource, /ready-for-manual-review/u);
assert.match(intakeTemplateSource, /replace-with-sample-source-real-exported-rehearsal-or-unknown/u);
assert.match(intakeTemplateSource, /replace-with-sample-source-status/u);
assert.match(intakeTemplateSource, /real-corpus-manifest\.json/u);
assert.match(intakeTemplateSource, /corpus-batch-index\.json/u);

assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Always pass each intake directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'the intake field completeness audit reports no open sample-note, manifest, or index fields for reviewed `--dir` values', 'runbook');
assertContains(runbookText, 'validator runs without `missing` or `empty` status', 'runbook');
assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(callerOwnedRealExportedIntakeReviewReadinessCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReadyNow":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned real-exported review readiness checkpoint must not grant interpretation readiness, production readiness, or authority now.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Caller-owned real-exported review readiness checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Caller-owned real-exported review readiness checkpoint should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned real-exported review readiness checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned real-exported review readiness checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Caller-owned real-exported review readiness checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned real-exported review readiness checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned real-exported review readiness checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness checkpoint smoke ok');
