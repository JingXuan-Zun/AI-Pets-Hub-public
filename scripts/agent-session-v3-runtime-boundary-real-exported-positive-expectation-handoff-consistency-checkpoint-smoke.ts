import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type RealExportedPositiveExpectationHandoffConsistencyInput =
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'positive-expectation-closeout-summary'
  | 'positive-expectation-to-interpretation-handoff'
  | 'real-corpus-evidence-interpretation-readiness'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract';

type RealExportedPositiveExpectationHandoffConsistencySignal =
  | 'handoff-aligns-with-closeout-summary'
  | 'handoff-aligns-with-interpretation-readiness'
  | 'handoff-aligns-with-production-gate-mapping'
  | 'handoff-preserves-p0-real-exported-missing'
  | 'handoff-preserves-caller-owned-dir-boundary'
  | 'handoff-consistency-remains-non-production';

type RealExportedPositiveExpectationHandoffConsistencyGuard =
  | 'handoff-consistency-only'
  | 'explicit-dir-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

type RealExportedPositiveExpectationHandoffConsistencyBlocker =
  | 'caller-owned-evidence-fill-required'
  | 'manual-evidence-interpretation-not-ready'
  | 'missing-real-or-production-like-traces'
  | 'no-explicit-real-exported-intake'
  | 'no-positive-sample-accepted'
  | 'p0-real-exported-corpus-missing'
  | 'production-gate-closed';

interface RealExportedPositiveExpectationHandoffConsistencyRow {
  blockersNow: readonly RealExportedPositiveExpectationHandoffConsistencyBlocker[];
  consistencyStatus: 'consistent-interpretation-not-ready';
  guards: readonly RealExportedPositiveExpectationHandoffConsistencyGuard[];
  inputs: readonly RealExportedPositiveExpectationHandoffConsistencyInput[];
  interpretationReady: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: RealExportedPositiveExpectationHandoffConsistencySignal;
}

interface RealExportedPositiveExpectationHandoffConsistencyCheckpoint {
  gate: 'real-exported-positive-expectation-handoff-consistency';
  interpretationReady: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RealExportedPositiveExpectationHandoffConsistencyRow[];
  summaryDecision: 'real-exported-positive-expectation-handoff-consistent-interpretation-not-ready';
}

