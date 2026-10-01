import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedPostRecheckBlockerWordingInput =
  | 'caller-owned-post-closeout-production-gate-recheck'
  | 'caller-owned-post-recheck-remaining-blocker-handoff'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'generic-post-recheck-remaining-blocker-handoff'
  | 'preflight-audit'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page';

type CallerOwnedPostRecheckBlockerWordingGroup =
  | 'caller-owned-real-exported-intake'
  | 'current-real-trace-evidence'
  | 'manual-interpretation'
  | 'production-gate'
  | 'remaining-non-evidence-production';

type CallerOwnedPostRecheckBlockerWordingTerm =
  | 'agent-session-v2-production-owner-retained'
  | 'caller-owned-evidence-blocker'
  | 'controller-policy-contracts-missing'
  | 'current-evidence-blocker'
  | 'does-not-clear-non-evidence-blockers'
  | 'manual-evidence-interpretation-not-ready'
  | 'manual-interpretation-not-ready'
  | 'missing-real-or-production-like-traces'
  | 'no-explicit-real-exported-intake'
  | 'non-evidence-blockers-remain'
  | 'package-health-missing-real-evidence'
  | 'p0-real-exported-corpus-missing'
  | 'production-adapter-contracts-missing'
  | 'production-gate-closed'
  | 'remaining-non-evidence-blocker'
  | 'runtime-action-order-not-owned-by-v3';

interface CallerOwnedPostRecheckBlockerWordingRow {
  group: CallerOwnedPostRecheckBlockerWordingGroup;
  inputs: readonly CallerOwnedPostRecheckBlockerWordingInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  status: 'wording-consistent-still-blocked';
  terms: readonly CallerOwnedPostRecheckBlockerWordingTerm[];
}

interface CallerOwnedPostRecheckBlockerWordingConsistencyCheckpoint {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-consistency';
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedPostRecheckBlockerWordingRow[];
  summaryDecision: 'caller-owned-blocker-wording-consistent-positive-gate-closed';
}

const sharedInputs = [
  'caller-owned-post-closeout-production-gate-recheck',
  'caller-owned-post-recheck-remaining-blocker-handoff',
  'generic-post-recheck-remaining-blocker-handoff',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedPostRecheckBlockerWordingInput[];

const callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint = {
  gate: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-blocker-wording-consistency',
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      group: 'caller-owned-real-exported-intake',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      status: 'wording-consistent-still-blocked',
      terms: [
        'caller-owned-evidence-blocker',
        'no-explicit-real-exported-intake',
        'p0-real-exported-corpus-missing',
      ],
    },
    {
      group: 'current-real-trace-evidence',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      status: 'wording-consistent-still-blocked',
      terms: [
        'current-evidence-blocker',
        'missing-real-or-production-like-traces',
        'package-health-missing-real-evidence',
      ],
    },
    {
      group: 'manual-interpretation',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      status: 'wording-consistent-still-blocked',
      terms: [
        'caller-owned-evidence-blocker',
        'manual-interpretation-not-ready',
        'manual-evidence-interpretation-not-ready',
      ],
    },
    {
      group: 'production-gate',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      status: 'wording-consistent-still-blocked',
      terms: [
        'production-gate-closed',
        'non-evidence-blockers-remain',
        'does-not-clear-non-evidence-blockers',
      ],
    },
    {
      group: 'remaining-non-evidence-production',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
      status: 'wording-consistent-still-blocked',
      terms: [
        'remaining-non-evidence-blocker',
        'agent-session-v2-production-owner-retained',
        'production-adapter-contracts-missing',
        'controller-policy-contracts-missing',
        'runtime-action-order-not-owned-by-v3',
      ],
    },
  ],
  summaryDecision: 'caller-owned-blocker-wording-consistent-positive-gate-closed',
} as const satisfies CallerOwnedPostRecheckBlockerWordingConsistencyCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForGroup(group: CallerOwnedPostRecheckBlockerWordingGroup) {
  const row = callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.rows
    .find((candidate) => candidate.group === group);

  assert.ok(row, `${group} should exist in the caller-owned post-recheck blocker wording checkpoint.`);
  return row;
}

function stripNegativeAssertionBlocks(text: string) {
  const keptLines: string[] = [];
  let skipping = false;

  for (const line of text.split(/\r?\n/u)) {
    if (line.includes('assert.doesNotMatch(')) {
      skipping = true;
      continue;
    }

    if (skipping) {
      if (line.trim() === ');') {
        skipping = false;
      }
      continue;
    }

    keptLines.push(line);
  }

  return keptLines.join('\n');
}

const boundarySource = readProjectFile('src/agent/agentSessionV3RuntimeBoundary.ts');
const auditText = readProjectFile('PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md');
const statusText = readProjectFile('PROJECT_AGENT_V2_STATUS.md');
const callerOwnedGateRecheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-co-prod-gate-rchk-ckpt-smoke.ts',
);
const callerOwnedBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-remaining-blocker-handoff-ckpt-smoke.ts',
);
const genericBlockerHandoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const evidenceMappingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);
const nonEvidenceInventorySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.productionAuthority, false);
assert.equal(callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.productionReady, false);
assert.equal(callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.summaryDecision,
  'caller-owned-blocker-wording-consistent-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.rows.map((row) => row.group).sort(),
  [
    'caller-owned-real-exported-intake',
    'current-real-trace-evidence',
    'manual-interpretation',
    'production-gate',
    'remaining-non-evidence-production',
  ],
);

