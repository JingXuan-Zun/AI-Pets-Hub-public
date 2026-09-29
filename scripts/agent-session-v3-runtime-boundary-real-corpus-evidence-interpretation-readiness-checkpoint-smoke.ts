import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { runAgentSessionV3PilotRealCorpusBatchIntakeReadinessGateReport } from './agent-session-v3-pilot-real-corpus-batch-intake-readiness-gate-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0IntakeTargetStatusReport } from './agent-session-v3-pilot-real-corpus-batch-p0-intake-target-status-report.ts';
import { runAgentSessionV3PilotRealCorpusBatchP0RealEvidenceCloseoutReport } from './agent-session-v3-pilot-real-corpus-batch-p0-real-evidence-closeout-report.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type RealCorpusEvidenceInterpretationReadinessInput =
  | 'intake-readiness-gate-report'
  | 'next-evidence-target-report'
  | 'p0-intake-target-status-report'
  | 'p0-real-evidence-closeout-report'
  | 'package-health-rollup'
  | 'p0-source-alignment-checkpoint'
  | 'pilot-readiness-checklist'
  | 'real-corpus-runbook';

type RealCorpusEvidenceInterpretationReadinessBlocker =
  | 'caller-owned-intake-dir-required'
  | 'intake-readiness-gate-no-intake-dirs'
  | 'package-health-missing-real-evidence'
  | 'p0-real-evidence-closeout-no-intake-dirs'
  | 'p0-target-real-exported-corpus-missing'
  | 'p0-target-real-production-like-sample-missing'
  | 'source-alignment-not-evidence-complete';

type RealCorpusEvidenceInterpretationReadinessSignal =
  | 'package-health-not-ready-for-interpretation'
  | 'p0-targets-not-ready-for-interpretation'
  | 'source-alignment-not-evidence-complete'
  | 'intake-readiness-gate-not-ready'
  | 'p0-closeout-not-ready'
  | 'interpretation-readiness-remains-non-production';

interface RealCorpusEvidenceInterpretationReadinessRow {
  blockers: readonly RealCorpusEvidenceInterpretationReadinessBlocker[];
  inputs: readonly RealCorpusEvidenceInterpretationReadinessInput[];
  interpretationReady: false;
  productionAuthority: false;
  productionReady: false;
  readinessStatus: 'not-ready-and-aligned';
  signal: RealCorpusEvidenceInterpretationReadinessSignal;
}

interface RealCorpusEvidenceInterpretationReadinessCheckpoint {
  gate: 'real-corpus-evidence-interpretation-readiness';
  interpretationReady: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly RealCorpusEvidenceInterpretationReadinessRow[];
  summaryDecision: 'manual-evidence-interpretation-not-ready';
}

