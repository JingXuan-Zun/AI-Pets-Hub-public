import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type ExplicitDirPostFillInterpretationInput =
  | 'field-completeness-audit'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'readiness-rollup-example-fixture'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract';

type ExplicitDirPostFillInterpretationSignal =
  | 'explicit-dir-reports-are-interpretable'
  | 'post-fill-fields-and-runbook-align'
  | 'p0-real-exported-remains-missing-for-rehearsal-fixture'
  | 'readiness-gate-preserves-p0-blockers'
  | 'p0-closeout-keeps-production-gate-closed'
  | 'runtime-boundary-remains-non-authoritative';

type ExplicitDirPostFillInterpretationGuard =
  | 'explicit-dir-only'
  | 'post-fill-interpretation-only'
  | 'no-auto-fill'
  | 'no-sample-collection'
  | 'no-directory-discovery'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

interface ExplicitDirPostFillInterpretationRow {
  guards: readonly ExplicitDirPostFillInterpretationGuard[];
  inputs: readonly ExplicitDirPostFillInterpretationInput[];
  interpretationStatus: 'interpretable-but-not-accepted-production-evidence';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: ExplicitDirPostFillInterpretationSignal;
}

interface ExplicitDirPostFillInterpretationCheckpoint {
  gate: 'explicit-dir-post-fill-interpretation-readiness-consistency';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ExplicitDirPostFillInterpretationRow[];
  summaryDecision: 'explicit-dir-post-fill-interpretable-p0-real-evidence-still-blocked';
}

