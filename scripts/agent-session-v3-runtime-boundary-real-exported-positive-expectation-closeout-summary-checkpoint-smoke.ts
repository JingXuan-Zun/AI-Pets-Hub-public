import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchFinalGapReport } from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type RealExportedPositiveExpectationCloseoutInput =
  | 'final-gap-report'
  | 'intake-filling-support-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'positive-expectation-consistency-checkpoint'
  | 'positive-sample-expectation-checkpoint'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract'
  | 'source-declaration-gap-closeout-rollup-checkpoint';

type RealExportedPositiveExpectationCloseoutSignal =
  | 'positive-expectation-defined'
  | 'positive-expectation-consistency-aligned'
  | 'real-exported-corpus-still-caller-owned'
  | 'positive-sample-still-not-accepted'
  | 'production-gate-still-closed'
  | 'next-real-exported-evidence-fill-remains-caller-owned';

type RealExportedPositiveExpectationCloseoutGuard =
  | 'positive-expectation-closeout-only'
  | 'explicit-dir-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

type RealExportedPositiveExpectationCloseoutBlocker =
  | 'no-explicit-real-exported-intake'
  | 'no-positive-sample-accepted'
  | 'real-exported-corpus-gap-open'
  | 'caller-owned-evidence-fill-required'
  | 'production-readiness-prohibited'
  | 'runtime-authority-absent';

interface RealExportedPositiveExpectationCloseoutRow {
  blockersNow: readonly RealExportedPositiveExpectationCloseoutBlocker[];
  closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake';
  guards: readonly RealExportedPositiveExpectationCloseoutGuard[];
  inputs: readonly RealExportedPositiveExpectationCloseoutInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: RealExportedPositiveExpectationCloseoutSignal;
}

interface RealExportedPositiveExpectationCloseoutSummaryCheckpoint {
  gate: 'real-exported-positive-expectation-closeout-summary';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RealExportedPositiveExpectationCloseoutRow[];
  summaryDecision: 'real-exported-positive-expectation-chain-closed-no-sample-accepted';
}

