import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchFinalGapReport } from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type RealExportedPositiveSampleExpectationInput =
  | 'final-gap-report'
  | 'intake-filling-support-report'
  | 'next-evidence-target-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract'
  | 'source-declaration-gap-closeout-rollup-checkpoint'
  | 'source-declaration-preflight';

type RealExportedPositiveSampleExpectationSignal =
  | 'positive-intake-must-be-explicit-caller-owned-dir'
  | 'positive-intake-must-declare-real-exported-source'
  | 'positive-intake-must-declare-real-exported-status'
  | 'positive-intake-must-reference-exported-corpus-files'
  | 'positive-intake-must-be-reviewable-not-production-ready'
  | 'positive-expectation-remains-non-production';

type RealExportedPositiveSampleExpectationGuard =
  | 'expectation-only'
  | 'explicit-dir-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

interface RealExportedPositiveSampleExpectationRow {
  expectationStatus: 'defined-but-no-positive-sample-accepted';
  guards: readonly RealExportedPositiveSampleExpectationGuard[];
  inputs: readonly RealExportedPositiveSampleExpectationInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  requiredEvidence: readonly string[];
  signal: RealExportedPositiveSampleExpectationSignal;
}

interface RealExportedPositiveSampleExpectationCheckpoint {
  gate: 'real-exported-positive-sample-expectation';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RealExportedPositiveSampleExpectationRow[];
  summaryDecision: 'real-exported-positive-sample-expectation-defined-no-sample-accepted';
}