const realCorpusEvidenceInterpretationReadinessCheckpoint = {
  gate: 'real-corpus-evidence-interpretation-readiness',
  interpretationReady: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: [
        'package-health-missing-real-evidence',
        'caller-owned-intake-dir-required',
      ],
      inputs: [
        'package-health-rollup',
        'pilot-readiness-checklist',
      ],
      interpretationReady: false,
      productionAuthority: false,
      productionReady: false,
      readinessStatus: 'not-ready-and-aligned',
      signal: 'package-health-not-ready-for-interpretation',
    },
    {
      blockers: [
        'p0-target-real-production-like-sample-missing',
        'p0-target-real-exported-corpus-missing',
        'caller-owned-intake-dir-required',
      ],
      inputs: [
        'next-evidence-target-report',
        'p0-intake-target-status-report',
        'pilot-readiness-checklist',
      ],
      interpretationReady: false,
      productionAuthority: false,
      productionReady: false,
      readinessStatus: 'not-ready-and-aligned',
      signal: 'p0-targets-not-ready-for-interpretation',
    },
    {
      blockers: [
        'source-alignment-not-evidence-complete',
        'p0-target-real-exported-corpus-missing',
      ],
      inputs: [
        'p0-source-alignment-checkpoint',
        'p0-intake-target-status-report',
        'real-corpus-runbook',
      ],
      interpretationReady: false,
      productionAuthority: false,
      productionReady: false,
      readinessStatus: 'not-ready-and-aligned',
      signal: 'source-alignment-not-evidence-complete',
    },
    {
      blockers: [
        'intake-readiness-gate-no-intake-dirs',
        'caller-owned-intake-dir-required',
      ],
      inputs: [
        'intake-readiness-gate-report',
        'p0-intake-target-status-report',
      ],
      interpretationReady: false,
      productionAuthority: false,
      productionReady: false,
      readinessStatus: 'not-ready-and-aligned',
      signal: 'intake-readiness-gate-not-ready',
    },
    {
      blockers: [
        'p0-real-evidence-closeout-no-intake-dirs',
        'p0-target-real-production-like-sample-missing',
        'p0-target-real-exported-corpus-missing',
      ],
      inputs: [
        'p0-real-evidence-closeout-report',
        'p0-intake-target-status-report',
        'next-evidence-target-report',
      ],
      interpretationReady: false,
      productionAuthority: false,
      productionReady: false,
      readinessStatus: 'not-ready-and-aligned',
      signal: 'p0-closeout-not-ready',
    },
    {
      blockers: [
        'package-health-missing-real-evidence',
        'source-alignment-not-evidence-complete',
        'caller-owned-intake-dir-required',
      ],
      inputs: [
        'package-health-rollup',
        'p0-source-alignment-checkpoint',
        'real-corpus-runbook',
      ],
      interpretationReady: false,
      productionAuthority: false,
      productionReady: false,
      readinessStatus: 'not-ready-and-aligned',
      signal: 'interpretation-readiness-remains-non-production',
    },
  ],
  summaryDecision: 'manual-evidence-interpretation-not-ready',
} as const satisfies RealCorpusEvidenceInterpretationReadinessCheckpoint;

function rowForSignal(signal: RealCorpusEvidenceInterpretationReadinessSignal) {
  const row = realCorpusEvidenceInterpretationReadinessCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the real-corpus interpretation readiness checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: RealCorpusEvidenceInterpretationReadinessBlocker) {
  return realCorpusEvidenceInterpretationReadinessCheckpoint.rows
    .filter((row) => row.blockers.includes(blocker));
}

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const readinessText = readProjectFile('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const sourceAlignmentSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-p0-real-evidence-intake-source-alignment-checkpoint-smoke.ts',
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

assert.equal(realCorpusEvidenceInterpretationReadinessCheckpoint.interpretationReady, false);
assert.equal(realCorpusEvidenceInterpretationReadinessCheckpoint.productionAuthority, false);
assert.equal(realCorpusEvidenceInterpretationReadinessCheckpoint.productionReady, false);
assert.equal(realCorpusEvidenceInterpretationReadinessCheckpoint.positiveGateAllowed, false);
assert.equal(realCorpusEvidenceInterpretationReadinessCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realCorpusEvidenceInterpretationReadinessCheckpoint.summaryDecision,
  'manual-evidence-interpretation-not-ready',
);

assert.deepEqual(
  realCorpusEvidenceInterpretationReadinessCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'intake-readiness-gate-not-ready',
    'interpretation-readiness-remains-non-production',
    'p0-closeout-not-ready',
    'p0-targets-not-ready-for-interpretation',
    'package-health-not-ready-for-interpretation',
    'source-alignment-not-evidence-complete',
  ],
);

for (const row of realCorpusEvidenceInterpretationReadinessCheckpoint.rows) {
  assert.equal(row.interpretationReady, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.readinessStatus, 'not-ready-and-aligned');
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockers.length > 0);
}

