import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffInput =
  | 'caller-owned-post-closeout-production-gate-recheck'
  | 'caller-owned-post-handoff-closeout-summary'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'intake-readiness-gate-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'post-recheck-remaining-blocker-handoff'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract';

type CallerOwnedRealExportedPostRecheckRemainingBlockerGroup =
  | 'caller-owned-real-exported-intake'
  | 'real-trace-evidence'
  | 'manual-interpretation'
  | 'production-ownership'
  | 'production-adapter-contracts'
  | 'controller-policy-contracts'
  | 'runtime-action-semantics';

type CallerOwnedRealExportedPostRecheckRemainingBlocker =
  | 'agent-session-v2-production-owner-retained'
  | 'controller-policy-contracts-missing'
  | 'manual-interpretation-not-ready'
  | 'missing-real-or-production-like-traces'
  | 'no-explicit-real-exported-intake'
  | 'package-health-missing-real-evidence'
  | 'p0-real-exported-corpus-missing'
  | 'production-adapter-contracts-missing'
  | 'production-gate-closed'
  | 'runtime-action-order-not-owned-by-v3';

type CallerOwnedRealExportedPostRecheckRemainingBlockerSource =
  | 'caller-owned-evidence-blocker'
  | 'current-evidence-blocker'
  | 'remaining-non-evidence-blocker';

