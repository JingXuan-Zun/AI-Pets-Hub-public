import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchFinalGapReport } from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchGapActionChecklist } from './agent-session-v3-pilot-real-corpus-batch-gap-action-checklist.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchRunbookCompletionReport } from './agent-session-v3-pilot-real-corpus-batch-runbook-completion-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0AcceptedIntakeEvidenceFillHandoffInput =
  | 'accepted-intake-criteria-closeout-summary'
  | 'final-gap-report'
  | 'gap-action-checklist'
  | 'intake-field-completeness-audit'
  | 'intake-filling-support-report'
  | 'intake-readiness-gate-report'
  | 'next-evidence-target-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runbook-completion-report'
  | 'runtime-boundary-contract';

type P0AcceptedIntakeEvidenceFillHandoffSignal =
  | 'closed-criteria-chain-hands-off-to-manual-fill'
  | 'p0-targets-map-to-fill-support'
  | 'field-completeness-remains-post-fill-check'
  | 'p0-status-remains-explicit-dir-only'
  | 'readiness-gate-remains-manual-review-only'
  | 'handoff-remains-non-production';

type P0AcceptedIntakeEvidenceFillHandoffGuard =
  | 'caller-owned-dir-only'
  | 'manual-fill-only'
  | 'no-automatic-sample-collection'
  | 'no-auto-fill'
  | 'no-directory-discovery'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-production-readiness';

interface P0AcceptedIntakeEvidenceFillHandoffRow {
  guards: readonly P0AcceptedIntakeEvidenceFillHandoffGuard[];
  handoffStatus: 'handoff-ready-currently-blocked';
  inputs: readonly P0AcceptedIntakeEvidenceFillHandoffInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: P0AcceptedIntakeEvidenceFillHandoffSignal;
}

interface P0AcceptedIntakeEvidenceFillHandoffCheckpoint {
  gate: 'p0-real-evidence-accepted-intake-criteria-to-evidence-fill-handoff';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0AcceptedIntakeEvidenceFillHandoffRow[];
  summaryDecision: 'handoff-defined-evidence-fill-still-caller-owned';
}

const sharedInputs = [
  'accepted-intake-criteria-closeout-summary',
  'next-evidence-target-report',
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
] as const satisfies readonly P0AcceptedIntakeEvidenceFillHandoffInput[];

