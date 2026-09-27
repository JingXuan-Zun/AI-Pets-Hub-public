import assert from 'node:assert/strict';
import { createAgentSessionV3RuntimeBoundaryContract } from '../src/agent/legacy/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutInput =
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency'
  | 'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary'
  | 'final-negative-readout-closeout-handoff-closeout-guard'
  | 'final-negative-readout-closeout-handoff-closeout-summary'
  | 'final-negative-readout-closeout-handoff-wording-consistency'
  | 'final-negative-readout-closeout-handoff'
  | 'production-gate-final-negative-readout'
  | 'evidence-interpretation-to-production-gate-mapping'
  | 'remaining-non-evidence-production-blocker-inventory'
  | 'runtime-boundary-contract'
  | 'status-page'
  | 'preflight-audit';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutSignal =
  | 'wording-closeout-current-status'
  | 'blocked-wording-preserved'
  | 'non-production-wording-preserved'
  | 'caller-owned-intake-blocker-wording-preserved'
  | 'current-evidence-blocker-wording-preserved'
  | 'manual-interpretation-blocker-wording-preserved'
  | 'non-evidence-production-blocker-wording-preserved'
  | 'positive-production-gate-remains-closed'
  | 'production-authority-remains-absent'
  | 'production-wiring-remains-deferred'
  | 'runtime-action-order-language-remains-absent'
  | 'tool-decision-language-remains-absent'
  | 'fixed-tool-chain-language-remains-absent';

type CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutBlockerGroup =
  | 'caller-owned-intake'
  | 'current-evidence'
  | 'manual-interpretation'
  | 'remaining-non-evidence-production';

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutRow {
  blockerGroups: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutBlockerGroup[];
  inputs: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutInput[];
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  signal: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutSignal;
  wordingStatus: 'closed-out-final-negative-handoff-guard-closeout-wording-still-blocked';
}

interface CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint {
  closeout: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary';
  interpretationReadyNow: false;
  isExecutionOrder: false;
  isImplementationPlan: false;
  isProductionWiringPlan: false;
  manualInterpretationOnly: true;
  positiveGateAllowed: false;
  productionAuthority: false;
  productionReady: false;
  rows: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutRow[];
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-positive-gate-closed';
}

const sharedInputs = [
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency',
  'final-negative-readout-closeout-handoff-closeout-guard-closeout-summary',
  'final-negative-readout-closeout-handoff-closeout-guard',
  'final-negative-readout-closeout-handoff-closeout-summary',
  'final-negative-readout-closeout-handoff-wording-consistency',
  'final-negative-readout-closeout-handoff',
  'production-gate-final-negative-readout',
  'evidence-interpretation-to-production-gate-mapping',
  'remaining-non-evidence-production-blocker-inventory',
  'preflight-audit',
  'status-page',
  'runtime-boundary-contract',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutInput[];

const allBlockerGroups = [
  'caller-owned-intake',
  'current-evidence',
  'manual-interpretation',
  'remaining-non-evidence-production',
] as const satisfies readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutBlockerGroup[];

function row(
  signal: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutSignal,
  blockerGroups: readonly CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutBlockerGroup[],
) {
  return {
    blockerGroups,
    inputs: sharedInputs,
    interpretationReadyNow: false,
    isExecutionOrder: false,
    isImplementationPlan: false,
    isProductionWiringPlan: false,
    manualInterpretationOnly: true,
    positiveGateAllowed: false,
    productionAuthority: false,
    productionReady: false,
    signal,
    wordingStatus: 'closed-out-final-negative-handoff-guard-closeout-wording-still-blocked',
  } as const satisfies CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutRow;
}

const callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint = {
  closeout: 'caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary',
  interpretationReadyNow: false,
  isExecutionOrder: false,
  isImplementationPlan: false,
  isProductionWiringPlan: false,
  manualInterpretationOnly: true,
  positiveGateAllowed: false,
  productionAuthority: false,
  productionReady: false,
  rows: [
    row('wording-closeout-current-status', allBlockerGroups),
    row('blocked-wording-preserved', allBlockerGroups),
    row('non-production-wording-preserved', allBlockerGroups),
    row('caller-owned-intake-blocker-wording-preserved', ['caller-owned-intake']),
    row('current-evidence-blocker-wording-preserved', ['current-evidence']),
    row('manual-interpretation-blocker-wording-preserved', ['manual-interpretation']),
    row('non-evidence-production-blocker-wording-preserved', ['remaining-non-evidence-production']),
    row('positive-production-gate-remains-closed', allBlockerGroups),
    row('production-authority-remains-absent', ['remaining-non-evidence-production']),
    row('production-wiring-remains-deferred', ['remaining-non-evidence-production']),
    row('runtime-action-order-language-remains-absent', ['remaining-non-evidence-production']),
    row('tool-decision-language-remains-absent', ['remaining-non-evidence-production']),
    row('fixed-tool-chain-language-remains-absent', ['remaining-non-evidence-production']),
  ],
  summaryDecision: 'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-positive-gate-closed',
} as const satisfies CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint;

function assertContains(text: string, expected: string, label: string) {
  assert.ok(text.includes(expected), `${label} should include: ${expected}`);
}

function rowForSignal(signal: CallerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutSignal) {
  const found = callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.rows
    .find((candidate) => candidate.signal === signal);

  assert.ok(found, `${signal} should exist in the caller-owned final negative wording closeout summary.`);
  return found;
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
const wordingConsistencySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-consistency-checkpoint-smoke.ts',
);
const guardCloseoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-summary-checkpoint-smoke.ts',
);
const guardSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-checkpoint-smoke.ts',
);
const closeoutSummarySmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-summary-checkpoint-smoke.ts',
);
const handoffWordingSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-wording-consistency-checkpoint-smoke.ts',
);
const handoffSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-checkpoint-smoke.ts',
);
const productionGateFinalNegativeReadoutSmokeSource = readProjectFile(
  'scripts/agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-production-gate-final-negative-readout-checkpoint-smoke.ts',
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

assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.interpretationReadyNow, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.manualInterpretationOnly, true);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.productionAuthority, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.productionReady, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.positiveGateAllowed, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.isExecutionOrder, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.isImplementationPlan, false);
assert.equal(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.isProductionWiringPlan, false);
assert.equal(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.summaryDecision,
  'caller-owned-final-negative-handoff-guard-closeout-wording-closeout-positive-gate-closed',
);

