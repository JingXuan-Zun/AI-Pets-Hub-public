import assert from 'node:assert/strict';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type AdapterPayloadFamily =
  | 'blocked'
  | 'failure'
  | 'success'
  | 'waiting';

type AdapterPayloadBacklogOwner =
  | 'future-controller-policy-fields'
  | 'future-production-adapter-evidence'
  | 'phase-port-payload-shape'
  | 'real-or-production-like-trace-evidence';

interface AdapterPayloadFamilyConsistencyRow {
  family: AdapterPayloadFamily;
  hasPromotionBacklog: boolean;
  productionReady: false;
  stopReason: AgentSessionV3RuntimeBoundaryStopReason;
}

interface AdapterPayloadBacklogConsistencyItem {
  fieldNames: readonly string[];
  family: Exclude<AdapterPayloadFamily, 'success'>;
  owner: AdapterPayloadBacklogOwner;
  productionReady: false;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

interface AdapterPayloadExcludedStopReasonRow {
  reason: Extract<AgentSessionV3RuntimeBoundaryStopReason, 'cancelled' | 'invalid-transition' | 'transition-budget-exhausted'>;
  staysOutOfAdapterPayloadBacklog: true;
  why: string;
}

const adapterPayloadFamilyConsistencyRows = [
  {
    family: 'success',
    hasPromotionBacklog: false,
    productionReady: false,
    stopReason: 'continue-with-event',
  },
  {
    family: 'waiting',
    hasPromotionBacklog: true,
    productionReady: false,
    stopReason: 'waiting-for-phase-event',
  },
  {
    family: 'blocked',
    hasPromotionBacklog: true,
    productionReady: false,
    stopReason: 'blocked-by-phase',
  },
  {
    family: 'failure',
    hasPromotionBacklog: true,
    productionReady: false,
    stopReason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadFamilyConsistencyRow[];

const adapterPayloadBacklogConsistencyItems = [
  {
    family: 'waiting',
    fieldNames: [
      'pauseReason',
      'waitSource',
    ],
    owner: 'phase-port-payload-shape',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'waiting',
    fieldNames: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    owner: 'future-controller-policy-fields',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'waiting',
    fieldNames: [
      'pauseReason',
      'resumeTriggerOwner',
      'waitBudget',
      'waitSource',
    ],
    owner: 'real-or-production-like-trace-evidence',
    productionReady: false,
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'blocked',
    fieldNames: [
      'blockerSource',
      'recoverability',
      'userActionRequired',
    ],
    owner: 'future-production-adapter-evidence',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    family: 'blocked',
    fieldNames: [
      'terminalStatusCandidate',
    ],
    owner: 'future-controller-policy-fields',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    family: 'blocked',
    fieldNames: [
      'blockerSource',
      'recoverability',
      'terminalStatusCandidate',
      'userActionRequired',
    ],
    owner: 'real-or-production-like-trace-evidence',
    productionReady: false,
    reason: 'blocked-by-phase',
  },
  {
    family: 'failure',
    fieldNames: [],
    owner: 'phase-port-payload-shape',
    productionReady: false,
    reason: 'runtime-failed',
  },
  {
    family: 'failure',
    fieldNames: [
      'errorClass',
      'failureOrigin',
      'retryability',
      'sideEffectCommitted',
      'userVisibleFailureReason',
    ],
    owner: 'future-production-adapter-evidence',
    productionReady: false,
    reason: 'runtime-failed',
  },
  {
    family: 'failure',
    fieldNames: [
      'errorClass',
      'failureOrigin',
      'retryability',
      'sideEffectCommitted',
      'userVisibleFailureReason',
    ],
    owner: 'real-or-production-like-trace-evidence',
    productionReady: false,
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadBacklogConsistencyItem[];

const adapterPayloadExcludedStopReasonRows = [
  {
    reason: 'cancelled',
    staysOutOfAdapterPayloadBacklog: true,
    why: 'cancelled already has a stricter terminal path and no adapter payload candidate in the current stop-evidence contract',
  },
  {
    reason: 'invalid-transition',
    staysOutOfAdapterPayloadBacklog: true,
    why: 'invalid-transition currently belongs to runner-derived metadata plus future adapter/controller classification, not adapter payload families',
  },
  {
    reason: 'transition-budget-exhausted',
    staysOutOfAdapterPayloadBacklog: true,
    why: 'transition-budget currently belongs to runner-derived metadata plus future controller budget policy, not adapter payload families',
  },
] as const satisfies readonly AdapterPayloadExcludedStopReasonRow[];

function fieldSourcesByName(reason: AgentSessionV3RuntimeBoundaryStopReason) {
  return new Map(getAgentSessionV3RuntimeStopEvidenceFields(reason).map((field) => [field.name, field.source]));
}

function fieldNamesBySource(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
  source: AgentSessionV3RuntimeStopEvidenceSource,
) {
  return getAgentSessionV3RuntimeStopEvidenceFields(reason)
    .filter((field) => field.source === source)
    .map((field) => field.name)
    .sort();
}

function backlogItemsForFamily(family: Exclude<AdapterPayloadFamily, 'success'>) {
  return adapterPayloadBacklogConsistencyItems.filter((item) => item.family === family);
}

function backlogReasons() {
  return adapterPayloadBacklogConsistencyItems
    .map((item) => item.reason)
    .filter((reason, index, reasons) => reasons.indexOf(reason) === index)
    .sort();
}

function familyReason(family: AdapterPayloadFamily) {
  return adapterPayloadFamilyConsistencyRows.find((row) => row.family === family)?.stopReason;
}

function assertFieldsHaveSource(options: {
  expectedSource: AgentSessionV3RuntimeStopEvidenceSource;
  fieldNames: readonly string[];
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}) {
  const sources = fieldSourcesByName(options.reason);

  for (const fieldName of options.fieldNames) {
    assert.equal(
      sources.get(fieldName),
      options.expectedSource,
      `${options.reason}.${fieldName} should come from ${options.expectedSource}.`,
    );
  }
}

const {
  backlogConsistencySmokeSource,
  boundarySource,
  familyRollupSmokeSource,
  preflightAuditText,
  promotionBacklogSmokeSource,
  statusText,
  stopPayloadRollupSmokeSource,
} = readProjectSources({
  backlogConsistencySmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-backlog-consistency-checkpoint-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  familyRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-family-rollup-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  promotionBacklogSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-promotion-blocker-backlog-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
  stopPayloadRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-stop-payload-audit-rollup-checkpoint-smoke.ts',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadFamilyConsistencyRows.map((row) => row.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Backlog consistency should cover the same four adapter payload families as the family rollup.',
);

assert.deepEqual(
  adapterPayloadFamilyConsistencyRows
    .filter((row) => row.hasPromotionBacklog)
    .map((row) => row.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);
assert.deepEqual(
  backlogReasons(),
  ['blocked-by-phase', 'runtime-failed', 'waiting-for-phase-event'],
  'Adapter-payload backlog should only cover waiting, blocked, and runtime-failed stop reasons.',
);

for (const family of ['waiting', 'blocked', 'failure'] as const) {
  const expectedReason = familyReason(family);
  assert.ok(expectedReason, `${family} should have a family-level stop reason.`);

  for (const item of backlogItemsForFamily(family)) {
    assert.equal(item.reason, expectedReason);
    assert.equal(item.productionReady, false);
  }
}

assert.deepEqual(
  backlogItemsForFamily('waiting').map((item) => item.owner).sort(),
  [
    'future-controller-policy-fields',
    'phase-port-payload-shape',
    'real-or-production-like-trace-evidence',
  ],
);
assert.deepEqual(
  backlogItemsForFamily('blocked').map((item) => item.owner).sort(),
  [
    'future-controller-policy-fields',
    'future-production-adapter-evidence',
    'real-or-production-like-trace-evidence',
  ],
);
assert.deepEqual(
  backlogItemsForFamily('failure').map((item) => item.owner).sort(),
  [
    'future-production-adapter-evidence',
    'phase-port-payload-shape',
    'real-or-production-like-trace-evidence',
  ],
);

assertFieldsHaveSource({
  expectedSource: 'phase-port-result',
  fieldNames: ['pauseReason', 'waitSource'],
  reason: 'waiting-for-phase-event',
});
assertFieldsHaveSource({
  expectedSource: 'future-controller-policy',
  fieldNames: ['resumeTriggerOwner', 'waitBudget'],
  reason: 'waiting-for-phase-event',
});
assertFieldsHaveSource({
  expectedSource: 'future-production-adapter',
  fieldNames: ['blockerSource', 'recoverability', 'userActionRequired'],
  reason: 'blocked-by-phase',
});
assertFieldsHaveSource({
  expectedSource: 'future-controller-policy',
  fieldNames: ['terminalStatusCandidate'],
  reason: 'blocked-by-phase',
});
assertFieldsHaveSource({
  expectedSource: 'future-production-adapter',
  fieldNames: [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
  reason: 'runtime-failed',
});

assert.deepEqual(fieldNamesBySource('waiting-for-phase-event', 'phase-port-result'), ['pauseReason', 'waitSource']);
assert.deepEqual(fieldNamesBySource('blocked-by-phase', 'future-production-adapter'), [
  'blockerSource',
  'recoverability',
  'userActionRequired',
]);
assert.deepEqual(fieldNamesBySource('runtime-failed', 'future-production-adapter'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

assert.equal(
  getAgentSessionV3RuntimeStopEvidenceFields('continue-with-event').length,
  0,
  'Success/continue-with-event should have no stop-payload fields and no backlog items.',
);
assert.equal(
  adapterPayloadBacklogConsistencyItems.some((item) => item.family === 'success'),
  false,
  'Success should remain outside the promotion blocker backlog.',
);

for (const row of adapterPayloadExcludedStopReasonRows) {
  assert.equal(row.staysOutOfAdapterPayloadBacklog, true);
  assert.equal(
    adapterPayloadBacklogConsistencyItems.some((item) => item.reason === row.reason),
    false,
    `${row.reason} should stay outside adapter-payload backlog consistency checks.`,
  );
}

assert.deepEqual(
  adapterPayloadExcludedStopReasonRows.map((row) => row.reason).sort(),
  ['cancelled', 'invalid-transition', 'transition-budget-exhausted'],
);
assert.deepEqual(fieldNamesBySource('invalid-transition', 'pilot-runner-state'), ['eventType', 'phase']);
assert.deepEqual(fieldNamesBySource('transition-budget-exhausted', 'pilot-runner-state'), [
  'recoveryCount',
  'transitionCount',
]);

assert.match(familyRollupSmokeSource, /Adapter-payload family rollup should cover success, waiting, blocked, and failure exactly once/u);
assert.match(familyRollupSmokeSource, /No adapter-payload family should be promoted into a formal payload contract yet/u);
assert.match(promotionBacklogSmokeSource, /Promotion backlog family summaries should cover success, waiting, blocked, and failure exactly once/u);
assert.match(promotionBacklogSmokeSource, /blocked-until-owner-evidence-exists/u);
assert.match(stopPayloadRollupSmokeSource, /Rollup checkpoint should cover every stop evidence contract field exactly once/u);
assert.match(stopPayloadRollupSmokeSource, /existing-runner-derived-contract-only/u);
assert.match(stopPayloadRollupSmokeSource, /keep-smoke-only/u);

const serializedConsistency = JSON.stringify({
  adapterPayloadBacklogConsistencyItems,
  adapterPayloadExcludedStopReasonRows,
  adapterPayloadFamilyConsistencyRows,
});
assert.doesNotMatch(
  serializedConsistency,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload backlog consistency should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload backlog consistency should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedConsistency,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Adapter-payload backlog consistency should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedConsistency,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload backlog consistency should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload backlog consistency must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  backlogConsistencySmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload backlog consistency should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Backlog Consistency Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-backlog-consistency-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /family rollup, promotion blocker backlog, and stop-payload rollup/u);
assert.match(preflightAuditText, /no family, owner, or stop reason drift/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload backlog consistency checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-backlog-consistency-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload backlog consistency checkpoint smoke ok');
