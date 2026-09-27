import {
  type AgentSessionV3PilotRunnerContext,
  type AgentSessionV3PilotRunnerResult,
} from './agentSessionV3PilotRunner';
import {
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotEventType,
  type AgentSessionV3PilotPhase,
  type AgentSessionV3PilotState,
  type AgentSessionV3PilotTransition,
} from './agentSessionV3PilotStateMachine';

export type AgentSessionV3RuntimeBoundaryMode =
  | 'contract-only'
  | 'debug-shadow'
  | 'experimental-non-production';

export type AgentSessionV3RuntimeBoundaryAuthority =
  | 'none'
  | 'debug-observer'
  | 'experimental-adapter';

export type AgentSessionV3RuntimeDrivenPhase = Exclude<AgentSessionV3PilotPhase, 'done' | 'failed'>;

export type AgentSessionV3RuntimeSideEffectScope =
  | 'none'
  | 'model-call'
  | 'command-preparation'
  | 'permission-route-consumption'
  | 'approval-pause'
  | 'transaction-execution'
  | 'post-action-evaluation'
  | 'recovery-planning'
  | 'trace-recording'
  | 'progress-emission';

export interface AgentSessionV3RuntimeSideEffectLimit {
  allowedScopes: AgentSessionV3RuntimeSideEffectScope[];
  forbiddenAuthority: string[];
  phase: AgentSessionV3RuntimeDrivenPhase;
}

export interface AgentSessionV3RuntimePhasePortContext<
  Phase extends AgentSessionV3RuntimeDrivenPhase = AgentSessionV3RuntimeDrivenPhase,
> extends AgentSessionV3PilotRunnerContext {
  boundaryMode: AgentSessionV3RuntimeBoundaryMode;
  phase: Phase;
  sideEffectLimit: AgentSessionV3RuntimeSideEffectLimit;
}

export type AgentSessionV3RuntimePhasePortResult =
  | {
      event: AgentSessionV3PilotEvent;
      kind: 'event';
      notes?: string[];
    }
  | {
      kind: 'waiting';
      reason: string;
    }
  | {
      kind: 'blocked';
      reason: string;
    };

export type AgentSessionV3RuntimePhasePortResultKind = AgentSessionV3RuntimePhasePortResult['kind'];

export type AgentSessionV3RuntimeBoundaryStopReason =
  | 'continue-with-event'
  | 'waiting-for-phase-event'
  | 'blocked-by-phase'
  | 'invalid-transition'
  | 'transition-budget-exhausted'
  | 'cancelled'
  | 'runtime-failed';

export interface AgentSessionV3RuntimeBoundaryStopSemantic {
  isTerminal: boolean;
  portResultKind: AgentSessionV3RuntimePhasePortResultKind;
  reason: AgentSessionV3RuntimeBoundaryStopReason;
  requiresControllerDecision: boolean;
  summary: string;
}

export type AgentSessionV3RuntimeStopEvidenceSource =
  | 'pilot-runner-state'
  | 'phase-port-result'
  | 'future-production-adapter'
  | 'future-controller-policy';

export interface AgentSessionV3RuntimeStopEvidenceField {
  description: string;
  name: string;
  requiredForProductionPolicy: boolean;
  source: AgentSessionV3RuntimeStopEvidenceSource;
}

export type AgentSessionV3RuntimeStopEvidenceContract = Partial<Record<
  AgentSessionV3RuntimeBoundaryStopReason,
  AgentSessionV3RuntimeStopEvidenceField[]
>>;

export interface AgentSessionV3RuntimeInvalidTransitionStopMetadata {
  eventType: AgentSessionV3PilotEventType;
  phase: AgentSessionV3PilotPhase;
  reason: 'invalid-transition';
}

export interface AgentSessionV3RuntimeTransitionBudgetStopMetadata {
  reason: 'transition-budget-exhausted';
  recoveryCount: number;
  transitionCount: number;
}

export type AgentSessionV3RuntimeRunnerDerivedStopMetadata =
  | AgentSessionV3RuntimeInvalidTransitionStopMetadata
  | AgentSessionV3RuntimeTransitionBudgetStopMetadata;

