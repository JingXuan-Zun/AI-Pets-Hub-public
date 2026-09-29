import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample } from './agent-session-v3-pilot-real-corpus-batch-readiness-rollup-example.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight } from './agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type SourceDeclarationGapCloseoutRollupInput =
  | 'explicit-dir-post-fill-interpretation-checkpoint'
  | 'field-completeness-audit'
  | 'p0-intake-source-alignment-checkpoint'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'p0-source-declaration-gap-readout-checkpoint'
  | 'readiness-rollup-example-fixture'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract'
  | 'source-declaration-preflight';

type SourceDeclarationGapCloseoutRollupSignal =
  | 'source-alignment-chain-closed'
  | 'explicit-dir-interpretation-preserves-source-gap'
  | 'source-gap-readout-confirms-source-separation'
  | 'real-exported-corpus-remains-open-with-rehearsal'
  | 'complete-fields-do-not-close-source-gap'
  | 'source-gap-closeout-remains-non-production';

type SourceDeclarationGapCloseoutRollupGuard =
  | 'explicit-dir-only'
  | 'source-gap-closeout-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

interface SourceDeclarationGapCloseoutRollupRow {
  closeoutStatus: 'closed-but-real-exported-still-required';
  guards: readonly SourceDeclarationGapCloseoutRollupGuard[];
  inputs: readonly SourceDeclarationGapCloseoutRollupInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: SourceDeclarationGapCloseoutRollupSignal;
}

interface SourceDeclarationGapCloseoutRollupCheckpoint {
  gate: 'source-declaration-gap-closeout-rollup';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly SourceDeclarationGapCloseoutRollupRow[];
  summaryDecision: 'source-declaration-gap-closeout-real-exported-still-required';
}