assert.deepEqual(
  callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.rows.map((entry) => entry.signal).sort(),
  [
    'blocked-wording-preserved',
    'caller-owned-intake-blocker-wording-preserved',
    'current-evidence-blocker-wording-preserved',
    'fixed-tool-chain-language-remains-absent',
    'manual-interpretation-blocker-wording-preserved',
    'non-evidence-production-blocker-wording-preserved',
    'non-production-wording-preserved',
    'positive-production-gate-remains-closed',
    'production-authority-remains-absent',
    'production-wiring-remains-deferred',
    'runtime-action-order-language-remains-absent',
    'tool-decision-language-remains-absent',
    'wording-closeout-current-status',
  ],
);

for (const entry of callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint.rows) {
  assert.equal(entry.wordingStatus, 'closed-out-final-negative-handoff-guard-closeout-wording-still-blocked');
  assert.equal(entry.interpretationReadyNow, false);
  assert.equal(entry.manualInterpretationOnly, true);
  assert.equal(entry.isExecutionOrder, false);
  assert.equal(entry.isImplementationPlan, false);
  assert.equal(entry.isProductionWiringPlan, false);
  assert.equal(entry.productionAuthority, false);
  assert.equal(entry.productionReady, false);
  assert.equal(entry.positiveGateAllowed, false);
  assert.deepEqual(entry.inputs, sharedInputs);
}

