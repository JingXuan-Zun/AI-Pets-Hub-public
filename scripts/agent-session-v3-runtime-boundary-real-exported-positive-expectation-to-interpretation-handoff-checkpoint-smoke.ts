import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type RealExportedPositiveExpectationInterpretationHandoffInput =
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'positive-expectation-closeout-summary'
  | 'real-corpus-evidence-interpretation-readiness'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract';

type RealExportedPositiveExpectationInterpretationHandoffSignal =
  | 'closed-expectation-chain-enters-interpretation-readiness'
  | 'expectation-closeout-does-not-accept-sample'
  | 'interpretation-readiness-still-blocked'
  | 'p0-real-exported-target-still-missing'
  | 'production-gate-mapping-still-negative'
  | 'handoff-remains-report-only';

type RealExportedPositiveExpectationInterpretationHandoffGuard =
  | 'handoff-only'
  | 'explicit-dir-only'
  | 'no-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness'
  | 'no-runtime-authority';

type RealExportedPositiveExpectationInterpretationHandoffBlocker =
  | 'no-explicit-real-exported-intake'
  | 'no-positive-sample-accepted'
  | 'manual-evidence-interpretation-not-ready'
  | 'p0-real-exported-corpus-missing'
  | 'missing-real-or-production-like-traces'
  | 'production-gate-closed';

interface RealExportedPositiveExpectationInterpretationHandoffRow {
  blockersNow: readonly RealExportedPositiveExpectationInterpretationHandoffBlocker[];
  guards: readonly RealExportedPositiveExpectationInterpretationHandoffGuard[];
  handoffStatus: 'handed-off-interpretation-not-ready';
  inputs: readonly RealExportedPositiveExpectationInterpretationHandoffInput[];
  interpretationReady: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: RealExportedPositiveExpectationInterpretationHandoffSignal;
}

interface RealExportedPositiveExpectationInterpretationHandoffCheckpoint {
  gate: 'real-exported-positive-expectation-to-interpretation-handoff';
  interpretationReady: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RealExportedPositiveExpectationInterpretationHandoffRow[];
  summaryDecision: 'real-exported-positive-expectation-handed-off-interpretation-not-ready';
}