const sharedInputs = [
  'p0-intake-source-alignment-checkpoint',
  'explicit-dir-post-fill-interpretation-checkpoint',
  'p0-source-declaration-gap-readout-checkpoint',
  'source-declaration-preflight',
  'p0-intake-target-status-report',
  'p0-real-evidence-closeout-report',
  'field-completeness-audit',
  'runbook-completion-report',
  'readiness-rollup-example-fixture',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly SourceDeclarationGapCloseoutRollupInput[];

const sourceDeclarationGapCloseoutRollupCheckpoint = {
  gate: 'source-declaration-gap-closeout-rollup',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      closeoutStatus: 'closed-but-real-exported-still-required',
      guards: [
        'explicit-dir-only',
        'source-gap-closeout-only',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'source-alignment-chain-closed',
    },
    {
      closeoutStatus: 'closed-but-real-exported-still-required',
      guards: [
        'explicit-dir-only',
        'source-gap-closeout-only',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'explicit-dir-interpretation-preserves-source-gap',
    },
    {
      closeoutStatus: 'closed-but-real-exported-still-required',
      guards: [
        'source-gap-closeout-only',
        'no-sample-collection',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'source-gap-readout-confirms-source-separation',
    },
    {
      closeoutStatus: 'closed-but-real-exported-still-required',
      guards: [
        'explicit-dir-only',
        'source-gap-closeout-only',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'real-exported-corpus-remains-open-with-rehearsal',
    },
    {
      closeoutStatus: 'closed-but-real-exported-still-required',
      guards: [
        'source-gap-closeout-only',
        'no-auto-fill',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'complete-fields-do-not-close-source-gap',
    },
    {
      closeoutStatus: 'closed-but-real-exported-still-required',
      guards: [
        'no-sample-collection',
        'no-runtime-action-order',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'source-gap-closeout-remains-non-production',
    },
  ],
  summaryDecision: 'source-declaration-gap-closeout-real-exported-still-required',
} as const satisfies SourceDeclarationGapCloseoutRollupCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: SourceDeclarationGapCloseoutRollupSignal) {
  const row = sourceDeclarationGapCloseoutRollupCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the source-declaration gap closeout rollup checkpoint.`);
  return row;
}

function rowsForGuard(guard: SourceDeclarationGapCloseoutRollupGuard) {
  return sourceDeclarationGapCloseoutRollupCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const sourceAlignmentSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
);
const explicitDirPostFillSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-explicit-dir-post-fill-interpretation-readiness-consistency-checkpoint-smoke.ts',
);
const sourceGapReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-source-declaration-gap-readout-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(sourceDeclarationGapCloseoutRollupCheckpoint.productionAuthority, false);
assert.equal(sourceDeclarationGapCloseoutRollupCheckpoint.productionReady, false);
assert.equal(sourceDeclarationGapCloseoutRollupCheckpoint.positiveGateAllowed, false);
assert.equal(sourceDeclarationGapCloseoutRollupCheckpoint.isExecutionOrder, false);
assert.equal(sourceDeclarationGapCloseoutRollupCheckpoint.isImplementationPlan, false);
assert.equal(sourceDeclarationGapCloseoutRollupCheckpoint.isProductionWiringPlan, false);
assert.equal(
  sourceDeclarationGapCloseoutRollupCheckpoint.summaryDecision,
  'source-declaration-gap-closeout-real-exported-still-required',
);

assert.deepEqual(
  sourceDeclarationGapCloseoutRollupCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'complete-fields-do-not-close-source-gap',
    'explicit-dir-interpretation-preserves-source-gap',
    'real-exported-corpus-remains-open-with-rehearsal',
    'source-alignment-chain-closed',
    'source-gap-closeout-remains-non-production',
    'source-gap-readout-confirms-source-separation',
  ],
);

for (const row of sourceDeclarationGapCloseoutRollupCheckpoint.rows) {
  assert.equal(row.closeoutStatus, 'closed-but-real-exported-still-required');
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
assert.ok(rowsForGuard('source-gap-closeout-only').length >= 5);
assert.ok(rowsForGuard('no-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 3);
assert.ok(rowsForGuard('no-runtime-authority').length >= 1);

assert.ok(rowForSignal('source-alignment-chain-closed').guards.includes('explicit-dir-only'));
assert.ok(rowForSignal('explicit-dir-interpretation-preserves-source-gap').guards.includes('no-auto-fill'));
assert.ok(rowForSignal('source-gap-readout-confirms-source-separation').guards.includes('no-sample-collection'));
assert.ok(rowForSignal('real-exported-corpus-remains-open-with-rehearsal').guards.includes('no-production-readiness'));
assert.ok(rowForSignal('complete-fields-do-not-close-source-gap').guards.includes('source-gap-closeout-only'));
assert.ok(rowForSignal('source-gap-closeout-remains-non-production').guards.includes('no-runtime-authority'));

const tempDir = await mkdtemp(path.join(tmpdir(), 'agent-v3-source-declaration-gap-closeout-'));
try {
  const example = await runAgentSessionV3PilotRealCorpusBatchReadinessRollupExample({
    outDir: tempDir,
    prettyJson: true,
  });
  const readyIntakeDir = example.intakeDirs.ready;

  const [
    realExportedExpectedPreflight,
    rehearsalExpectedPreflight,
    fieldCompleteness,
    runbookCompletion,
    p0TargetStatus,
    p0Closeout,
  ] = await Promise.all([
    runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
      expectedSampleSource: 'real-exported',
      intakeDir: readyIntakeDir,
      prettyJson: true,
    }),
    runAgentSessionV3PilotRealCorpusBatchSourceDeclarationPreflight({
      expectedSampleSource: 'rehearsal',
      intakeDir: readyIntakeDir,
      prettyJson: true,
    }),
    runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
    runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
      intakeDirs: [readyIntakeDir],
      prettyJson: true,
      projectRoot,
    }),
  ]);

  assert.equal(realExportedExpectedPreflight.status, 'blocked');
  assert.equal(realExportedExpectedPreflight.readyForProductionRuntime, false);
  assert.equal(realExportedExpectedPreflight.sampleSource, 'rehearsal');
  assert.equal(realExportedExpectedPreflight.sampleSourceStatus, 'synthetic-rehearsal');
  assert.ok(realExportedExpectedPreflight.issues.some((issue) => issue.code === 'expected-source-mismatch'));

  assert.equal(rehearsalExpectedPreflight.status, 'consistent');
  assert.equal(rehearsalExpectedPreflight.readyForProductionRuntime, false);
  assert.equal(rehearsalExpectedPreflight.sampleSource, 'rehearsal');
  assert.equal(rehearsalExpectedPreflight.sampleSourceStatus, 'synthetic-rehearsal');

  assert.equal(fieldCompleteness.status, 'complete');
  assert.equal(fieldCompleteness.readyForProductionRuntime, false);
  assert.equal(fieldCompleteness.openFieldCount, 0);
  assert.equal(fieldCompleteness.missingFieldCount, 0);
  assert.equal(fieldCompleteness.placeholderFieldCount, 0);

  assert.equal(runbookCompletion.status, 'ready-for-manual-review');
  assert.equal(runbookCompletion.readyForProductionRuntime, false);
  assert.equal(runbookCompletion.blockedCriteriaCount, 0);
  assert.equal(runbookCompletion.reviewCriteriaCount, 0);
  assert.equal(runbookCompletion.readyCriteriaCount, 6);

  assert.equal(p0TargetStatus.status, 'blocked');
  assert.equal(p0TargetStatus.readyForProductionRuntime, false);
  assert.equal(p0TargetStatus.entries[0]?.validatorStatus, 'ready');
  assert.equal(p0TargetStatus.entries[0]?.sourceDeclarationStatus, 'blocked');
  assert.equal(p0TargetStatus.entries[0]?.hasProductionLikeSourceKind, true);
  assert.equal(p0TargetStatus.entries[0]?.sourceSampleSource, 'rehearsal');
  assert.equal(p0TargetStatus.entries[0]?.sourceSampleSourceStatus, 'synthetic-rehearsal');
  assert.deepEqual(
    p0TargetStatus.p0TargetSignals.map((signal) => `${signal.gapKind}:${signal.status}`).sort(),
    [
      'real-exported-corpus:missing',
      'real-production-like-sample:blocked',
    ],
  );

  assert.equal(p0Closeout.status, 'blocked');
  assert.equal(p0Closeout.readyForProductionRuntime, false);
  assert.equal(p0Closeout.p0IntakeTargetStatus, 'blocked');
  assert.equal(p0Closeout.readinessRollupStatus, 'ready-for-manual-review');
  assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('P0 target real-exported-corpus is missing')));
  assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('P0 target real-production-like-sample is blocked')));
} finally {
  await rm(tempDir, {
    force: true,
    recursive: true,
  });
}

assertContains(sourceAlignmentSmokeSource, 'p0-source-alignment-still-blocks-production-wiring', 'source alignment checkpoint');
assertContains(sourceAlignmentSmokeSource, 'real-exported-source-declaration-required', 'source alignment checkpoint');
assertContains(sourceAlignmentSmokeSource, 'production-like-source-kind-required', 'source alignment checkpoint');
assertContains(sourceAlignmentSmokeSource, 'rehearsal-does-not-satisfy-real-exported', 'source alignment checkpoint');
assertContains(explicitDirPostFillSmokeSource, 'explicit-dir-post-fill-interpretable-p0-real-evidence-still-blocked', 'explicit-dir checkpoint');
assertContains(explicitDirPostFillSmokeSource, 'p0-real-exported-remains-missing-for-rehearsal-fixture', 'explicit-dir checkpoint');
assertContains(sourceGapReadoutSmokeSource, 'p0-source-declaration-gap-readout-real-exported-still-required', 'source gap readout checkpoint');
assertContains(sourceGapReadoutSmokeSource, 'production-like-source-kind-is-not-real-exported-corpus', 'source gap readout checkpoint');
assertContains(sourceGapReadoutSmokeSource, 'p0-status-and-closeout-preserve-source-gap', 'source gap readout checkpoint');

assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'If you are checking a generated rehearsal bundle instead of caller-owned real exported samples', 'runbook');
assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(runbookText, 'manual prioritization aids, not a runtime action order', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Source-Declaration Gap Closeout Rollup Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary source-declaration gap closeout rollup checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-source-declaration-gap-closeout-rollup-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(sourceDeclarationGapCloseoutRollupCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Source-declaration gap closeout rollup must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Source-declaration gap closeout rollup must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Source-declaration gap closeout rollup should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Source-declaration gap closeout rollup should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Source-declaration gap closeout rollup should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Source-declaration gap closeout rollup should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-declaration gap closeout rollup must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-declaration gap closeout rollup must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary source-declaration gap closeout rollup checkpoint smoke ok');
