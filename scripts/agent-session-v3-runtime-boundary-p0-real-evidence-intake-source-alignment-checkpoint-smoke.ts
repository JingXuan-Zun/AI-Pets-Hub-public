import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type P0RealEvidenceSourceAlignmentInput =
  | 'intake-readiness-gate-report'
  | 'next-evidence-target-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'pilot-readiness-checklist'
  | 'real-corpus-runbook'
  | 'source-declaration-preflight';

type P0RealEvidenceSourceAlignmentBlocker =
  | 'caller-owned-intake-dir-required'
  | 'package-health-missing-real-evidence'
  | 'production-like-source-kind-required'
  | 'real-exported-source-declaration-required'
  | 'real-production-like-sample-missing'
  | 'real-exported-corpus-missing';

type P0RealEvidenceSourceAlignmentSignal =
  | 'p0-targets-remain-explicit'
  | 'real-exported-maps-to-source-declaration'
  | 'production-like-maps-to-source-kind'
  | 'no-intake-dirs-remain-missing'
  | 'rehearsal-does-not-satisfy-real-exported'
  | 'source-alignment-remains-non-production';

interface P0RealEvidenceSourceAlignmentRow {
  alignmentStatus: 'blocked-and-aligned';
  blockers: readonly P0RealEvidenceSourceAlignmentBlocker[];
  inputs: readonly P0RealEvidenceSourceAlignmentInput[];
  productionAuthority: false;
  productionReady: false;
  signal: P0RealEvidenceSourceAlignmentSignal;
}

interface P0RealEvidenceIntakeSourceAlignmentCheckpoint {
  gate: 'p0-real-evidence-intake-source-alignment';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly P0RealEvidenceSourceAlignmentRow[];
  summaryDecision: 'p0-source-alignment-still-blocks-production-wiring';
}

const p0RealEvidenceIntakeSourceAlignmentCheckpoint = {
  gate: 'p0-real-evidence-intake-source-alignment',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      alignmentStatus: 'blocked-and-aligned',
      blockers: [
        'real-production-like-sample-missing',
        'real-exported-corpus-missing',
        'package-health-missing-real-evidence',
      ],
      inputs: [
        'next-evidence-target-report',
        'package-health-rollup',
        'pilot-readiness-checklist',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'p0-targets-remain-explicit',
    },
    {
      alignmentStatus: 'blocked-and-aligned',
      blockers: [
        'real-exported-source-declaration-required',
        'real-exported-corpus-missing',
      ],
      inputs: [
        'source-declaration-preflight',
        'p0-intake-target-status-report',
        'real-corpus-runbook',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'real-exported-maps-to-source-declaration',
    },
    {
      alignmentStatus: 'blocked-and-aligned',
      blockers: [
        'production-like-source-kind-required',
        'real-production-like-sample-missing',
      ],
      inputs: [
        'p0-intake-target-status-report',
        'intake-readiness-gate-report',
        'real-corpus-runbook',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'production-like-maps-to-source-kind',
    },
    {
      alignmentStatus: 'blocked-and-aligned',
      blockers: [
        'caller-owned-intake-dir-required',
        'real-production-like-sample-missing',
        'real-exported-corpus-missing',
      ],
      inputs: [
        'p0-intake-target-status-report',
        'p0-real-evidence-closeout-report',
        'intake-readiness-gate-report',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'no-intake-dirs-remain-missing',
    },
    {
      alignmentStatus: 'blocked-and-aligned',
      blockers: [
        'real-exported-source-declaration-required',
        'real-exported-corpus-missing',
      ],
      inputs: [
        'source-declaration-preflight',
        'real-corpus-runbook',
        'pilot-readiness-checklist',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'rehearsal-does-not-satisfy-real-exported',
    },
    {
      alignmentStatus: 'blocked-and-aligned',
      blockers: [
        'package-health-missing-real-evidence',
        'caller-owned-intake-dir-required',
      ],
      inputs: [
        'package-health-rollup',
        'p0-real-evidence-closeout-report',
        'intake-readiness-gate-report',
      ],
      productionAuthority: false,
      productionReady: false,
      signal: 'source-alignment-remains-non-production',
    },
  ],
  summaryDecision: 'p0-source-alignment-still-blocks-production-wiring',
} as const satisfies P0RealEvidenceIntakeSourceAlignmentCheckpoint;

function rowForSignal(signal: P0RealEvidenceSourceAlignmentSignal) {
  const row = p0RealEvidenceIntakeSourceAlignmentCheckpoint.rows.find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the P0 real-evidence source-alignment checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: P0RealEvidenceSourceAlignmentBlocker) {
  return p0RealEvidenceIntakeSourceAlignmentCheckpoint.rows.filter((row) => row.blockers.includes(blocker));
}

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const readinessText = readProjectFile('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const sourceDeclarationSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-source-declaration-preflight.ts',
);
const p0IntakeTargetStatusSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts',
);
const p0RealEvidenceCloseoutSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts',
);
const intakeReadinessGateSource = readProjectFile(
  'scripts/agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({ projectRoot });
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
const p0IntakeTargetStatus = await runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport({
  projectRoot,
});
const p0RealEvidenceCloseout = await runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport({
  projectRoot,
});
const intakeReadinessGate = await runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport({
  projectRoot,
});

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(p0RealEvidenceIntakeSourceAlignmentCheckpoint.productionAuthority, false);
assert.equal(p0RealEvidenceIntakeSourceAlignmentCheckpoint.productionReady, false);
assert.equal(p0RealEvidenceIntakeSourceAlignmentCheckpoint.positiveGateAllowed, false);
assert.equal(p0RealEvidenceIntakeSourceAlignmentCheckpoint.isProductionWiringPlan, false);
assert.equal(
  p0RealEvidenceIntakeSourceAlignmentCheckpoint.summaryDecision,
  'p0-source-alignment-still-blocks-production-wiring',
);

assert.deepEqual(
  p0RealEvidenceIntakeSourceAlignmentCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'no-intake-dirs-remain-missing',
    'p0-targets-remain-explicit',
    'production-like-maps-to-source-kind',
    'real-exported-maps-to-source-declaration',
    'rehearsal-does-not-satisfy-real-exported',
    'source-alignment-remains-non-production',
  ],
);

for (const row of p0RealEvidenceIntakeSourceAlignmentCheckpoint.rows) {
  assert.equal(row.alignmentStatus, 'blocked-and-aligned');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockers.length > 0);
}

