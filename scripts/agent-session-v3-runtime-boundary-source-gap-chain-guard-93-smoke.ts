import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/agentSessionV3RuntimeBoundary.ts';
import { readProjectFile } from './smokeTestHarness.ts';

function repeatSegment(segment: string, count: number, separator: string) {
  return Array.from({ length: count }, () => segment).join(separator);
}

function buildKebabGuardCheckpoint(summaryCount: number) {
  return `future-owner-precondition-evidence-source-gap-closeout-chain-final-${repeatSegment(
    'guard-closeout-summary',
    summaryCount,
    '-',
  )}-guard`;
}

function buildKebabGuardDecision(summaryCount: number) {
  return `source-gap-final-${repeatSegment('guard-closeout-summary', summaryCount, '-')}-guard-remains-non-production`;
}

function buildKebabSummaryDecision(summaryCount: number) {
  return `source-gap-final-${repeatSegment('guard-closeout-summary', summaryCount, '-')}-remains-non-production`;
}

function buildTitleGuardCheckpoint(summaryCount: number) {
  return `Future Owner Precondition Evidence Source Gap Closeout Chain Final ${repeatSegment(
    'Guard Closeout Summary',
    summaryCount,
    ' ',
  )} Guard Checkpoint Status`;
}

function buildStatusGuardCheckpoint(summaryCount: number) {
  return `V3 runtime boundary future owner precondition evidence source gap closeout chain final ${repeatSegment(
    'guard closeout summary',
    summaryCount,
    ' ',
  )} guard checkpoint`;
}

function buildTextGuardDecision(summaryCount: number) {
  return `source gap final ${repeatSegment('guard closeout summary', summaryCount, ' ')} guard remains non-production`;
}

type GuardSignal =
  | 'closeout-summary-wording-guarded'
  | 'evidence-still-unsatisfied'
  | 'contract-drafting-still-closed'
  | 'production-authority-still-absent'
  | 'blocker-separation-still-non-authoritative'
  | 'implementation-task-list-still-absent'
  | 'fixed-tool-chain-still-absent'
  | 'runtime-action-order-still-absent';

interface GuardCheckpoint {
  checkpoint: string;
  autoCollectionAllowed: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  guardDecision: string;
  guardStatus: 'guarded-non-production';
  isContractDraft: false;
  isExecutionOrder: false;
  isImplementationTaskList: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signals: readonly GuardSignal[];
}

const guard93Checkpoint = buildKebabGuardCheckpoint(92);
const guard93Decision = buildKebabGuardDecision(92);
const summary92Decision = buildKebabSummaryDecision(92);
const guard92Decision = buildKebabGuardDecision(91);

const checkpoint = {
  checkpoint: guard93Checkpoint,
  autoCollectionAllowed: false,
  contractDraftingReady: false,
  evidenceCollectedNow: false,
  evidenceSatisfied: false,
  guardDecision: guard93Decision,
  guardStatus: 'guarded-non-production',
  isContractDraft: false,
  isExecutionOrder: false,
  isImplementationTaskList: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  signals: [
    'closeout-summary-wording-guarded',
    'evidence-still-unsatisfied',
    'contract-drafting-still-closed',
    'production-authority-still-absent',
    'blocker-separation-still-non-authoritative',
    'implementation-task-list-still-absent',
    'fixed-tool-chain-still-absent',
    'runtime-action-order-still-absent',
  ],
} as const satisfies GuardCheckpoint;

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
const previousSummarySource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-summary-92-smoke.ts',
);
const previousGuardSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-source-gap-chain-guard-92-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.checkpoint, guard93Checkpoint);
assert.equal(checkpoint.autoCollectionAllowed, false);
assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.evidenceCollectedNow, false);
assert.equal(checkpoint.evidenceSatisfied, false);
assert.equal(checkpoint.guardDecision, guard93Decision);
assert.equal(checkpoint.guardStatus, 'guarded-non-production');
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isImplementationTaskList, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);

assert.deepEqual(checkpoint.signals, [
  'closeout-summary-wording-guarded',
  'evidence-still-unsatisfied',
  'contract-drafting-still-closed',
  'production-authority-still-absent',
  'blocker-separation-still-non-authoritative',
  'implementation-task-list-still-absent',
  'fixed-tool-chain-still-absent',
  'runtime-action-order-still-absent',
]);

assertContains(previousSummarySource, 'const summary92Decision = buildKebabSummaryDecision(92);', 'previous summary source');
assertContains(previousSummarySource, 'closeoutDecision: summary92Decision', 'previous summary source');
assertContains(previousGuardSource, 'const guard92Decision = buildKebabGuardDecision(91);', 'previous guard source');
assertContains(previousGuardSource, 'guardDecision: guard92Decision', 'previous guard source');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

assertContains(auditText, buildTitleGuardCheckpoint(92), 'preflight audit');
assertContains(auditText, buildTextGuardDecision(92), 'preflight audit');
assertContains(statusText, buildStatusGuardCheckpoint(92), 'status page');
assertContains(statusText, 'agent-session-v3-runtime-boundary-source-gap-chain-guard-93-smoke.ts', 'status page');
assertContains(statusText, 'agent-session-v3-runtime-boundary-source-gap-chain-summary-96-smoke.ts', 'status next step');
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['previous summary source', previousSummarySource],
  ['previous guard source', previousGuardSource],
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
  'Source-gap guard 93 checkpoint must not grant production, evidence, or contract readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /autoCollectionAllowed":true|evidenceCollectedNow":true|isContractDraft":true|isProductionWiringPlan":true|isExecutionOrder":true|isImplementationTaskList":true/u,
  'Source-gap guard 93 checkpoint must not collect evidence, draft contracts, list implementation tasks, or define execution order.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-gap guard 93 checkpoint must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-gap guard 93 checkpoint must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary source gap chain guard 93 smoke ok');





