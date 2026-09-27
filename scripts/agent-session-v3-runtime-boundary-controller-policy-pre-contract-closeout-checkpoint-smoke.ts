import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ControllerPolicyCloseoutField =
  | 'budgetOwner'
  | 'invalidTransitionKind'
  | 'resumeTriggerOwner'
  | 'terminalStatusCandidate'
  | 'waitBudget';

type ControllerPolicyCloseoutCoverage =
  | 'gap-alignment'
  | 'ownership-pre-contract'
  | 'promotion-readiness';

type ControllerPolicyCloseoutDecision =
  | 'keep-smoke-only';

type ControllerPolicyCloseoutBlocker =
  | 'no-current-source'
  | 'requires-adapter-or-phase-evidence-first'
  | 'requires-controller-policy-contract'
  | 'requires-real-production-like-traces';

interface ControllerPolicyPreContractCloseoutRow {
  blockers: readonly ControllerPolicyCloseoutBlocker[];
  coverage: readonly ControllerPolicyCloseoutCoverage[];
  decision: ControllerPolicyCloseoutDecision;
  fieldName: ControllerPolicyCloseoutField;
  formalPolicyContractReady: false;
  productionReady: false;
  reason: Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    | 'blocked-by-phase'
    | 'invalid-transition'
    | 'transition-budget-exhausted'
    | 'waiting-for-phase-event'
  >;
  remainsControllerPolicyOwned: true;
}

interface ControllerPolicyPreContractCloseoutCheckpoint {
  formalPolicyContractReady: false;
  gate: 'controller-policy-pre-contract-closeout';
  productionReady: false;
  rows: readonly ControllerPolicyPreContractCloseoutRow[];
}

const controllerPolicyPreContractCloseoutCheckpoint = {
  formalPolicyContractReady: false,
  gate: 'controller-policy-pre-contract-closeout',
  productionReady: false,
  rows: [
    {
      blockers: [
        'no-current-source',
        'requires-adapter-or-phase-evidence-first',
        'requires-controller-policy-contract',
        'requires-real-production-like-traces',
      ],
      coverage: [
        'ownership-pre-contract',
        'promotion-readiness',
        'gap-alignment',
      ],
      decision: 'keep-smoke-only',
      fieldName: 'resumeTriggerOwner',
      formalPolicyContractReady: false,
      productionReady: false,
      reason: 'waiting-for-phase-event',
      remainsControllerPolicyOwned: true,
    },
    {
      blockers: [
        'no-current-source',
        'requires-adapter-or-phase-evidence-first',
        'requires-controller-policy-contract',
        'requires-real-production-like-traces',
      ],
      coverage: [
        'ownership-pre-contract',
        'promotion-readiness',
        'gap-alignment',
      ],
      decision: 'keep-smoke-only',
      fieldName: 'waitBudget',
      formalPolicyContractReady: false,
      productionReady: false,
      reason: 'waiting-for-phase-event',
      remainsControllerPolicyOwned: true,
    },
    {
      blockers: [
        'no-current-source',
        'requires-adapter-or-phase-evidence-first',
        'requires-controller-policy-contract',
        'requires-real-production-like-traces',
      ],
      coverage: [
        'ownership-pre-contract',
        'promotion-readiness',
        'gap-alignment',
      ],
      decision: 'keep-smoke-only',
      fieldName: 'terminalStatusCandidate',
      formalPolicyContractReady: false,
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsControllerPolicyOwned: true,
    },
    {
      blockers: [
        'no-current-source',
        'requires-adapter-or-phase-evidence-first',
        'requires-controller-policy-contract',
        'requires-real-production-like-traces',
      ],
      coverage: [
        'ownership-pre-contract',
        'promotion-readiness',
        'gap-alignment',
      ],
      decision: 'keep-smoke-only',
      fieldName: 'invalidTransitionKind',
      formalPolicyContractReady: false,
      productionReady: false,
      reason: 'invalid-transition',
      remainsControllerPolicyOwned: true,
    },
    {
      blockers: [
        'no-current-source',
        'requires-adapter-or-phase-evidence-first',
        'requires-controller-policy-contract',
        'requires-real-production-like-traces',
      ],
      coverage: [
        'ownership-pre-contract',
        'promotion-readiness',
        'gap-alignment',
      ],
      decision: 'keep-smoke-only',
      fieldName: 'budgetOwner',
      formalPolicyContractReady: false,
      productionReady: false,
      reason: 'transition-budget-exhausted',
      remainsControllerPolicyOwned: true,
    },
  ],
} as const satisfies ControllerPolicyPreContractCloseoutCheckpoint;

const excludedReasons = [
  'cancelled',
  'continue-with-event',
  'runtime-failed',
] as const satisfies readonly AgentSessionV3RuntimeBoundaryStopReason[];

