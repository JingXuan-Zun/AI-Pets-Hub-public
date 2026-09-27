import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0AcceptedIntakeCriteriaInput =
  | 'field-completeness-audit'
  | 'intake-filling-support-report'
  | 'intake-readiness-gate-report'
  | 'p0-intake-handoff-consistency-checkpoint'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract';

type P0AcceptedIntakeCriteriaSignal =
  | 'explicit-intake-directory-required'
  | 'p0-targets-must-be-supported'
  | 'required-fields-must-be-complete'
  | 'validator-and-readiness-must-be-reviewable'
  | 'runbook-must-be-complete-or-reviewable'
  | 'accepted-intake-remains-manual-only';

type P0AcceptedIntakeCriteriaBlocker =
  | 'no-explicit-intake-dirs'
  | 'p0-targets-missing'
  | 'field-completeness-not-run'
  | 'validator-not-run'
  | 'runbook-not-run'
  | 'readiness-gate-not-run'
  | 'production-readiness-prohibited';

interface P0AcceptedIntakeCriteriaRow {
  blockersWhenAbsent: readonly P0AcceptedIntakeCriteriaBlocker[];
  criteriaStatus: 'criteria-defined-currently-missing';
  inputs: readonly P0AcceptedIntakeCriteriaInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: P0AcceptedIntakeCriteriaSignal;
}

interface P0AcceptedIntakeReadinessCriteriaCheckpoint {
  gate: 'p0-real-evidence-accepted-intake-readiness-criteria';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0AcceptedIntakeCriteriaRow[];
  summaryDecision: 'criteria-defined-but-no-accepted-intake-yet';
}

const p0AcceptedIntakeReadinessCriteriaCheckpoint = {
  gate: 'p0-real-evidence-accepted-intake-readiness-criteria',
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
      blockersWhenAbsent: [
        'no-explicit-intake-dirs',
        'readiness-gate-not-run',
      ],
      criteriaStatus: 'criteria-defined-currently-missing',
      inputs: [
        'p0-intake-target-status-report',
        'intake-readiness-gate-report',
        'p0-real-evidence-closeout-report',
      ],
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'explicit-intake-directory-required',
    },
    {
      blockersWhenAbsent: [
        'p0-targets-missing',
        'no-explicit-intake-dirs',
      ],
      criteriaStatus: 'criteria-defined-currently-missing',
      inputs: [
        'p0-intake-target-status-report',
        'p0-intake-handoff-consistency-checkpoint',
        'real-corpus-runbook',
      ],
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-targets-must-be-supported',
    },
    {
      blockersWhenAbsent: [
        'field-completeness-not-run',
        'no-explicit-intake-dirs',
      ],
      criteriaStatus: 'criteria-defined-currently-missing',
      inputs: [
        'intake-filling-support-report',
        'field-completeness-audit',
        'real-corpus-runbook',
      ],
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'required-fields-must-be-complete',
    },
    {
      blockersWhenAbsent: [
        'validator-not-run',
        'readiness-gate-not-run',
        'no-explicit-intake-dirs',
      ],
      criteriaStatus: 'criteria-defined-currently-missing',
      inputs: [
        'intake-readiness-gate-report',
        'p0-real-evidence-closeout-report',
        'real-corpus-runbook',
      ],
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'validator-and-readiness-must-be-reviewable',
    },
    {
      blockersWhenAbsent: [
        'runbook-not-run',
        'no-explicit-intake-dirs',
      ],
      criteriaStatus: 'criteria-defined-currently-missing',
      inputs: [
        'runbook-completion-report',
        'real-corpus-runbook',
      ],
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'runbook-must-be-complete-or-reviewable',
    },
    {
      blockersWhenAbsent: [
        'production-readiness-prohibited',
        'p0-targets-missing',
      ],
      criteriaStatus: 'criteria-defined-currently-missing',
      inputs: [
        'runtime-boundary-contract',
        'p0-real-evidence-closeout-report',
        'p0-intake-handoff-consistency-checkpoint',
      ],
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'accepted-intake-remains-manual-only',
    },
  ],
  summaryDecision: 'criteria-defined-but-no-accepted-intake-yet',
} as const satisfies P0AcceptedIntakeReadinessCriteriaCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0AcceptedIntakeCriteriaSignal) {
  const row = p0AcceptedIntakeReadinessCriteriaCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 accepted-intake criteria checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: P0AcceptedIntakeCriteriaBlocker) {
  return p0AcceptedIntakeReadinessCriteriaCheckpoint.rows.filter((row) => row.blockersWhenAbsent.includes(blocker));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const handoffConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-handoff-consistency-checkpoint-smoke.ts',
);
const p0IntakeTargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const intakeReadinessGateSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
);
const runbookCompletionSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts',
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

assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.interpretationReadyNow, false);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.manualInterpretationOnly, true);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.productionAuthority, false);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.productionReady, false);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.positiveGateAllowed, false);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.isExecutionOrder, false);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.isImplementationPlan, false);
assert.equal(p0AcceptedIntakeReadinessCriteriaCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0AcceptedIntakeReadinessCriteriaCheckpoint.summaryDecision,
  'criteria-defined-but-no-accepted-intake-yet',
);

