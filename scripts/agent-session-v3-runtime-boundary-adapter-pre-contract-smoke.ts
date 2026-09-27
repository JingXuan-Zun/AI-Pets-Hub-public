import assert from 'node:assert/strict';
import {
  AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
  createAgentSessionV3RuntimeBoundaryContract,
  getAgentSessionV3RuntimeStopEvidenceFields,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeDrivenPhase,
  type AgentSessionV3RuntimeSideEffectScope,
  type AgentSessionV3RuntimeStopEvidenceSource,
} from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

type AdapterCandidateReadiness =
  | 'pre-contract-only'
  | 'needs-adapter-contract'
  | 'needs-controller-policy'
  | 'needs-production-evidence';

interface StopEvidenceResponsibility {
  adapterObservableFields: string[];
  controllerPolicyFields: string[];
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  runnerDerivedFields: string[];
}

interface RuntimeAdapterPreContractAuditRow {
  allowedScopes: AgentSessionV3RuntimeSideEffectScope[];
  candidateResponsibility: string;
  currentV2OwnerModules: string[];
  doesNotDefineRequiredOrder: true;
  evidenceResponsibilities: StopEvidenceResponsibility[];
  phase: AgentSessionV3RuntimeDrivenPhase;
  productionReady: false;
  readiness: AdapterCandidateReadiness;
  runtimeAuthority: 'none';
  ownerRetention: 'AgentSessionV2 remains production owner';
  mustNotMoveYet: string[];
}

