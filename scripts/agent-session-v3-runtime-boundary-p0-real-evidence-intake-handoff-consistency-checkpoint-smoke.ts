import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport } from './agent-session-v3-pilot-real-corpus-batch-intake-filling-support-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0RealEvidenceIntakeHandoffConsistencyInput =
  | 'interpretation-readiness-checkpoint'
  | 'intake-filling-support-report'
  | 'intake-readiness-gate-report'
  | 'next-evidence-target-report'
  | 'p0-intake-preparation-support-checkpoint'
  | 'p0-intake-source-alignment-checkpoint'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'real-corpus-runbook'
  | 'runtime-boundary-contract';

type P0RealEvidenceIntakeHandoffConsistencySignal =
  | 'same-p0-targets'
  | 'same-caller-owned-intake-boundary'
  | 'same-real-exported-source-boundary'
  | 'same-production-like-source-boundary'
  | 'same-non-production-guardrails'
  | 'same-manual-interpretation-boundary';

type P0RealEvidenceIntakeHandoffConsistencyGuard =
  | 'explicit-dir-only'
  | 'manual-review-only'
  | 'no-automatic-sample-collection'
  | 'no-directory-discovery'
  | 'no-production-readiness'
  | 'no-required-report-order'
  | 'no-runtime-action-order'
  | 'no-smoke-execution-queue';

interface P0RealEvidenceIntakeHandoffConsistencyRow {
  consistencyStatus: 'consistent-and-non-production';
  guards: readonly P0RealEvidenceIntakeHandoffConsistencyGuard[];
  inputs: readonly P0RealEvidenceIntakeHandoffConsistencyInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: P0RealEvidenceIntakeHandoffConsistencySignal;
}

interface P0RealEvidenceIntakeHandoffConsistencyCheckpoint {
  gate: 'p0-real-evidence-intake-handoff-consistency';
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0RealEvidenceIntakeHandoffConsistencyRow[];
  summaryDecision: 'handoff-consistent-but-evidence-still-missing';
}