assert.deepEqual(
  p0AcceptedIntakeReadinessCriteriaCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'accepted-intake-remains-manual-only',
    'explicit-intake-directory-required',
    'p0-targets-must-be-supported',
    'required-fields-must-be-complete',
    'runbook-must-be-complete-or-reviewable',
    'validator-and-readiness-must-be-reviewable',
  ],
);

for (const row of p0AcceptedIntakeReadinessCriteriaCheckpoint.rows) {
  assert.equal(row.criteriaStatus, 'criteria-defined-currently-missing');
  assert.equal(row.interpretationReadyNow, false);
  assert.equal(row.manualInterpretationOnly, true);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockersWhenAbsent.length > 0);
}

assert.ok(rowsForBlocker('no-explicit-intake-dirs').length >= 5);
assert.ok(rowsForBlocker('p0-targets-missing').length >= 2);
assert.ok(rowsForBlocker('field-completeness-not-run').length === 1);
assert.ok(rowsForBlocker('validator-not-run').length === 1);
assert.ok(rowsForBlocker('runbook-not-run').length === 1);
assert.ok(rowsForBlocker('readiness-gate-not-run').length >= 2);
assert.ok(rowsForBlocker('production-readiness-prohibited').length === 1);

assert.ok(rowForSignal('explicit-intake-directory-required').inputs.includes('intake-readiness-gate-report'));
assert.ok(rowForSignal('p0-targets-must-be-supported').inputs.includes('p0-intake-target-status-report'));
assert.ok(rowForSignal('required-fields-must-be-complete').inputs.includes('field-completeness-audit'));
assert.ok(rowForSignal('validator-and-readiness-must-be-reviewable').inputs.includes('p0-real-evidence-closeout-report'));
assert.ok(rowForSignal('runbook-must-be-complete-or-reviewable').inputs.includes('runbook-completion-report'));
assert.ok(rowForSignal('accepted-intake-remains-manual-only').inputs.includes('runtime-boundary-contract'));

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
assert.ok(fillingSupport.fillingItems.some((item) => item.gapKind === 'real-production-like-sample'));
assert.ok(fillingSupport.fillingItems.some((item) => item.gapKind === 'real-exported-corpus'));

assert.equal(fieldCompleteness.status, 'no-intake-dirs');
assert.equal(fieldCompleteness.readyForProductionRuntime, false);
assert.equal(fieldCompleteness.intakeCount, 0);
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-production-like-sample')));
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-exported-corpus')));

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

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.equal(intakeReadinessGate.intakeCount, 0);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');
assert.ok(
  p0Closeout.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')),
  'P0 closeout should explain that accepted-intake criteria cannot be satisfied without explicit intake dirs.',
);

assert.equal(runbookCompletion.status, 'no-intake-dirs');
assert.equal(runbookCompletion.readyForProductionRuntime, false);
assert.equal(runbookCompletion.intakeCount, 0);
assert.deepEqual(runbookCompletion.statusCounts, {
  blocked: 0,
  'ready-for-manual-review': 0,
  'review-needed': 0,
});

assertContains(handoffConsistencySmokeSource, 'handoff-consistent-but-evidence-still-missing', 'handoff consistency checkpoint');
assertContains(handoffConsistencySmokeSource, 'same-caller-owned-intake-boundary', 'handoff consistency checkpoint');
assertContains(handoffConsistencySmokeSource, 'same-manual-interpretation-boundary', 'handoff consistency checkpoint');
assertContains(p0IntakeTargetStatusSource, 'ready-for-manual-review', 'P0 intake target status source');
assertContains(p0IntakeTargetStatusSource, 'real-production-like-sample', 'P0 intake target status source');
assertContains(p0IntakeTargetStatusSource, 'real-exported-corpus', 'P0 intake target status source');
assertContains(intakeReadinessGateSource, 'ready-for-manual-review', 'intake readiness gate source');
assertContains(intakeReadinessGateSource, 'block runtime execution', 'intake readiness gate source');
assertContains(runbookCompletionSource, 'ready-for-manual-review', 'runbook completion source');
assertContains(runbookCompletionSource, 'readyForProductionRuntime=false', 'runbook completion source');
assertContains(runbookText, 'Treat `ready-for-manual-review` as permission to interpret the evidence manually, not as production readiness.', 'runbook');
assertContains(runbookText, 'Always pass each intake directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'the intake field completeness audit reports no open sample-note, manifest, or index fields for reviewed `--dir` values', 'runbook');
assertContains(runbookText, 'validator runs without `missing` or `empty` status', 'runbook');

assertContains(auditText, 'P0 Real-Evidence Accepted-Intake Readiness Criteria Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence accepted-intake readiness criteria checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-readiness-criteria-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0AcceptedIntakeReadinessCriteriaCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReadyNow":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 accepted-intake criteria checkpoint must not grant interpretation, production readiness, or authority now.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 accepted-intake criteria checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 accepted-intake criteria checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 accepted-intake criteria checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 accepted-intake criteria checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 accepted-intake criteria checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 accepted-intake criteria checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 accepted-intake criteria checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence accepted-intake readiness criteria checkpoint smoke ok');