interface CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffRow {
  blockers: readonly CallerOwnedRealExportedPostRecheckRemainingBlocker[];
  blockerSource: CallerOwnedRealExportedPostRecheckRemainingBlockerSource;
  contractPromotionAllowed: false;
  group: CallerOwnedRealExportedPostRecheckRemainingBlockerGroup;
  handoffStatus: 'handoff-only-still-blocked';
  inputs: readonly CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-remaining-blocker-handoff';
  handoffScope: 'caller-owned-non-production-blocker-readout';
  interpretationReadyNow: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffRow[];
  summaryDecision: 'caller-owned-remaining-blockers-handed-off-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-post-closeout-production-gate-recheck',
  'caller-owned-post-handoff-closeout-summary',
  'post-recheck-remaining-blocker-handoff',
  'remaining-non-evidence-production-blocker-inventory',
  'evidence-interpretation-to-production-gate-mapping',
  'package-health-rollup',
  'p0-intake-target-status-report',
  'intake-readiness-gate-report',
  'p0-real-evidence-closeout-report',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffInput[];

const callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-remaining-blocker-handoff',
  handoffScope: 'caller-owned-non-production-blocker-readout',
  interpretationReadyNow: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: [
        'no-explicit-real-exported-intake',
        'p0-real-exported-corpus-missing',
      ],
      blockerSource: 'caller-owned-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'caller-owned-real-exported-intake',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'missing-real-or-production-like-traces',
        'package-health-missing-real-evidence',
      ],
      blockerSource: 'current-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'real-trace-evidence',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: [
        'manual-interpretation-not-ready',
        'production-gate-closed',
      ],
      blockerSource: 'caller-owned-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'manual-interpretation',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['agent-session-v2-production-owner-retained'],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'production-ownership',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['production-adapter-contracts-missing'],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'production-adapter-contracts',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['controller-policy-contracts-missing'],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'controller-policy-contracts',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      blockers: ['runtime-action-order-not-owned-by-v3'],
      blockerSource: 'remaining-non-evidence-blocker',
      contractPromotionAllowed: false,
      group: 'runtime-action-semantics',
      handoffStatus: 'handoff-only-still-blocked',
      inputs: sharedInputs,
      interpretationReadyNow: false,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      manualInterpretationOnly: true,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'caller-owned-remaining-blockers-handed-off-positive-gate-closed',
} as const satisfies CallerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForGroup(group: CallerOwnedRealExportedPostRecheckRemainingBlockerGroup) {
  const row = callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.rows
    .find((candidate) => candidate.group === group);
  assert.ok(row, `${group} should exist in the caller-owned post-recheck remaining blocker handoff checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: CallerOwnedRealExportedPostRecheckRemainingBlocker) {
  return callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.rows
    .filter((row) => row.blockers.includes(blocker));
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort();
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const callerOwnedGateRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-co-prod-gate-rchk-ckpt-smoke.ts',
);
const callerOwnedPostHandoffCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-handoff-co-sum-ckpt-smoke.ts',
);
const genericHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const nonEvidenceInventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const evidenceMappingSmokeSource = readProjectFile(
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

assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.productionAuthority, false);
assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.productionReady, false);
assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.summaryDecision,
  'caller-owned-remaining-blockers-handed-off-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.rows.map((row) => row.group).sort(),
  [
    'caller-owned-real-exported-intake',
    'controller-policy-contracts',
    'manual-interpretation',
    'production-adapter-contracts',
    'production-ownership',
    'real-trace-evidence',
    'runtime-action-semantics',
  ],
);

const flattenedBlockers = uniqueSorted(
  callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.rows.flatMap((row) => row.blockers),
);
assert.deepEqual(
  flattenedBlockers,
  uniqueSorted([
    'agent-session-v2-production-owner-retained',
    'controller-policy-contracts-missing',
    'manual-interpretation-not-ready',
    'missing-real-or-production-like-traces',
    'no-explicit-real-exported-intake',
    'package-health-missing-real-evidence',
    'p0-real-exported-corpus-missing',
    'production-adapter-contracts-missing',
    'production-gate-closed',
    'runtime-action-order-not-owned-by-v3',
  ]),
);

for (const row of callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint.rows) {
  assert.equal(row.handoffStatus, 'handoff-only-still-blocked');
  assert.equal(row.contractPromotionAllowed, false);
  assert.equal(row.interpretationReadyNow, false);
  assert.equal(row.manualInterpretationOnly, true);
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.blockers.length > 0);
}

assert.equal(rowForGroup('caller-owned-real-exported-intake').blockerSource, 'caller-owned-evidence-blocker');
assert.ok(rowForGroup('caller-owned-real-exported-intake').blockers.includes('no-explicit-real-exported-intake'));
assert.ok(rowForGroup('caller-owned-real-exported-intake').blockers.includes('p0-real-exported-corpus-missing'));
assert.equal(rowForGroup('real-trace-evidence').blockerSource, 'current-evidence-blocker');
assert.ok(rowForGroup('real-trace-evidence').blockers.includes('missing-real-or-production-like-traces'));
assert.equal(rowForGroup('manual-interpretation').blockerSource, 'caller-owned-evidence-blocker');
assert.ok(rowForGroup('manual-interpretation').blockers.includes('manual-interpretation-not-ready'));
assert.equal(rowForGroup('production-ownership').blockerSource, 'remaining-non-evidence-blocker');
assert.ok(rowForGroup('production-ownership').blockers.includes('agent-session-v2-production-owner-retained'));
assert.ok(rowForGroup('production-adapter-contracts').blockers.includes('production-adapter-contracts-missing'));
assert.ok(rowForGroup('controller-policy-contracts').blockers.includes('controller-policy-contracts-missing'));
assert.ok(rowForGroup('runtime-action-semantics').blockers.includes('runtime-action-order-not-owned-by-v3'));

for (const blocker of flattenedBlockers as CallerOwnedRealExportedPostRecheckRemainingBlocker[]) {
  assert.equal(rowsForBlocker(blocker).length, 1, `${blocker} should appear exactly once in the caller-owned handoff rows.`);
  assertContains(callerOwnedGateRecheckSmokeSource, blocker, 'caller-owned post-closeout gate recheck smoke');
}

for (const blocker of [
  'agent-session-v2-production-owner-retained',
  'production-adapter-contracts-missing',
  'controller-policy-contracts-missing',
  'runtime-action-order-not-owned-by-v3',
] as const) {
  assertContains(nonEvidenceInventorySmokeSource, blocker, 'remaining non-evidence blocker inventory smoke');
  assertContains(genericHandoffSmokeSource, blocker, 'generic post-recheck handoff smoke');
}

assertContains(callerOwnedGateRecheckSmokeSource, 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing', 'caller-owned gate recheck');
assertContains(callerOwnedGateRecheckSmokeSource, 'non-evidence-blockers-still-remain', 'caller-owned gate recheck');
assertContains(callerOwnedPostHandoffCloseoutSmokeSource, 'real-exported-review-readiness-post-handoff-closed-evidence-still-missing', 'caller-owned post-handoff closeout');
assertContains(genericHandoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'generic post-recheck handoff');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence interpretation mapping smoke');
assertContains(evidenceMappingSmokeSource, 'missing-real-or-production-like-traces', 'evidence interpretation mapping smoke');

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.readyForProductionRuntime, false);

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

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Remaining Blocker Handoff Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck remaining blocker handoff checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-remaining-blocker-handoff-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(callerOwnedRealExportedPostRecheckRemainingBlockerHandoffCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReadyNow":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true|contractPromotionAllowed":true/u,
  'Caller-owned post-recheck remaining blocker handoff must not grant interpretation readiness, production readiness, contract promotion, or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned post-recheck remaining blocker handoff must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Caller-owned post-recheck remaining blocker handoff should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned post-recheck remaining blocker handoff should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned post-recheck remaining blocker handoff should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|fallback chain|requiredReportOrder|implementationQueue|orderedSteps|smokeExecutionQueue/iu,
  'Caller-owned post-recheck remaining blocker handoff should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned post-recheck remaining blocker handoff must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned post-recheck remaining blocker handoff must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck remaining blocker handoff checkpoint smoke ok');
