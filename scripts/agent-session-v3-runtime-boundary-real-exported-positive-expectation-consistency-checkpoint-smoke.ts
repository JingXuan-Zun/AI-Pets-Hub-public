import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type RealExportedPositiveExpectationConsistencyInput =
  | 'intake-filling-support-report'
  | 'intake-template'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'positive-sample-expectation-checkpoint'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract'
  | 'source-declaration-gap-closeout-rollup-checkpoint'
  | 'source-declaration-preflight';

type RealExportedPositiveExpectationConsistencySignal =
  | 'expectation-aligns-with-intake-filling-support'
  | 'expectation-aligns-with-source-declaration-preflight'
  | 'expectation-aligns-with-p0-target-status'
  | 'expectation-aligns-with-p0-closeout'
  | 'expectation-aligns-with-runbook'
  | 'expectation-consistency-remains-non-production';

type RealExportedPositiveExpectationConsistencyGuard =
  | 'expectation-consistency-only'
  | 'explicit-dir-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

interface RealExportedPositiveExpectationConsistencyRow {
  consistencyStatus: 'consistent-but-no-positive-sample-accepted';
  guards: readonly RealExportedPositiveExpectationConsistencyGuard[];
  inputs: readonly RealExportedPositiveExpectationConsistencyInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  requiredAlignment: readonly string[];
  signal: RealExportedPositiveExpectationConsistencySignal;
}

interface RealExportedPositiveExpectationConsistencyCheckpoint {
  gate: 'real-exported-positive-expectation-consistency';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RealExportedPositiveExpectationConsistencyRow[];
  summaryDecision: 'real-exported-positive-expectation-consistent-no-sample-accepted';
}

const sharedInputs = [
  'positive-sample-expectation-checkpoint',
  'intake-filling-support-report',
  'source-declaration-preflight',
  'p0-intake-target-status-report',
  'p0-real-evidence-closeout-report',
  'real-corpus-runbook',
  'source-declaration-gap-closeout-rollup-checkpoint',
  'intake-template',
  'runtime-boundary-contract',
] as const satisfies readonly RealExportedPositiveExpectationConsistencyInput[];