assert.deepEqual(rowForSignal('wording-closeout-current-status').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('blocked-wording-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('non-production-wording-preserved').blockerGroups, allBlockerGroups);
assert.deepEqual(rowForSignal('caller-owned-intake-blocker-wording-preserved').blockerGroups, ['caller-owned-intake']);
assert.deepEqual(rowForSignal('current-evidence-blocker-wording-preserved').blockerGroups, ['current-evidence']);
assert.deepEqual(rowForSignal('manual-interpretation-blocker-wording-preserved').blockerGroups, ['manual-interpretation']);
assert.deepEqual(rowForSignal('non-evidence-production-blocker-wording-preserved').blockerGroups, ['remaining-non-evidence-production']);
assert.equal(rowForSignal('positive-production-gate-remains-closed').positiveGateAllowed, false);
assert.equal(rowForSignal('production-authority-remains-absent').productionAuthority, false);
assert.equal(rowForSignal('production-wiring-remains-deferred').isProductionWiringPlan, false);
assert.equal(rowForSignal('runtime-action-order-language-remains-absent').isExecutionOrder, false);
assert.equal(rowForSignal('tool-decision-language-remains-absent').isExecutionOrder, false);
assert.equal(rowForSignal('fixed-tool-chain-language-remains-absent').isExecutionOrder, false);

assertContains(
  wordingConsistencySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-wording-consistent-positive-gate-closed',
  'wording consistency smoke',
);
assertContains(
  wordingConsistencySmokeSource,
  'final-negative-handoff-guard-closeout-wording-consistent-still-blocked',
  'wording consistency smoke',
);
assertContains(
  guardCloseoutSummarySmokeSource,
  'caller-owned-final-negative-handoff-guard-closeout-positive-gate-closed',
  'guard closeout summary smoke',
);
assertContains(
  guardCloseoutSummarySmokeSource,
  'closed-out-final-negative-handoff-guard-still-blocked',
  'guard closeout summary smoke',
);
assertContains(
  guardSmokeSource,
  'caller-owned-final-negative-handoff-closeout-guard-positive-gate-closed',
  'guard smoke',
);
assertContains(closeoutSummarySmokeSource, 'closed-out-final-negative-handoff-still-blocked', 'closeout summary smoke');
assertContains(
  handoffWordingSmokeSource,
  'caller-owned-final-negative-handoff-wording-consistent-positive-gate-closed',
  'handoff wording smoke',
);
assertContains(handoffSmokeSource, 'final-negative-readout-closeout-handoff-still-blocked', 'handoff smoke');
assertContains(
  productionGateFinalNegativeReadoutSmokeSource,
  'final-negative-production-gate-readout-still-blocked',
  'production gate final negative readout smoke',
);
assertContains(evidenceMappingSmokeSource, 'mapping-only-positive-gate-remains-closed', 'evidence mapping smoke');
assertContains(nonEvidenceInventorySmokeSource, 'non-evidence-blockers-remain-positive-gate-closed', 'non-evidence inventory smoke');

assertContains(
  auditText,
  'Caller-Owned Real-Exported Evidence Intake Review Readiness Post-Recheck Final Negative Readout Closeout Handoff Closeout Guard Closeout Wording Closeout Summary Checkpoint Status',
  'preflight audit',
);
assertContains(
  auditText,
  'final negative handoff guard closeout wording closeout keeps one current blocked wording readout',
  'preflight audit',
);
assertContains(
  statusText,
  'V3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout summary checkpoint',
  'status',
);
assertContains(
  statusText,
  'agent-session-v3-runtime-boundary-caller-owned-real-exported-evidence-intake-review-readiness-post-recheck-final-negative-readout-closeout-handoff-closeout-guard-closeout-wording-closeout-summary-checkpoint-smoke.ts',
  'status',
);
assertContains(statusText, 'Overall practical runtime including v3: about 99.2%', 'status current estimate');
assertContains(statusText, 'v3 full runtime preflight/pilot: about 99.2%', 'status current estimate');

const guardedSources = [
  ['wording consistency', wordingConsistencySmokeSource],
  ['guard closeout summary', guardCloseoutSummarySmokeSource],
  ['guard', guardSmokeSource],
  ['closeout summary', closeoutSummarySmokeSource],
  ['handoff wording', handoffWordingSmokeSource],
  ['handoff', handoffSmokeSource],
  ['production gate final negative readout', productionGateFinalNegativeReadoutSmokeSource],
  ['evidence mapping', evidenceMappingSmokeSource],
  ['non-evidence inventory', nonEvidenceInventorySmokeSource],
  ['preflight audit', auditText],
  ['status page', statusText],
] as const;

for (const [label, source] of guardedSources) {
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

const serializedCheckpoint = JSON.stringify(callerOwnedFinalNegativeHandoffGuardCloseoutWordingCloseoutCheckpoint);
assert.doesNotMatch(
  serializedCheckpoint,
  /productionAuthority":true|productionReady":true|positiveGateAllowed":true/u,
  'Caller-owned final negative handoff guard closeout wording closeout summary must not grant production readiness.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /isProductionWiringPlan":true|isImplementationPlan":true|production-wiring-ready|ready-for-production-wiring/u,
  'Caller-owned final negative handoff guard closeout wording closeout summary must not become an implementation plan.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Caller-owned final negative handoff guard closeout wording closeout summary should not define controller actions.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Caller-owned final negative handoff guard closeout wording closeout summary should not prescribe desktop tools.',
);
assert.doesNotMatch(
  serializedCheckpoint,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|requiredReportOrder|implementationQueue|orderedSteps/iu,
  'Caller-owned final negative handoff guard closeout wording closeout summary should not define fixed workflows.',
);

assertContains(boundarySource, 'AgentSessionV2 remains the production orchestrator', 'runtime boundary');
assertContains(boundarySource, 'no required ordered tool workflow', 'runtime boundary');
assertContains(boundarySource, 'no evidence adapter gains runtime authority', 'runtime boundary');
assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(Controller|Adapter)|type AgentSessionV3Runtime(Controller|Adapter)/u,
  'Caller-owned final negative handoff guard closeout wording closeout summary must not add controller contracts.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Caller-owned final negative handoff guard closeout wording closeout summary must not add production runtime calls.',
);

console.log('agent session v3 runtime boundary caller-owned real-exported evidence intake review readiness post-recheck final negative readout closeout handoff closeout guard closeout wording closeout summary checkpoint smoke ok');