export interface AgentSessionV3RuntimeRunnerDerivedStopMetadataContract {
  fieldsByReason: {
    'invalid-transition': readonly (keyof AgentSessionV3RuntimeInvalidTransitionStopMetadata)[];
    'transition-budget-exhausted': readonly (keyof AgentSessionV3RuntimeTransitionBudgetStopMetadata)[];
  };
  guardrails: string[];
  productionAuthority: false;
  promotedReasons: readonly Extract<
    AgentSessionV3RuntimeBoundaryStopReason,
    'invalid-transition' | 'transition-budget-exhausted'
  >[];
  version: 1;
}

export type AgentSessionV3RuntimePhasePort<
  Phase extends AgentSessionV3RuntimeDrivenPhase = AgentSessionV3RuntimeDrivenPhase,
> = (
  context: AgentSessionV3RuntimePhasePortContext<Phase>,
) => AgentSessionV3RuntimePhasePortResult | Promise<AgentSessionV3RuntimePhasePortResult>;

export type AgentSessionV3RuntimeBoundaryPorts = Partial<{
  [Phase in AgentSessionV3RuntimeDrivenPhase]: AgentSessionV3RuntimePhasePort<Phase>;
}>;

export interface AgentSessionV3RuntimeBoundaryContract {
  authority: AgentSessionV3RuntimeBoundaryAuthority;
  guardrails: string[];
  mode: AgentSessionV3RuntimeBoundaryMode;
  phaseLimits: Record<AgentSessionV3RuntimeDrivenPhase, AgentSessionV3RuntimeSideEffectLimit>;
  productionAuthority: false;
  runnerDerivedStopMetadataContract: AgentSessionV3RuntimeRunnerDerivedStopMetadataContract;
  stopEvidenceContract: AgentSessionV3RuntimeStopEvidenceContract;
  stopSemantics: Record<AgentSessionV3RuntimePhasePortResultKind, AgentSessionV3RuntimeBoundaryStopSemantic>;
  version: 1;
}

const AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY = [
  'replace AgentSessionV2',
  'choose tools outside the active phase port',
  'route permissions outside an explicit permission phase adapter',
  'execute tools outside an explicit transaction phase adapter',
  'decide recovery outside an explicit recovery phase adapter',
  'define a required ordered tool workflow',
];

export const AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS = [
  'contract-only by default',
  'productionAuthority=false',
  'AgentSessionV2 remains the production orchestrator',
  'ports return events or waiting/blocked results',
  'waiting/blocked results require explicit controller stop semantics before production',
  'adapters must stay inside declared phase side-effect limits',
  'no required ordered tool workflow',
  'no evidence adapter gains runtime authority',
];

export const AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS: Record<
  AgentSessionV3RuntimeDrivenPhase,
  AgentSessionV3RuntimeSideEffectLimit