const realExportedPositiveExpectationConsistencyCheckpoint = {
  gate: 'real-exported-positive-expectation-consistency',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      consistencyStatus: 'consistent-but-no-positive-sample-accepted',
      guards: [
        'expectation-consistency-only',
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
      requiredAlignment: [
        'real-exported-corpus filling item exposes sample-source and sample-source-status fields',
        'real-exported-corpus filling item exposes corpus file reference fields',
        'filling support remains manual and caller-owned',
      ],
      signal: 'expectation-aligns-with-intake-filling-support',
    },
    {
      consistencyStatus: 'consistent-but-no-positive-sample-accepted',
      guards: [
        'expectation-consistency-only',
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
      requiredAlignment: [
        'sampleSource real-exported maps to real-exported-evidence',
        'expected-source mismatch remains a blocker',
        'unknown sample source remains unresolved',
      ],
      signal: 'expectation-aligns-with-source-declaration-preflight',
    },
    {
      consistencyStatus: 'consistent-but-no-positive-sample-accepted',
      guards: [
        'expectation-consistency-only',
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
      requiredAlignment: [
        'P0 target status keeps real-exported-corpus missing without explicit intake dirs',
        'real-exported-corpus support requires real-exported sample source evidence',
      ],
      signal: 'expectation-aligns-with-p0-target-status',
    },
    {
      consistencyStatus: 'consistent-but-no-positive-sample-accepted',
      guards: [
        'expectation-consistency-only',
        'explicit-dir-only',
        'no-production-readiness',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredAlignment: [
        'P0 closeout remains no-intake-dirs without caller-owned dirs',
        'closeout does not convert reviewability into production readiness',
      ],
      signal: 'expectation-aligns-with-p0-closeout',
    },
    {
      consistencyStatus: 'consistent-but-no-positive-sample-accepted',
      guards: [
        'expectation-consistency-only',
        'explicit-dir-only',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      requiredAlignment: [
        'runbook requires explicit --dir for intake interpretation',
        'runbook keeps real-exported source declaration caller-owned',
        'runbook keeps ready-for-manual-review separate from production readiness',
      ],
      signal: 'expectation-aligns-with-runbook',
    },
    {
      consistencyStatus: 'consistent-but-no-positive-sample-accepted',
      guards: [
        'expectation-consistency-only',
        'no-sample-collection',
        'no-auto-fill',
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
      requiredAlignment: [
        'consistency checkpoint does not accept a positive sample',
        'consistency checkpoint does not add runtime adapter or controller authority',
      ],
      signal: 'expectation-consistency-remains-non-production',
    },
  ],
  summaryDecision: 'real-exported-positive-expectation-consistent-no-sample-accepted',
} as const satisfies RealExportedPositiveExpectationConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: RealExportedPositiveExpectationConsistencySignal) {
  const row = realExportedPositiveExpectationConsistencyCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the real-exported positive expectation consistency checkpoint.`);
  return row;
}

function rowsForGuard(guard: RealExportedPositiveExpectationConsistencyGuard) {
  return realExportedPositiveExpectationConsistencyCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const positiveExpectationSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-sample-expectation-checkpoint-smoke.ts',
);
const sourceDeclarationSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
);
const p0TargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const p0CloseoutSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
);
const intakeTemplateSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-template.ts',
);
const sourceGapCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-declaration-gap-closeout-rollup-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(realExportedPositiveExpectationConsistencyCheckpoint.productionAuthority, false);
assert.equal(realExportedPositiveExpectationConsistencyCheckpoint.productionReady, false);
assert.equal(realExportedPositiveExpectationConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(realExportedPositiveExpectationConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(realExportedPositiveExpectationConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(realExportedPositiveExpectationConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realExportedPositiveExpectationConsistencyCheckpoint.summaryDecision,
  'real-exported-positive-expectation-consistent-no-sample-accepted',
);

assert.deepEqual(
  realExportedPositiveExpectationConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'expectation-aligns-with-intake-filling-support',
    'expectation-aligns-with-p0-closeout',
    'expectation-aligns-with-p0-target-status',
    'expectation-aligns-with-runbook',
    'expectation-aligns-with-source-declaration-preflight',
    'expectation-consistency-remains-non-production',
  ],
);

for (const row of realExportedPositiveExpectationConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'consistent-but-no-positive-sample-accepted');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.requiredAlignment.length > 0);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('expectation-consistency-only').length === realExportedPositiveExpectationConsistencyCheckpoint.rows.length);
assert.ok(rowsForGuard('explicit-dir-only').length >= 5);
assert.ok(rowsForGuard('no-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 1);

assert.ok(
  rowForSignal('expectation-aligns-with-intake-filling-support')
    .requiredAlignment.includes('real-exported-corpus filling item exposes sample-source and sample-source-status fields'),
);
assert.ok(
  rowForSignal('expectation-aligns-with-source-declaration-preflight')
    .requiredAlignment.includes('sampleSource real-exported maps to real-exported-evidence'),
);
assert.ok(
  rowForSignal('expectation-aligns-with-p0-target-status')
    .requiredAlignment.includes('real-exported-corpus support requires real-exported sample source evidence'),
);
assert.ok(
  rowForSignal('expectation-aligns-with-p0-closeout')
    .requiredAlignment.includes('closeout does not convert reviewability into production readiness'),
);
assert.ok(
  rowForSignal('expectation-aligns-with-runbook')
    .requiredAlignment.includes('runbook keeps ready-for-manual-review separate from production readiness'),
);
assert.ok(rowForSignal('expectation-consistency-remains-non-production').guards.includes('no-runtime-authority'));

assertContains(
  positiveExpectationSmokeSource,
  'real-exported-positive-sample-expectation-defined-no-sample-accepted',
  'positive expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-intake-must-declare-real-exported-source',
  'positive expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-intake-must-declare-real-exported-status',
  'positive expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-intake-must-reference-exported-corpus-files',
  'positive expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-expectation-remains-non-production',
  'positive expectation checkpoint',
);

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
const realExportedFillingItem = fillingSupport.fillingItems.find((item) => item.gapKind === 'real-exported-corpus');
assert.ok(realExportedFillingItem, 'real-exported-corpus filling item should exist.');
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-source'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-source-status'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'corpus-paths'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'sample-count'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'validator-status'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'p0-target-status-command'));
assert.ok(realExportedFillingItem.sampleNoteFields.some((field) => field.id === 'p0-real-exported-signal'));
assert.ok(realExportedFillingItem.manifestFields.includes('sources[].path'));
assert.ok(realExportedFillingItem.indexFields.includes('batches[].manifestPath'));
assert.match(fillingSupport.guardrail, /does not discover directories/u);
assert.match(fillingSupport.guardrail, /auto-fill files/u);

assert.match(sourceDeclarationSource, /sampleSource === 'real-exported'/u);
assert.match(sourceDeclarationSource, /return 'real-exported-evidence'/u);
assert.match(sourceDeclarationSource, /expected-source-mismatch/u);
assert.match(sourceDeclarationSource, /unknown-sample-source/u);
assert.match(sourceDeclarationSource, /does not infer realness from file content/u);

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.deepEqual(
  p0TargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status, signal.missingReason]),
  [
    ['real-production-like-sample', 'missing', 'no explicit intake directories supplied'],
    ['real-exported-corpus', 'missing', 'no explicit intake directories supplied'],
  ],
);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSource === 'real-exported'/u);
assert.match(p0TargetStatusSource, /entry\.sourceSampleSourceStatus === 'real-exported-evidence'/u);
assert.match(p0TargetStatusSource, /no supplied intake has real-exported sample source evidence/u);
assert.match(p0TargetStatusSource, /does not discover directories/u);

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.ok(p0Closeout.closeoutReasons.includes('no explicit intake directories were supplied'));
assert.match(p0CloseoutSource, /does not discover directories/u);
assert.match(p0CloseoutSource, /readyForProductionRuntime: false/u);

assertContains(intakeTemplateSource, 'replace-with-sample-source-real-exported-rehearsal-or-unknown', 'intake template');
assertContains(intakeTemplateSource, 'replace-with-sample-source-status', 'intake template');
assertContains(intakeTemplateSource, 'real-corpus-manifest.json', 'intake template');
assertContains(intakeTemplateSource, 'corpus-batch-index.json', 'intake template');
assertContains(intakeTemplateSource, 'The template does not create or discover samples.', 'intake template');
assertContains(
  runbookText,
  'Always pass each intake directory with `--dir`; this report does not discover directories',
  'runbook',
);
assertContains(
  runbookText,
  'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.',
  'runbook',
);
assertContains(
  runbookText,
  'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.',
  'runbook',
);
assertContains(
  runbookText,
  'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.',
  'runbook',
);

assertContains(
  sourceGapCloseoutSmokeSource,
  'source-declaration-gap-closeout-real-exported-still-required',
  'source gap closeout checkpoint',
);
assertContains(
  sourceGapCloseoutSmokeSource,
  'complete-fields-do-not-close-source-gap',
  'source gap closeout checkpoint',
);
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Real-Exported Positive Expectation Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary real-exported positive expectation consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-exported-positive-expectation-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realExportedPositiveExpectationConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Real-exported positive expectation consistency checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Real-exported positive expectation consistency checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Real-exported positive expectation consistency checkpoint should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Real-exported positive expectation consistency checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Real-exported positive expectation consistency checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Real-exported positive expectation consistency checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Real-exported positive expectation consistency checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Real-exported positive expectation consistency checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real-exported positive expectation consistency checkpoint smoke ok');