const sharedInputs = [
  'positive-expectation-closeout-summary',
  'positive-expectation-to-interpretation-handoff',
  'real-corpus-evidence-interpretation-readiness',
  'evidence-interpretation-to-production-gate-mapping',
  'package-health-rollup',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly RealExportedPositiveExpectationHandoffConsistencyInput[];

const realExportedPositiveExpectationHandoffConsistencyCheckpoint = {
  gate: 'real-exported-positive-expectation-handoff-consistency',
  interpretationReady: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockersNow: [
        'no-positive-sample-accepted',
        'no-explicit-real-exported-intake',
      ],
      consistencyStatus: 'consistent-interpretation-not-ready',
      guards: [
        'handoff-consistency-only',
        'no-sample-collection',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-aligns-with-closeout-summary',
    },
    {
      blockersNow: [
        'manual-evidence-interpretation-not-ready',
        'no-explicit-real-exported-intake',
      ],
      consistencyStatus: 'consistent-interpretation-not-ready',
      guards: [
        'handoff-consistency-only',
        'explicit-dir-only',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-aligns-with-interpretation-readiness',
    },
    {
      blockersNow: [
        'missing-real-or-production-like-traces',
        'production-gate-closed',
      ],
      consistencyStatus: 'consistent-interpretation-not-ready',
      guards: [
        'handoff-consistency-only',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-aligns-with-production-gate-mapping',
    },
    {
      blockersNow: [
        'p0-real-exported-corpus-missing',
        'no-positive-sample-accepted',
      ],
      consistencyStatus: 'consistent-interpretation-not-ready',
      guards: [
        'handoff-consistency-only',
        'explicit-dir-only',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-preserves-p0-real-exported-missing',
    },
    {
      blockersNow: [
        'no-explicit-real-exported-intake',
        'caller-owned-evidence-fill-required',
      ],
      consistencyStatus: 'consistent-interpretation-not-ready',
      guards: [
        'handoff-consistency-only',
        'explicit-dir-only',
        'no-directory-discovery',
        'no-required-report-order',
      ],
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-preserves-caller-owned-dir-boundary',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'manual-evidence-interpretation-not-ready',
      ],
      consistencyStatus: 'consistent-interpretation-not-ready',
      guards: [
        'handoff-consistency-only',
        'no-runtime-action-order',
        'no-required-report-order',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-consistency-remains-non-production',
    },
  ],
  summaryDecision: 'real-exported-positive-expectation-handoff-consistent-interpretation-not-ready',
} as const satisfies RealExportedPositiveExpectationHandoffConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: RealExportedPositiveExpectationHandoffConsistencySignal) {
  const row = realExportedPositiveExpectationHandoffConsistencyCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the real-exported positive expectation handoff consistency checkpoint.`);
  return row;
}

function rowsForGuard(guard: RealExportedPositiveExpectationHandoffConsistencyGuard) {
  return realExportedPositiveExpectationHandoffConsistencyCheckpoint.rows
    .filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: RealExportedPositiveExpectationHandoffConsistencyBlocker) {
  return realExportedPositiveExpectationHandoffConsistencyCheckpoint.rows
    .filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-expectation-closeout-summary-checkpoint-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-expectation-to-interpretation-handoff-checkpoint-smoke.ts',
);
const interpretationReadinessSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-corpus-evidence-interpretation-readiness-checkpoint-smoke.ts',
);
const interpretationGateMappingSmokeSource = readProjectFile(
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

assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.interpretationReady, false);
assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.productionAuthority, false);
assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.productionReady, false);
assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(realExportedPositiveExpectationHandoffConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realExportedPositiveExpectationHandoffConsistencyCheckpoint.summaryDecision,
  'real-exported-positive-expectation-handoff-consistent-interpretation-not-ready',
);

assert.deepEqual(
  realExportedPositiveExpectationHandoffConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'handoff-aligns-with-closeout-summary',
    'handoff-aligns-with-interpretation-readiness',
    'handoff-aligns-with-production-gate-mapping',
    'handoff-consistency-remains-non-production',
    'handoff-preserves-caller-owned-dir-boundary',
    'handoff-preserves-p0-real-exported-missing',
  ],
);

for (const row of realExportedPositiveExpectationHandoffConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'consistent-interpretation-not-ready');
  assert.equal(row.interpretationReady, false);
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
  rowsForGuard('handoff-consistency-only').length,
  realExportedPositiveExpectationHandoffConsistencyCheckpoint.rows.length,
);
assert.ok(rowsForGuard('explicit-dir-only').length >= 3);
assert.ok(rowsForGuard('no-sample-collection').length >= 1);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 2);
assert.ok(rowsForGuard('no-required-report-order').length >= 2);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 1);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 2);

assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 3);
assert.ok(rowsForBlocker('no-positive-sample-accepted').length >= 2);
assert.ok(rowsForBlocker('manual-evidence-interpretation-not-ready').length >= 2);
assert.ok(rowsForBlocker('p0-real-exported-corpus-missing').length >= 1);
assert.ok(rowsForBlocker('missing-real-or-production-like-traces').length >= 1);
assert.ok(rowsForBlocker('production-gate-closed').length >= 2);
assert.ok(rowsForBlocker('caller-owned-evidence-fill-required').length >= 1);

assert.ok(rowForSignal('handoff-aligns-with-closeout-summary').inputs.includes('positive-expectation-closeout-summary'));
assert.ok(rowForSignal('handoff-aligns-with-closeout-summary').blockersNow.includes('no-positive-sample-accepted'));
assert.ok(rowForSignal('handoff-aligns-with-interpretation-readiness').inputs.includes('real-corpus-evidence-interpretation-readiness'));
assert.ok(rowForSignal('handoff-aligns-with-interpretation-readiness').blockersNow.includes('manual-evidence-interpretation-not-ready'));
assert.ok(rowForSignal('handoff-aligns-with-production-gate-mapping').inputs.includes('evidence-interpretation-to-production-gate-mapping'));
assert.ok(rowForSignal('handoff-aligns-with-production-gate-mapping').blockersNow.includes('production-gate-closed'));
assert.ok(rowForSignal('handoff-preserves-p0-real-exported-missing').blockersNow.includes('p0-real-exported-corpus-missing'));
assert.ok(rowForSignal('handoff-preserves-caller-owned-dir-boundary').guards.includes('explicit-dir-only'));
assert.equal(rowForSignal('handoff-consistency-remains-non-production').positiveGateAllowed, false);

assertContains(
  closeoutSummarySmokeSource,
  'real-exported-positive-expectation-chain-closed-no-sample-accepted',
  'positive expectation closeout summary',
);
assertContains(
  closeoutSummarySmokeSource,
  'positive-sample-still-not-accepted',
  'positive expectation closeout summary',
);
assertContains(
  closeoutSummarySmokeSource,
  'real-exported-corpus-still-caller-owned',
  'positive expectation closeout summary',
);
assertContains(
  handoffSmokeSource,
  'real-exported-positive-expectation-handed-off-interpretation-not-ready',
  'positive expectation handoff',
);
assertContains(
  handoffSmokeSource,
  'closed-expectation-chain-enters-interpretation-readiness',
  'positive expectation handoff',
);
assertContains(
  handoffSmokeSource,
  'handoff-remains-report-only',
  'positive expectation handoff',
);
assertContains(
  interpretationReadinessSmokeSource,
  'manual-evidence-interpretation-not-ready',
  'interpretation readiness checkpoint',
);
assertContains(
  interpretationReadinessSmokeSource,
  'p0-target-real-exported-corpus-missing',
  'interpretation readiness checkpoint',
);
assertContains(
  interpretationReadinessSmokeSource,
  'caller-owned-intake-dir-required',
  'interpretation readiness checkpoint',
);
assertContains(
  interpretationGateMappingSmokeSource,
  'mapping-only-positive-gate-remains-closed',
  'interpretation to production gate mapping checkpoint',
);
assertContains(
  interpretationGateMappingSmokeSource,
  'missing-real-or-production-like-traces',
  'interpretation to production gate mapping checkpoint',
);

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.readyForProductionRuntime, false);
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
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);
assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');

assertContains(
  runbookText,
  'The next decision after this runbook is evidence interpretation, not production wiring.',
  'runbook',
);
assertContains(
  runbookText,
  'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.',
  'runbook',
);
assertContains(
  runbookText,
  'Always pass each intake directory with `--dir`; this report does not discover directories',
  'runbook',
);
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Real-Exported Positive Expectation Handoff Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary real-exported positive expectation handoff consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-exported-positive-expectation-handoff-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realExportedPositiveExpectationHandoffConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReady":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Real-exported positive expectation handoff consistency must not grant interpretation readiness, production readiness, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Real-exported positive expectation handoff consistency must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Real-exported positive expectation handoff consistency should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Real-exported positive expectation handoff consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Real-exported positive expectation handoff consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Real-exported positive expectation handoff consistency should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Real-exported positive expectation handoff consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Real-exported positive expectation handoff consistency must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real-exported positive expectation handoff consistency checkpoint smoke ok');