const sharedInputs = [
  'readiness-rollup-example-fixture',
  'field-completeness-audit',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'runbook-completion-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly ExplicitDirPostFillInterpretationInput[];

const explicitDirPostFillInterpretationCheckpoint = {
  gate: 'explicit-dir-post-fill-interpretation-readiness-consistency',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      guards: [
        'explicit-dir-only',
        'post-fill-interpretation-only',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      interpretationStatus: 'interpretable-but-not-accepted-production-evidence',
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'explicit-dir-reports-are-interpretable',
    },
    {
      guards: [
        'explicit-dir-only',
        'post-fill-interpretation-only',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      interpretationStatus: 'interpretable-but-not-accepted-production-evidence',
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'post-fill-fields-and-runbook-align',
    },
    {
      guards: [
        'post-fill-interpretation-only',
        'no-sample-collection',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      interpretationStatus: 'interpretable-but-not-accepted-production-evidence',
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-real-exported-remains-missing-for-rehearsal-fixture',
    },
    {
      guards: [
        'explicit-dir-only',
        'post-fill-interpretation-only',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      interpretationStatus: 'interpretable-but-not-accepted-production-evidence',
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'readiness-gate-preserves-p0-blockers',
    },
    {
      guards: [
        'post-fill-interpretation-only',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationStatus: 'interpretable-but-not-accepted-production-evidence',
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-closeout-keeps-production-gate-closed',
    },
    {
      guards: [
        'no-runtime-action-order',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationStatus: 'interpretable-but-not-accepted-production-evidence',
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'runtime-boundary-remains-non-authoritative',
    },
  ],
  summaryDecision: 'explicit-dir-post-fill-interpretable-p0-real-evidence-still-blocked',
} as const satisfies ExplicitDirPostFillInterpretationCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: ExplicitDirPostFillInterpretationSignal) {
  const row = explicitDirPostFillInterpretationCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the explicit-dir post-fill interpretation checkpoint.`);
  return row;
}

function rowsForGuard(guard: ExplicitDirPostFillInterpretationGuard) {
  return explicitDirPostFillInterpretationCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const p0TargetStatusSmokeSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report-smoke.ts',
);
const starterToFilledDeltaSmokeSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-starter-to-filled-delta-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(explicitDirPostFillInterpretationCheckpoint.productionAuthority, false);
assert.equal(explicitDirPostFillInterpretationCheckpoint.productionReady, false);
assert.equal(explicitDirPostFillInterpretationCheckpoint.positiveGateAllowed, false);
assert.equal(explicitDirPostFillInterpretationCheckpoint.isExecutionOrder, false);
assert.equal(explicitDirPostFillInterpretationCheckpoint.isImplementationPlan, false);
assert.equal(explicitDirPostFillInterpretationCheckpoint.isProductionWiringPlan, false);
assert.equal(
  explicitDirPostFillInterpretationCheckpoint.summaryDecision,
  'explicit-dir-post-fill-interpretable-p0-real-evidence-still-blocked',
);

assert.deepEqual(
  explicitDirPostFillInterpretationCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'explicit-dir-reports-are-interpretable',
    'p0-closeout-keeps-production-gate-closed',
    'p0-real-exported-remains-missing-for-rehearsal-fixture',
    'post-fill-fields-and-runbook-align',
    'readiness-gate-preserves-p0-blockers',
    'runtime-boundary-remains-non-authoritative',
  ],
);

for (const row of explicitDirPostFillInterpretationCheckpoint.rows) {
  assert.equal(row.interpretationStatus, 'interpretable-but-not-accepted-production-evidence');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('explicit-dir-only').length >= 3);
assert.ok(rowsForGuard('post-fill-interpretation-only').length >= 5);
assert.ok(rowsForGuard('no-auto-fill').length >= 1);
assert.ok(rowsForGuard('no-sample-collection').length >= 1);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 3);
assert.ok(rowsForGuard('no-runtime-authority').length >= 2);

assert.ok(rowForSignal('explicit-dir-reports-are-interpretable').guards.includes('explicit-dir-only'));
assert.ok(rowForSignal('post-fill-fields-and-runbook-align').guards.includes('no-auto-fill'));
assert.ok(rowForSignal('p0-real-exported-remains-missing-for-rehearsal-fixture').guards.includes('no-sample-collection'));
assert.ok(rowForSignal('readiness-gate-preserves-p0-blockers').guards.includes('no-runtime-action-order'));
assert.ok(rowForSignal('p0-closeout-keeps-production-gate-closed').guards.includes('no-production-readiness'));
assert.ok(rowForSignal('runtime-boundary-remains-non-authoritative').guards.includes('no-runtime-authority'));

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-explicit-dir-post-fill-interpretation-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });
  const readyIntakeDir = example.intakeDirs.ready;
  const [
    fieldCompleteness,
    p0TargetStatus,
    intakeReadinessGate,
    p0Closeout,
    runbookCompletion,
  ] = await Promise.all([
    runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
  ]);

  assert.equal(fieldCompleteness.status, 'complete');
  assert.equal(fieldCompleteness.readyForProductionRuntime, false);
  assert.equal(fieldCompleteness.intakeCount, 1);
  assert.equal(fieldCompleteness.openFieldCount, 0);
  assert.equal(fieldCompleteness.missingFieldCount, 0);
  assert.equal(fieldCompleteness.placeholderFieldCount, 0);
  assert.equal(fieldCompleteness.unreadableFieldCount, 0);
  assert.equal(fieldCompleteness.intakeEntries[0]?.intakeDir, readyIntakeDir);
  assert.ok(fieldCompleteness.intakeEntries[0]?.fieldAudits.every((field) => field.status === 'complete'));
  assertContains(fieldCompleteness.guardrail, 'reads only explicitly supplied --dir intake directories', 'field completeness guardrail');
  assertContains(fieldCompleteness.guardrail, 'auto-fill files', 'field completeness guardrail');

  assert.equal(runbookCompletion.status, 'ready-for-manual-review');
  assert.equal(runbookCompletion.readyForProductionRuntime, false);
  assert.equal(runbookCompletion.intakeCount, 1);
  assert.equal(runbookCompletion.blockedCriteriaCount, 0);
  assert.equal(runbookCompletion.reviewCriteriaCount, 0);
  assert.equal(runbookCompletion.readyCriteriaCount, 6);
  assert.ok(runbookCompletion.intakeEntries[0]?.criteria.every((criterion) => criterion.status === 'complete'));
  assertContains(runbookCompletion.guardrail, 'reads only explicitly supplied --dir intake directories', 'runbook completion guardrail');

  assert.equal(p0TargetStatus.status, 'blocked');
  assert.equal(p0TargetStatus.readyForProductionRuntime, false);
  assert.equal(p0TargetStatus.intakeCount, 1);
  assert.equal(p0TargetStatus.blockedCount, 1);
  assert.equal(p0TargetStatus.readyForManualReviewCount, 0);
  assert.equal(p0TargetStatus.entries[0]?.validatorStatus, 'ready');
  assert.equal(p0TargetStatus.entries[0]?.sourceDeclarationStatus, 'blocked');
  assert.equal(p0TargetStatus.entries[0]?.sourceSampleSource, 'rehearsal');
  assert.equal(p0TargetStatus.entries[0]?.sourceSampleSourceStatus, 'synthetic-rehearsal');
  assert.deepEqual(
    p0TargetStatus.p0TargetSignals.map((signal) => `${signal.gapKind}:${signal.status}`).sort(),
    [
      'real-exported-corpus:missing',
      'real-production-like-sample:blocked',
    ],
  );
  assert.equal(
    p0TargetStatus.p0TargetSignals.find((signal) => signal.gapKind === 'real-exported-corpus')?.missingReason,
    'no supplied intake has real-exported sample source evidence',
  );
  assert.ok(
    p0TargetStatus.p0TargetSignals
      .find((signal) => signal.gapKind === 'real-production-like-sample')
      ?.evidenceReasons.some((reason) => reason.includes('source declaration preflight is blocked')),
  );
  assertContains(p0TargetStatus.guardrail, 'does not discover directories', 'P0 target status guardrail');

  assert.equal(intakeReadinessGate.status, 'blocked');
  assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
  assert.equal(intakeReadinessGate.intakeCount, 1);
  assert.equal(intakeReadinessGate.blockedCount, 1);
  assert.equal(intakeReadinessGate.readyForManualReviewCount, 0);
  assert.equal(intakeReadinessGate.entries[0]?.fieldCompletenessStatus, 'complete');
  assert.equal(intakeReadinessGate.entries[0]?.runbookStatus, 'ready-for-manual-review');
  assert.equal(intakeReadinessGate.entries[0]?.p0EntryStatus, 'blocked');
  assert.deepEqual(
    intakeReadinessGate.issueCodeRollup.map((entry) => entry.issueCode).sort(),
    [
      'p0-entry-blocked',
      'p0-target-blocked',
      'p0-target-missing',
    ],
  );
  assert.ok(intakeReadinessGate.unblockRollup.every((entry) => entry.category === 'review-p0-targets'));
  assert.deepEqual(
    intakeReadinessGate.entries[0]?.p0SignalAttributions
      .map((attribution) => `${attribution.gapKind}:${attribution.status}:${attribution.supportsTarget ? 'yes' : 'no'}`),
    [
      'real-production-like-sample:blocked:yes',
      'real-exported-corpus:missing:no',
    ],
  );
  assertContains(intakeReadinessGate.guardrail, 'block runtime execution', 'readiness gate guardrail');

  assert.equal(p0Closeout.status, 'blocked');
  assert.equal(p0Closeout.readyForProductionRuntime, false);
  assert.equal(p0Closeout.p0IntakeTargetStatus, 'blocked');
  assert.equal(p0Closeout.readinessRollupStatus, 'ready-for-manual-review');
  assert.deepEqual(p0Closeout.readinessStatusCounts, {
    blocked: 0,
    readyForManualReview: 1,
    reviewNeeded: 0,
  });
  assert.deepEqual(
    p0Closeout.p0TargetSignals.map((signal) => `${signal.gapKind}:${signal.status}`).sort(),
    [
      'real-exported-corpus:missing',
      'real-production-like-sample:blocked',
    ],
  );
  assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('P0 target real-exported-corpus is missing')));
  assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('P0 target real-production-like-sample is blocked')));
  assertContains(p0Closeout.guardrail, 'grant runtime authority', 'P0 closeout guardrail');

  assert.equal(example.rollup.status, 'blocked');
  assert.equal(example.reviewSummary.status, 'blocked');
  assert.match(example.reviewSummary.summaryText, /status=blocked/u);

  for (const report of [
    fieldCompleteness,
    p0TargetStatus,
    intakeReadinessGate,
    p0Closeout,
    runbookCompletion,
  ]) {
    assert.equal(report.readyForProductionRuntime, false);
  }
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

assertContains(p0TargetStatusSmokeSource, "assert.equal(readyOnly.status, 'blocked')", 'P0 target status smoke');
assertContains(p0TargetStatusSmokeSource, "assert.equal(readyOnly.entries[0]?.sourceSampleSource, 'rehearsal')", 'P0 target status smoke');
assertContains(starterToFilledDeltaSmokeSource, "assert.equal(filled.p0Status.status, 'blocked')", 'starter to filled delta smoke');
assertContains(starterToFilledDeltaSmokeSource, 'real-exported-corpus:missing', 'starter to filled delta smoke');

assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(runbookText, 'Always pass each intake directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'the intake field completeness audit reports no open sample-note, manifest, or index fields for reviewed `--dir` values', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Explicit-Dir Post-Fill Interpretation Readiness Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary explicit-dir post-fill interpretation readiness consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-explicit-dir-post-fill-interpretation-readiness-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(explicitDirPostFillInterpretationCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Explicit-dir post-fill interpretation checkpoint must not grant production readiness or runtime authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Explicit-dir post-fill interpretation checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoFill|collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Explicit-dir post-fill interpretation checkpoint should not automate evidence filling or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Explicit-dir post-fill interpretation checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Explicit-dir post-fill interpretation checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Explicit-dir post-fill interpretation checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Explicit-dir post-fill interpretation checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Explicit-dir post-fill interpretation checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary explicit-dir post-fill interpretation readiness consistency checkpoint smoke ok');
