import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CloseoutSummaryFacet =
  | 'caller-owned-intake-blockers-separated'
  | 'contract-drafting-status-unchanged'
  | 'current-evidence-blockers-separated'
  | 'evidence-status-unchanged'
  | 'final-guard-outcome-summarized'
  | 'manual-interpretation-blockers-separated'
  | 'production-runtime-authority-unchanged'
  | 'remaining-non-evidence-production-blockers-separated';

type Source =
  | 'source-gap-chain-final-guard'
  | 'source-gap-negative-gate-consistency-closeout'
  | 'precondition-evidence-source-gap'
  | 'contract-drafting-negative-gate'
  | 'owner-contract-preconditions'
  | 'remaining-non-evidence-blocker-inventory'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'runtime-boundary-contract'
  | 'preflight-audit'
  | 'status-page';

interface SourceGapChainFinalGuardCloseoutSummaryRow {
  autoCollectionAllowed: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  facet: CloseoutSummaryFacet;
  isContractDraft: false;
  isExecutionOrder: false;
  isImplementationTaskList: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  sources: readonly Source[];
  summaryStatus: 'closeout-summary-non-production';
}

interface SourceGapChainFinalGuardCloseoutSummaryCheckpoint {
  checkpoint: 'future-owner-precondition-evidence-source-gap-closeout-chain-final-guard-closeout-summary';
  autoCollectionAllowed: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  isContractDraft: false;
  isExecutionOrder: false;
  isImplementationTaskList: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly SourceGapChainFinalGuardCloseoutSummaryRow[];
  summaryDecision: 'source-gap-final-guard-closeout-summary-remains-non-production';
}

const sources = [
  'source-gap-chain-final-guard',
  'source-gap-negative-gate-consistency-closeout',
  'precondition-evidence-source-gap',
  'contract-drafting-negative-gate',
  'owner-contract-preconditions',
  'remaining-non-evidence-blocker-inventory',
  'evidence-interpretation-to-production-gate-mapping',
  'runtime-boundary-contract',
  'preflight-audit',
  'status-page',
] as const satisfies readonly Source[];

function row(facet: CloseoutSummaryFacet) {
  return {
    autoCollectionAllowed: false,
    contractDraftingReady: false,
    evidenceCollectedNow: false,
    evidenceSatisfied: false,
    facet,
    isContractDraft: false,
    isExecutionOrder: false,
    isImplementationTaskList: false,
    isProductionWiringPlan: false,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    sources,
    summaryStatus: 'closeout-summary-non-production',
  } as const satisfies SourceGapChainFinalGuardCloseoutSummaryRow;
}

const checkpoint = {
  checkpoint: 'future-owner-precondition-evidence-source-gap-closeout-chain-final-guard-closeout-summary',
  autoCollectionAllowed: false,
  contractDraftingReady: false,
  evidenceCollectedNow: false,
  evidenceSatisfied: false,
  isContractDraft: false,
  isExecutionOrder: false,
  isImplementationTaskList: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('final-guard-outcome-summarized'),
    row('evidence-status-unchanged'),
    row('contract-drafting-status-unchanged'),
    row('production-runtime-authority-unchanged'),
    row('caller-owned-intake-blockers-separated'),
    row('current-evidence-blockers-separated'),
    row('manual-interpretation-blockers-separated'),
    row('remaining-non-evidence-production-blockers-separated'),
  ],
  summaryDecision: 'source-gap-final-guard-closeout-summary-remains-non-production',
} as const satisfies SourceGapChainFinalGuardCloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function uniqueSorted(values: readonly string[]) {
  return Array.from(new Set(values)).sort();
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
const sourceGapFinalGuardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-final-guard-smoke.ts',
);
const sourceGapConsistencyCloseoutSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-precondition-evidence-source-gap-negative-gate-consistency-closeout-smoke.ts',
);
const sourceGapSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-precondition-evidence-source-gap-smoke.ts',
);
const contractDraftingNegativeGateSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-contract-drafting-negative-gate-smoke.ts',
);
const ownerPreconditionsSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-owner-contract-preconditions-checkpoint-smoke.ts',
);
const blockerInventorySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-remaining-non-evidence-production-blocker-inventory-checkpoint-smoke.ts',
);
const evidenceGateMappingSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-evidence-interpretation-to-production-gate-mapping-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.autoCollectionAllowed, false);
assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.evidenceCollectedNow, false);
assert.equal(checkpoint.evidenceSatisfied, false);
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isImplementationTaskList, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.summaryDecision, 'source-gap-final-guard-closeout-summary-remains-non-production');

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.facet)),
  [
    'caller-owned-intake-blockers-separated',
    'contract-drafting-status-unchanged',
    'current-evidence-blockers-separated',
    'evidence-status-unchanged',
    'final-guard-outcome-summarized',
    'manual-interpretation-blockers-separated',
    'production-runtime-authority-unchanged',
    'remaining-non-evidence-production-blockers-separated',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(checkpointRow.autoCollectionAllowed, false);
  assert.equal(checkpointRow.contractDraftingReady, false);
  assert.equal(checkpointRow.evidenceCollectedNow, false);
  assert.equal(checkpointRow.evidenceSatisfied, false);
  assert.equal(checkpointRow.isContractDraft, false);
  assert.equal(checkpointRow.isExecutionOrder, false);
  assert.equal(checkpointRow.isImplementationTaskList, false);
  assert.equal(checkpointRow.isProductionWiringPlan, false);
  assert.equal(checkpointRow.productionAuthority, false);
  assert.equal(checkpointRow.productionReady, false);
  assert.equal(checkpointRow.positiveGateAllowed, false);
  assert.equal(checkpointRow.summaryStatus, 'closeout-summary-non-production');
  assert.deepEqual(checkpointRow.sources, sources);
}

