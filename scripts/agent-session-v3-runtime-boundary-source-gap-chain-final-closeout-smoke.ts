import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/agentSessionV3RuntimeBoundary.ts';
import { readProjectSources } from './smokeTestHarness.ts';

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

type FinalCloseoutSignal =
  | 'source-gap-chain-stopped-at-summary-141'
  | 'evidence-remains-unsatisfied'
  | 'contract-drafting-remains-closed'
  | 'production-authority-remains-absent'
  | 'adapter-contract-remains-future-only'
  | 'fixed-tool-chain-remains-absent'
  | 'automatic-chain-continuation-remains-absent';

interface FinalCloseoutCheckpoint {
  checkpoint: 'source-gap-chain-final-closeout';
  autoCollectionAllowed: false;
  automaticChainContinuation: false;
  contractDraftingReady: false;
  evidenceCollectedNow: false;
  evidenceSatisfied: false;
  finalCloseoutDecision: 'stop-source-gap-chain-at-summary-141';
  isContractDraft: false;
  isExecutionOrder: false;
  isImplementationTaskList: false;
  isProductionWiringPlan: false;
  nextSafeWork: 'minimal-production-adapter-contract-draft';
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signals: readonly FinalCloseoutSignal[];
}

const checkpoint = {
  checkpoint: 'source-gap-chain-final-closeout',
  autoCollectionAllowed: false,
  automaticChainContinuation: false,
  contractDraftingReady: false,
  evidenceCollectedNow: false,
  evidenceSatisfied: false,
  finalCloseoutDecision: 'stop-source-gap-chain-at-summary-141',
  isContractDraft: false,
  isExecutionOrder: false,
  isImplementationTaskList: false,
  isProductionWiringPlan: false,
  nextSafeWork: 'minimal-production-adapter-contract-draft',
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  signals: [
    'source-gap-chain-stopped-at-summary-141',
    'evidence-remains-unsatisfied',
    'contract-drafting-remains-closed',
    'production-authority-remains-absent',
    'adapter-contract-remains-future-only',
    'fixed-tool-chain-remains-absent',
    'automatic-chain-continuation-remains-absent',
  ],
} as const satisfies FinalCloseoutCheckpoint;

const {
  boundarySource,
  auditText,
  statusText,
  summary141Source,
  guard141Source,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  auditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  summary141Source: 'scripts/agent-session-v3-runtime-boundary-source-gap-chain-summary-141-smoke.ts',
  guard141Source: 'scripts/agent-session-v3-runtime-boundary-source-gap-chain-guard-141-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(checkpoint.checkpoint, 'source-gap-chain-final-closeout');
assert.equal(checkpoint.autoCollectionAllowed, false);
assert.equal(checkpoint.automaticChainContinuation, false);
assert.equal(checkpoint.contractDraftingReady, false);
assert.equal(checkpoint.evidenceCollectedNow, false);
assert.equal(checkpoint.evidenceSatisfied, false);
assert.equal(checkpoint.finalCloseoutDecision, 'stop-source-gap-chain-at-summary-141');
assert.equal(checkpoint.isContractDraft, false);
assert.equal(checkpoint.isExecutionOrder, false);
assert.equal(checkpoint.isImplementationTaskList, false);
assert.equal(checkpoint.isProductionWiringPlan, false);
assert.equal(checkpoint.nextSafeWork, 'minimal-production-adapter-contract-draft');
assert.equal(checkpoint.positiveGateAllowed, false);
assert.equal(checkpoint.productionAuthority, false);
assert.equal(checkpoint.productionReady, false);

assert.deepEqual(checkpoint.signals, [
  'source-gap-chain-stopped-at-summary-141',
  'evidence-remains-unsatisfied',
  'contract-drafting-remains-closed',
  'production-authority-remains-absent',
  'adapter-contract-remains-future-only',
  'fixed-tool-chain-remains-absent',
  'automatic-chain-continuation-remains-absent',
]);

assertContains(summary141Source, 'const summary141Decision = buildKebabSummaryDecision(141);', 'summary 141 source');
assertContains(summary141Source, 'closeoutDecision: summary141Decision', 'summary 141 source');
assertContains(guard141Source, 'const guard141Decision = buildKebabGuardDecision(140);', 'guard 141 source');
assertContains(guard141Source, 'guardDecision: guard141Decision', 'guard 141 source');
assertContains(statusText, 'source-gap summary 141 non-production boundary wording coverage', 'status page');
assertContains(statusText, 'agent-session-v3-runtime-boundary-source-gap-chain-summary-141-smoke.ts', 'status page');
assertContains(statusText, 'agent-session-v3-runtime-boundary-source-gap-chain-final-closeout-smoke.ts', 'status page');
assertContains(statusText, 'source-gap final closeout non-production chain stop coverage', 'status page');
assertContains(statusText, 'minimal adapter contract draft', 'status next step');
assertContains(auditText, '## Source Gap Chain Final Closeout Status', 'preflight audit');
assertContains(auditText, 'stop this source-gap guard/summary chain at summary 141', 'preflight audit');
assertContains(auditText, 'minimal production adapter contract draft', 'preflight audit');
assertContains(auditText, 'This closeout is not production wiring.', 'preflight audit');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');

const guardedSources = [
  ['summary 141 source', summary141Source],
  ['guard 141 source', guard141Source],
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
    /source-gap-chain-(guard|summary)-142|guard-142|summary-142/u,
    `${label} must not continue the source-gap guard/summary chain past summary 141.`,
  );
}

const serializedCheckpoint = JSON.stringify(checkpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true|evidenceSatisfied":true|contractDraftingReady":true|automaticChainContinuation":true/u,
  'Source-gap final closeout must not grant production readiness or continue the chain.',
);
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Source-gap final closeout must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Source-gap final closeout must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary source gap chain final closeout smoke ok');
