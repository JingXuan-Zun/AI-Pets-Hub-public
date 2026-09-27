import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import {
  runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport,
  type AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode,
} from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0AcceptedIntakeCriteriaConsistencyInput =
  | 'accepted-intake-readiness-criteria-checkpoint'
  | 'field-completeness-audit'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract';

type P0AcceptedIntakeCriteriaConsistencySignal =
  | 'explicit-intake-dir-consistent-with-no-intake-dirs-status'
  | 'p0-target-support-consistent-with-p0-target-signals'
  | 'field-completeness-consistent-with-readiness-gate'
  | 'validator-readiness-consistent-with-gate-issue-codes'
  | 'runbook-completion-consistent-with-readiness-gate'
  | 'manual-only-criteria-consistent-with-production-gate';

type P0AcceptedIntakeCriteriaConsistencyBlocker =
  | 'no-explicit-intake-dirs'
  | 'p0-targets-missing'
  | 'field-completeness-not-interpretable'
  | 'validator-not-interpretable'
  | 'runbook-not-interpretable'
  | 'production-readiness-prohibited';

interface P0AcceptedIntakeCriteriaConsistencyRow {
  blockersNow: readonly P0AcceptedIntakeCriteriaConsistencyBlocker[];
  consistencyStatus: 'consistent-currently-blocked';
  gateIssueCodes: readonly AgentSessionV3PilotRealCorpusBatchIntakeReadinessGateIssueCode[];
  inputs: readonly P0AcceptedIntakeCriteriaConsistencyInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: P0AcceptedIntakeCriteriaConsistencySignal;
}

interface P0AcceptedIntakeCriteriaConsistencyCheckpoint {
  gate: 'p0-real-evidence-accepted-intake-criteria-consistency';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0AcceptedIntakeCriteriaConsistencyRow[];
  summaryDecision: 'criteria-consistent-but-no-accepted-intake-yet';
}

const p0AcceptedIntakeCriteriaConsistencyCheckpoint = {
  gate: 'p0-real-evidence-accepted-intake-criteria-consistency',
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
        'no-explicit-intake-dirs',
      ],
      consistencyStatus: 'consistent-currently-blocked',
      gateIssueCodes: [],
      inputs: [
        'accepted-intake-readiness-criteria-checkpoint',
        'intake-readiness-gate-report',
        'p0-intake-target-status-report',
        'p0-real-evidence-closeout-report',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'explicit-intake-dir-consistent-with-no-intake-dirs-status',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'p0-targets-missing',
      ],
      consistencyStatus: 'consistent-currently-blocked',
      gateIssueCodes: [
        'p0-entry-blocked',
        'p0-entry-missing',
        'p0-entry-review-needed',
        'p0-target-blocked',
        'p0-target-missing',
        'p0-target-review-needed',
      ],
      inputs: [
        'accepted-intake-readiness-criteria-checkpoint',
        'p0-intake-target-status-report',
        'intake-readiness-gate-report',
        'p0-real-evidence-closeout-report',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-target-support-consistent-with-p0-target-signals',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'field-completeness-not-interpretable',
      ],
      consistencyStatus: 'consistent-currently-blocked',
      gateIssueCodes: [
        'field-completeness-missing-entry',
        'field-completeness-open-fields',
      ],
      inputs: [
        'accepted-intake-readiness-criteria-checkpoint',
        'field-completeness-audit',
        'intake-readiness-gate-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'field-completeness-consistent-with-readiness-gate',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'validator-not-interpretable',
      ],
      consistencyStatus: 'consistent-currently-blocked',
      gateIssueCodes: [
        'validator-empty',
        'validator-missing',
        'validator-mixed',
        'validator-not-ready',
      ],
      inputs: [
        'accepted-intake-readiness-criteria-checkpoint',
        'intake-readiness-gate-report',
        'p0-real-evidence-closeout-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'validator-readiness-consistent-with-gate-issue-codes',
    },
    {
      blockersNow: [
        'no-explicit-intake-dirs',
        'runbook-not-interpretable',
      ],
      consistencyStatus: 'consistent-currently-blocked',
      gateIssueCodes: [
        'runbook-blocked',
        'runbook-missing-entry',
        'runbook-review-needed',
      ],
      inputs: [
        'accepted-intake-readiness-criteria-checkpoint',
        'runbook-completion-report',
        'intake-readiness-gate-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'runbook-completion-consistent-with-readiness-gate',
    },
    {
      blockersNow: [
        'production-readiness-prohibited',
      ],
      consistencyStatus: 'consistent-currently-blocked',
      gateIssueCodes: [],
      inputs: [
        'accepted-intake-readiness-criteria-checkpoint',
        'runtime-boundary-contract',
        'p0-real-evidence-closeout-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-only-criteria-consistent-with-production-gate',
    },
  ],
  summaryDecision: 'criteria-consistent-but-no-accepted-intake-yet',
} as const satisfies P0AcceptedIntakeCriteriaConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0AcceptedIntakeCriteriaConsistencySignal) {
  const row = p0AcceptedIntakeCriteriaConsistencyCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 accepted-intake criteria consistency checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: P0AcceptedIntakeCriteriaConsistencyBlocker) {
  return p0AcceptedIntakeCriteriaConsistencyCheckpoint.rows.filter((row) => row.blockersNow.includes(blocker));
}

function allGateIssueCodes() {
  return p0AcceptedIntakeCriteriaConsistencyCheckpoint.rows.flatMap((row) => row.gateIssueCodes);
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const acceptedCriteriaSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-readiness-criteria-checkpoint-smoke.ts',
);
const intakeReadinessGateSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
);
const p0TargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const p0CloseoutSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
);
const runbookCompletionSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
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

assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.productionAuthority, false);
assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.productionReady, false);
assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.manualInterpretationOnly, true);
assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(p0AcceptedIntakeCriteriaConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0AcceptedIntakeCriteriaConsistencyCheckpoint.summaryDecision,
  'criteria-consistent-but-no-accepted-intake-yet',
);

assert.deepEqual(
  p0AcceptedIntakeCriteriaConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'explicit-intake-dir-consistent-with-no-intake-dirs-status',
    'field-completeness-consistent-with-readiness-gate',
    'manual-only-criteria-consistent-with-production-gate',
    'p0-target-support-consistent-with-p0-target-signals',
    'runbook-completion-consistent-with-readiness-gate',
    'validator-readiness-consistent-with-gate-issue-codes',
  ],
);

for (const row of p0AcceptedIntakeCriteriaConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'consistent-currently-blocked');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.manualInterpretationOnly, true);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockersNow.length > 0);
}

assert.ok(rowsForBlocker('no-explicit-intake-dirs').length >= 5);
assert.equal(rowsForBlocker('p0-targets-missing').length, 1);
assert.equal(rowsForBlocker('field-completeness-not-interpretable').length, 1);
assert.equal(rowsForBlocker('validator-not-interpretable').length, 1);
assert.equal(rowsForBlocker('runbook-not-interpretable').length, 1);
assert.equal(rowsForBlocker('production-readiness-prohibited').length, 1);

assert.ok(rowForSignal('explicit-intake-dir-consistent-with-no-intake-dirs-status').gateIssueCodes.length === 0);
assert.ok(rowForSignal('p0-target-support-consistent-with-p0-target-signals').gateIssueCodes.includes('p0-target-missing'));
assert.ok(rowForSignal('field-completeness-consistent-with-readiness-gate').gateIssueCodes.includes('field-completeness-open-fields'));
assert.ok(rowForSignal('validator-readiness-consistent-with-gate-issue-codes').gateIssueCodes.includes('validator-not-ready'));
assert.ok(rowForSignal('runbook-completion-consistent-with-readiness-gate').gateIssueCodes.includes('runbook-review-needed'));
assert.ok(rowForSignal('manual-only-criteria-consistent-with-production-gate').inputs.includes('runtime-boundary-contract'));

for (const issueCode of allGateIssueCodes()) {
  assertContains(intakeReadinessGateSource, issueCode, 'intake readiness gate source');
}

assert.equal(fieldCompleteness.status, 'no-intake-dirs');
assert.equal(fieldCompleteness.readyForProductionRuntime, false);
assert.equal(fieldCompleteness.intakeCount, 0);
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-production-like-sample')));
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-exported-corpus')));

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.equal(intakeReadinessGate.intakeCount, 0);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);
assert.deepEqual(intakeReadinessGate.statusCounts, {
  blocked: 0,
  'ready-for-manual-review': 0,
  'review-needed': 0,
});

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

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');
assert.ok(p0Closeout.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')));
assert.ok(p0Closeout.p0TargetSignals.every((signal) => signal.status === 'missing'));

assert.equal(runbookCompletion.status, 'no-intake-dirs');
assert.equal(runbookCompletion.readyForProductionRuntime, false);
assert.equal(runbookCompletion.intakeCount, 0);
assert.deepEqual(runbookCompletion.statusCounts, {
  blocked: 0,
  'ready-for-manual-review': 0,
  'review-needed': 0,
});

assertContains(acceptedCriteriaSmokeSource, 'criteria-defined-but-no-accepted-intake-yet', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'explicit-intake-directory-required', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'p0-targets-must-be-supported', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'required-fields-must-be-complete', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'validator-and-readiness-must-be-reviewable', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'runbook-must-be-complete-or-reviewable', 'accepted-intake criteria checkpoint');
assertContains(acceptedCriteriaSmokeSource, 'accepted-intake-remains-manual-only', 'accepted-intake criteria checkpoint');

assertContains(intakeReadinessGateSource, 'ready-for-manual-review', 'intake readiness gate source');
assertContains(intakeReadinessGateSource, 'block runtime execution', 'intake readiness gate source');
assertContains(p0TargetStatusSource, 'ready-for-manual-review', 'P0 target status source');
assertContains(p0TargetStatusSource, 'real-production-like-sample', 'P0 target status source');
assertContains(p0TargetStatusSource, 'real-exported-corpus', 'P0 target status source');
assertContains(p0CloseoutSource, 'no explicit intake directories were supplied', 'P0 closeout source');
assertContains(p0CloseoutSource, 'ready-for-manual-review', 'P0 closeout source');
assertContains(runbookCompletionSource, 'runtime-authority', 'runbook completion source');
assertContains(runbookCompletionSource, 'runbook completion report is manual evidence only', 'runbook completion source');

assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(runbookText, 'Always pass each intake directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'the intake field completeness audit reports no open sample-note, manifest, or index fields for reviewed `--dir` values', 'runbook');
assertContains(runbookText, 'validator runs without `missing` or `empty` status', 'runbook');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');

assertContains(auditText, 'P0 Real-Evidence Accepted-Intake Criteria Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence accepted-intake criteria consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0AcceptedIntakeCriteriaConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 accepted-intake criteria consistency checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 accepted-intake criteria consistency checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 accepted-intake criteria consistency checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 accepted-intake criteria consistency checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 accepted-intake criteria consistency checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 accepted-intake criteria consistency checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 accepted-intake criteria consistency checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 accepted-intake criteria consistency checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence accepted-intake criteria consistency checkpoint smoke ok');
