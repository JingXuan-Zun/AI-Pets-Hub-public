import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type SourceGapChainCheckpoint =
  | 'precondition-evidence-source-gap'
  | 'precondition-evidence-source-gap-negative-gate'
  | 'precondition-evidence-source-gap-negative-gate-consistency'
  | 'precondition-evidence-source-gap-negative-gate-consistency-closeout';

type Source =
  | 'source-gap'
  | 'source-gap-negative-gate'
  | 'source-gap-negative-gate-consistency'
  | 'source-gap-negative-gate-consistency-closeout'
  | 'contract-drafting-negative-gate'
  | 'owner-contract-preconditions'
  | 'runtime-boundary-contract'
  | 'preflight-audit'
  | 'status-page';

interface SourceGapChainFinalGuardRow {
  autoCollectionAllowed: false;
  chainCheckpoint: SourceGapChainCheckpoint;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  finalGuardStatus: 'wording-drift-guarded';
  isContractDraft: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  sources: readonly Source[];
}

interface SourceGapChainFinalGuardCheckpoint {
  checkpoint: 'future-owner-precondition-evidence-source-gap-closeout-chain-final-guard';
  autoCollectionAllowed: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  finalGuardStatus: 'wording-drift-guarded';
  isContractDraft: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly SourceGapChainFinalGuardRow[];
  summaryDecision: 'closed-source-gap-chain-guarded-against-readiness-drift';
}

const sources = [
  'source-gap',
  'source-gap-negative-gate',
  'source-gap-negative-gate-consistency',
  'source-gap-negative-gate-consistency-closeout',
  'contract-drafting-negative-gate',
  'owner-contract-preconditions',
  'runtime-boundary-contract',
  'preflight-audit',
  'status-page',
] as const satisfies readonly Source[];

function row(chainCheckpoint: SourceGapChainCheckpoint) {
  return {
    autoCollectionAllowed: false,
    chainCheckpoint,
    contractDraftingReady: false,
    evidenceCollectedNow: false,
    evidenceSatisfied: false,
    finalGuardStatus: 'wording-drift-guarded',
    isContractDraft: false,
    isExecutionOrder: false,
    isProductionWiringPlan: false,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    sources,
  } as const satisfies SourceGapChainFinalGuardRow;
}

const checkpoint = {
  checkpoint: 'future-owner-precondition-evidence-source-gap-closeout-chain-final-guard',
  autoCollectionAllowed: false,
  contractDraftingReady: false,
  evidenceCollectedNow: false,
  evidenceSatisfied: false,
  finalGuardStatus: 'wording-drift-guarded',
  isContractDraft: false,
  isExecutionOrder: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('precondition-evidence-source-gap'),
    row('precondition-evidence-source-gap-negative-gate'),
    row('precondition-evidence-source-gap-negative-gate-consistency'),
    row('precondition-evidence-source-gap-negative-gate-consistency-closeout'),
  ],
  summaryDecision: 'closed-source-gap-chain-guarded-against-readiness-drift',
} as const satisfies SourceGapChainFinalGuardCheckpoint;

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
const sourceGapSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-precondition-evidence-source-gap-smoke.ts',
);
const sourceGapNegativeGateSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-precondition-evidence-source-gap-negative-gate-smoke.ts',
);
const consistencySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-precondition-evidence-source-gap-negative-gate-consistency-smoke.ts',
);
const closeoutSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-precondition-evidence-source-gap-negative-gate-consistency-closeout-smoke.ts',
);
const contractDraftingNegativeGateSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-contract-drafting-negative-gate-smoke.ts',
);
const preconditionSource = readProjectFile(
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
assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.evidenceCollectedNow, false);
assert.equal(checkpoint.evidenceSatisfied, false);
assert.equal(checkpoint.finalGuardStatus, 'wording-drift-guarded');
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.summaryDecision, 'closed-source-gap-chain-guarded-against-readiness-drift');

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.chainCheckpoint)),
  [
    'precondition-evidence-source-gap',
    'precondition-evidence-source-gap-negative-gate',
    'precondition-evidence-source-gap-negative-gate-consistency',
    'precondition-evidence-source-gap-negative-gate-consistency-closeout',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(checkpointRow.autoCollectionAllowed, false);
  assert.equal(checkpointRow.contractDraftingReady, false);
  assert.equal(checkpointRow.evidenceCollectedNow, false);
  assert.equal(checkpointRow.evidenceSatisfied, false);
  assert.equal(checkpointRow.finalGuardStatus, 'wording-drift-guarded');
  assert.equal(checkpointRow.isContractDraft, false);
  assert.equal(checkpointRow.isExecutionOrder, false);
  assert.equal(checkpointRow.isProductionWiringPlan, false);
  assert.equal(checkpointRow.productionAuthority, false);
  assert.equal(checkpointRow.productionReady, false);
  assert.equal(checkpointRow.positiveGateAllowed, false);
  assert.deepEqual(checkpointRow.sources, sources);
}

assertContains(sourceGapSource, 'future-owner-precondition-evidence-source-gaps-remain-open', 'source gap source');
assertContains(sourceGapSource, 'evidenceCollectedNow: false', 'source gap source');
assertContains(sourceGapSource, 'contractDraftingReady: false', 'source gap source');
assertContains(
  sourceGapNegativeGateSource,
  'mapped-evidence-sources-do-not-open-contract-drafting',
  'source gap negative gate source',
);
assertContains(sourceGapNegativeGateSource, 'evidenceSatisfied: false', 'source gap negative gate source');
assertContains(consistencySource, 'source-gap-and-negative-gate-remain-aligned-closed', 'consistency source');
assertContains(closeoutSource, 'source-gap-negative-gate-consistency-chain-closed-without-readiness', 'closeout source');
assertContains(closeoutSource, 'closed-with-negative-gate-retained', 'closeout source');
assertContains(
  contractDraftingNegativeGateSource,
  'future-owner-contract-drafting-negative-gate-remains-closed',
  'contract drafting negative gate source',
);
assertContains(
  preconditionSource,
  'future-owner-contract-drafting-preconditions-listed-positive-gate-closed',
  'precondition source',
);
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(
  auditText,
  'Future Owner Precondition Evidence Source Gap Closeout Chain Final Guard Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'closed source-gap chain is guarded against readiness drift',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary future owner precondition evidence source gap closeout chain final guard checkpoint',
  'status page',
);
assertContains(statusText, 'agent-session-v3-runtime-boundary-source-gap-chain-final-guard-smoke.ts', 'status page');
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['source gap source', sourceGapSource],
  ['source gap negative gate source', sourceGapNegativeGateSource],
  ['consistency source', consistencySource],
  ['closeout source', closeoutSource],
  ['contract drafting negative gate source', contractDraftingNegativeGateSource],
  ['precondition source', preconditionSource],
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
  'Source-gap chain final guard must not grant production, evidence, or contract readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoCollectionAllowed":true|evidenceCollectedNow":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true/u,
  'Source-gap chain final guard must not collect evidence, draft contracts, or define execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-gap chain final guard must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-gap chain final guard must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary source gap chain final guard smoke ok');