function createFieldKey(reason: AgentSessionV3RuntimeBoundaryStopReason, fieldName: string) {
  return `${reason}.${fieldName}`;
}

const {
  boundarySource,
  closeoutSmokeSource,
  controllerPolicyGapAlignmentSmokeSource,
  controllerPolicyOwnershipSmokeSource,
  controllerPolicyPromotionReadinessSmokeSource,
  phasePortPayloadCloseoutSmokeSource,
  preflightAuditText,
  productionAdapterEvidenceCloseoutSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  closeoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke.ts',
  controllerPolicyGapAlignmentSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-gap-alignment-checkpoint-smoke.ts',
  controllerPolicyOwnershipSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke.ts',
  controllerPolicyPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke.ts',
  phasePortPayloadCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-phase-port-payload-pre-contract-closeout-checkpoint-smoke.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  productionAdapterEvidenceCloseoutSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-production-adapter-evidence-pre-contract-closeout-checkpoint-smoke.ts',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const boundaryContract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(boundaryContract.productionAuthority, false);
assert.equal(boundaryContract.authority, 'none');
assert.equal(controllerPolicyPreContractCloseoutCheckpoint.formalPolicyContractReady, false);
assert.equal(controllerPolicyPreContractCloseoutCheckpoint.productionReady, false);

const controllerPolicyContractFields = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? [])
    .filter((field) => field.source === 'future-controller-policy')
    .map((field) => ({
      fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
      fieldName: field.name,
      reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    })));

assert.deepEqual(
  controllerPolicyPreContractCloseoutCheckpoint.rows
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  controllerPolicyContractFields.map((field) => field.fieldKey).sort(),
  'Controller-policy pre-contract closeout should cover every controller-policy stop-payload field exactly once.',
);

for (const row of controllerPolicyPreContractCloseoutCheckpoint.rows) {
  const contractField = controllerPolicyContractFields.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist as a controller-policy field.`);
  assert.equal(row.decision, 'keep-smoke-only');
  assert.equal(row.formalPolicyContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsControllerPolicyOwned, true);
  assert.deepEqual(row.coverage, [
    'ownership-pre-contract',
    'promotion-readiness',
    'gap-alignment',
  ]);
  assert.deepEqual(row.blockers, [
    'no-current-source',
    'requires-adapter-or-phase-evidence-first',
    'requires-controller-policy-contract',
    'requires-real-production-like-traces',
  ]);
}

assert.deepEqual(
  controllerPolicyPreContractCloseoutCheckpoint.rows
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  [
    'blocked-by-phase.terminalStatusCandidate',
    'invalid-transition.invalidTransitionKind',
    'transition-budget-exhausted.budgetOwner',
    'waiting-for-phase-event.resumeTriggerOwner',
    'waiting-for-phase-event.waitBudget',
  ],
);

for (const excludedReason of excludedReasons) {
  assert.equal(
    controllerPolicyPreContractCloseoutCheckpoint.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside controller-policy pre-contract closeout for now.`,
  );
}

assert.match(controllerPolicyOwnershipSmokeSource, /future-controller-policy-owned/u);
assert.match(controllerPolicyPromotionReadinessSmokeSource, /keep-smoke-only/u);
assert.match(controllerPolicyGapAlignmentSmokeSource, /adapterMayDecide: false/u);
assert.match(controllerPolicyGapAlignmentSmokeSource, /runtime-failed/u);
assert.match(productionAdapterEvidenceCloseoutSmokeSource, /adapterContractPromotionAllowed: false/u);
assert.match(phasePortPayloadCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);

const serializedCloseout = JSON.stringify(controllerPolicyPreContractCloseoutCheckpoint);
assert.doesNotMatch(
  serializedCloseout,
  /formalPolicyContractReady":true|productionReady":true|decision":"formal-contract-ready/u,
  'Controller-policy pre-contract closeout must not allow policy-contract promotion.',
);
assert.doesNotMatch(
  serializedCloseout,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Controller-policy pre-contract closeout should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Controller-policy pre-contract closeout should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedCloseout,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Controller-policy pre-contract closeout should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedCloseout,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Controller-policy pre-contract closeout should remain a pre-contract audit checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Controller-policy pre-contract closeout should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Controller-policy pre-contract closeout should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Controller-policy pre-contract closeout must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  closeoutSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Controller-policy pre-contract closeout should not call production v2 modules.',
);

assert.match(preflightAuditText, /Controller-Policy Pre-Contract Closeout Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /controller-policy fields remain smoke-only/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary controller-policy pre-contract closeout checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-controller-policy-pre-contract-closeout-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary controller-policy pre-contract closeout checkpoint smoke ok');
