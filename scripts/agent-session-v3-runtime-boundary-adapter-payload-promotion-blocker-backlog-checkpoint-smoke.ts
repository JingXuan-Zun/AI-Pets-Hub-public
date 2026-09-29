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

type AdapterPayloadPromotionBlockerOwner =
  | 'future-controller-policy-fields'
  | 'future-production-adapter-evidence'
  | 'phase-port-payload-shape'
  | 'real-or-production-like-trace-evidence';

type AdapterPayloadPromotionBlockerCode =
  | 'blocked-controller-terminal-status-map-missing'
  | 'blocked-production-adapter-evidence-missing'
  | 'blocked-real-traces-missing'
  | 'failure-phase-port-result-kind-missing'
  | 'failure-production-adapter-evidence-missing'
  | 'failure-real-traces-missing'
  | 'waiting-controller-policy-fields-missing'
  | 'waiting-phase-port-payload-too-shallow'
  | 'waiting-real-traces-missing';

type AdapterPayloadPromotionDecision =
  | 'blocked-until-owner-evidence-exists'
  | 'not-applicable-no-stop-payload';

interface AdapterPayloadPromotionBlockerBacklogItem {
  blockerCode: AdapterPayloadPromotionBlockerCode;
  doesNotDefineRequiredOrder: true;
  family: Exclude<AdapterPayloadFamily, 'success'>;
  fieldNames: readonly string[];
  owner: AdapterPayloadPromotionBlockerOwner;
  productionReady: false;
  promotionDecision: Extract<AdapterPayloadPromotionDecision, 'blocked-until-owner-evidence-exists'>;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

interface AdapterPayloadPromotionFamilySummary {
  family: AdapterPayloadFamily;
  promotionCandidate: boolean;
  promotionDecision: AdapterPayloadPromotionDecision;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
}

const adapterPayloadPromotionFamilySummaries = [
  {
    family: 'success',
    promotionCandidate: false,
    promotionDecision: 'not-applicable-no-stop-payload',
    reason: 'continue-with-event',
  },
  {
    family: 'waiting',
    promotionCandidate: true,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'waiting-for-phase-event',
  },
  {
    family: 'blocked',
    promotionCandidate: true,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'blocked-by-phase',
  },
  {
    family: 'failure',
    promotionCandidate: true,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadPromotionFamilySummary[];

const adapterPayloadPromotionBlockerBacklog = [
  {
    blockerCode: 'waiting-phase-port-payload-too-shallow',
    doesNotDefineRequiredOrder: true,
    family: 'waiting',
    fieldNames: [
      'pauseReason',
      'waitSource',
    ],
    owner: 'phase-port-payload-shape',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'waiting-for-phase-event',
  },
  {
    blockerCode: 'waiting-controller-policy-fields-missing',
    doesNotDefineRequiredOrder: true,
    family: 'waiting',
    fieldNames: [
      'resumeTriggerOwner',
      'waitBudget',
    ],
    owner: 'future-controller-policy-fields',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'waiting-for-phase-event',
  },
  {
    blockerCode: 'waiting-real-traces-missing',
    doesNotDefineRequiredOrder: true,
    family: 'waiting',
    fieldNames: [
      'pauseReason',
      'resumeTriggerOwner',
      'waitBudget',
      'waitSource',
    ],
    owner: 'real-or-production-like-trace-evidence',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'waiting-for-phase-event',
  },
  {
    blockerCode: 'blocked-production-adapter-evidence-missing',
    doesNotDefineRequiredOrder: true,
    family: 'blocked',
    fieldNames: [
      'blockerSource',
      'recoverability',
      'userActionRequired',
    ],
    owner: 'future-production-adapter-evidence',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'blocked-by-phase',
  },
  {
    blockerCode: 'blocked-controller-terminal-status-map-missing',
    doesNotDefineRequiredOrder: true,
    family: 'blocked',
    fieldNames: [
      'terminalStatusCandidate',
    ],
    owner: 'future-controller-policy-fields',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'blocked-by-phase',
  },
  {
    blockerCode: 'blocked-real-traces-missing',
    doesNotDefineRequiredOrder: true,
    family: 'blocked',
    fieldNames: [
      'blockerSource',
      'recoverability',
      'terminalStatusCandidate',
      'userActionRequired',
    ],
    owner: 'real-or-production-like-trace-evidence',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'blocked-by-phase',
  },
  {
    blockerCode: 'failure-phase-port-result-kind-missing',
    doesNotDefineRequiredOrder: true,
    family: 'failure',
    fieldNames: [],
    owner: 'phase-port-payload-shape',
    productionReady: false,
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'runtime-failed',
  },
  {
    blockerCode: 'failure-production-adapter-evidence-missing',
    doesNotDefineRequiredOrder: true,
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
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'runtime-failed',
  },
  {
    blockerCode: 'failure-real-traces-missing',
    doesNotDefineRequiredOrder: true,
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
    promotionDecision: 'blocked-until-owner-evidence-exists',
    reason: 'runtime-failed',
  },
] as const satisfies readonly AdapterPayloadPromotionBlockerBacklogItem[];

const reasonsExcludedFromAdapterPayloadPromotionBacklog = [
  'cancelled',
  'invalid-transition',
  'transition-budget-exhausted',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function fieldsBySource(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
  source: AgentSessionV3RuntimeStopEvidenceSource,
) {
  return getAgentSessionV3RuntimeStopEvidenceFields(reason)
    .filter((field) => field.source === source)
    .map((field) => field.name)
    .sort();
}

function assertFieldsExist(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldNames: readonly string[]) {
  const knownFieldNames = new Set(getAgentSessionV3RuntimeStopEvidenceFields(reason).map((field) => field.name));

  for (const fieldName of fieldNames) {
    assert.ok(knownFieldNames.has(fieldName), `${reason}.${fieldName} should exist in the stop evidence contract.`);
  }
}

function fieldNamesForFamily(family: Exclude<AdapterPayloadFamily, 'success'>) {
  return adapterPayloadPromotionBlockerBacklog
    .filter((item) => item.family === family)
    .flatMap((item) => item.fieldNames)
    .filter((fieldName, index, fieldNames) => fieldNames.indexOf(fieldName) === index)
    .sort();
}

function ownersForFamily(family: Exclude<AdapterPayloadFamily, 'success'>) {
  return adapterPayloadPromotionBlockerBacklog
    .filter((item) => item.family === family)
    .map((item) => item.owner)
    .filter((owner, index, owners) => owners.indexOf(owner) === index)
    .sort();
}

const {
  backlogSmokeSource,
  blockedPayloadPromotionReadinessSmokeSource,
  boundarySource,
  controllerPolicyPromotionReadinessSmokeSource,
  failurePayloadPromotionReadinessSmokeSource,
  familyRollupSmokeSource,
  phasePortPayloadReadinessSmokeSource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  backlogSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-promotion-blocker-backlog-checkpoint-smoke.ts',
  blockedPayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-blocked-payload-promotion-readiness-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerPolicyPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke.ts',
  failurePayloadPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-failure-payload-promotion-readiness-smoke.ts',
  familyRollupSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-payload-family-rollup-checkpoint-smoke.ts',
  phasePortPayloadReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-contract-readiness-rollup-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');

assert.deepEqual(
  adapterPayloadPromotionFamilySummaries.map((summary) => summary.family).sort(),
  ['blocked', 'failure', 'success', 'waiting'],
  'Promotion backlog family summaries should cover success, waiting, blocked, and failure exactly once.',
);
assert.deepEqual(
  adapterPayloadPromotionFamilySummaries
    .filter((summary) => !summary.promotionCandidate)
    .map((summary) => summary.family),
  ['success'],
  'Success should remain descriptive only because continue-with-event has no stop-payload fields.',
);
assert.deepEqual(
  adapterPayloadPromotionFamilySummaries
    .filter((summary) => summary.promotionCandidate)
    .map((summary) => summary.family)
    .sort(),
  ['blocked', 'failure', 'waiting'],
);

for (const item of adapterPayloadPromotionBlockerBacklog) {
  assert.equal(item.productionReady, false);
  assert.equal(item.promotionDecision, 'blocked-until-owner-evidence-exists');
  assert.equal(item.doesNotDefineRequiredOrder, true);
  assertFieldsExist(item.reason, item.fieldNames);
}

assert.deepEqual(
  ownersForFamily('waiting'),
  [
    'future-controller-policy-fields',
    'phase-port-payload-shape',
    'real-or-production-like-trace-evidence',
  ],
);
assert.deepEqual(
  ownersForFamily('blocked'),
  [
    'future-controller-policy-fields',
    'future-production-adapter-evidence',
    'real-or-production-like-trace-evidence',
  ],
);
assert.deepEqual(
  ownersForFamily('failure'),
  [
    'future-production-adapter-evidence',
    'phase-port-payload-shape',
    'real-or-production-like-trace-evidence',
  ],
);

assert.deepEqual(
  fieldNamesForFamily('waiting'),
  [
    'pauseReason',
    'resumeTriggerOwner',
    'waitBudget',
    'waitSource',
  ],
);
assert.deepEqual(
  fieldNamesForFamily('blocked'),
  [
    'blockerSource',
    'recoverability',
    'terminalStatusCandidate',
    'userActionRequired',
  ],
);
assert.deepEqual(
  fieldNamesForFamily('failure'),
  [
    'errorClass',
    'failureOrigin',
    'retryability',
    'sideEffectCommitted',
    'userVisibleFailureReason',
  ],
);

assert.deepEqual(fieldsBySource('waiting-for-phase-event', 'phase-port-result'), ['pauseReason', 'waitSource']);
assert.deepEqual(fieldsBySource('waiting-for-phase-event', 'future-controller-policy'), [
  'resumeTriggerOwner',
  'waitBudget',
]);
assert.deepEqual(fieldsBySource('blocked-by-phase', 'future-production-adapter'), [
  'blockerSource',
  'recoverability',
  'userActionRequired',
]);
assert.deepEqual(fieldsBySource('blocked-by-phase', 'future-controller-policy'), ['terminalStatusCandidate']);
assert.deepEqual(fieldsBySource('runtime-failed', 'future-production-adapter'), [
  'errorClass',
  'failureOrigin',
  'retryability',
  'sideEffectCommitted',
  'userVisibleFailureReason',
]);

assert.equal(
  adapterPayloadPromotionBlockerBacklog.some((item) => item.family === 'success'),
  false,
  'Success should not create promotion blockers because it has no stop-payload candidate.',
);
assert.equal(
  adapterPayloadPromotionBlockerBacklog.some((item) => item.reason === 'invalid-transition'),
  false,
  'Invalid-transition should remain runner/controller metadata, not adapter-payload promotion backlog.',
);
assert.equal(
  adapterPayloadPromotionBlockerBacklog.some((item) => item.reason === 'transition-budget-exhausted'),
  false,
  'Transition-budget should remain runner/controller metadata, not adapter-payload promotion backlog.',
);

for (const excludedReason of reasonsExcludedFromAdapterPayloadPromotionBacklog) {
  assert.equal(
    adapterPayloadPromotionBlockerBacklog.some((item) => item.reason === excludedReason),
    false,
    `${excludedReason} should remain outside the adapter-payload promotion blocker backlog for now.`,
  );
}

assert.match(familyRollupSmokeSource, /No adapter-payload family should be promoted into a formal payload contract yet/u);
assert.match(phasePortPayloadReadinessSmokeSource, /formal-contract-ready/u);
assert.match(phasePortPayloadReadinessSmokeSource, /keep-smoke-only/u);
assert.match(controllerPolicyPromotionReadinessSmokeSource, /No controller-policy-owned stop-payload field is formal-contract-ready/u);
assert.match(blockedPayloadPromotionReadinessSmokeSource, /No structured blocked payload field is formal-contract-ready/u);
assert.match(failurePayloadPromotionReadinessSmokeSource, /No structured failure payload field is formal-contract-ready/u);

const serializedBacklog = JSON.stringify(adapterPayloadPromotionBlockerBacklog);
assert.doesNotMatch(
  serializedBacklog,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Adapter-payload promotion blocker backlog should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedBacklog,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter-payload promotion blocker backlog should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedBacklog,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Adapter-payload promotion blocker backlog should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedBacklog,
  /productionReady":true|runtimeAuthority|experimental-adapter/u,
  'Adapter-payload promotion blocker backlog should not grant runtime authority.',
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter-payload promotion blocker backlog must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  backlogSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter-payload promotion blocker backlog should not call production v2 modules.',
);

assert.match(preflightAuditText, /Adapter-Payload Promotion Blocker Backlog Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-adapter-payload-promotion-blocker-backlog-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /phase-port payload shape/u);
assert.match(preflightAuditText, /future production adapter evidence/u);
assert.match(preflightAuditText, /future controller-policy fields/u);
assert.match(preflightAuditText, /real or production-like trace evidence/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter-payload promotion blocker backlog checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-adapter-payload-promotion-blocker-backlog-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary adapter-payload promotion blocker backlog checkpoint smoke ok');
