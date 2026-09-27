import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
  createAgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryStopReason,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type ControllerPolicyGapAlignmentField =
  | 'budgetOwner'
  | 'invalidTransitionKind'
  | 'resumeTriggerOwner'
  | 'terminalStatusCandidate'
  | 'waitBudget';

type ControllerPolicyGapAlignmentDecisionKind =
  | 'budget-owner-policy'
  | 'invalid-transition-classification-policy'
  | 'terminal-status-policy'
  | 'wait-budget-policy'
  | 'wait-resume-policy';

type ControllerPolicyGapAlignmentInput =
  | 'controller-policy-ownership-pre-contract'
  | 'controller-policy-promotion-readiness'
  | 'phase-port-payload-pre-contract-closeout'
  | 'production-adapter-evidence-pre-contract-closeout';

interface ControllerPolicyGapAlignmentRow {
  adapterMayDecide: false;
  decisionKind: ControllerPolicyGapAlignmentDecisionKind;
  fieldName: ControllerPolicyGapAlignmentField;
  formalPolicyContractReady: false;
  inputs: readonly ControllerPolicyGapAlignmentInput[];
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

interface ControllerPolicyGapAlignmentCheckpoint {
  formalPolicyContractReady: false;
  gate: 'controller-policy-gap-alignment';
  productionReady: false;
  rows: readonly ControllerPolicyGapAlignmentRow[];
}

const controllerPolicyGapAlignmentCheckpoint = {
  formalPolicyContractReady: false,
  gate: 'controller-policy-gap-alignment',
  productionReady: false,
  rows: [
    {
      adapterMayDecide: false,
      decisionKind: 'wait-resume-policy',
      fieldName: 'resumeTriggerOwner',
      formalPolicyContractReady: false,
      inputs: [
        'controller-policy-ownership-pre-contract',
        'controller-policy-promotion-readiness',
        'phase-port-payload-pre-contract-closeout',
      ],
      productionReady: false,
      reason: 'waiting-for-phase-event',
      remainsControllerPolicyOwned: true,
    },
    {
      adapterMayDecide: false,
      decisionKind: 'wait-budget-policy',
      fieldName: 'waitBudget',
      formalPolicyContractReady: false,
      inputs: [
        'controller-policy-ownership-pre-contract',
        'controller-policy-promotion-readiness',
        'phase-port-payload-pre-contract-closeout',
      ],
      productionReady: false,
      reason: 'waiting-for-phase-event',
      remainsControllerPolicyOwned: true,
    },
    {
      adapterMayDecide: false,
      decisionKind: 'terminal-status-policy',
      fieldName: 'terminalStatusCandidate',
      formalPolicyContractReady: false,
      inputs: [
        'controller-policy-ownership-pre-contract',
        'controller-policy-promotion-readiness',
        'production-adapter-evidence-pre-contract-closeout',
      ],
      productionReady: false,
      reason: 'blocked-by-phase',
      remainsControllerPolicyOwned: true,
    },
    {
      adapterMayDecide: false,
      decisionKind: 'invalid-transition-classification-policy',
      fieldName: 'invalidTransitionKind',
      formalPolicyContractReady: false,
      inputs: [
        'controller-policy-ownership-pre-contract',
        'controller-policy-promotion-readiness',
      ],
      productionReady: false,
      reason: 'invalid-transition',
      remainsControllerPolicyOwned: true,
    },
    {
      adapterMayDecide: false,
      decisionKind: 'budget-owner-policy',
      fieldName: 'budgetOwner',
      formalPolicyContractReady: false,
      inputs: [
        'controller-policy-ownership-pre-contract',
        'controller-policy-promotion-readiness',
      ],
      productionReady: false,
      reason: 'transition-budget-exhausted',
      remainsControllerPolicyOwned: true,
    },
  ],
} as const satisfies ControllerPolicyGapAlignmentCheckpoint;

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
  controllerPolicyOwnershipSmokeSource,
  controllerPolicyPromotionReadinessSmokeSource,
  finalGateSmokeSource,
  gapAlignmentSmokeSource,
  phasePortPayloadCloseoutSmokeSource,
  preflightAuditText,
  productionAdapterEvidenceCloseoutSmokeSource,
  statusText,
} = readProjectSources({
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  controllerPolicyOwnershipSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-ownership-pre-contract-smoke.ts',
  controllerPolicyPromotionReadinessSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-payload-promotion-readiness-smoke.ts',
  finalGateSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-payload-closeout-final-preflight-gate-smoke.ts',
  gapAlignmentSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-controller-policy-gap-alignment-checkpoint-smoke.ts',
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
assert.equal(controllerPolicyGapAlignmentCheckpoint.formalPolicyContractReady, false);
assert.equal(controllerPolicyGapAlignmentCheckpoint.productionReady, false);

const controllerPolicyContractFields = Object.entries(AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT)
  .flatMap(([reason, fields]) => (fields ?? [])
    .filter((field) => field.source === 'future-controller-policy')
    .map((field) => ({
      fieldKey: createFieldKey(reason as AgentSessionV3RuntimeBoundaryStopReason, field.name),
      fieldName: field.name,
      reason: reason as AgentSessionV3RuntimeBoundaryStopReason,
    })));

assert.deepEqual(
  controllerPolicyGapAlignmentCheckpoint.rows
    .map((row) => createFieldKey(row.reason, row.fieldName))
    .sort(),
  controllerPolicyContractFields.map((field) => field.fieldKey).sort(),
  'Controller-policy gap alignment should cover every controller-policy stop-payload field exactly once.',
);

for (const row of controllerPolicyGapAlignmentCheckpoint.rows) {
  const contractField = controllerPolicyContractFields.find((field) => (
    field.reason === row.reason && field.fieldName === row.fieldName
  ));

  assert.ok(contractField, `${row.reason}.${row.fieldName} should exist as a controller-policy field.`);
  assert.equal(row.adapterMayDecide, false);
  assert.equal(row.formalPolicyContractReady, false);
  assert.equal(row.productionReady, false);
  assert.equal(row.remainsControllerPolicyOwned, true);
  assert.ok(row.inputs.includes('controller-policy-ownership-pre-contract'));
  assert.ok(row.inputs.includes('controller-policy-promotion-readiness'));

  if (row.reason === 'waiting-for-phase-event') {
    assert.ok(row.inputs.includes('phase-port-payload-pre-contract-closeout'));
    assert.equal(row.inputs.includes('production-adapter-evidence-pre-contract-closeout'), false);
  }

  if (row.reason === 'blocked-by-phase') {
    assert.ok(row.inputs.includes('production-adapter-evidence-pre-contract-closeout'));
    assert.equal(row.inputs.includes('phase-port-payload-pre-contract-closeout'), false);
  }

  if (row.reason === 'invalid-transition' || row.reason === 'transition-budget-exhausted') {
    assert.deepEqual(row.inputs, [
      'controller-policy-ownership-pre-contract',
      'controller-policy-promotion-readiness',
    ]);
  }
}

assert.deepEqual(
  controllerPolicyGapAlignmentCheckpoint.rows
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
    controllerPolicyGapAlignmentCheckpoint.rows.some((row) => row.reason === excludedReason),
    false,
    `${excludedReason} should stay outside controller-policy gap alignment for now.`,
  );
}

assert.match(controllerPolicyOwnershipSmokeSource, /future-controller-policy-owned/u);
assert.match(controllerPolicyPromotionReadinessSmokeSource, /keep-smoke-only/u);
assert.match(productionAdapterEvidenceCloseoutSmokeSource, /adapterContractPromotionAllowed: false/u);
assert.match(productionAdapterEvidenceCloseoutSmokeSource, /waiting-for-phase-event/u);
assert.match(phasePortPayloadCloseoutSmokeSource, /phase-port payload side is internally covered but still pre-contract only/u);
assert.match(finalGateSmokeSource, /controller-policy-fields-not-formalized/u);

const serializedAlignment = JSON.stringify(controllerPolicyGapAlignmentCheckpoint);
assert.doesNotMatch(
  serializedAlignment,
  /adapterMayDecide":true|productionReady":true|formalPolicyContractReady":true/u,
  'Controller-policy gap alignment must not let adapter evidence become controller policy.',
);
assert.doesNotMatch(
  serializedAlignment,
  /nextTool|nextArgs|toolName|permissionRoute|recoveryAction|shouldPause|shouldRecover|shouldFail/u,
  'Controller-policy gap alignment should not define controller actions or tool decisions.',
);
assert.doesNotMatch(
  serializedAlignment,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Controller-policy gap alignment should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedAlignment,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain/iu,
  'Controller-policy gap alignment should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedAlignment,
  /implementationQueue|orderedSteps|runtimeAuthority|experimental-adapter/u,
  'Controller-policy gap alignment should remain a pre-contract audit checkpoint.',
);

assert.doesNotMatch(
  boundarySource,
  /interface AgentSessionV3Runtime(PhasePort|Adapter).*(Payload|Contract)|type AgentSessionV3Runtime(PhasePort|Adapter).*Payload/u,
  'Controller-policy gap alignment should not add formal phase-port or adapter payload types.',
);
assert.doesNotMatch(
  boundarySource,
  /kind:\s*'failure'/u,
  'Controller-policy gap alignment should not add a phase-port failure result kind.',
);
assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Controller-policy gap alignment must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  gapAlignmentSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Controller-policy gap alignment should not call production v2 modules.',
);

assert.match(preflightAuditText, /Controller-Policy Gap Alignment Checkpoint Status/u);
assert.match(
  preflightAuditText,
  /agent-session-v3-runtime-boundary-controller-policy-gap-alignment-checkpoint-smoke\.ts/u,
);
assert.match(preflightAuditText, /pause, fail, recover, retry, and terminal-status decisions/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary controller-policy gap alignment checkpoint.*Completed/u);
assert.match(
  statusText,
  /agent-session-v3-runtime-boundary-controller-policy-gap-alignment-checkpoint-smoke\.ts/u,
);

console.log('agent session v3 runtime boundary controller-policy gap alignment checkpoint smoke ok');
