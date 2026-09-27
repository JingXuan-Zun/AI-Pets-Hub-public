import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchFinalGapReport } from './agent-session-v3-pilot-real-corpus-batch-final-gap-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit } from './agent-session-v3-pilot-real-corpus-batch-intake-field-completeness-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0RealEvidenceIntakePreparationInput =
  | 'final-gap-report'
  | 'intake-field-completeness-audit'
  | 'intake-filling-support-report'
  | 'intake-readiness-gate-report'
  | 'next-evidence-target-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'real-corpus-runbook'
  | 'source-alignment-checkpoint';

type P0RealEvidenceIntakePreparationGuard =
  | 'caller-owned-explicit-intake-dirs-only'
  | 'generated-rehearsal-evidence-excluded'
  | 'no-automatic-sample-collection'
  | 'no-directory-discovery'
  | 'no-production-readiness'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-smoke-execution-queue';

type P0RealEvidenceIntakePreparationSignal =
  | 'p0-targets-remain-real-evidence'
  | 'intake-fields-can-be-prepared'
  | 'no-intake-dirs-remain-blocked'
  | 'closeout-still-needs-caller-owned-intake'
  | 'preparation-is-reporting-only'
  | 'production-gate-remains-closed';

interface P0RealEvidenceIntakePreparationSupportRow {
  guards: readonly P0RealEvidenceIntakePreparationGuard[];
  inputs: readonly P0RealEvidenceIntakePreparationInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  preparationStatus: 'blocked-until-caller-owned-intake' | 'ready-to-fill-manually';
  productionAuthority: false;
  productionReady: false;
  signal: P0RealEvidenceIntakePreparationSignal;
}

interface P0RealEvidenceIntakePreparationSupportCheckpoint {
  gate: 'p0-real-evidence-intake-preparation-support';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0RealEvidenceIntakePreparationSupportRow[];
  summaryDecision: 'prepare-caller-owned-p0-intake-only';
}