> = {
  evaluate: {
    allowedScopes: ['post-action-evaluation', 'trace-recording'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'evaluate',
  },
  execute_transaction: {
    allowedScopes: ['transaction-execution', 'trace-recording', 'progress-emission'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'execute_transaction',
  },
  init: {
    allowedScopes: ['none', 'trace-recording'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'init',
  },
  model_decision: {
    allowedScopes: ['model-call', 'trace-recording'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'model_decision',
  },
  needs_approval: {
    allowedScopes: ['approval-pause', 'trace-recording'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'needs_approval',
  },
  prepare_command: {
    allowedScopes: ['command-preparation', 'permission-route-consumption', 'trace-recording'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'prepare_command',
  },
  recover: {
    allowedScopes: ['recovery-planning', 'trace-recording'],
    forbiddenAuthority: AGENT_SESSION_V3_RUNTIME_FORBIDDEN_AUTHORITY,
    phase: 'recover',
  },
};

export const AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS: Record<
  AgentSessionV3RuntimePhasePortResultKind,
  AgentSessionV3RuntimeBoundaryStopSemantic
> = {
  blocked: {
    isTerminal: false,
    portResultKind: 'blocked',
    reason: 'blocked-by-phase',
    requiresControllerDecision: true,
    summary: 'The phase adapter could not produce a safe event; a future controller must decide pause, fail, or recover.',
  },
  event: {
    isTerminal: false,
    portResultKind: 'event',
    reason: 'continue-with-event',
    requiresControllerDecision: false,
    summary: 'The phase adapter produced a pilot event that may be applied to the state machine.',
  },
  waiting: {
    isTerminal: false,
    portResultKind: 'waiting',
    reason: 'waiting-for-phase-event',
    requiresControllerDecision: true,
    summary: 'The phase adapter needs more input or time; a future controller must decide whether to wait, poll, or pause.',
  },
};

export const AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT: AgentSessionV3RuntimeStopEvidenceContract = {
  'blocked-by-phase': [
    {
      description: 'Classifies whether the block came from phase input, environment state, permissions, or adapter limits.',
      name: 'blockerSource',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Indicates whether retry or recovery may safely continue without user intervention.',
      name: 'recoverability',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Indicates whether user action is required before the runtime can continue.',
      name: 'userActionRequired',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'The future terminal status candidate if the controller stops instead of recovering.',
      name: 'terminalStatusCandidate',
      requiredForProductionPolicy: true,
      source: 'future-controller-policy',
    },
  ],
  'invalid-transition': [
    {
      description: 'The state-machine phase that rejected the event.',
      name: 'phase',
      requiredForProductionPolicy: true,
      source: 'pilot-runner-state',
    },
    {
      description: 'The event type rejected by the state machine.',
      name: 'eventType',
      requiredForProductionPolicy: true,
      source: 'pilot-runner-state',
    },
    {
      description: 'The phase adapter or event source that emitted the invalid event.',
      name: 'adapterSource',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Classifies whether the issue is state corruption, adapter bug, or stale event evidence.',
      name: 'invalidTransitionKind',
      requiredForProductionPolicy: true,
      source: 'future-controller-policy',
    },
    {
      description: 'Indicates whether retrying the current phase is safe.',
      name: 'retrySafety',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
  ],
  'runtime-failed': [
    {
      description: 'Classifies whether failure came from model, tool, phase adapter, runner driver, or terminal policy.',
      name: 'failureOrigin',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Indicates whether the failure can be retried without repeating unsafe side effects.',
      name: 'retryability',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Indicates whether the failed phase may already have committed side effects.',
      name: 'sideEffectCommitted',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'The user-visible explanation if the runtime stops.',
      name: 'userVisibleFailureReason',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Normalized error class for reporting and comparison.',
      name: 'errorClass',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
  ],
  'transition-budget-exhausted': [
    {
      description: 'Identifies whether the exhausted budget belongs to transitions, model calls, tool calls, or wall time.',
      name: 'budgetOwner',
      requiredForProductionPolicy: true,
      source: 'future-controller-policy',
    },
    {
      description: 'The transition count when the runtime stopped.',
      name: 'transitionCount',
      requiredForProductionPolicy: true,
      source: 'pilot-runner-state',
    },
    {
      description: 'Model-call budget state at the stop point.',
      name: 'modelBudgetState',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Tool-call budget state at the stop point.',
      name: 'toolBudgetState',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Evidence of task progress at the stop point.',
      name: 'taskProgress',
      requiredForProductionPolicy: true,
      source: 'future-production-adapter',
    },
    {
      description: 'Recovery count when the runtime stopped.',
      name: 'recoveryCount',
      requiredForProductionPolicy: true,
      source: 'pilot-runner-state',
    },
  ],
  'waiting-for-phase-event': [
    {
      description: 'Classifies why the phase cannot emit an event yet.',
      name: 'waitSource',
      requiredForProductionPolicy: true,
      source: 'phase-port-result',
    },
    {
      description: 'Identifies who can resume the waiting phase.',
      name: 'resumeTriggerOwner',
      requiredForProductionPolicy: true,
      source: 'future-controller-policy',
    },
    {
      description: 'Maximum wait or poll budget available to the future controller.',
      name: 'waitBudget',
      requiredForProductionPolicy: true,
      source: 'future-controller-policy',
    },
    {
      description: 'The user-visible pause reason if the runtime cannot continue immediately.',
      name: 'pauseReason',
      requiredForProductionPolicy: true,
      source: 'phase-port-result',
    },
  ],
};

export const AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT:
  AgentSessionV3RuntimeRunnerDerivedStopMetadataContract = {
    fieldsByReason: {
      'invalid-transition': ['reason', 'phase', 'eventType'],
      'transition-budget-exhausted': ['reason', 'transitionCount', 'recoveryCount'],
    },
    guardrails: [
      'runner-derived metadata only',
      'no adapter-owned stop-payload fields',
      'no controller-policy fields',
      'no production runtime authority',
      'no required ordered tool workflow',
    ],
    productionAuthority: false,
    promotedReasons: ['invalid-transition', 'transition-budget-exhausted'],
    version: 1,
  };

export function getAgentSessionV3RuntimePhaseSideEffectLimit(
  phase: AgentSessionV3RuntimeDrivenPhase,
): AgentSessionV3RuntimeSideEffectLimit {
  return AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS[phase];
}

export function getAgentSessionV3RuntimeBoundaryStopSemantic(
  resultKind: AgentSessionV3RuntimePhasePortResultKind,
): AgentSessionV3RuntimeBoundaryStopSemantic {
  return AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS[resultKind];
}

export function getAgentSessionV3RuntimeStopEvidenceFields(
  reason: AgentSessionV3RuntimeBoundaryStopReason,
): readonly AgentSessionV3RuntimeStopEvidenceField[] {
  return AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT[reason] ?? [];
}

export function getAgentSessionV3RuntimeRunnerDerivedStopMetadataFields(
  reason: Extract<AgentSessionV3RuntimeBoundaryStopReason, 'invalid-transition' | 'transition-budget-exhausted'>,
): readonly string[] {
  return AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT.fieldsByReason[reason];
}

export function extractAgentSessionV3RuntimeRunnerDerivedStopMetadata(
  result: AgentSessionV3PilotRunnerResult,
): AgentSessionV3RuntimeRunnerDerivedStopMetadata | null {
  if (result.status === 'invalid-transition') {
    if (!result.transition || result.transition.accepted) {
      return null;
    }

    return {
      eventType: result.transition.event.type,
      phase: result.transition.from,
      reason: 'invalid-transition',
    };
  }

  if (result.status === 'transition-limit') {
    return {
      reason: 'transition-budget-exhausted',
      recoveryCount: result.state.recoveryCount,
      transitionCount: result.transitions.length,
    };
  }

  return null;
}

export function createAgentSessionV3RuntimePhasePortContext<
  Phase extends AgentSessionV3RuntimeDrivenPhase,
>(options: {
  boundaryMode?: AgentSessionV3RuntimeBoundaryMode;
  phase: Phase;
  state: AgentSessionV3PilotState;
  transitionCount: number;
  transitions: readonly AgentSessionV3PilotTransition[];
}): AgentSessionV3RuntimePhasePortContext<Phase> {
  return {
    boundaryMode: options.boundaryMode ?? 'contract-only',
    phase: options.phase,
    sideEffectLimit: getAgentSessionV3RuntimePhaseSideEffectLimit(options.phase),
    state: options.state,
    transitionCount: options.transitionCount,
    transitions: options.transitions,
  };
}

export function createAgentSessionV3RuntimeBoundaryContract(
  options: {
    authority?: AgentSessionV3RuntimeBoundaryAuthority;
    mode?: AgentSessionV3RuntimeBoundaryMode;
  } = {},
): AgentSessionV3RuntimeBoundaryContract {
  return {
    authority: options.authority ?? 'none',
    guardrails: [...AGENT_SESSION_V3_RUNTIME_BOUNDARY_GUARDRAILS],
    mode: options.mode ?? 'contract-only',
    phaseLimits: AGENT_SESSION_V3_RUNTIME_BOUNDARY_PHASE_LIMITS,
    productionAuthority: false,
    runnerDerivedStopMetadataContract: AGENT_SESSION_V3_RUNTIME_RUNNER_DERIVED_STOP_METADATA_CONTRACT,
    stopEvidenceContract: AGENT_SESSION_V3_RUNTIME_STOP_EVIDENCE_CONTRACT,
    stopSemantics: AGENT_SESSION_V3_RUNTIME_BOUNDARY_STOP_SEMANTICS,
    version: 1,
  };
}
