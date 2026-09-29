import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type GuardCloseoutSummarySignal =
  | 'blocker-separation-remains-non-authoritative'
  | 'closeout-summary-guard-summarized'
  | 'contract-drafting-remains-closed'
  | 'evidence-remains-unsatisfied'
  | 'fixed-tool-chain-remains-absent'
  | 'implementation-task-list-remains-absent'
  | 'production-authority-remains-absent'
  | 'runtime-action-order-remains-absent';

type Source =
  | 'source-gap-chain-final-guard-closeout-summary-guard'
  | 'source-gap-chain-final-guard-closeout-summary'
  | 'source-gap-chain-final-guard'
  | 'precondition-evidence-source-gap'
  | 'contract-drafting-negative-gate'
  | 'owner-contract-preconditions'
  | 'runtime-boundary-contract'
  | 'preflight-audit'
  | 'status-page';

interface SourceGapChainFinalGuardCloseoutSummaryGuardCloseoutSummaryRow {
  autoCollectionAllowed: false;
  closeoutStatus: 'closeout-summary-non-production';
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
  signal: GuardCloseoutSummarySignal;
  sources: readonly Source[];
}

interface SourceGapChainFinalGuardCloseoutSummaryGuardCloseoutSummaryCheckpoint {
  checkpoint: 'future-owner-precondition-evidence-source-gap-closeout-chain-final-guard-closeout-summary-guard-closeout-summary';
  autoCollectionAllowed: false;
  closeoutDecision: 'source-gap-final-guard-closeout-summary-guard-closeout-summary-remains-non-production';
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
  rows: readonly SourceGapChainFinalGuardCloseoutSummaryGuardCloseoutSummaryRow[];
}

const sources = [
  'source-gap-chain-final-guard-closeout-summary-guard',
  'source-gap-chain-final-guard-closeout-summary',
  'source-gap-chain-final-guard',
  'precondition-evidence-source-gap',
  'contract-drafting-negative-gate',
  'owner-contract-preconditions',
  'runtime-boundary-contract',
  'preflight-audit',
  'status-page',
] as const satisfies readonly Source[];

function row(signal: GuardCloseoutSummarySignal) {
  return {
    autoCollectionAllowed: false,
    closeoutStatus: 'closeout-summary-non-production',
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
    signal,
    sources,
  } as const satisfies SourceGapChainFinalGuardCloseoutSummaryGuardCloseoutSummaryRow;
}

const checkpoint = {
  checkpoint:
    'future-owner-precondition-evidence-source-gap-closeout-chain-final-guard-closeout-summary-guard-closeout-summary',
  autoCollectionAllowed: false,
  closeoutDecision: 'source-gap-final-guard-closeout-summary-guard-closeout-summary-remains-non-production',
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
    row('closeout-summary-guard-summarized'),
    row('evidence-remains-unsatisfied'),
    row('contract-drafting-remains-closed'),
    row('production-authority-remains-absent'),
    row('blocker-separation-remains-non-authoritative'),
    row('implementation-task-list-remains-absent'),
    row('fixed-tool-chain-remains-absent'),
    row('runtime-action-order-remains-absent'),
  ],
} as const satisfies SourceGapChainFinalGuardCloseoutSummaryGuardCloseoutSummaryCheckpoint;

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
const guardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-final-guard-closeout-summary-guard-smoke.ts',
);
const closeoutSummarySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-final-guard-closeout-summary-smoke.ts',
);
const sourceGapFinalGuardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-final-guard-smoke.ts',
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

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.autoCollectionAllowed, false);
assert.equal(
  checkpoint.closeoutDecision,
  'source-gap-final-guard-closeout-summary-guard-closeout-summary-remains-non-production',
);
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

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.signal)),
  [
    'blocker-separation-remains-non-authoritative',
    'closeout-summary-guard-summarized',
    'contract-drafting-remains-closed',
    'evidence-remains-unsatisfied',
    'fixed-tool-chain-remains-absent',
    'implementation-task-list-remains-absent',
    'production-authority-remains-absent',
    'runtime-action-order-remains-absent',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(checkpointRow.autoCollectionAllowed, false);
  assert.equal(checkpointRow.closeoutStatus, 'closeout-summary-non-production');
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
  assert.deepEqual(checkpointRow.sources, sources);
}

assertContains(
  guardSource,
  'source-gap-final-guard-closeout-summary-guard-remains-non-production',
  'closeout summary guard source',
);
assertContains(guardSource, "guardStatus: 'guarded-non-production'", 'closeout summary guard source');
assertContains(guardSource, 'isImplementationTaskList: false', 'closeout summary guard source');
assertContains(guardSource, 'isExecutionOrder: false', 'closeout summary guard source');
assertContains(
  closeoutSummarySource,
  'source-gap-final-guard-closeout-summary-remains-non-production',
  'closeout summary source',
);
assertContains(
  sourceGapFinalGuardSource,
  'closed-source-gap-chain-guarded-against-readiness-drift',
  'source gap final guard source',
);
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
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(
  auditText,
  'Future Owner Precondition Evidence Source Gap Closeout Chain Final Guard Closeout Summary Guard Closeout Summary Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'source gap final guard closeout summary guard closeout summary remains non-production',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary future owner precondition evidence source gap closeout chain final guard closeout summary guard closeout summary checkpoint',
  'status page',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-source-gap-chain-final-guard-closeout-summary-guard-closeout-summary-smoke.ts',
  'status page',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['closeout summary guard source', guardSource],
  ['closeout summary source', closeoutSummarySource],
  ['source gap final guard source', sourceGapFinalGuardSource],
  ['source gap source', sourceGapSource],
  ['contract drafting negative gate source', contractDraftingNegativeGateSource],
  ['owner preconditions source', ownerPreconditionsSource],
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
  'Source-gap closeout summary guard closeout summary must not grant production, evidence, or contract readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoCollectionAllowed":true|evidenceCollectedNow":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true|isImplementationTaskList":true/u,
  'Source-gap closeout summary guard closeout summary must not collect evidence, draft contracts, list implementation tasks, or define execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-gap closeout summary guard closeout summary must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-gap closeout summary guard closeout summary must not add production runtime calls.',
);

console.log(
  'agent session v3 runtime boundary source gap chain final guard closeout summary guard closeout summary smoke ok',
);












