import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type Precondition =
  | 'adapter-evidence-source-identified'
  | 'debug-shadow-exit-criteria-defined'
  | 'non-fixed-scheduling-invariants-defined'
  | 'payload-field-source-map-complete'
  | 'permission-and-tool-delegation-policy-defined'
  | 'phase-payload-readiness-source-complete'
  | 'production-attachment-switch-defined'
  | 'production-orchestrator-transfer-policy-defined'
  | 'real-or-production-like-trace-sample-available'
  | 'runtime-action-order-ownership-model-defined'
  | 'stop-payload-terminal-semantics-defined'
  | 'v2-retained-owner-handoff-policy-defined';

type EvidenceSourceCategory =
  | 'controller-policy-evidence-source'
  | 'phase-payload-evidence-source'
  | 'production-adapter-evidence-source'
  | 'production-ownership-evidence-source'
  | 'real-trace-evidence-source'
  | 'runtime-attachment-evidence-source'
  | 'scheduling-invariant-evidence-source'
  | 'stop-payload-semantics-evidence-source';

type Source =
  | 'contract-drafting-negative-gate'
  | 'owner-contract-preconditions'
  | 'precondition-evidence-source-gap'
  | 'precondition-evidence-source-gap-negative-gate'
  | 'runtime-boundary-contract'
  | 'preflight-audit'
  | 'status-page';

interface EvidenceSourceGapNegativeGateConsistencyRow {
  aligned: true;
  autoCollectionAllowed: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  evidenceSourceCategory: EvidenceSourceCategory;
  isContractDraft: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  negativeGateDecision: 'mapped-evidence-sources-do-not-open-contract-drafting';
  positiveGateAllowed: false;
  precondition: Precondition;
  productionAuthority: false;
  productionReady: false;
  sourceGapDecision: 'future-owner-precondition-evidence-source-gaps-remain-open';
  sourceMappedOnly: true;
  sources: readonly Source[];
  status: 'aligned-negative-gate-closed';
}

interface EvidenceSourceGapNegativeGateConsistencyCheckpoint {
  checkpoint: 'future-owner-precondition-evidence-source-gap-negative-gate-consistency';
  aligned: true;
  autoCollectionAllowed: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  isContractDraft: false;
  isExecutionOrder: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly EvidenceSourceGapNegativeGateConsistencyRow[];
  sourceMappedOnly: true;
  summaryDecision: 'source-gap-and-negative-gate-remain-aligned-closed';
}

const sources = [
  'contract-drafting-negative-gate',
  'owner-contract-preconditions',
  'precondition-evidence-source-gap',
  'precondition-evidence-source-gap-negative-gate',
  'runtime-boundary-contract',
  'preflight-audit',
  'status-page',
] as const satisfies readonly Source[];

function row(precondition: Precondition, evidenceSourceCategory: EvidenceSourceCategory) {
  return {
    aligned: true,
    autoCollectionAllowed: false,
    contractDraftingReady: false,
    evidenceCollectedNow: false,
    evidenceSatisfied: false,
    evidenceSourceCategory,
    isContractDraft: false,
    isExecutionOrder: false,
    isProductionWiringPlan: false,
    negativeGateDecision: 'mapped-evidence-sources-do-not-open-contract-drafting',
    positiveGateAllowed: false,
    precondition,
    productionAuthority: false,
    productionReady: false,
    sourceGapDecision: 'future-owner-precondition-evidence-source-gaps-remain-open',
    sourceMappedOnly: true,
    sources,
    status: 'aligned-negative-gate-closed',
  } as const satisfies EvidenceSourceGapNegativeGateConsistencyRow;
}

const checkpoint = {
  checkpoint: 'future-owner-precondition-evidence-source-gap-negative-gate-consistency',
  aligned: true,
  autoCollectionAllowed: false,
  contractDraftingReady: false,
  evidenceCollectedNow: false,
  evidenceSatisfied: false,
  isContractDraft: false,
  isExecutionOrder: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('v2-retained-owner-handoff-policy-defined', 'production-ownership-evidence-source'),
    row('production-orchestrator-transfer-policy-defined', 'production-ownership-evidence-source'),
    row('debug-shadow-exit-criteria-defined', 'runtime-attachment-evidence-source'),
    row('production-attachment-switch-defined', 'runtime-attachment-evidence-source'),
    row('adapter-evidence-source-identified', 'production-adapter-evidence-source'),
    row('real-or-production-like-trace-sample-available', 'real-trace-evidence-source'),
    row('permission-and-tool-delegation-policy-defined', 'controller-policy-evidence-source'),
    row('stop-payload-terminal-semantics-defined', 'stop-payload-semantics-evidence-source'),
    row('phase-payload-readiness-source-complete', 'phase-payload-evidence-source'),
    row('payload-field-source-map-complete', 'phase-payload-evidence-source'),
    row('non-fixed-scheduling-invariants-defined', 'scheduling-invariant-evidence-source'),
    row('runtime-action-order-ownership-model-defined', 'scheduling-invariant-evidence-source'),
  ],
  sourceMappedOnly: true,
  summaryDecision: 'source-gap-and-negative-gate-remain-aligned-closed',
} as const satisfies EvidenceSourceGapNegativeGateConsistencyCheckpoint;

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