const adapterPreContractAudit = [
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.init.allowedScopes,
    candidateResponsibility: 'Describe session bootstrap evidence and initial phase transition facts.',
    currentV2OwnerModules: [
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'errorClass',
          'failureOrigin',
          'userVisibleFailureReason',
        ],
        controllerPolicyFields: [],
        reason: 'runtime-failed',
        runnerDerivedFields: [],
      },
    ],
    mustNotMoveYet: [
      'session lifecycle',
      'budget initialization',
      'history and trace persistence',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'init',
    productionReady: false,
    readiness: 'pre-contract-only',
    runtimeAuthority: 'none',
  },
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.model_decision.allowedScopes,
    candidateResponsibility: 'Describe model-decision turn results after the existing v2 model-decision module owns prompting, repair, and acceptance.',
    currentV2OwnerModules: [
      'agentSessionV2ModelDecisionTurn.ts',
      'agentSessionV2DecisionContract.ts',
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'modelBudgetState',
          'taskProgress',
        ],
        controllerPolicyFields: [
          'budgetOwner',
        ],
        reason: 'transition-budget-exhausted',
        runnerDerivedFields: [
          'transitionCount',
        ],
      },
      {
        adapterObservableFields: [
          'errorClass',
          'failureOrigin',
          'retryability',
          'userVisibleFailureReason',
        ],
        controllerPolicyFields: [],
        reason: 'runtime-failed',
        runnerDerivedFields: [],
      },
    ],
    mustNotMoveYet: [
      'prompt assembly',
      'model-output repair budgets',
      'final-answer acceptance policy',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'model_decision',
    productionReady: false,
    readiness: 'needs-production-evidence',
    runtimeAuthority: 'none',
  },
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.prepare_command.allowedScopes,
    candidateResponsibility: 'Describe command-preparation and permission-route facts after existing v2 command and permission modules own construction.',
    currentV2OwnerModules: [
      'agentSessionV2ToolCommandFactory.ts',
      'agentPermissionRouter.ts',
      'agentSessionV2ParallelToolPreparation.ts',
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'blockerSource',
          'recoverability',
          'userActionRequired',
        ],
        controllerPolicyFields: [
          'terminalStatusCandidate',
        ],
        reason: 'blocked-by-phase',
        runnerDerivedFields: [],
      },
      {
        adapterObservableFields: [
          'adapterSource',
          'retrySafety',
        ],
        controllerPolicyFields: [
          'invalidTransitionKind',
        ],
        reason: 'invalid-transition',
        runnerDerivedFields: [
          'eventType',
          'phase',
        ],
      },
    ],
    mustNotMoveYet: [
      'tool-command creation',
      'permission route aggregation',
      'parallel read-only preparation',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'prepare_command',
    productionReady: false,
    readiness: 'needs-adapter-contract',
    runtimeAuthority: 'none',
  },
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.needs_approval.allowedScopes,
    candidateResponsibility: 'Describe approval-pause evidence without owning the user wait, resume, or denial policy.',
    currentV2OwnerModules: [
      'agentSessionV2PendingApprovalAssembly.ts',
      'agentPermissionRouter.ts',
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'pauseReason',
          'waitSource',
        ],
        controllerPolicyFields: [
          'resumeTriggerOwner',
          'waitBudget',
        ],
        reason: 'waiting-for-phase-event',
        runnerDerivedFields: [],
      },
      {
        adapterObservableFields: [
          'userActionRequired',
        ],
        controllerPolicyFields: [
          'terminalStatusCandidate',
        ],
        reason: 'blocked-by-phase',
        runnerDerivedFields: [],
      },
    ],
    mustNotMoveYet: [
      'pending approval assembly',
      'approval resume semantics',
      'permission denial handling',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'needs_approval',
    productionReady: false,
    readiness: 'needs-controller-policy',
    runtimeAuthority: 'none',
  },
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.execute_transaction.allowedScopes,
    candidateResponsibility: 'Describe transaction execution evidence after the existing v2 transaction modules own side effects and progress emission.',
    currentV2OwnerModules: [
      'agentSessionV2ToolExecutionTransaction.ts',
      'agentSessionV2ParallelToolExecutionTransaction.ts',
      'agentRuntimeExecutor.ts',
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'toolBudgetState',
          'taskProgress',
        ],
        controllerPolicyFields: [
          'budgetOwner',
        ],
        reason: 'transition-budget-exhausted',
        runnerDerivedFields: [
          'transitionCount',
        ],
      },
      {
        adapterObservableFields: [
          'errorClass',
          'failureOrigin',
          'retryability',
          'sideEffectCommitted',
          'userVisibleFailureReason',
        ],
        controllerPolicyFields: [],
        reason: 'runtime-failed',
        runnerDerivedFields: [],
      },
    ],
    mustNotMoveYet: [
      'tool execution transaction',
      'side-effect commit boundary',
      'parallel execution mechanics',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'execute_transaction',
    productionReady: false,
    readiness: 'needs-adapter-contract',
    runtimeAuthority: 'none',
  },
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.evaluate.allowedScopes,
    candidateResponsibility: 'Describe post-action evaluation evidence after existing v2 evaluators own completion, user-needed, and recovery classification.',
    currentV2OwnerModules: [
      'agentSessionV2PostActionTerminalEvaluator.ts',
      'agentSessionV2PostActionStateResolver.ts',
      'agentResultAssessment.ts',
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'blockerSource',
          'recoverability',
          'userActionRequired',
        ],
        controllerPolicyFields: [
          'terminalStatusCandidate',
        ],
        reason: 'blocked-by-phase',
        runnerDerivedFields: [],
      },
      {
        adapterObservableFields: [
          'adapterSource',
          'retrySafety',
        ],
        controllerPolicyFields: [
          'invalidTransitionKind',
        ],
        reason: 'invalid-transition',
        runnerDerivedFields: [
          'eventType',
          'phase',
        ],
      },
    ],
    mustNotMoveYet: [
      'terminal evaluator decisions',
      'post-action state interpretation',
      'final result assembly',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'evaluate',
    productionReady: false,
    readiness: 'needs-production-evidence',
    runtimeAuthority: 'none',
  },
  {
    allowedScopes: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS.recover.allowedScopes,
    candidateResponsibility: 'Describe recovery-planning evidence after existing v2 recovery builders own candidate construction and retry limits.',
    currentV2OwnerModules: [
      'agentSessionV2RecoveryStrategyBuilder.ts',
      'agentSessionV2RecoveryCommandBuilder.ts',
      'agentSessionV2PostActionRecoveryFollowUpSignal.ts',
      'agentSessionV2.ts',
    ],
    doesNotDefineRequiredOrder: true,
    evidenceResponsibilities: [
      {
        adapterObservableFields: [
          'taskProgress',
        ],
        controllerPolicyFields: [
          'budgetOwner',
        ],
        reason: 'transition-budget-exhausted',
        runnerDerivedFields: [
          'recoveryCount',
          'transitionCount',
        ],
      },
      {
        adapterObservableFields: [
          'errorClass',
          'failureOrigin',
          'retryability',
          'userVisibleFailureReason',
        ],
        controllerPolicyFields: [],
        reason: 'runtime-failed',
        runnerDerivedFields: [],
      },
    ],
    mustNotMoveYet: [
      'recovery strategy',
      'recovery command construction',
      'auto-recovery stop policy',
    ],
    ownerRetention: 'AgentSessionV2 remains production owner',
    phase: 'recover',
    productionReady: false,
    readiness: 'needs-controller-policy',
    runtimeAuthority: 'none',
  },
] as const satisfies readonly RuntimeAdapterPreContractAuditRow[];

function assertFieldsMatchSource(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
  fields: readonly string[],
  expectedSources: readonly AgentSessionV3RuntimeStopEvidenceSource[],
) {
  const contractFields = new Map(getAgentSessionV3RuntimeStopEvidenceFields(reason).map((field) => [field.name, field]));

  for (const fieldName of fields) {
    const field = contractFields.get(fieldName);
    assert.ok(field, `${reason}.${fieldName} should exist in the stop evidence contract.`);
    assert.ok(
      expectedSources.includes(field.source),
      `${reason}.${fieldName} should come from ${expectedSources.join(' or ')}, got ${field.source}.`,
    );
  }
}