const p0RealEvidenceIntakePreparationSupportCheckpoint = {
  gate: 'p0-real-evidence-intake-preparation-support',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      guards: [
        'caller-owned-explicit-intake-dirs-only',
        'generated-rehearsal-evidence-excluded',
        'no-production-readiness',
      ],
      inputs: [
        'next-evidence-target-report',
        'package-health-rollup',
        'source-alignment-checkpoint',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      preparationStatus: 'blocked-until-caller-owned-intake',
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-targets-remain-real-evidence',
    },
    {
      guards: [
        'caller-owned-explicit-intake-dirs-only',
        'no-automatic-sample-collection',
        'no-directory-discovery',
      ],
      inputs: [
        'final-gap-report',
        'intake-filling-support-report',
        'intake-field-completeness-audit',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      preparationStatus: 'ready-to-fill-manually',
      productionAuthority: false,
      productionReady: false,
      signal: 'intake-fields-can-be-prepared',
    },
    {
      guards: [
        'caller-owned-explicit-intake-dirs-only',
        'no-directory-discovery',
        'no-smoke-execution-queue',
      ],
      inputs: [
        'p0-intake-target-status-report',
        'intake-readiness-gate-report',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      preparationStatus: 'blocked-until-caller-owned-intake',
      productionAuthority: false,
      productionReady: false,
      signal: 'no-intake-dirs-remain-blocked',
    },
    {
      guards: [
        'caller-owned-explicit-intake-dirs-only',
        'no-production-readiness',
        'no-runtime-action-order',
      ],
      inputs: [
        'p0-real-evidence-closeout-report',
        'p0-intake-target-status-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      preparationStatus: 'blocked-until-caller-owned-intake',
      productionAuthority: false,
      productionReady: false,
      signal: 'closeout-still-needs-caller-owned-intake',
    },
    {
      guards: [
        'no-automatic-sample-collection',
        'no-required-report-order',
        'no-runtime-action-order',
      ],
      inputs: [
        'intake-filling-support-report',
        'intake-readiness-gate-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      preparationStatus: 'ready-to-fill-manually',
      productionAuthority: false,
      productionReady: false,
      signal: 'preparation-is-reporting-only',
    },
    {
      guards: [
        'no-production-readiness',
        'no-runtime-action-order',
        'no-smoke-execution-queue',
      ],
      inputs: [
        'p0-real-evidence-closeout-report',
        'package-health-rollup',
        'source-alignment-checkpoint',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      preparationStatus: 'blocked-until-caller-owned-intake',
      productionAuthority: false,
      productionReady: false,
      signal: 'production-gate-remains-closed',
    },
  ],
  summaryDecision: 'prepare-caller-owned-p0-intake-only',
} as const satisfies P0RealEvidenceIntakePreparationSupportCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0RealEvidenceIntakePreparationSignal) {
  const row = p0RealEvidenceIntakePreparationSupportCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 real-evidence intake preparation checkpoint.`);
  return row;
}

function rowsForGuard(guard: P0RealEvidenceIntakePreparationGuard) {
  return p0RealEvidenceIntakePreparationSupportCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const sourceAlignmentSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({ projectRoot });
const finalGap = createAgentSessionV3PilotRealCorpusBatchFinalGapReport({ projectRoot });
const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({ projectRoot });
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });
const fieldCompleteness = await runAgentSessionV3PilotRealCorpusBatchIntakeFieldCompletenessAudit({ projectRoot });
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(p0RealEvidenceIntakePreparationSupportCheckpoint.productionAuthority, false);
assert.equal(p0RealEvidenceIntakePreparationSupportCheckpoint.productionReady, false);
assert.equal(p0RealEvidenceIntakePreparationSupportCheckpoint.positiveGateAllowed, false);
assert.equal(p0RealEvidenceIntakePreparationSupportCheckpoint.isExecutionOrder, false);
assert.equal(p0RealEvidenceIntakePreparationSupportCheckpoint.isImplementationPlan, false);
assert.equal(p0RealEvidenceIntakePreparationSupportCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0RealEvidenceIntakePreparationSupportCheckpoint.summaryDecision,
  'prepare-caller-owned-p0-intake-only',
);

assert.deepEqual(
  p0RealEvidenceIntakePreparationSupportCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'closeout-still-needs-caller-owned-intake',
    'intake-fields-can-be-prepared',
    'no-intake-dirs-remain-blocked',
    'p0-targets-remain-real-evidence',
    'preparation-is-reporting-only',
    'production-gate-remains-closed',
  ],
);

for (const row of p0RealEvidenceIntakePreparationSupportCheckpoint.rows) {
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('caller-owned-explicit-intake-dirs-only').length >= 4);
assert.ok(rowsForGuard('generated-rehearsal-evidence-excluded').length >= 1);
assert.ok(rowsForGuard('no-automatic-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 3);
assert.ok(rowsForGuard('no-required-report-order').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 3);
assert.ok(rowsForGuard('no-smoke-execution-queue').length >= 2);

assert.equal(rowForSignal('p0-targets-remain-real-evidence').preparationStatus, 'blocked-until-caller-owned-intake');
assert.equal(rowForSignal('intake-fields-can-be-prepared').preparationStatus, 'ready-to-fill-manually');
assert.equal(rowForSignal('no-intake-dirs-remain-blocked').preparationStatus, 'blocked-until-caller-owned-intake');
assert.equal(rowForSignal('closeout-still-needs-caller-owned-intake').preparationStatus, 'blocked-until-caller-owned-intake');
assert.equal(rowForSignal('preparation-is-reporting-only').preparationStatus, 'ready-to-fill-manually');
assert.equal(rowForSignal('production-gate-remains-closed').productionReady, false);

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.readyForProductionRuntime, false);
assert.equal(nextTarget.status, 'target-needed');
assert.equal(nextTarget.nextPriority, 'P0');
assert.equal(nextTarget.readyForProductionRuntime, false);
assert.deepEqual(
  nextTarget.targets
    .filter((target) => target.priority === 'P0')
    .map((target) => target.gapKind),
  [
    'real-production-like-sample',
    'real-exported-corpus',
  ],
);

assert.equal(finalGap.status, 'missing-real-evidence');
assert.equal(finalGap.readyForProductionRuntime, false);
assert.ok(finalGap.finalGaps.some((gap) => gap.priority === 'P0' && gap.gapKind === 'real-production-like-sample'));
assert.ok(finalGap.finalGaps.some((gap) => gap.priority === 'P0' && gap.gapKind === 'real-exported-corpus'));
assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
assert.ok(fillingSupport.fillingItems.some((item) => item.priority === 'P0' && item.gapKind === 'real-production-like-sample'));
assert.ok(fillingSupport.fillingItems.some((item) => item.priority === 'P0' && item.gapKind === 'real-exported-corpus'));
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
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);
assert.equal(p0Closeout.status, 'no-intake-dirs');
assert.equal(p0Closeout.readyForProductionRuntime, false);
assert.equal(p0Closeout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(p0Closeout.readinessRollupStatus, 'not-run');
assert.ok(
  p0Closeout.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')),
  'P0 closeout should stay blocked on explicit caller-owned intake directories.',
);

assertContains(fillingSupport.guardrail, 'caller-owned intake filling support report only', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'does not discover directories', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'collect samples', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'run smoke tests', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'create task queues', 'intake filling support guardrail');
assertContains(fillingSupport.guardrail, 'define runtime action order', 'intake filling support guardrail');
assertContains(fieldCompleteness.guardrail, 'reads only explicitly supplied --dir intake directories', 'field completeness guardrail');
assertContains(intakeReadinessGate.guardrail, 'does not discover directories', 'intake readiness gate guardrail');
assertContains(intakeReadinessGate.guardrail, 'block runtime execution', 'intake readiness gate guardrail');
assertContains(p0Closeout.guardrail, 'collect samples', 'P0 closeout guardrail');
assertContains(runbookText, 'manual prioritization aids, not a runtime action order', 'runbook');
assertContains(runbookText, 'If you are checking a generated rehearsal bundle instead of caller-owned real exported samples', 'runbook');
assertContains(sourceAlignmentSmokeSource, 'rehearsal-does-not-satisfy-real-exported', 'source alignment checkpoint');
assertContains(sourceAlignmentSmokeSource, 'source-alignment-remains-non-production', 'source alignment checkpoint');
assertContains(auditText, 'P0 Real-Evidence Intake Preparation Support Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence intake preparation support checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-intake-preparation-support-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0RealEvidenceIntakePreparationSupportCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 real-evidence intake preparation support must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 real-evidence intake preparation support must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 real-evidence intake preparation support should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 real-evidence intake preparation support should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 real-evidence intake preparation support should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 real-evidence intake preparation support should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 real-evidence intake preparation support must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 real-evidence intake preparation support must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence intake preparation support checkpoint smoke ok');
