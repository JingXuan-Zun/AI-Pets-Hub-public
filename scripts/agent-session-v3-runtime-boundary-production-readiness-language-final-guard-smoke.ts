import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type ProductionReadinessLanguageFinalGuardInput =
  | 'post-closeout-production-gate-recheck'
  | 'post-handoff-gate-wording-consistency'
  | 'post-recheck-remaining-blocker-handoff'
  | 'preflight-audit'
  | 'runtime-boundary-contract'
  | 'status-page';

type ProductionReadinessLanguageFinalGuardCheck =
  | 'final-positive-readiness-language-absent'
  | 'production-authority-still-negative'
  | 'production-ready-still-negative'
  | 'runtime-action-order-still-absent'
  | 'tool-chain-language-still-negative'
  | 'v3-production-wiring-still-deferred';

interface ProductionReadinessLanguageFinalGuardRow {
  check: ProductionReadinessLanguageFinalGuardCheck;
  guardStatus: 'guarded-negative-language';
  inputs: readonly ProductionReadinessLanguageFinalGuardInput[];
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
}

interface ProductionReadinessLanguageFinalGuard {
  guard: 'production-readiness-language-final-guard';
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly ProductionReadinessLanguageFinalGuardRow[];
  summaryDecision: 'no-production-readiness-language-drift';
}

const sharedInputs = [
  'post-handoff-gate-wording-consistency',
  'post-recheck-remaining-blocker-handoff',
  'post-closeout-production-gate-recheck',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly ProductionReadinessLanguageFinalGuardInput[];

const productionReadinessLanguageFinalGuard = {
  guard: 'production-readiness-language-final-guard',
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    {
      check: 'final-positive-readiness-language-absent',
      guardStatus: 'guarded-negative-language',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'production-authority-still-negative',
      guardStatus: 'guarded-negative-language',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'production-ready-still-negative',
      guardStatus: 'guarded-negative-language',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'v3-production-wiring-still-deferred',
      guardStatus: 'guarded-negative-language',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'runtime-action-order-still-absent',
      guardStatus: 'guarded-negative-language',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
    {
      check: 'tool-chain-language-still-negative',
      guardStatus: 'guarded-negative-language',
      inputs: sharedInputs,
      isExecutionOrder: false,
      isImplementationPlan: false,
      isProductionWiringPlan: false,
      positiveGateAllowed: false,
      productionAuthority: false,
      productionReady: false,
    },
  ],
  summaryDecision: 'no-production-readiness-language-drift',
} as const satisfies ProductionReadinessLanguageFinalGuard;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForCheck(check: ProductionReadinessLanguageFinalGuardCheck) {
  const row = productionReadinessLanguageFinalGuard.rows.find((candidate) => candidate.check === check);
  assert.ok(row, `${check} should exist in the production-readiness language final guard.`);
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
const finalGuardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-production-readiness-language-final-guard-smoke.ts',
);
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-handoff-gate-wording-consistency-checkpoint-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-recheck-remaining-blocker-handoff-checkpoint-smoke.ts',
);
const recheckSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-post-closeout-production-gate-recheck-checkpoint-smoke.ts',
);

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(boundaryContract.mode, 'contract-only');
assert.ok(boundaryContract.guardrails.includes('AgentSessionV2 remains the production orchestrator'));
assert.ok(boundaryContract.guardrails.includes('no required ordered tool workflow'));
assert.ok(boundaryContract.guardrails.includes('no evidence adapter gains runtime authority'));

assert.equal(productionReadinessLanguageFinalGuard.productionAuthority, false);
assert.equal(productionReadinessLanguageFinalGuard.productionReady, false);
assert.equal(productionReadinessLanguageFinalGuard.positiveGateAllowed, false);
assert.equal(productionReadinessLanguageFinalGuard.isProductionWiringPlan, false);
assert.equal(productionReadinessLanguageFinalGuard.isImplementationPlan, false);
assert.equal(productionReadinessLanguageFinalGuard.summaryDecision, 'no-production-readiness-language-drift');

