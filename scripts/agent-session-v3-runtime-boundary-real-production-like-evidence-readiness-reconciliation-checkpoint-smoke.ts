import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { createAgentSessionV3PilotRealCorpusBatchCloseoutAudit } from './agent-session-v3-pilot-real-corpus-batch-closeout-audit.ts';
import { createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport } from './agent-session-v3-pilot-real-corpus-batch-next-evidence-target-report.ts';
import { createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup } from './agent-session-v3-pilot-real-corpus-batch-package-health-rollup.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

type EvidenceReadinessReconciliationInput =
  | 'closeout-audit'
  | 'full-runtime-preflight-audit'
  | 'next-evidence-target-report'
  | 'package-health-rollup'
  | 'pilot-readiness-checklist'
  | 'positive-gate-closeout'
  | 'production-authority-drift-final-guard'
  | 'production-wiring-gate-summary'
  | 'real-corpus-runbook';

type EvidenceReadinessReconciliationBlocker =
  | 'missing-real-or-production-like-traces'
  | 'package-health-missing-real-evidence'
  | 'production-runtime-readiness-no'
  | 'real-exported-corpus-missing'
  | 'real-production-like-sample-missing';

type EvidenceReadinessReconciliationSignal =
  | 'production-wiring-evidence-blocker-still-open'
  | 'package-health-still-missing-real-evidence'
  | 'p0-real-evidence-targets-still-open'
  | 'readiness-checklist-still-not-production-ready'
  | 'runbook-still-evidence-interpretation-only';

interface EvidenceReadinessReconciliationRow {
  blockers: readonly EvidenceReadinessReconciliationBlocker[];
  inputs: readonly EvidenceReadinessReconciliationInput[];
  productionAuthority: false;
  productionReady: false;
  reconciliation: 'blocked-and-consistent';
  signal: EvidenceReadinessReconciliationSignal;
}

interface RealProductionLikeEvidenceReadinessReconciliationCheckpoint {
  gate: 'real-production-like-evidence-readiness-reconciliation';
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly EvidenceReadinessReconciliationRow[];
  summaryDecision: 'evidence-readiness-still-blocks-production-wiring';
}

const realProductionLikeEvidenceReadinessReconciliationCheckpoint = {
  gate: 'real-production-like-evidence-readiness-reconciliation',
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      blockers: ['missing-real-or-production-like-traces'],
      inputs: [
        'full-runtime-preflight-audit',
        'production-wiring-gate-summary',
        'positive-gate-closeout',
        'production-authority-drift-final-guard',
      ],
      productionAuthority: false,
      productionReady: false,
      reconciliation: 'blocked-and-consistent',
      signal: 'production-wiring-evidence-blocker-still-open',
    },
    {
      blockers: [
        'package-health-missing-real-evidence',
        'production-runtime-readiness-no',
      ],
      inputs: [
        'package-health-rollup',
        'closeout-audit',
        'pilot-readiness-checklist',
      ],
      productionAuthority: false,
      productionReady: false,
      reconciliation: 'blocked-and-consistent',
      signal: 'package-health-still-missing-real-evidence',
    },
    {
      blockers: [
        'real-production-like-sample-missing',
        'real-exported-corpus-missing',
        'production-runtime-readiness-no',
      ],
      inputs: [
        'next-evidence-target-report',
        'pilot-readiness-checklist',
        'real-corpus-runbook',
      ],
      productionAuthority: false,
      productionReady: false,
      reconciliation: 'blocked-and-consistent',
      signal: 'p0-real-evidence-targets-still-open',
    },
    {
      blockers: [
        'package-health-missing-real-evidence',
        'real-production-like-sample-missing',
        'real-exported-corpus-missing',
      ],
      inputs: [
        'pilot-readiness-checklist',
        'package-health-rollup',
        'next-evidence-target-report',
      ],
      productionAuthority: false,
      productionReady: false,
      reconciliation: 'blocked-and-consistent',
      signal: 'readiness-checklist-still-not-production-ready',
    },
    {
      blockers: [
        'missing-real-or-production-like-traces',
        'real-production-like-sample-missing',
        'real-exported-corpus-missing',
      ],
      inputs: [
        'real-corpus-runbook',
        'pilot-readiness-checklist',
        'production-wiring-gate-summary',
      ],
      productionAuthority: false,
      productionReady: false,
      reconciliation: 'blocked-and-consistent',
      signal: 'runbook-still-evidence-interpretation-only',
    },
  ],
  summaryDecision: 'evidence-readiness-still-blocks-production-wiring',
} as const satisfies RealProductionLikeEvidenceReadinessReconciliationCheckpoint;

function rowForSignal(signal: EvidenceReadinessReconciliationSignal) {
  const row = realProductionLikeEvidenceReadinessReconciliationCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(row, `${signal} should exist in the evidence-readiness reconciliation checkpoint.`);
  return row;
}

function rowsForBlocker(blocker: EvidenceReadinessReconciliationBlocker) {
  return realProductionLikeEvidenceReadinessReconciliationCheckpoint.rows
    .filter((row) => row.blockers.includes(blocker));
}

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const readinessText = readProjectFile('PROJECT_AGENT_V3_PILOT_READINESS_CHECKLIST.md');
const runbookText = readProjectFile('PROJECT_AGENT_V3_REAL_CORPUS_BATCH_RUNBOOK.md');
const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const productionWiringSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-gate-closeout-summary-checkpoint-smoke.ts',
);
const positiveGateCloseoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-wiring-positive-gate-precondition-closeout-gate-smoke.ts',
);
const productionAuthorityDriftGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-authority-drift-final-guard-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
const packageHealth = createAgentSessionV3PilotRealCorpusBatchPackageHealthRollup({ projectRoot });
const nextTarget = createAgentSessionV3PilotRealCorpusBatchNextEvidenceTargetReport({ projectRoot });
const closeoutAudit = createAgentSessionV3PilotRealCorpusBatchCloseoutAudit({ projectRoot });

assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');

assert.equal(realProductionLikeEvidenceReadinessReconciliationCheckpoint.productionAuthority, false);
assert.equal(realProductionLikeEvidenceReadinessReconciliationCheckpoint.productionReady, false);
assert.equal(realProductionLikeEvidenceReadinessReconciliationCheckpoint.positiveGateAllowed, false);
assert.equal(realProductionLikeEvidenceReadinessReconciliationCheckpoint.isProductionWiringPlan, false);
assert.equal(
  realProductionLikeEvidenceReadinessReconciliationCheckpoint.summaryDecision,
  'evidence-readiness-still-blocks-production-wiring',
);

assert.deepEqual(
  realProductionLikeEvidenceReadinessReconciliationCheckpoint.rows.map((row) => row.signal).sort(),
  [
    'p0-real-evidence-targets-still-open',
    'package-health-still-missing-real-evidence',
    'production-wiring-evidence-blocker-still-open',
    'readiness-checklist-still-not-production-ready',
    'runbook-still-evidence-interpretation-only',
  ],
);

for (const row of realProductionLikeEvidenceReadinessReconciliationCheckpoint.rows) {
  assert.equal(row.reconciliation, 'blocked-and-consistent');
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.inputs.length > 0);
  assert.ok(row.blockers.length > 0);
}

assert.ok(rowsForBlocker('missing-real-or-production-like-traces').length >= 2);
assert.ok(rowsForBlocker('package-health-missing-real-evidence').length >= 2);
assert.ok(rowsForBlocker('production-runtime-readiness-no').length >= 2);
assert.ok(rowsForBlocker('real-production-like-sample-missing').length >= 3);
assert.ok(rowsForBlocker('real-exported-corpus-missing').length >= 3);

assert.ok(
  rowForSignal('production-wiring-evidence-blocker-still-open').inputs.includes('production-wiring-gate-summary'),
);
assert.ok(rowForSignal('package-health-still-missing-real-evidence').inputs.includes('package-health-rollup'));
assert.ok(rowForSignal('p0-real-evidence-targets-still-open').inputs.includes('next-evidence-target-report'));
assert.ok(rowForSignal('readiness-checklist-still-not-production-ready').inputs.includes('pilot-readiness-checklist'));
assert.ok(rowForSignal('runbook-still-evidence-interpretation-only').inputs.includes('real-corpus-runbook'));

assert.equal(packageHealth.status, 'missing-real-evidence');
assert.equal(packageHealth.readyForProductionRuntime, false);
assert.equal(packageHealth.realSampleGapCount, 47);
assert.equal(packageHealth.p0IntakeTargetStatusLinkStatus, 'linked');
assert.equal(packageHealth.p0IntakeTargetStatusLinkMissingSignalCount, 0);
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
assert.equal(closeoutAudit.status, 'aligned');
assert.equal(closeoutAudit.readyForProductionRuntime, false);
assert.equal(closeoutAudit.realSampleGapCount, 47);

assert.match(productionWiringSummarySmokeSource, /missing-real-or-production-like-traces/u);
assert.match(productionWiringSummarySmokeSource, /production-wiring-deferred/u);
assert.match(positiveGateCloseoutSmokeSource, /real-production-like-trace-corpus/u);
assert.match(positiveGateCloseoutSmokeSource, /positive-gate-remains-closed/u);
assert.match(productionAuthorityDriftGuardSmokeSource, /no-production-authority-drift-detected/u);

assertContains(readinessText, '- package health: `missing-real-evidence`', 'pilot readiness checklist');
assertContains(
  readinessText,
  '- current P0 target kinds: `real-production-like-sample`, `real-exported-corpus`',
  'pilot readiness checklist',
);
assertContains(readinessText, '- production runtime readiness: `no`', 'pilot readiness checklist');
assertContains(
  readinessText,
  'real evidence is not closed',
  'pilot readiness checklist',
);
assertContains(
  runbookText,
  'The next decision after this runbook is evidence interpretation, not production wiring.',
  'real corpus runbook',
);
assertContains(
  runbookText,
  'manual prioritization aids, not a runtime action order',
  'real corpus runbook',
);
assertContains(auditText, 'Real Or Production-Like Evidence Readiness Reconciliation Checkpoint Status', 'preflight audit');
assertContains(
  auditText,
  'evidence-readiness reconciliation, not a production wiring plan',
  'preflight audit',
);
assertContains(statusText, 'V3 runtime boundary real or production-like evidence readiness reconciliation checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-real-production-like-evidence-readiness-reconciliation-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(realProductionLikeEvidenceReadinessReconciliationCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Evidence-readiness reconciliation must not grant production authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready/u,
  'Evidence-readiness reconciliation must not become a production wiring plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /adapterContractPromotionAllowed|payloadContractPromotionAllowed|formalPolicyContractReady|formalContractReady/u,
  'Evidence-readiness reconciliation should not promote payload, adapter, or controller contracts.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Evidence-readiness reconciliation should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Evidence-readiness reconciliation should stay a non-production checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Evidence-readiness reconciliation must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Evidence-readiness reconciliation must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary real production-like evidence readiness reconciliation checkpoint smoke ok');
