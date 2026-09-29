import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchFinalGapReport } from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchGapActionChecklist } from './agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyInput =
  | 'criteria-to-evidence-fill-handoff-checkpoint'
  | 'final-gap-report'
  | 'gap-action-checklist'
  | 'intake-field-completeness-audit'
  | 'intake-filling-support-report'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract';

type P0AcceptedIntakeEvidenceFillHandoffGuardConsistencySignal =
  | 'manual-fill-guard-consistent-with-filling-support'
  | 'explicit-dir-guard-consistent-with-field-completeness'
  | 'p0-status-guard-consistent-with-explicit-dir-boundary'
  | 'readiness-gate-guard-consistent-with-manual-review'
  | 'no-runtime-action-order-consistent-with-gap-action-checklist'
  | 'non-production-guard-consistent-with-runbook-and-boundary';

type P0AcceptedIntakeEvidenceFillHandoffGuard =
  | 'caller-owned-dir-only'
  | 'manual-fill-only'
  | 'no-automatic-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness';

interface P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyRow {
  consistencyStatus: 'consistent-still-caller-owned';
  evidenceFillAuthority: false;
  guards: readonly P0AcceptedIntakeEvidenceFillHandoffGuard[];
  inputs: readonly P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: P0AcceptedIntakeEvidenceFillHandoffGuardConsistencySignal;
}

interface P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint {
  evidenceFillAuthority: false;
  gate: 'p0-real-evidence-accepted-intake-evidence-fill-handoff-guard-consistency';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyRow[];
  summaryDecision: 'evidence-fill-handoff-guards-consistent-caller-owned-only';
}

const sharedInputs = [
  'criteria-to-evidence-fill-handoff-checkpoint',
  'final-gap-report',
  'gap-action-checklist',
  'intake-filling-support-report',
  'intake-field-completeness-audit',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'runbook-completion-report',
  'real-corpus-runbook',
  'runtime-boundary-contract',
] as const satisfies readonly P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyInput[];