assert.deepEqual(
  productionReadinessLanguageFinalGuard.rows.map((row) => row.check).sort(),
  [
    'final-positive-readiness-language-absent',
    'production-authority-still-negative',
    'production-ready-still-negative',
    'runtime-action-order-still-absent',
    'tool-chain-language-still-negative',
    'v3-production-wiring-still-deferred',
  ],
);

for (const row of productionReadinessLanguageFinalGuard.rows) {
  assert.equal(row.guardStatus, 'guarded-negative-language');
  assert.equal(row.isExecutionOrder, false);
  assert.equal(row.isImplementationPlan, false);
  assert.equal(row.isProductionWiringPlan, false);
  assert.equal(row.productionAuthority, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.positiveGateAllowed, false);
  assert.deepEqual(row.inputs, sharedInputs);
}

assert.equal(rowForCheck('final-positive-readiness-language-absent').positiveGateAllowed, false);
assert.equal(rowForCheck('production-authority-still-negative').productionAuthority, false);
assert.equal(rowForCheck('production-ready-still-negative').productionReady, false);
assert.equal(rowForCheck('v3-production-wiring-still-deferred').isProductionWiringPlan, false);
assert.equal(rowForCheck('runtime-action-order-still-absent').isExecutionOrder, false);
assert.equal(rowForCheck('tool-chain-language-still-negative').isExecutionOrder, false);

assertContains(wordingConsistencySmokeSource, 'handoff-wording-consistent-positive-gate-closed', 'wording consistency smoke');
assertContains(wordingConsistencySmokeSource, 'wording-consistent-and-blocked', 'wording consistency smoke');
assertContains(handoffSmokeSource, 'remaining-blockers-handed-off-positive-gate-closed', 'handoff smoke');
assertContains(handoffSmokeSource, 'handoff-only-still-blocked', 'handoff smoke');
assertContains(recheckSmokeSource, 'post-closeout-positive-gate-remains-closed', 'post-closeout recheck smoke');
assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(auditText, 'Production-Readiness Language Final Guard Status', 'preflight audit');
assertContains(auditText, 'no production-readiness language drift was detected', 'preflight audit');
assertContains(statusText, 'V3 runtime boundary production-readiness language final guard', 'status');
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-production-readiness-language-final-guard-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['preflight audit', auditText],
  ['status page', statusText],
  ['wording consistency smoke', wordingConsistencySmokeSource],
  ['handoff smoke', handoffSmokeSource],
  ['post-closeout recheck smoke', recheckSmokeSource],
] as const;

for (const [label, source] of guardedSources) {
  const sourceWithoutNegativeAssertions = stripNegativeAssertionBlocks(source);
  assert.doesNotMatch(
    sourceWithoutNegativeAssertions,
    /ready-for-production-wiring|production-wiring-ready|productionGateCleared|positiveGateAllowed:\s*true|productionAuthority:\s*true|productionReady:\s*true/u,
    `${label} must not claim positive production readiness outside negative assertions.`,
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

const serializedGuard = JSON.stringify(productionReadinessLanguageFinalGuard);
assert.doesNotMatch(
  serializedGuard,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Production-readiness language final guard must not grant production readiness or authority.',
);
assert.doesNotMatch(
  serializedGuard,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Production-readiness language final guard must not become an implementation plan or production wiring plan.',
);
assert.doesNotMatch(
  serializedGuard,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Production-readiness language final guard should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedGuard,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Production-readiness language final guard should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedGuard,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Production-readiness language final guard should not define fixed workflows, required report order, or task queues.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Production-readiness language final guard must not add production controller or adapter contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Production-readiness language final guard must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  finalGuardSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Production-readiness language final guard smoke should not call production v2 modules.',
);

console.log('agent session v3 runtime boundary production-readiness language final guard smoke ok');