const p0RealEvidenceIntakeHandoffConsistencyCheckpoint = {
  gate: 'p0-real-evidence-intake-handoff-consistency',
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      consistencyStatus: 'consistent-and-non-production',
      guards: [
        'explicit-dir-only',
        'manual-review-only',
        'no-production-readiness',
      ],
      inputs: [
        'next-evidence-target-report',
        'p0-intake-preparation-support-checkpoint',
        'p0-intake-source-alignment-checkpoint',
        'interpretation-readiness-checkpoint',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'same-p0-targets',
    },
    {
      consistencyStatus: 'consistent-and-non-production',
      guards: [
        'explicit-dir-only',
        'manual-review-only',
        'no-directory-discovery',
      ],
      inputs: [
        'intake-readiness-gate-report',
        'p0-intake-target-status-report',
        'p0-real-evidence-closeout-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'same-caller-owned-intake-boundary',
    },
    {
      consistencyStatus: 'consistent-and-non-production',
      guards: [
        'explicit-dir-only',
        'manual-review-only',
        'no-automatic-sample-collection',
      ],
      inputs: [
        'p0-intake-source-alignment-checkpoint',
        'p0-intake-target-status-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'same-real-exported-source-boundary',
    },
    {
      consistencyStatus: 'consistent-and-non-production',
      guards: [
        'explicit-dir-only',
        'manual-review-only',
        'no-runtime-action-order',
      ],
      inputs: [
        'intake-filling-support-report',
        'p0-intake-source-alignment-checkpoint',
        'p0-intake-target-status-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'same-production-like-source-boundary',
    },
    {
      consistencyStatus: 'consistent-and-non-production',
      guards: [
        'no-automatic-sample-collection',
        'no-directory-discovery',
        'no-required-report-order',
        'no-runtime-action-order',
        'no-smoke-execution-queue',
      ],
      inputs: [
        'p0-intake-preparation-support-checkpoint',
        'intake-filling-support-report',
        'intake-readiness-gate-report',
        'real-corpus-runbook',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'same-non-production-guardrails',
    },
    {
      consistencyStatus: 'consistent-and-non-production',
      guards: [
        'manual-review-only',
        'no-production-readiness',
        'no-runtime-action-order',
      ],
      inputs: [
        'interpretation-readiness-checkpoint',
        'p0-real-evidence-closeout-report',
        'real-corpus-runbook',
        'runtime-boundary-contract',
      ],
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      signal: 'same-manual-interpretation-boundary',
    },
  ],
  summaryDecision: 'handoff-consistent-but-evidence-still-missing',
} as const satisfies P0RealEvidenceIntakeHandoffConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: P0RealEvidenceIntakeHandoffConsistencySignal) {
  const row = p0RealEvidenceIntakeHandoffConsistencyCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 real-evidence intake handoff consistency checkpoint.`);
  return row;
}

function rowsForGuard(guard: P0RealEvidenceIntakeHandoffConsistencyGuard) {
  return p0RealEvidenceIntakeHandoffConsistencyCheckpoint.rows.filter((row) => row.guards.includes(guard));
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const preparationSupportSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-preparation-support-checkpoint-smoke.ts',
);
const sourceAlignmentSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
);
const interpretationReadinessSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-real-corpus-evidence-interpretation-readiness-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
const fillingSupport = createAgentSessionV3PilotRealCorpusBatchIntakeFillingSupportReport({ projectRoot });
const p0TargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({ projectRoot });
const p0Closeout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({ projectRoot });
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(p0RealEvidenceIntakeHandoffConsistencyCheckpoint.productionAuthority, false);
assert.equal(p0RealEvidenceIntakeHandoffConsistencyCheckpoint.productionReady, false);
assert.equal(p0RealEvidenceIntakeHandoffConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(p0RealEvidenceIntakeHandoffConsistencyCheckpoint.isExecutionOrder, false);
assert.equal(p0RealEvidenceIntakeHandoffConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(p0RealEvidenceIntakeHandoffConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0RealEvidenceIntakeHandoffConsistencyCheckpoint.summaryDecision,
  'handoff-consistent-but-evidence-still-missing',
);

assert.deepEqual(
  p0RealEvidenceIntakeHandoffConsistencyCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'same-caller-owned-intake-boundary',
    'same-manual-interpretation-boundary',
    'same-non-production-guardrails',
    'same-p0-targets',
    'same-production-like-source-boundary',
    'same-real-exported-source-boundary',
  ],
);

for (const row of p0RealEvidenceIntakeHandoffConsistencyCheckpoint.rows) {
  assert.equal(row.consistencyStatus, 'consistent-and-non-production');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.guards.length > 0);
}

assert.ok(rowsForGuard('explicit-dir-only').length >= 4);
assert.ok(rowsForGuard('manual-review-only').length >= 5);
assert.ok(rowsForGuard('no-automatic-sample-collection').length >= 2);
assert.ok(rowsForGuard('no-directory-discovery').length >= 2);
assert.ok(rowsForGuard('no-production-readiness').length >= 2);
assert.ok(rowsForGuard('no-required-report-order').length >= 1);
assert.ok(rowsForGuard('no-runtime-action-order').length >= 3);
assert.ok(rowsForGuard('no-smoke-execution-queue').length >= 1);

assert.ok(rowForSignal('same-p0-targets').inputs.includes('next-evidence-target-report'));
assert.ok(rowForSignal('same-caller-owned-intake-boundary').inputs.includes('real-corpus-runbook'));
assert.ok(rowForSignal('same-real-exported-source-boundary').inputs.includes('p0-intake-source-alignment-checkpoint'));
assert.ok(rowForSignal('same-production-like-source-boundary').inputs.includes('intake-filling-support-report'));
assert.ok(rowForSignal('same-non-production-guardrails').guards.includes('no-required-report-order'));
assert.ok(rowForSignal('same-manual-interpretation-boundary').inputs.includes('interpretation-readiness-checkpoint'));

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

assert.equal(fillingSupport.status, 'needs-intake-filling');
assert.equal(fillingSupport.readyForProductionRuntime, false);
assert.ok(fillingSupport.fillingItems.some((item) => item.gapKind === 'real-production-like-sample'));
assert.ok(fillingSupport.fillingItems.some((item) => item.gapKind === 'real-exported-corpus'));
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
assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);

assertContains(preparationSupportSmokeSource, 'prepare-caller-owned-p0-intake-only', 'preparation support checkpoint');
assertContains(preparationSupportSmokeSource, 'caller-owned-explicit-intake-dirs-only', 'preparation support checkpoint');
assertContains(preparationSupportSmokeSource, 'no-required-report-order', 'preparation support checkpoint');
assertContains(preparationSupportSmokeSource, 'no-smoke-execution-queue', 'preparation support checkpoint');
assertContains(sourceAlignmentSmokeSource, 'p0-source-alignment-still-blocks-production-wiring', 'source alignment checkpoint');
assertContains(sourceAlignmentSmokeSource, 'real-exported-source-declaration-required', 'source alignment checkpoint');
assertContains(sourceAlignmentSmokeSource, 'production-like-source-kind-required', 'source alignment checkpoint');
assertContains(interpretationReadinessSmokeSource, 'manual-evidence-interpretation-not-ready', 'interpretation readiness checkpoint');
assertContains(interpretationReadinessSmokeSource, 'caller-owned-intake-dir-required', 'interpretation readiness checkpoint');

assertContains(runbookText, 'This runbook describes the caller-owned manual flow', 'runbook');
assertContains(runbookText, 'Always pass each directory with `--dir`; this report does not discover directories', 'runbook');
assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'sourceKind=production-like', 'runbook');
assertContains(runbookText, 'manual prioritization aids, not a runtime action order', 'runbook');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');
assertContains(runbookText, 'If you are checking a generated rehearsal bundle instead of caller-owned real exported samples', 'runbook');

assertContains(auditText, 'P0 Real-Evidence Intake Handoff Consistency Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence intake handoff consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-intake-handoff-consistency-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0RealEvidenceIntakeHandoffConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 real-evidence handoff consistency checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|isExecutionOrder":true/u,
  'P0 real-evidence handoff consistency checkpoint must not become an implementation plan or execution order.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 real-evidence handoff consistency checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 real-evidence handoff consistency checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'P0 real-evidence handoff consistency checkpoint should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'P0 real-evidence handoff consistency checkpoint should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 real-evidence handoff consistency checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 real-evidence handoff consistency checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence intake handoff consistency checkpoint smoke ok');