const sharedInputs = [
  'positive-expectation-closeout-summary',
  'real-corpus-evidence-interpretation-readiness',
  'evidence-interpretation-to-production-gate-mapping',
  'package-health-rollup',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly RealExportedPositiveExpectationInterpretationHandoffInput[];

const realExportedPositiveExpectationInterpretationHandoffCheckpoint = {
  gate: 'real-exported-positive-expectation-to-interpretation-handoff',
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
        'no-explicit-real-exported-intake',
        'manual-evidence-interpretation-not-ready',
      ],
      guards: [
        'handoff-only',
        'explicit-dir-only',
        'no-required-report-order',
      ],
      handoffStatus: 'handed-off-interpretation-not-ready',
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'closed-expectation-chain-enters-interpretation-readiness',
    },
    {
      blockersNow: [
        'no-positive-sample-accepted',
        'p0-real-exported-corpus-missing',
      ],
      guards: [
        'handoff-only',
        'no-sample-collection',
        'no-auto-fill',
      ],
      handoffStatus: 'handed-off-interpretation-not-ready',
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'expectation-closeout-does-not-accept-sample',
    },
    {
      blockersNow: [
        'manual-evidence-interpretation-not-ready',
        'no-explicit-real-exported-intake',
      ],
      guards: [
        'handoff-only',
        'explicit-dir-only',
        'no-directory-discovery',
      ],
      handoffStatus: 'handed-off-interpretation-not-ready',
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'interpretation-readiness-still-blocked',
    },
    {
      blockersNow: [
        'p0-real-exported-corpus-missing',
        'no-positive-sample-accepted',
      ],
      guards: [
        'handoff-only',
        'explicit-dir-only',
        'no-auto-fill',
      ],
      handoffStatus: 'handed-off-interpretation-not-ready',
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-real-exported-target-still-missing',
    },
    {
      blockersNow: [
        'missing-real-or-production-like-traces',
        'production-gate-closed',
      ],
      guards: [
        'handoff-only',
        'no-production-readiness',
        'no-runtime-authority',
      ],
      handoffStatus: 'handed-off-interpretation-not-ready',
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'production-gate-mapping-still-negative',
    },
    {
      blockersNow: [
        'production-gate-closed',
        'manual-evidence-interpretation-not-ready',
      ],
      guards: [
        'handoff-only',
        'no-sample-collection',
        'no-runtime-action-order',
        'no-production-readiness',
      ],
      handoffStatus: 'handed-off-interpretation-not-ready',
      inputs: sharedInputs,
      interpretationReady: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-remains-report-only',
    },
  ],
  summaryDecision: 'real-exported-positive-expectation-handed-off-interpretation-not-ready',
} as const satisfies RealExportedPositiveExpectationInterpretationHandoffCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: RealExportedPositiveExpectationInterpretationHandoffSignal) {
  const row = realExportedPositiveExpectationInterpretationHandoffCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the real-exported positive expectation interpretation handoff checkpoint.`);
  return row;
}

function rowsForGuard(guard: RealExportedPositiveExpectationInterpretationHandoffGuard) {
  return realExportedPositiveExpectationInterpretationHandoffCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

function rowsForBlocker(blocker: RealExportedPositiveExpectationInterpretationHandoffBlocker) {
  return realExportedPositiveExpectationInterpretationHandoffCheckpoint.rows.filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-exported-positive-expectation-closeout-summary-checkpoint-smoke.ts',
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

assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.interpretationReady, false);
assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.productionAuthority, false);
assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.productionReady, false);
assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.positiveGateAllowed, false);
assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.isExecutionOrder, false);
assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.isImplementationPlan, false);
assert.equal(realExportedPositiveExpectationInterpretationHandoffCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realExportedPositiveExpectationInterpretationHandoffCheckpoint.summaryDecision,
  'real-exported-positive-expectation-handed-off-interpretation-not-ready',
);

assert.deepEqual(
  realExportedPositiveExpectationInterpretationHandoffCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'closed-expectation-chain-enters-interpretation-readiness',
    'expectation-closeout-does-not-accept-sample',
    'handoff-remains-report-only',
    'interpretation-readiness-still-blocked',
    'p0-real-exported-target-still-missing',
    'production-gate-mapping-still-negative',
  ],
);

for (const row of realExportedPositiveExpectationInterpretationHandoffCheckpoint.rows) {
  assert.equal(row.handoffStatus, 'handed-off-interpretation-not-ready');
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

assert.ok(rowsForGuard('handoff-only').length === realExportedPositiveExpectationInterpretationHandoffCheckpoint.rows.length);
assert.ok(rowsForGuard('explicit-dir-only').length >= 3);
assert.ok(rowsForGuard('no-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 1);
assert.ok(rowsForGuard('no-required-report-order').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 1);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-runtime-authority').length >= 1);

assert.ok(rowsForBlocker('no-explicit-real-exported-intake').length >= 2);
assert.ok(rowsForBlocker('no-positive-sample-accepted').length >= 2);
assert.ok(rowsForBlocker('manual-evidence-interpretation-not-ready').length >= 3);
assert.ok(rowsForBlocker('p0-real-exported-corpus-missing').length >= 2);
assert.equal(rowsForBlocker('missing-real-or-production-like-traces').length, 1);
assert.ok(rowsForBlocker('production-gate-closed').length >= 2);

assert.ok(rowForSignal('closed-expectation-chain-enters-interpretation-readiness').inputs.includes('positive-expectation-closeout-summary'));
assert.ok(rowForSignal('closed-expectation-chain-enters-interpretation-readiness').inputs.includes('real-corpus-evidence-interpretation-readiness'));
assert.ok(rowForSignal('expectation-closeout-does-not-accept-sample').blockersNow.includes('no-positive-sample-accepted'));
assert.ok(rowForSignal('interpretation-readiness-still-blocked').blockersNow.includes('manual-evidence-interpretation-not-ready'));
assert.ok(rowForSignal('p0-real-exported-target-still-missing').blockersNow.includes('p0-real-exported-corpus-missing'));
assert.ok(rowForSignal('production-gate-mapping-still-negative').inputs.includes('evidence-interpretation-to-production-gate-mapping'));
assert.equal(rowForSignal('handoff-remains-report-only').isExecutionOrder, false);

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

assertContains(auditText, 'Real-Exported Positive Expectation To Evidence-Interpretation Handoff Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary real-exported positive expectation to evidence-interpretation handoff checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-exported-positive-expectation-to-interpretation-handoff-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realExportedPositiveExpectationInterpretationHandoffCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReady":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Real-exported positive expectation handoff must not grant interpretation readiness, production readiness, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'Real-exported positive expectation handoff must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Real-exported positive expectation handoff should not collect samples or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Real-exported positive expectation handoff should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Real-exported positive expectation handoff should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Real-exported positive expectation handoff should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Real-exported positive expectation handoff must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Real-exported positive expectation handoff must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real-exported positive expectation to interpretation handoff checkpoint smoke ok');