assert.equal(checkpoint.aligned, true);
assert.equal(checkpoint.autoCollectionAllowed, false);
assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.evidenceCollectedNow, false);
assert.equal(checkpoint.evidenceSatisfied, false);
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.sourceMappedOnly, true);
assert.equal(checkpoint.summaryDecision, 'source-gap-and-negative-gate-remain-aligned-closed');

assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.precondition)),
  [
    'adapter-evidence-source-identified',
    'debug-shadow-exit-criteria-defined',
    'non-fixed-scheduling-invariants-defined',
    'payload-field-source-map-complete',
    'permission-and-tool-delegation-policy-defined',
    'phase-payload-readiness-source-complete',
    'production-attachment-switch-defined',
    'production-orchestrator-transfer-policy-defined',
    'real-or-production-like-trace-sample-available',
    'runtime-action-order-ownership-model-defined',
    'stop-payload-terminal-semantics-defined',
    'v2-retained-owner-handoff-policy-defined',
  ],
);
assert.deepEqual(
  uniqueSorted(checkpoint.rows.map((candidate) => candidate.evidenceSourceCategory)),
  [
    'controller-policy-evidence-source',
    'phase-payload-evidence-source',
    'production-adapter-evidence-source',
    'production-ownership-evidence-source',
    'real-trace-evidence-source',
    'runtime-attachment-evidence-source',
    'scheduling-invariant-evidence-source',
    'stop-payload-semantics-evidence-source',
  ],
);

for (const checkpointRow of checkpoint.rows) {
  assert.equal(checkpointRow.status, 'aligned-negative-gate-closed');
  assert.equal(checkpointRow.aligned, true);
  assert.equal(checkpointRow.autoCollectionAllowed, false);
  assert.equal(checkpointRow.contractDraftingReady, false);
  assert.equal(checkpointRow.evidenceCollectedNow, false);
  assert.equal(checkpointRow.evidenceSatisfied, false);
  assert.equal(checkpointRow.isContractDraft, false);
  assert.equal(checkpointRow.isExecutionOrder, false);
  assert.equal(checkpointRow.isProductionWiringPlan, false);
  assert.equal(checkpointRow.negativeGateDecision, 'mapped-evidence-sources-do-not-open-contract-drafting');
  assert.equal(checkpointRow.productionAuthority, false);
  assert.equal(checkpointRow.productionReady, false);
  assert.equal(checkpointRow.positiveGateAllowed, false);
  assert.equal(checkpointRow.sourceGapDecision, 'future-owner-precondition-evidence-source-gaps-remain-open');
  assert.equal(checkpointRow.sourceMappedOnly, true);
  assert.deepEqual(checkpointRow.sources, sources);
  assertContains(sourceGapSource, checkpointRow.precondition, 'precondition evidence source gap source');
  assertContains(sourceGapSource, checkpointRow.evidenceSourceCategory, 'precondition evidence source gap source');
  assertContains(sourceGapNegativeGateSource, checkpointRow.precondition, 'precondition evidence source gap negative gate source');
  assertContains(
    sourceGapNegativeGateSource,
    checkpointRow.evidenceSourceCategory,
    'precondition evidence source gap negative gate source',
  );
  assertContains(preconditionSource, checkpointRow.precondition, 'precondition source');
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
assertContains(sourceGapNegativeGateSource, 'sourceMappedOnly: true', 'source gap negative gate source');
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
  'Future Owner Precondition Evidence Source Gap Negative Gate Consistency Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'source gap and negative gate remain aligned closed',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary future owner precondition evidence source gap negative gate consistency checkpoint',
  'status page',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-precondition-evidence-source-gap-negative-gate-consistency-smoke.ts',
  'status page',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['source gap source', sourceGapSource],
  ['source gap negative gate source', sourceGapNegativeGateSource],
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
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true|evidenceSatisfied:\s*true/u,
    `${label} source wording must not claim positive production or evidence satisfaction outside negative assertions.`,
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
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|evidenceSatisfied":true/u,
  'Evidence source gap negative gate consistency must not grant production or evidence readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoCollectionAllowed":true|evidenceCollectedNow":true|contractDraftingReady":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true/u,
  'Evidence source gap negative gate consistency must not collect evidence, draft contracts, or define execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Evidence source gap negative gate consistency must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Evidence source gap negative gate consistency must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary precondition evidence source gap negative gate consistency smoke ok');