const p0AcceptedIntakeEvidenceFillHandoffCheckpoint = {
  gate: 'p0-real-evidence-accepted-intake-criteria-to-evidence-fill-handoff',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      guards: [
        'caller-owned-dir-only',
        'manual-fill-only',
        'no-automatic-sample-collection',
        'no-auto-fill',
      ],
      handoffStatus: 'handoff-ready-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'closed-criteria-chain-hands-off-to-manual-fill',
    },
    {
      guards: [
        'manual-fill-only',
        'no-required-report-order',
        'no-runtime-action-order',
      ],
      handoffStatus: 'handoff-ready-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-targets-map-to-fill-support',
    },
    {
      guards: [
        'caller-owned-dir-only',
        'manual-fill-only',
        'no-auto-fill',
        'no-directory-discovery',
      ],
      handoffStatus: 'handoff-ready-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'field-completeness-remains-post-fill-check',
    },
    {
      guards: [
        'caller-owned-dir-only',
        'no-directory-discovery',
        'no-runtime-action-order',
      ],
      handoffStatus: 'handoff-ready-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-status-remains-explicit-dir-only',
    },
    {
      guards: [
        'manual-fill-only',
        'no-production-readiness',
        'no-required-report-order',
      ],
      handoffStatus: 'handoff-ready-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'readiness-gate-remains-manual-review-only',
    },
    {
      guards: [
        'no-automatic-sample-collection',
        'no-auto-fill',
        'no-production-readiness',
        'no-runtime-action-order',
      ],
      handoffStatus: 'handoff-ready-currently-blocked',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'handoff-remains-non-production',
    },
  ],
  summaryDecision: 'handoff-defined-evidence-fill-still-caller-owned',
} as const satisfies P0AcceptedIntakeEvidenceFillHandoffCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0AcceptedIntakeEvidenceFillHandoffSignal) {
  const row = p0AcceptedIntakeEvidenceFillHandoffCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 accepted-intake evidence-fill handoff checkpoint.`);
  return row;
}

function rowsForGuard(guard: P0AcceptedIntakeEvidenceFillHandoffGuard) {
  return p0AcceptedIntakeEvidenceFillHandoffCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-closeout-summary-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const nextEvidenceTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
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

assert.equal(p0AcceptedIntakeEvidenceFillHandoffCheckpoint.productionAuthority, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffCheckpoint.productionReady, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffCheckpoint.positiveGateAllowed, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffCheckpoint.isExecutionOrder, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffCheckpoint.isImplementationPlan, false);
assert.equal(p0AcceptedIntakeEvidenceFillHandoffCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0AcceptedIntakeEvidenceFillHandoffCheckpoint.summaryDecision,
  'handoff-defined-evidence-fill-still-caller-owned',
);

assert.deepEqual(
  p0AcceptedIntakeEvidenceFillHandoffCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'closed-criteria-chain-hands-off-to-manual-fill',
    'field-completeness-remains-post-fill-check',
    'handoff-remains-non-production',
    'p0-status-remains-explicit-dir-only',
    'p0-targets-map-to-fill-support',
    'readiness-gate-remains-manual-review-only',
  ],
);

for (const row of p0AcceptedIntakeEvidenceFillHandoffCheckpoint.rows) {
  assert.equal(row.handoffStatus, 'handoff-ready-currently-blocked');
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

assert.ok(rowForSignal('closed-criteria-chain-hands-off-to-manual-fill').guards.includes('no-auto-fill'));
assert.ok(rowForSignal('p0-targets-map-to-fill-support').guards.includes('no-required-report-order'));
assert.ok(rowForSignal('field-completeness-remains-post-fill-check').guards.includes('caller-owned-dir-only'));
assert.ok(rowForSignal('p0-status-remains-explicit-dir-only').guards.includes('no-directory-discovery'));
assert.ok(rowForSignal('readiness-gate-remains-manual-review-only').guards.includes('no-production-readiness'));
assert.ok(rowForSignal('handoff-remains-non-production').guards.includes('no-runtime-action-order'));

assert.equal(nextEvidenceTarget.status, 'target-needed');
assert.equal(nextEvidenceTarget.nextPriority, 'P0');
assert.equal(nextEvidenceTarget.readyForProductionRuntime, false);
assert.deepEqual(
  nextEvidenceTarget.targets
    .filter((target) => target.priority === 'P0')
    .map((target) => target.gapKind),
  [
    'real-production-like-sample',
    'real-exported-corpus',
  ],
);

assert.equal(finalGap.status, 'missing-real-evidence');
assert.equal(finalGap.readyForProductionRuntime, false);
assert.ok(finalGap.finalGaps.some((gap) => gap.gapKind === 'real-production-like-sample' && gap.priority === 'P0'));
assert.ok(finalGap.finalGaps.some((gap) => gap.gapKind === 'real-exported-corpus' && gap.priority === 'P0'));

assert.equal(gapAction.readyForProductionRuntime, false);
assert.ok(gapAction.actions.some((action) => action.gapKind === 'real-production-like-sample' && action.priority === 'P0'));
assert.ok(gapAction.actions.some((action) => action.gapKind === 'real-exported-corpus' && action.priority === 'P0'));
assert.ok(gapAction.guardrail.includes('not runtime action order'));

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
assert.ok(fillingSupport.followUpReportPaths.includes(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts',
));

assert.equal(fieldCompleteness.status, 'no-intake-dirs');
assert.equal(fieldCompleteness.readyForProductionRuntime, false);
assert.equal(fieldCompleteness.intakeCount, 0);
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-production-like-sample')));
assert.ok(fieldCompleteness.fieldRequirements.some((field) => field.gapKinds.includes('real-exported-corpus')));

assert.equal(p0TargetStatus.status, 'no-intake-dirs');
assert.equal(p0TargetStatus.readyForProductionRuntime, false);
assert.ok(p0TargetStatus.p0TargetSignals.every((signal) => signal.status === 'missing'));
assert.ok(
  p0TargetStatus.p0TargetSignals.every((signal) => signal.missingReason === 'no explicit intake directories supplied'),
);

assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);

assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');

assert.equal(runbookCompletion.status, 'no-intake-dirs');
assert.equal(runbookCompletion.readyForProductionRuntime, false);
assert.equal(runbookCompletion.intakeCount, 0);

assertContains(closeoutSummarySmokeSource, 'accepted-intake-criteria-chain-closed-no-accepted-intake', 'closeout summary checkpoint');
assertContains(closeoutSummarySmokeSource, 'next-evidence-fill-remains-caller-owned', 'closeout summary checkpoint');
assertContains(closeoutSummarySmokeSource, 'manualInterpretationReady, false', 'closeout summary checkpoint');

assertContains(runbookText, 'Before filling real exported corpus batches, first read the current evidence target context:', 'runbook');
assertContains(runbookText, 'Optionally use the final gap report when you want the shortest current P0/P1/P2 manual evidence list before filling new intake directories:', 'runbook');
assertContains(runbookText, 'Optionally use the intake filling support report when you want the current final gaps translated into caller-owned sample-note, manifest, and index fields:', 'runbook');
assertContains(runbookText, 'Optionally use the intake field completeness audit after filling a caller-owned intake directory and before interpreting readiness:', 'runbook');
assertContains(runbookText, 'Always pass each directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'They are manual prioritization aids, not a runtime action order.', 'runbook');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');

assertContains(auditText, 'P0 Real-Evidence Accepted-Intake Criteria-To-Evidence-Fill Handoff Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence accepted-intake criteria-to-evidence-fill handoff checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-accepted-intake-criteria-to-evidence-fill-handoff-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0AcceptedIntakeEvidenceFillHandoffCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 accepted-intake evidence-fill handoff must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 accepted-intake evidence-fill handoff must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoFill|collectSamples|createIntakeDirectory|adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 accepted-intake evidence-fill handoff should not automate evidence filling or promote contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 accepted-intake evidence-fill handoff should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 accepted-intake evidence-fill handoff should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 accepted-intake evidence-fill handoff should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 accepted-intake evidence-fill handoff must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 accepted-intake evidence-fill handoff must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence accepted-intake criteria-to-evidence-fill handoff checkpoint smoke ok');