const sharedInputs = [
  'positive-sample-expectation-checkpoint',
  'positive-expectation-consistency-checkpoint',
  'source-declaration-gap-closeout-rollup-checkpoint',
  'final-gap-report',
  'intake-filling-support-report',
  'p0-intake-target-status-report',
  'p0-real-evidence-closeout-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly RealExportedPositiveExpectationCloseoutInput[];

const realExportedPositiveExpectationCloseoutSummaryCheckpoint = {
  gate: 'real-exported-positive-expectation-closeout-summary',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockersNow: [
        'no-explicit-real-exported-intake',
        'no-positive-sample-accepted',
      ],
      closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake',
      guards: [
        'positive-expectation-closeout-only',
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
      signal: 'positive-expectation-defined',
    },
    {
      blockersNow: [
        'no-explicit-real-exported-intake',
        'no-positive-sample-accepted',
      ],
      closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake',
      guards: [
        'positive-expectation-closeout-only',
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
      signal: 'positive-expectation-consistency-aligned',
    },
    {
      blockersNow: [
        'real-exported-corpus-gap-open',
        'caller-owned-evidence-fill-required',
      ],
      closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake',
      guards: [
        'positive-expectation-closeout-only',
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
      signal: 'real-exported-corpus-still-caller-owned',
    },
    {
      blockersNow: [
        'no-positive-sample-accepted',
        'real-exported-corpus-gap-open',
      ],
      closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake',
      guards: [
        'positive-expectation-closeout-only',
        'no-sample-collection',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'positive-sample-still-not-accepted',
    },
    {
      blockersNow: [
        'production-readiness-prohibited',
        'runtime-authority-absent',
      ],
      closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake',
      guards: [
        'positive-expectation-closeout-only',
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
      signal: 'production-gate-still-closed',
    },
    {
      blockersNow: [
        'no-explicit-real-exported-intake',
        'caller-owned-evidence-fill-required',
      ],
      closeoutStatus: 'closed-out-waiting-for-caller-owned-real-exported-intake',
      guards: [
        'positive-expectation-closeout-only',
        'explicit-dir-only',
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
      signal: 'next-real-exported-evidence-fill-remains-caller-owned',
    },
  ],
  summaryDecision: 'real-exported-positive-expectation-chain-closed-no-sample-accepted',
} as const satisfies RealExportedPositiveExpectationCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: RealExportedPositiveExpectationCloseoutSignal) {
  const row = realExportedPositiveExpectationCloseoutSummaryCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the real-exported positive expectation closeout summary checkpoint.`);
  return row;
}

function rowsForGuard(guard: RealExportedPositiveExpectationCloseoutGuard) {
  return realExportedPositiveExpectationCloseoutSummaryCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: RealExportedPositiveExpectationCloseoutBlocker) {
  return realExportedPositiveExpectationCloseoutSummaryCheckpoint.rows.filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const positiveExpectationSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-sample-expectation-checkpoint-smoke.ts',
);
const consistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-expectation-consistency-checkpoint-smoke.ts',
);
const sourceGapCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-declaration-gap-closeout-rollup-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
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

assert.equal(realExportedPositiveExpectationCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(realExportedPositiveExpectationCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(realExportedPositiveExpectationCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(realExportedPositiveExpectationCloseoutSummaryCheckpoint.isExecutionOrder, false);
assert.equal(realExportedPositiveExpectationCloseoutSummaryCheckpoint.isImplementationPlan, false);
assert.equal(realExportedPositiveExpectationCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realExportedPositiveExpectationCloseoutSummaryCheckpoint.summaryDecision,
  'real-exported-positive-expectation-chain-closed-no-sample-accepted',
);

assert.deepEqual(
  realExportedPositiveExpectationCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'next-real-exported-evidence-fill-remains-caller-owned',
    'positive-expectation-consistency-aligned',
    'positive-expectation-defined',
    'positive-sample-still-not-accepted',
    'production-gate-still-closed',
    'real-exported-corpus-still-caller-owned',
  ],
);

for (const row of realExportedPositiveExpectationCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.closeoutStatus, 'closed-out-waiting-for-caller-owned-real-exported-intake');
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

assert.ok(rowsForGuard('positive-expectation-closeout-only').length === realExportedPositiveExpectationCloseoutSummaryCheckpoint.rows.length);
assert.ok(rowsForGuard('explicit-dir-only').length >= 4);
assert.ok(rowsForGuard('no-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 1);

assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 3);
assert.ok(rowsForBlocker('no-positive-sample-accepted').length >= 3);
assert.ok(rowsForBlocker('real-exported-corpus-gap-open').length >= 2);
assert.ok(rowsForBlocker('caller-owned-evidence-fill-required').length >= 2);
assert.equal(rowsForBlocker('production-readiness-prohibited').length, 1);
assert.equal(rowsForBlocker('runtime-authority-absent').length, 1);

assert.ok(rowForSignal('positive-expectation-defined').blockersNow.includes('no-positive-sample-accepted'));
assert.ok(rowForSignal('positive-expectation-consistency-aligned').guards.includes('no-auto-fill'));
assert.ok(rowForSignal('real-exported-corpus-still-caller-owned').blockersNow.includes('caller-owned-evidence-fill-required'));
assert.ok(rowForSignal('positive-sample-still-not-accepted').guards.includes('no-sample-collection'));
assert.equal(rowForSignal('production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('next-real-exported-evidence-fill-remains-caller-owned').isExecutionOrder, false);

assertContains(
  positiveExpectationSmokeSource,
  'real-exported-positive-sample-expectation-defined-no-sample-accepted',
  'positive expectation checkpoint',
);
assertContains(
  positiveExpectationSmokeSource,
  'positive-intake-must-be-explicit-caller-owned-dir',
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
assertContains(
  consistencySmokeSource,
  'real-exported-positive-expectation-consistent-no-sample-accepted',
  'positive expectation consistency checkpoint',
);
assertContains(
  consistencySmokeSource,
  'expectation-aligns-with-source-declaration-preflight',
  'positive expectation consistency checkpoint',
);
assertContains(
  consistencySmokeSource,
  'expectation-aligns-with-p0-target-status',
  'positive expectation consistency checkpoint',
);
assertContains(
  consistencySmokeSource,
  'expectation-consistency-remains-non-production',
  'positive expectation consistency checkpoint',
);
assertContains(
  sourceGapCloseoutSmokeSource,
  'source-declaration-gap-closeout-real-exported-still-required',
  'source declaration gap closeout checkpoint',
);

assert.equal(finalGap.status, 'missing-real-evidence');
assert.equal(finalGap.readyForProductionRuntime, false);
assert.ok(finalGap.finalGaps.some((gap) => gap.gapKind === 'real-exported-corpus' && gap.priority === 'P0'));

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
assert.ok(fillingSupport.fillingItems.some((item) => item.gapKind === 'real-exported-corpus'));
assert.match(fillingSupport.guardrail, /caller-owned intake filling support report only/u);
assert.match(fillingSupport.guardrail, /does not discover directories/u);
assert.match(fillingSupport.guardrail, /auto-fill files/u);

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
assert.ok(p0Closeout.closeoutReasons.includes('no explicit intake directories were supplied'));

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
  'Always pass each intake directory with `--dir`; this report does not discover directories',
  'runbook',
);
assertContains(
  runbookText,
  'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.',
  'runbook',
);
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Real-Exported Positive Expectation Closeout Summary Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary real-exported positive expectation closeout summary checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-exported-positive-expectation-closeout-summary-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realExportedPositiveExpectationCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Real-exported positive expectation closeout summary must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Real-exported positive expectation closeout summary must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Real-exported positive expectation closeout summary should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Real-exported positive expectation closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Real-exported positive expectation closeout summary should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Real-exported positive expectation closeout summary should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Real-exported positive expectation closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Real-exported positive expectation closeout summary must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real-exported positive expectation closeout summary checkpoint smoke ok');