assertContains(
  sourceGapFinalGuardSource,
  'closed-source-gap-chain-guarded-against-readiness-drift',
  'source gap final guard source',
);
assertContains(sourceGapFinalGuardSource, 'evidenceSatisfied: false', 'source gap final guard source');
assertContains(sourceGapFinalGuardSource, 'contractDraftingReady: false', 'source gap final guard source');
assertContains(
  sourceGapConsistencyCloseoutSource,
  'source-gap-negative-gate-consistency-chain-closed-without-readiness',
  'source gap consistency closeout source',
);
assertContains(sourceGapConsistencyCloseoutSource, 'evidenceCollectedNow: false', 'source gap consistency closeout');
assertContains(sourceGapSource, 'future-owner-precondition-evidence-source-gaps-remain-open', 'source gap source');
assertContains(
  contractDraftingNegativeGateSource,
  'future-owner-contract-drafting-negative-gate-remains-closed',
  'contract drafting negative gate source',
);
assertContains(
  ownerPreconditionsSource,
  'future-owner-contract-drafting-preconditions-listed-positive-gate-closed',
  'owner preconditions source',
);
assertContains(
  blockerInventorySource,
  'non-evidence-blockers-remain-positive-gate-closed',
  'blocker inventory source',
);
assertContains(
  evidenceGateMappingSource,
  'mapping-only-positive-gate-remains-closed',
  'evidence gate mapping source',
);
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(
  auditText,
  'Future Owner Precondition Evidence Source Gap Closeout Chain Final Guard Closeout Summary Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'source gap final guard closeout summary remains non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary future owner precondition evidence source gap closeout chain final guard closeout summary checkpoint',
  'status page',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-source-gap-chain-final-guard-closeout-summary-smoke.ts',
  'status page',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['source gap final guard source', sourceGapFinalGuardSource],
  ['source gap consistency closeout source', sourceGapConsistencyCloseoutSource],
  ['source gap source', sourceGapSource],
  ['contract drafting negative gate source', contractDraftingNegativeGateSource],
  ['owner preconditions source', ownerPreconditionsSource],
  ['blocker inventory source', blockerInventorySource],
  ['evidence gate mapping source', evidenceGateMappingSource],
  ['preflight audit', auditText],
  ['status page', statusText],
  ['runtime boundary', boundarySource],
] as const;

for (const [label, source] of guardedSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);

  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true|evidenceSatisfied:\s*true|contractDraftingReady:\s*true/u,
    `${label} source wording must not claim positive production, evidence, or contract readiness outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} source wording must not define queues, required order, tool decisions, or controller actions outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
    `${label} source wording must not prescribe concrete desktop tools outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
    `${label} source wording must not define fixed workflows outside negative assertions.`,
  );
}

const serializedCheckpoint = JSON.stringify(checkpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|evidenceSatisfied":true|contractDraftingReady":true/u,
  'Source-gap final guard closeout summary must not grant production, evidence, or contract readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoCollectionAllowed":true|evidenceCollectedNow":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true|isImplementationTaskList":true/u,
  'Source-gap final guard closeout summary must not collect evidence, draft contracts, list implementation tasks, or define execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-gap final guard closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-gap final guard closeout summary must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary source gap chain final guard closeout summary smoke ok');