assert.ok(rowsForBlocker('caller-owned-intake-dir-required').length >= 4);
assert.ok(rowsForBlocker('intake-readiness-gate-no-intake-dirs').length === 1);
assert.ok(rowsForBlocker('package-health-missing-real-evidence').length >= 2);
assert.ok(rowsForBlocker('p0-real-evidence-closeout-no-intake-dirs').length === 1);
assert.ok(rowsForBlocker('p0-target-real-exported-corpus-missing').length >= 3);
assert.ok(rowsForBlocker('p0-target-real-production-like-sample-missing').length >= 2);
assert.ok(rowsForBlocker('source-alignment-not-evidence-complete').length >= 2);

assert.ok(rowForSignal('package-health-not-ready-for-interpretation').inputs.includes('package-health-rollup'));
assert.ok(rowForSignal('p0-targets-not-ready-for-interpretation').inputs.includes('p0-intake-target-status-report'));
assert.ok(rowForSignal('source-alignment-not-evidence-complete').inputs.includes('p0-source-alignment-checkpoint'));
assert.ok(rowForSignal('intake-readiness-gate-not-ready').inputs.includes('intake-readiness-gate-report'));
assert.ok(rowForSignal('p0-closeout-not-ready').inputs.includes('p0-real-evidence-closeout-report'));
assert.ok(rowForSignal('interpretation-readiness-remains-non-production').inputs.includes('real-corpus-runbook'));

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
assert.deepEqual(
  p0IntakeTargetStatus.p0TargetSignals.map((signal) => [signal.gapKind, signal.status]),
  [
    ['real-production-like-sample', 'missing'],
    ['real-exported-corpus', 'missing'],
  ],
);
assert.equal(p0RealEvidenceCloseout.status, 'no-intake-dirs');
assert.equal(p0RealEvidenceCloseout.readyForProductionRuntime, false);
assert.equal(p0RealEvidenceCloseout.readinessRollupStatus, 'not-run');
assert.ok(
  p0RealEvidenceCloseout.closeoutReasons.some((reason) => reason.includes('no explicit intake directories')),
  'P0 closeout should explain the no-intake interpretation blocker.',
);
assert.equal(intakeReadinessGate.status, 'no-intake-dirs');
assert.equal(intakeReadinessGate.readyForProductionRuntime, false);
assert.deepEqual(intakeReadinessGate.issueCodeRollup, []);
assert.deepEqual(intakeReadinessGate.unblockItems, []);

assert.match(sourceAlignmentSmokeSource, /p0-source-alignment-still-blocks-production-wiring/u);
assert.match(sourceAlignmentSmokeSource, /real-exported-source-declaration-required/u);
assert.match(sourceAlignmentSmokeSource, /production-like-source-kind-required/u);
assert.match(sourceAlignmentSmokeSource, /rehearsal-does-not-satisfy-real-exported/u);

assertContains(readinessText, '- package health: `missing-real-evidence`', 'readiness');
assertContains(readinessText, '- production runtime readiness: `no`', 'readiness');
assertContains(readinessText, '- current P0 target kinds: `real-production-like-sample`, `real-exported-corpus`', 'readiness');
assertContains(runbookText, 'The next decision after this runbook is evidence interpretation, not production wiring.', 'runbook');
assertContains(runbookText, 'manual prioritization aids, not a runtime action order', 'runbook');
assertContains(auditText, 'Real-Corpus Evidence Interpretation Readiness Checkpoint Status', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary real-corpus evidence interpretation readiness checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-corpus-evidence-interpretation-readiness-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realCorpusEvidenceInterpretationReadinessCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /interpretationReady":true|productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Interpretation readiness checkpoint must not grant interpretation or production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready/u,
  'Interpretation readiness checkpoint must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Interpretation readiness checkpoint should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Interpretation readiness checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter|requiredReportOrder/u,
  'Interpretation readiness checkpoint should stay a non-production checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Interpretation readiness checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Interpretation readiness checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real-corpus evidence interpretation readiness checkpoint smoke ok');