for (const row of callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint.rows) {
  assert.equal(row.status, 'wording-consistent-still-blocked');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
  assert.ok(row.terms.length > 0);
}

for (const term of rowForGroup('caller-owned-real-exported-intake').terms) {
  assertContains(callerOwnedBlockerHandoffSmokeSource, term, 'caller-owned blocker handoff smoke');
}

assertContains(callerOwnedGateRecheckSmokeSource, 'no-explicit-real-exported-intake', 'caller-owned gate recheck smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'p0-real-exported-corpus-missing', 'caller-owned gate recheck smoke');
assertContains(evidenceMappingSmokeSource, 'p0-real-exported-corpus-missing', 'evidence mapping smoke');

assertContains(callerOwnedBlockerHandoffSmokeSource, 'current-evidence-blocker', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'missing-real-or-production-like-traces', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedBlockerHandoffSmokeSource, 'package-health-missing-real-evidence', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'missing-real-or-production-like-traces', 'caller-owned gate recheck smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'package-health-missing-real-evidence', 'caller-owned gate recheck smoke');
assertContains(genericBlockerHandoffSmokeSource, 'missing-real-or-production-like-traces', 'generic blocker handoff smoke');
assertContains(evidenceMappingSmokeSource, 'missing-real-or-production-like-traces', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, "flattenedBlockers.includes('missing-real-or-production-like-traces'), false", 'non-evidence inventory smoke');

assertContains(callerOwnedBlockerHandoffSmokeSource, 'manual-interpretation-not-ready', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'manual-interpretation-not-ready', 'caller-owned gate recheck smoke');
assertContains(evidenceMappingSmokeSource, 'manual-evidence-interpretation-not-ready', 'evidence mapping smoke');

assertContains(callerOwnedBlockerHandoffSmokeSource, 'production-gate-closed', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'production-gate-closed', 'caller-owned gate recheck smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'non-evidence-blockers-remain', 'caller-owned gate recheck smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');
assertContains(evidenceMappingSmokeSource, 'does-not-clear-non-evidence-blockers', 'evidence mapping smoke');

for (const term of [
  'agent-session-v2-production-owner-retained',
  'production-adapter-contracts-missing',
  'controller-policy-contracts-missing',
  'runtime-action-order-not-owned-by-v3',
] as const) {
  assertContains(callerOwnedBlockerHandoffSmokeSource, term, 'caller-owned blocker handoff smoke');
  assertContains(callerOwnedGateRecheckSmokeSource, term, 'caller-owned gate recheck smoke');
  assertContains(genericBlockerHandoffSmokeSource, term, 'generic blocker handoff smoke');
  assertContains(nonEvidenceInventorySmokeSource, term, 'non-evidence inventory smoke');
  assertContains(evidenceMappingSmokeSource, term, 'evidence mapping smoke');
}

assertContains(callerOwnedBlockerHandoffSmokeSource, 'caller-owned-remaining-blockers-handed-off-positive-gate-closed', 'caller-owned blocker handoff smoke');
assertContains(callerOwnedGateRecheckSmokeSource, 'caller-owned-post-closeout-positive-gate-remains-closed-evidence-still-missing', 'caller-owned gate recheck smoke');
assertContains(genericBlockerHandoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'generic blocker handoff smoke');
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(auditText, 'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Blocker Wording Consistency Checkpoint Status', 'preflight audit');
assertContains(auditText, 'blocker wording is consistent across caller-owned recheck, handoff, generic handoff, evidence mapping, and non-evidence inventory', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck blocker wording consistency checkpoint', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-rx-intake-review-post-rchk-blocker-word-cons-ckpt-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const serializedCheckpoint = JSON.stringify(callerOwnedPostRecheckBlockerWordingConsistencyCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned blocker wording checkpoint must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|ready-for-production-wiring|production-wiring-ready|productionGateCleared":true/u,
  'Caller-owned blocker wording checkpoint must not become a production wiring plan or clear the gate.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned blocker wording checkpoint should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned blocker wording checkpoint should not prescribe concrete desktop tools.',
);

for (const [label, source] of [
  ['caller-owned blocker handoff', callerOwnedBlockerHandoffSmokeSource],
  ['caller-owned gate recheck', callerOwnedGateRecheckSmokeSource],
  ['generic blocker handoff', genericBlockerHandoffSmokeSource],
  ['evidence mapping', evidenceMappingSmokeSource],
  ['non-evidence inventory', nonEvidenceInventorySmokeSource],
] as const) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);

  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true/u,
    `${label} source wording must not claim positive production readiness outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} source wording must not define queues, required order, tool decisions, or controller actions outside negative assertions.`,
  );
}

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned blocker wording checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned blocker wording checkpoint must not add production calls to the boundary contract.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck blocker wording consistency checkpoint smoke ok');
