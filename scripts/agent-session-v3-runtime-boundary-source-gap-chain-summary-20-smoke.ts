import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/agentSessionV3RuntimeBoundary.ts';


function repeatSegment(segment: string, count: number, separator: string) {
  return Array.from({ length: count }, () => segment).join(separator);
}

function buildKebabSummaryCheckpoint(summaryCount: number) {
  return `future-owner-precondition-evidence-source-gap-closeout-chain-final-${repeatSegment(
    'guard-closeout-summary',
    summaryCount,
    '-',
  )}`;
}

function buildKebabSummaryDecision(summaryCount: number) {
  return `source-gap-final-${repeatSegment('guard-closeout-summary', summaryCount, '-')}-remains-non-production`;
}

function buildKebabGuardDecision(summaryCount: number) {
  return `source-gap-final-${repeatSegment('guard-closeout-summary', summaryCount, '-')}-guard-remains-non-production`;
}

function buildTitleSummaryCheckpoint(summaryCount: number) {
  return `Future Owner Precondition Evidence Source Gap Closeout Chain Final ${repeatSegment(
    'Guard Closeout Summary',
    summaryCount,
    ' ',
  )} Checkpoint Status`;
}

function buildStatusSummaryCheckpoint(summaryCount: number) {
  return `V3 runtime boundary future owner precondition evidence source gap closeout chain final ${repeatSegment(
    'guard closeout summary',
    summaryCount,
    ' ',
  )} checkpoint`;
}

function buildTextSummaryDecision(summaryCount: number) {
  return `source gap final ${repeatSegment('guard closeout summary', summaryCount, ' ')} remains non-production`;
}

type CloseoutSummarySignal =
  | 'guard-summary-summarized'
  | 'evidence-remains-unsatisfied'
  | 'contract-drafting-remains-closed'
  | 'production-authority-remains-absent'
  | 'blocker-separation-remains-non-authoritative'
  | 'implementation-task-list-remains-absent'
  | 'fixed-tool-chain-remains-absent'
  | 'runtime-action-order-remains-absent';

interface CloseoutSummaryCheckpoint {
  checkpoint: string;
  autoCollectionAllowed: false;
  closeoutDecision: string;
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
  signals: readonly CloseoutSummarySignal[];
}

const summary20Checkpoint = buildKebabSummaryCheckpoint(20);
const summary20Decision = buildKebabSummaryDecision(20);
const guard20Decision = buildKebabGuardDecision(19);
const summary19Decision = buildKebabSummaryDecision(19);

const checkpoint = {
  checkpoint: summary20Checkpoint,
  autoCollectionAllowed: false,
  closeoutDecision: summary20Decision,
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
  signals: [
    'guard-summary-summarized',
    'evidence-remains-unsatisfied',
    'contract-drafting-remains-closed',
    'production-authority-remains-absent',
    'blocker-separation-remains-non-authoritative',
    'implementation-task-list-remains-absent',
    'fixed-tool-chain-remains-absent',
    'runtime-action-order-remains-absent',
  ],
} as const satisfies CloseoutSummaryCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
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
const previousGuardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-guard-20-smoke.ts',
);
const previousSummarySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-summary-19-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.checkpoint, summary20Checkpoint);
assert.equal(checkpoint.autoCollectionAllowed, false);
assert.equal(checkpoint.closeoutDecision, summary20Decision);
assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.evidenceCollectedNow, false);
assert.equal(checkpoint.evidenceSatisfied, false);
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isImplementationTaskList, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);

assert.deepEqual(checkpoint.signals, [
  'guard-summary-summarized',
  'evidence-remains-unsatisfied',
  'contract-drafting-remains-closed',
  'production-authority-remains-absent',
  'blocker-separation-remains-non-authoritative',
  'implementation-task-list-remains-absent',
  'fixed-tool-chain-remains-absent',
  'runtime-action-order-remains-absent',
]);

assertContains(previousGuardSource, 'const guard20Decision = buildKebabGuardDecision(19);', 'previous guard source');
assertContains(previousGuardSource, 'guardDecision: guard20Decision', 'previous guard source');
assertContains(previousSummarySource, 'const summary19Decision = buildKebabSummaryDecision(19);', 'previous summary source');
assertContains(previousSummarySource, 'closeoutDecision: summary19Decision', 'previous summary source');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, buildTitleSummaryCheckpoint(20), 'preflight audit');
assertContains(auditText, buildTextSummaryDecision(20), 'preflight audit');
assertContains(statusText, buildStatusSummaryCheckpoint(20), 'status page');
assertContains(statusText, 'agent-session-v3-runtime-boundary-source-gap-chain-summary-20-smoke.ts', 'status page');
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['previous guard source', previousGuardSource],
  ['previous summary source', previousSummarySource],
  ['preflight audit', auditText],
  ['status page', statusText],
  ['runtime boundary', boundarySource],
] as const;

for (const [label, source] of guardedSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);

  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true|evidenceSatisfied:\s*true|contractDraftingReady:\s*true/u,
    `${label} must not claim positive production, evidence, or contract readiness outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /implementationQueue|orderedSteps|requiredReportOrder|nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
    `${label} must not define queues, required order, tool decisions, or controller actions outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
    `${label} must not prescribe concrete desktop tools outside negative assertions.`,
  );
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
    `${label} must not define fixed workflows outside negative assertions.`,
  );
}

const serializedCheckpoint = JSON.stringify(checkpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|evidenceSatisfied":true|contractDraftingReady":true/u,
  'Source-gap summary 20 checkpoint must not grant production, evidence, or contract readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoCollectionAllowed":true|evidenceCollectedNow":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true|isImplementationTaskList":true/u,
  'Source-gap summary 20 checkpoint must not collect evidence, draft contracts, list implementation tasks, or define execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-gap summary 20 checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-gap summary 20 checkpoint must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary source gap chain summary 20 smoke ok');