const {
  adapterPreContractSmokeSource,
  boundarySource,
  preflightAuditText,
  statusText,
} = readProjectSources({
  adapterPreContractSmokeSource:
    'scripts/agent-session-v3-runtime-boundary-adapter-pre-contract-smoke.ts',
  boundarySource: 'src/agent/agentSessionV3RuntimeBoundary.ts',
  preflightAuditText: 'PROJECT_AGENT_V3_FULL_RUNTIME_PREFLIGHT_AUDIT.md',
  statusText: 'PROJECT_AGENT_V2_STATUS.md',
});

const contract = createAgentSessionV3RuntimeBoundaryContract();
assert.equal(contract.productionAuthority, false);
assert.equal(contract.mode, 'contract-only');

assert.deepEqual(
  adapterPreContractAudit.map((row) => row.phase).sort(),
  Object.keys(AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS).sort(),
  'Adapter pre-contract audit should cover every non-terminal v3 runtime-driven phase.',
);

for (const row of adapterPreContractAudit) {
  assert.deepEqual(row.allowedScopes, AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS[row.phase].allowedScopes);
  assert.equal(row.productionReady, false);
  assert.equal(row.runtimeAuthority, 'none');
  assert.equal(row.ownerRetention, 'AgentSessionV2 remains production owner');
  assert.equal(row.doesNotDefineRequiredOrder, true);
  assert.ok(row.currentV2OwnerModules.includes('agentSessionV2.ts'));
  assert.ok(row.currentV2OwnerModules.every((owner) => owner.endsWith('.ts')));
  assert.ok(row.mustNotMoveYet.length >= 3);
  assert.ok(row.evidenceResponsibilities.length >= 1);

  for (const responsibility of row.evidenceResponsibilities) {
    assertFieldsMatchSource(
      responsibility.reason,
      responsibility.adapterObservableFields,
      ['future-production-adapter', 'phase-port-result'],
    );
    assertFieldsMatchSource(
      responsibility.reason,
      responsibility.controllerPolicyFields,
      ['future-controller-policy'],
    );
    assertFieldsMatchSource(
      responsibility.reason,
      responsibility.runnerDerivedFields,
      ['pilot-runner-state'],
    );
  }
}

assert.deepEqual(
  adapterPreContractAudit.find((row) => row.phase === 'execute_transaction')?.allowedScopes,
  ['transaction-execution', 'trace-recording', 'progress-emission'],
);
assert.deepEqual(
  adapterPreContractAudit.find((row) => row.phase === 'prepare_command')?.allowedScopes,
  ['command-preparation', 'permission-route-consumption', 'trace-recording'],
);
assert.ok(
  adapterPreContractAudit
    .find((row) => row.phase === 'needs_approval')
    ?.evidenceResponsibilities.some((responsibility) => responsibility.reason === 'waiting-for-phase-event'),
);
assert.ok(
  adapterPreContractAudit
    .find((row) => row.phase === 'recover')
    ?.evidenceResponsibilities.some((responsibility) => responsibility.runnerDerivedFields.includes('recoveryCount')),
);

assert.doesNotMatch(
  boundarySource,
  /runAgentSessionV2|runAgentSessionV2ModelDecisionTurn|runAgentSessionV2ToolExecutionTransaction|buildAgentPermissionRoute|toolExecutor/u,
  'Adapter pre-contract audit must not add production calls to the boundary contract.',
);
assert.doesNotMatch(
  adapterPreContractSmokeSource,
  /runAgentSessionV2ModelDecisionTurn\(|runAgentSessionV2ToolExecutionTransaction\(|buildAgentPermissionRoute\(|evaluateAgentSessionV2PostActionTerminal\(|executeAgentChatCommand\(/u,
  'Adapter pre-contract audit should reference current owners, not call production v2 modules.',
);

const serializedAudit = JSON.stringify(adapterPreContractAudit);
assert.doesNotMatch(
  serializedAudit,
  /observe_windows_and_apps|locate_screen_elements|execute_desktop_sequence|execute_desktop_input|execute_desktop_action|mouse_click|keyboard_hotkey/iu,
  'Adapter pre-contract audit should not prescribe concrete desktop tools.',
);
assert.doesNotMatch(
  serializedAudit,
  /observe\s*->\s*locate\s*->\s*execute\s*->\s*verify|if .* then execute|fallback chain|nextTool|nextArgs/iu,
  'Adapter pre-contract audit should not define fixed workflows or fallback chains.',
);
assert.doesNotMatch(
  serializedAudit,
  /productionReady":true|runtimeAuthority":"experimental-adapter"/u,
  'Adapter pre-contract audit should not grant production runtime authority.',
);

assert.match(preflightAuditText, /Runtime Adapter Pre-Contract Audit Status/u);
assert.match(preflightAuditText, /agent-session-v3-runtime-boundary-adapter-pre-contract-smoke\.ts/u);
assert.match(preflightAuditText, /AgentSessionV2 remains production owner/u);
assert.match(preflightAuditText, /not production wiring/u);
assert.match(statusText, /V3 runtime boundary adapter pre-contract audit.*Completed/u);
assert.match(statusText, /agent-session-v3-runtime-boundary-adapter-pre-contract-smoke\.ts/u);

console.log('agent session v3 runtime boundary adapter pre-contract smoke ok');