const sharedInputs = [
  'source-declaration-gap-closeout-rollup-checkpoint',
  'source-declaration-preflight',
  'next-evidence-target-report',
  'final-gap-report',
  'intake-filling-support-report',
  'p0-intake-target-status-report',
  'p0-real-evidence-closeout-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly RealExportedPositiveSampleExpectationInput[];

const realExportedPositiveSampleExpectationCheckpoint = {
  gate: 'real-exported-positive-sample-expectation',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      expectationStatus: 'defined-but-no-positive-sample-accepted',
      guards: [
        'expectation-only',
        'explicit-dir-only',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredEvidence: [
        'caller supplies explicit --dir',
        'intake directory remains caller-owned',
      ],
      signal: 'positive-intake-must-be-explicit-caller-owned-dir',
    },
    {
      expectationStatus: 'defined-but-no-positive-sample-accepted',
      guards: [
        'expectation-only',
        'explicit-dir-only',
        'no-sample-collection',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredEvidence: [
        'Sample source is real-exported',
        '--expected-source real-exported preflight is consistent',
      ],
      signal: 'positive-intake-must-declare-real-exported-source',
    },
    {
      expectationStatus: 'defined-but-no-positive-sample-accepted',
      guards: [
        'expectation-only',
        'explicit-dir-only',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredEvidence: [
        'Sample source status is real-exported-evidence',
        'source/status derived mapping is valid',
      ],
      signal: 'positive-intake-must-declare-real-exported-status',
    },
    {
      expectationStatus: 'defined-but-no-positive-sample-accepted',
      guards: [
        'expectation-only',
        'explicit-dir-only',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredEvidence: [
        'real-corpus-manifest.json has source paths',
        'corpus-batch-index.json references the real manifest',
        'corpus file paths point at already exported files',
      ],
      signal: 'positive-intake-must-reference-exported-corpus-files',
    },
    {
      expectationStatus: 'defined-but-no-positive-sample-accepted',
      guards: [
        'expectation-only',
        'no-runtime-action-order',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredEvidence: [
        'validator is not missing or empty',
        'P0 real-exported-corpus signal is reviewable',
        'manual review remains separate from production readiness',
      ],
      signal: 'positive-intake-must-be-reviewable-not-production-ready',
    },
    {
      expectationStatus: 'defined-but-no-positive-sample-accepted',
      guards: [
        'expectation-only',
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
      requiredEvidence: [
        'expectations do not collect or create samples',
        'expectations do not promote v3 runtime authority',
      ],
      signal: 'positive-expectation-remains-non-production',
    },
  ],
  summaryDecision: 'real-exported-positive-sample-expectation-defined-no-sample-accepted',
} as const satisfies RealExportedPositiveSampleExpectationCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: RealExportedPositiveSampleExpectationSignal) {
  const row = realExportedPositiveSampleExpectationCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the real-exported positive sample expectation checkpoint.`);
  return row;
}

function rowsForGuard(guard: RealExportedPositiveSampleExpectationGuard) {
  return realExportedPositiveSampleExpectationCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const sourceDeclarationSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
);
const sourceGapCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-declaration-gap-closeout-rollup-checkpoint-smoke.ts',
);
const p0TargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const intakeTemplateSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
const finalGap = createAgentSessionV3PilotRealCorpusBatchFinalGapReport({ projectRoot });
const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(realExportedPositiveSampleExpectationCheckpoint.productionAuthority, false);
assert.equal(realExportedPositiveSampleExpectationCheckpoint.productionReady, false);
assert.equal(realExportedPositiveSampleExpectationCheckpoint.positiveGateAllowed, false);
assert.equal(realExportedPositiveSampleExpectationCheckpoint.isExecutionOrder, false);
assert.equal(realExportedPositiveSampleExpectationCheckpoint.isImplementationPlan, false);
assert.equal(realExportedPositiveSampleExpectationCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realExportedPositiveSampleExpectationCheckpoint.summaryDecision,
  'real-exported-positive-sample-expectation-defined-no-sample-accepted',
);

assert.deepEqual(
  realExportedPositiveSampleExpectationCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'positive-expectation-remains-non-production',
    'positive-intake-must-be-explicit-caller-owned-dir',
    'positive-intake-must-be-reviewable-not-production-ready',
    'positive-intake-must-declare-real-exported-source',
    'positive-intake-must-declare-real-exported-status',
    'positive-intake-must-reference-exported-corpus-files',
  ],
);

for (const row of realExportedPositiveSampleExpectationCheckpoint.rows) {
  assert.equal(row.expectationStatus, 'defined-but-no-positive-sample-accepted');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.requiredEvidence.length > 0);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('expectation-only').length === realExportedPositiveSampleExpectationCheckpoint.rows.length);
assert.ok(rowsForGuard('explicit-dir-only').length >= 4);
assert.ok(rowsForGuard('no-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 1);

assert.ok(
  rowForSignal('positive-intake-must-be-explicit-caller-owned-dir')
    .requiredEvidence.includes('caller supplies explicit --dir'),
);
assert.ok(
  rowForSignal('positive-intake-must-declare-real-exported-source')
    .requiredEvidence.includes('Sample source is real-exported'),
);
assert.ok(
  rowForSignal('positive-intake-must-declare-real-exported-status')
    .requiredEvidence.includes('Sample source status is real-exported-evidence'),
);
assert.ok(
  rowForSignal('positive-intake-must-reference-exported-corpus-files')
    .requiredEvidence.includes('real-corpus-manifest.json has source paths'),
);
assert.ok(
  rowForSignal('positive-intake-must-be-reviewable-not-production-ready')
    .requiredEvidence.includes('manual review remains separate from production readiness'),
);
assert.ok(rowForSignal('positive-expectation-remains-non-production').guards.includes('no-runtime-authority'));

assert.equal(nextTarget.status, 'target-needed');
assert.equal(nextTarget.nextPriority, 'P0');
assert.equal(nextTarget.readyForProductionRuntime, false);
assert.ok(nextTarget.targets.some((target) => target.gapKind === 'real-exported-corpus'));

assert.equal(finalGap.status, 'missing-real-evidence');
assert.equal(finalGap.readyForProductionRuntime, false);
assert.ok(finalGap.finalGaps.some((gap) => gap.gapKind === 'real-exported-corpus' && gap.priority === 'P0'));

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
const realExportedFillingItem = fillingSupport.fillingItems.find((item) => item.gapKind === 'real-exported-corpus');
assert.ok(realExportedFillingItem, 'real-exported-corpus filling item should exist.');
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-source'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-source-status'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'corpus-paths'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-count'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'validator-status'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'p0-real-exported-signal'));
assert.ok(realExportedFillingItem.manifestFields.includes('sources[].path'));
assert.ok(realExportedFillingItem.indexFields.includes('batches[].manifestPath'));

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.deepEqual(
  p0TargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status, signal.missingReason]),
  [
    ['real-production-like-sample', 'missing', 'no explicit intake directories supplied'],
    ['real-exported-corpus', 'missing', 'no explicit intake directories supplied'],
  ],
);
assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');

assert.match(sourceDeclarationSource, /sampleSource === 'real-exported'/u);
assert.match(sourceDeclarationSource, /return 'real-exported-evidence'/u);
assert.match(sourceDeclarationSource, /expectedSampleSource/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSource === 'real-exported'/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSourceStatus === 'real-exported-evidence'/u);
assert.match(intakeTemplateSource, /replace-with-sample-source-real-exported-rehearsal-or-unknown/u);
assert.match(intakeTemplateSource, /replace-with-sample-source-status/u);
assert.match(intakeTemplateSource, /real-corpus-manifest\.json/u);
assert.match(intakeTemplateSource, /corpus-batch-index\.json/u);

assertContains(sourceGapCloseoutSmokeSource, 'source-declaration-gap-closeout-real-exported-still-required', 'source gap closeout checkpoint');
assertContains(sourceGapCloseoutSmokeSource, 'real-exported-corpus-remains-open-with-rehearsal', 'source gap closeout checkpoint');
assertContains(sourceGapCloseoutSmokeSource, 'complete-fields-do-not-close-source-gap', 'source gap closeout checkpoint');
assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Always pass each intake directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'validator runs without `missing` or `empty` status', 'runbook');
assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Real-Exported Positive Sample Expectation Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary real-exported positive sample expectation checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-exported-positive-sample-expectation-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realExportedPositiveSampleExpectationCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Real-exported positive sample expectation checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Real-exported positive sample expectation checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Real-exported positive sample expectation checkpoint should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Real-exported positive sample expectation checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Real-exported positive sample expectation checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Real-exported positive sample expectation checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Real-exported positive sample expectation checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Real-exported positive sample expectation checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real-exported positive sample expectation checkpoint smoke ok');
