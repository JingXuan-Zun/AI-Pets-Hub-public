import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0AcceptedIntakeCriteriaCloseoutInput =
  | 'accepted-intake-criteria-consistency-checkpoint'
  | 'accepted-intake-readiness-criteria-checkpoint'
  | 'field-completeness-audit'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract';

type P0AcceptedIntakeCriteriaCloseoutSignal =
  | 'readiness-criteria-defined'
  | 'criteria-consistency-aligned'
  | 'accepted-intake-still-absent'
  | 'manual-interpretation-still-blocked'
  | 'production-gate-still-closed'
  | 'next-evidence-fill-remains-caller-owned';

type P0AcceptedIntakeCriteriaCloseoutBlocker =
  | 'no-explicit-intake-dirs'
  | 'no-accepted-intake'
  | 'p0-targets-missing'
  | 'reports-not-interpretable'
  | 'manual-interpretation-not-open'
  | 'production-readiness-prohibited';

interface P0AcceptedIntakeCriteriaCloseoutRow {
  blockersNow: readonly P0AcceptedIntakeCriteriaCloseoutBlocker[];
  closeoutStatus: 'closed-out-currently-blocked';
  inputs: readonly P0AcceptedIntakeCriteriaCloseoutInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationReady: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: P0AcceptedIntakeCriteriaCloseoutSignal;
}

interface P0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint {
  gate: 'p0-real-evidence-accepted-intake-criteria-closeout-summary';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationReady: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0AcceptedIntakeCriteriaCloseoutRow[];
  summaryDecision: 'accepted-intake-criteria-chain-closed-no-accepted-intake';
}

const sharedInputs = [
  'accepted-intake-readiness-criteria-checkpoint',
  'accepted-intake-criteria-consistency-checkpoint',
  'field-completeness-audit',
  'intake-readiness-gate-report',
  'p0-intake-target-status-report',
  'p0-real-evidence-closeout-report',
  'runbook-completion-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly P0AcceptedIntakeCriteriaCloseoutInput[];

const p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint = {
  gate: 'p0-real-evidence-accepted-intake-criteria-closeout-summary',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationReady: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'no-accepted-intake',
      ],
      closeoutStatus: 'closed-out-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationReady: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'readiness-criteria-defined',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'reports-not-interpretable',
      ],
      closeoutStatus: 'closed-out-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationReady: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'criteria-consistency-aligned',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'no-accepted-intake',
        'p0-targets-missing',
      ],
      closeoutStatus: 'closed-out-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationReady: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'accepted-intake-still-absent',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'reports-not-interpretable',
        'manual-interpretation-not-open',
      ],
      closeoutStatus: 'closed-out-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationReady: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-interpretation-still-blocked',
    },
    {
      blockersNow: [
        'production-readiness-prohibited',
      ],
      closeoutStatus: 'closed-out-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationReady: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'production-gate-still-closed',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'no-accepted-intake',
      ],
      closeoutStatus: 'closed-out-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationReady: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'next-evidence-fill-remains-caller-owned',
    },
  ],
  summaryDecision: 'accepted-intake-criteria-chain-closed-no-accepted-intake',
} as const satisfies P0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0AcceptedIntakeCriteriaCloseoutSignal) {
  const row = p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 accepted-intake criteria closeout summary checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: P0AcceptedIntakeCriteriaCloseoutBlocker) {
  return p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.rows.filter((row) => row.blockersNow.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const acceptedCriteriaSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-readiness-criteria-checkpoint-smoke.ts',
);
const criteriaConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-consistency-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const fieldCompleteness = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({ projectRoot });
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });
const runbookCompletion = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.productionAuthority, false);
assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.productionReady, false);
assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.positiveGateAllowed, false);
assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.manualInterpretationReady, false);
assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.isExecutionOrder, false);
assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.isImplementationPlan, false);
assert.equal(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.summaryDecision,
  'accepted-intake-criteria-chain-closed-no-accepted-intake',
);

assert.deepEqual(
  p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'accepted-intake-still-absent',
    'criteria-consistency-aligned',
    'manual-interpretation-still-blocked',
    'next-evidence-fill-remains-caller-owned',
    'production-gate-still-closed',
    'readiness-criteria-defined',
  ],
);

for (const row of p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint.rows) {
  assert.equal(row.closeoutStatus, 'closed-out-currently-blocked');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.manualInterpretationReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.blockersNow.length > 0);
}

assert.ok(rowsForBlocker('no-explicit-intake-dirs').length >= 5);
assert.ok(rowsForBlocker('no-accepted-intake').length >= 3);
assert.equal(rowsForBlocker('p0-targets-missing').length, 1);
assert.ok(rowsForBlocker('reports-not-interpretable').length >= 2);
assert.equal(rowsForBlocker('manual-interpretation-not-open').length, 1);
assert.equal(rowsForBlocker('production-readiness-prohibited').length, 1);

assert.equal(rowForSignal('readiness-criteria-defined').manualInterpretationReady, false);
assert.equal(rowForSignal('criteria-consistency-aligned').productionReady, false);
assert.ok(rowForSignal('accepted-intake-still-absent').blockersNow.includes('p0-targets-missing'));
assert.ok(rowForSignal('manual-interpretation-still-blocked').blockersNow.includes('manual-interpretation-not-open'));
assert.equal(rowForSignal('production-gate-still-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('next-evidence-fill-remains-caller-owned').isExecutionOrder, false);

assert.equal(fieldCompleteness.status, 'no-intake-dirs');
assert.equal(fieldCompleteness.readyForProductionRuntime, false);
assert.equal(fieldCompleteness.intakeCount, 0);

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.equal(intakeReadinessGate.intakeCount, 0);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.deepEqual(p0TargetStatus.p0TargetGapKinds, [
  'real-production-like-sample',
  'real-exported-corpus',
]);
assert.ok(p0TargetStatus.p0TargetSignals.every((signal) => signal.status === 'missing'));
assert.ok(
  p0TargetStatus.p0TargetSignals.every((signal) => signal.missingReason === 'no explicit intake directories supplied'),
);

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');
assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')));

assert.equal(runbookCompletion.status, 'no-intake-dirs');
assert.equal(runbookCompletion.readyForProductionRuntime, false);
assert.equal(runbookCompletion.intakeCount, 0);

assertContains(acceptedCriteriaSmokeSource, 'criteria-defined-but-no-accepted-intake-yet', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'accepted-intake-remains-manual-only', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'interpretationReadyNow, false', 'accepted-intake criteria checkpoint');
assertContains(criteriaConsistencySmokeSource, 'criteria-consistent-but-no-accepted-intake-yet', 'criteria consistency checkpoint');
assertContains(criteriaConsistencySmokeSource, 'manual-only-criteria-consistent-with-production-gate', 'criteria consistency checkpoint');
assertContains(criteriaConsistencySmokeSource, 'production-readiness-prohibited', 'criteria consistency checkpoint');

assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(runbookText, 'Always pass each intake directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'P0 Real-Evidence Accepted-Intake Criteria Closeout Summary Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence accepted-intake criteria closeout summary checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-closeout-summary-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0AcceptedIntakeCriteriaCloseoutSummaryCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /manualInterpretationReady":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 accepted-intake criteria closeout summary must not grant manual interpretation, production readiness, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 accepted-intake criteria closeout summary must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 accepted-intake criteria closeout summary should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 accepted-intake criteria closeout summary should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 accepted-intake criteria closeout summary should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 accepted-intake criteria closeout summary should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 accepted-intake criteria closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 accepted-intake criteria closeout summary must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence accepted-intake criteria closeout summary checkpoint smoke ok');