const p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint = {
  evidenceFillAuthority: false,
  gate: 'p0-real-evidence-accepted-intake-evidence-fill-handoff-guard-consistency',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      consistencyStatus: 'consistent-still-caller-owned',
      evidenceFillAuthority: false,
      guards: [
        'manual-fill-only',
        'no-automatic-sample-collection',
        'no-auto-fill',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'manual-fill-guard-consistent-with-filling-support',
    },
    {
      consistencyStatus: 'consistent-still-caller-owned',
      evidenceFillAuthority: false,
      guards: [
        'caller-owned-dir-only',
        'manual-fill-only',
        'no-auto-fill',
        'no-directory-discovery',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'explicit-dir-guard-consistent-with-field-completeness',
    },
    {
      consistencyStatus: 'consistent-still-caller-owned',
      evidenceFillAuthority: false,
      guards: [
        'caller-owned-dir-only',
        'no-directory-discovery',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-status-guard-consistent-with-explicit-dir-boundary',
    },
    {
      consistencyStatus: 'consistent-still-caller-owned',
      evidenceFillAuthority: false,
      guards: [
        'caller-owned-dir-only',
        'manual-fill-only',
        'no-production-readiness',
        'no-required-report-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'readiness-gate-guard-consistent-with-manual-review',
    },
    {
      consistencyStatus: 'consistent-still-caller-owned',
      evidenceFillAuthority: false,
      guards: [
        'manual-fill-only',
        'no-required-report-order',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'no-runtime-action-order-consistent-with-gap-action-checklist',
    },
    {
      consistencyStatus: 'consistent-still-caller-owned',
      evidenceFillAuthority: false,
      guards: [
        'no-automatic-sample-collection',
        'no-auto-fill',
        'no-production-readiness',
        'no-runtime-action-order',
      ],
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'non-production-guard-consistent-with-runbook-and-boundary',
    },
  ],
  summaryDecision: 'evidence-fill-handoff-guards-consistent-caller-owned-only',
} as const satisfies P0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0AcceptedIntakeEvidenceFillHandoffGuardConsistencySignal) {
  const row = p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 accepted-intake evidence-fill handoff guard consistency checkpoint.`);
  return row;
}

function rowsForGuard(guard: P0AcceptedIntakeEvidenceFillHandoffGuard) {
  return p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.rows
    .filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const evidenceFillHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-to-evidence-fill-handoff-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const finalGap = createAgentSessionV3PilotRealCorpusBatchFinalGapReport({ projectRoot });
const gapAction = createAgentSessionV3PilotRealCorpusBatchGapActionChecklist({ projectRoot });
const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({ projectRoot });
const fieldCompleteness = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });
const runbookCompletion = await runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.productionAuthority, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.productionReady, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.evidenceFillAuthority, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.summaryDecision,
  'evidence-fill-handoff-guards-consistent-caller-owned-only',
);

assert.deepEqual(
  p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'explicit-dir-guard-consistent-with-field-completeness',
    'manual-fill-guard-consistent-with-filling-support',
    'no-runtime-action-order-consistent-with-gap-action-checklist',
    'non-production-guard-consistent-with-runbook-and-boundary',
    'p0-status-guard-consistent-with-explicit-dir-boundary',
    'readiness-gate-guard-consistent-with-manual-review',
  ],
);

for (const row of p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'consistent-still-caller-owned');
  assert.equal(row.evidenceFillAuthority, false);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('caller-owned-dir-only').length >= 3);
assert.ok(rowsForGuard('manual-fill-only').length >= 4);
assert.ok(rowsForGuard('no-automatic-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-auto-fill').length >= 3);
assert.ok(rowsForGuard('no-directory-discovery').length >= 2);
assert.ok(rowsForGuard('no-required-report-order').length >= 2);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 3);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);

assert.ok(rowForSignal('manual-fill-guard-consistent-with-filling-support').guards.includes('no-auto-fill'));
assert.ok(rowForSignal('explicit-dir-guard-consistent-with-field-completeness').guards.includes('caller-owned-dir-only'));
assert.ok(rowForSignal('p0-status-guard-consistent-with-explicit-dir-boundary').guards.includes('no-directory-discovery'));
assert.ok(rowForSignal('readiness-gate-guard-consistent-with-manual-review').guards.includes('no-production-readiness'));
assert.ok(rowForSignal('no-runtime-action-order-consistent-with-gap-action-checklist').guards.includes('no-required-report-order'));
assert.ok(rowForSignal('non-production-guard-consistent-with-runbook-and-boundary').guards.includes('no-runtime-action-order'));

assert.equal(finalGap.status, 'missing-real-evidence');
assert.equal(finalGap.readyForProductionRuntime, false);
assert.ok(finalGap.finalGaps.some((gap) => gap.gapKind === 'real-production-like-sample' && gap.priority === 'P0'));
assert.ok(finalGap.finalGaps.some((gap) => gap.gapKind === 'real-exported-corpus' && gap.priority === 'P0'));
assertContains(finalGap.guardrail, 'does not discover directories', 'final gap guardrail');
assertContains(finalGap.guardrail, 'collect samples', 'final gap guardrail');
assertContains(finalGap.guardrail, 'define runtime action order', 'final gap guardrail');
assertContains(finalGap.guardrail, 'grant runtime authority', 'final gap guardrail');

assert.equal(gapAction.readyForProductionRuntime, false);
assert.ok(gapAction.actions.some((action) => action.gapKind === 'real-production-like-sample' && action.priority === 'P0'));
assert.ok(gapAction.actions.some((action) => action.gapKind === 'real-exported-corpus' && action.priority === 'P0'));
assertContains(gapAction.guardrail, 'does not collect samples', 'gap action checklist guardrail');
assertContains(gapAction.guardrail, 'not runtime action order', 'gap action checklist guardrail');
assertContains(gapAction.guardrail, 'grant runtime authority', 'gap action checklist guardrail');

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
assert.ok(
  fillingSupport.fillingItems
    .find((item) => item.gapKind === 'real-production-like-sample')
    ?.sampleNoteFields.some((field) => field.id === 'p0-production-like-signal'),
);
assert.ok(
  fillingSupport.fillingItems
    .find((item) => item.gapKind === 'real-exported-corpus')
    ?.sampleNoteFields.some((field) => field.id === 'p0-real-exported-signal'),
);
assertContains(fillingSupport.guardrail, 'does not discover directories', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'collect samples', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'auto-fill files', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'define runtime action order', 'intake filling support guardrail');

assert.equal(fieldCompleteness.status, 'no-intake-dirs');
assert.equal(fieldCompleteness.readyForProductionRuntime, false);
assert.equal(fieldCompleteness.intakeCount, 0);
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-production-like-sample')));
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-exported-corpus')));
assertContains(fieldCompleteness.guardrail, 'reads only explicitly supplied --dir intake directories', 'field completeness guardrail');
assertContains(fieldCompleteness.guardrail, 'does not discover directories', 'field completeness guardrail');
assertContains(fieldCompleteness.guardrail, 'auto-fill files', 'field completeness guardrail');
assertContains(fieldCompleteness.guardrail, 'define runtime action order', 'field completeness guardrail');

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.ok(p0TargetStatus.p0TargetSignals.every((signal) => signal.status === 'missing'));
assert.ok(
  p0TargetStatus.p0TargetSignals.every((signal) => signal.missingReason === 'no explicit intake directories supplied'),
);
assertContains(p0TargetStatus.guardrail, 'does not discover directories', 'P0 target status guardrail');
assertContains(p0TargetStatus.guardrail, 'collect samples', 'P0 target status guardrail');
assertContains(p0TargetStatus.guardrail, 'define runtime action order', 'P0 target status guardrail');

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.equal(intakeReadinessGate.intakeCount, 0);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);
assertContains(intakeReadinessGate.guardrail, 'reads only explicitly supplied --dir intake directories', 'readiness gate guardrail');
assertContains(intakeReadinessGate.guardrail, 'does not discover directories', 'readiness gate guardrail');
assertContains(intakeReadinessGate.guardrail, 'auto-fill files', 'readiness gate guardrail');
assertContains(intakeReadinessGate.guardrail, 'block runtime execution', 'readiness gate guardrail');
assertContains(intakeReadinessGate.guardrail, 'grant runtime authority', 'readiness gate guardrail');

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');
assertContains(p0Closeout.guardrail, 'does not discover directories', 'P0 closeout guardrail');
assertContains(p0Closeout.guardrail, 'collect samples', 'P0 closeout guardrail');
assertContains(p0Closeout.guardrail, 'define runtime action order', 'P0 closeout guardrail');

assert.equal(runbookCompletion.status, 'no-intake-dirs');
assert.equal(runbookCompletion.readyForProductionRuntime, false);
assert.equal(runbookCompletion.intakeCount, 0);
assertContains(runbookCompletion.guardrail, 'reads only explicitly supplied --dir intake directories', 'runbook completion guardrail');
assertContains(runbookCompletion.guardrail, 'auto-fill files', 'runbook completion guardrail');
assertContains(runbookCompletion.guardrail, 'define runtime action order', 'runbook completion guardrail');

assertContains(
  evidenceFillHandoffSmokeSource,
  'handoff-defined-evidence-fill-still-caller-owned',
  'criteria-to-evidence-fill handoff checkpoint',
);
assertContains(evidenceFillHandoffSmokeSource, 'manual-fill-only', 'criteria-to-evidence-fill handoff checkpoint');
assertContains(evidenceFillHandoffSmokeSource, 'no-required-report-order', 'criteria-to-evidence-fill handoff checkpoint');
assertContains(evidenceFillHandoffSmokeSource, 'no-runtime-action-order', 'criteria-to-evidence-fill handoff checkpoint');

assertContains(runbookText, 'Always pass each directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'They are manual prioritization aids, not a runtime action order.', 'runbook');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'P0 Real-Evidence Accepted-Intake Evidence-Fill Handoff Guard Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence accepted-intake evidence-fill handoff guard consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-evidence-fill-handoff-guard-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0AcceptedIntakeEvidenceFillHandoffGuardConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /evidenceFillAuthority":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 accepted-intake evidence-fill handoff guard consistency must not grant evidence-fill, production readiness, or runtime authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 accepted-intake evidence-fill handoff guard consistency must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoFill|collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 accepted-intake evidence-fill handoff guard consistency should not automate evidence filling or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 accepted-intake evidence-fill handoff guard consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 accepted-intake evidence-fill handoff guard consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 accepted-intake evidence-fill handoff guard consistency should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 accepted-intake evidence-fill handoff guard consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 accepted-intake evidence-fill handoff guard consistency must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence accepted-intake evidence-fill handoff guard consistency checkpoint smoke ok');