assert.ok(rowsForBlocker('caller-owned-intake-dir-required').length >= 2);
assert.ok(rowsForBlocker('package-health-missing-real-evidence').length >= 2);
assert.ok(rowsForBlocker('production-like-source-kind-required').length >= 1);
assert.ok(rowsForBlocker('real-exported-source-declaration-required').length >= 2);
assert.ok(rowsForBlocker('real-production-like-sample-missing').length >= 3);
assert.ok(rowsForBlocker('real-exported-corpus-missing').length >= 4);

assert.ok(rowForSignal('p0-targets-remain-explicit').inputs.includes('next-evidence-target-report'));
assert.ok(rowForSignal('real-exported-maps-to-source-declaration').inputs.includes('source-declaration-preflight'));
assert.ok(rowForSignal('production-like-maps-to-source-kind').inputs.includes('p0-intake-target-status-report'));
assert.ok(rowForSignal('no-intake-dirs-remain-missing').inputs.includes('p0-real-evidence-closeout-report'));
assert.ok(rowForSignal('rehearsal-does-not-satisfy-real-exported').inputs.includes('real-corpus-runbook'));
assert.ok(rowForSignal('source-alignment-remains-non-production').inputs.includes('intake-readiness-gate-report'));

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

assert.equal(p0IntakeTargetStatus.status, 'no-intake-dirs');
assert.equal(p0IntakeTargetStatus.readyForProductionRuntime, false);
assert.deepEqual(p0IntakeTargetStatus.p0TargetGapKinds, [
  'real-production-like-sample',
  'real-exported-corpus',
]);
assert.deepEqual(
  p0IntakeTargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status, signal.missingReason]),
  [
    ['real-production-like-sample', 'missing', 'no explicit intake directories supplied'],
    ['real-exported-corpus', 'missing', 'no explicit intake directories supplied'],
  ],
);
assert.equal(p0RealEvidenceCloseout.status, 'no-intake-dirs');
assert.equal(p0RealEvidenceCloseout.readyForProductionRuntime, false);
assert.equal(p0RealEvidenceCloseout.p0IntakeTargetStatus, 'no-intake-dirs');
assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);

assert.match(sourceDeclarationSource, /sampleSource === 'real-exported'/u);
assert.match(sourceDeclarationSource, /return 'real-exported-evidence'/u);
assert.match(sourceDeclarationSource, /sampleSource=unknown leaves the real sample declaration unresolved/u);
assert.match(p0IntakeTargetStatusSource, /gapKind === 'real-production-like-sample'/u);
assert.match(p0IntakeTargetStatusSource, /entry\.hasProductionLikeSourceKind/u);
assert.match(p0IntakeTargetStatusSource, /gapKind === 'real-exported-corpus'/u);
assert.match(p0IntakeTargetStatusSource, /entry\.sourceSampleSource === 'real-exported'/u);
assert.match(p0IntakeTargetStatusSource, /entry\.sourceSampleSourceStatus === 'real-exported-evidence'/u);
assert.match(p0RealEvidenceCloseoutSource, /P0 target \$\{signal\.gapKind\} is \$\{signal\.status\}/u);
assert.match(intakeReadinessGateSource, /p0EntrySupportsGapKind/u);
assert.match(intakeReadinessGateSource, /real-exported-corpus/u);

assertContains(readinessText, '- current P0 target kinds: `real-production-like-sample`, `real-exported-corpus`', 'readiness');
assertContains(readinessText, '- production runtime readiness: `no`', 'readiness');
assertContains(readinessText, 'do not satisfy real-exported P0 evidence', 'readiness');
assertContains(runbookText, 'Use `--expected-source real-exported` only when the intake is meant to point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'Use `--sample-source real-exported` only when the intake directories point at caller-owned real exported samples.', 'runbook');
assertContains(runbookText, 'If you are checking a generated rehearsal bundle instead of caller-owned real exported samples', 'runbook');
assertContains(runbookText, 'manual prioritization aids, not a runtime action order', 'runbook');
assertContains(auditText, 'P0 Real-Evidence Intake Source-Alignment Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary P0 real-evidence intake source-alignment checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(p0RealEvidenceIntakeSourceAlignmentCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'P0 source-alignment checkpoint must not grant production authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready/u,
  'P0 source-alignment checkpoint must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'P0 source-alignment checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'P0 source-alignment checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter|requiredReportOrder/u,
  'P0 source-alignment checkpoint should stay a non-production checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'P0 source-alignment checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'P0 source-alignment checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary P0 real evidence intake source-alignment checkpoint smoke ok');
