import {
  advanceAgentSessionV3PilotState,
  createAgentSessionV3PilotInitialState,
  isAgentSessionV3PilotTerminalPhase,
  type AgentSessionV3PilotState,
  type AgentSessionV3PilotTransition,
} from './agentSessionV3PilotStateMachine';
import {
  createAgentSessionV3RuntimeBoundaryContract,
  createAgentSessionV3RuntimePhasePortContext,
  extractAgentSessionV3RuntimeRunnerDerivedStopMetadata,
  getAgentSessionV3RuntimeBoundaryStopSemantic,
  type AgentSessionV3RuntimeBoundaryContract,
  type AgentSessionV3RuntimeBoundaryMode,
  type AgentSessionV3RuntimeBoundaryPorts,
  type AgentSessionV3RuntimeBoundaryStopReason,
  type AgentSessionV3RuntimeBoundaryStopSemantic,
  type AgentSessionV3RuntimeDrivenPhase,
  type AgentSessionV3RuntimePhasePort,
  type AgentSessionV3RuntimePhasePortResult,
  type AgentSessionV3RuntimeRunnerDerivedStopMetadata,
} from './agentSessionV3RuntimeBoundary';

export type AgentSessionV3RuntimeControllerStatus =
  | 'blocked'
  | 'cancelled'
  | 'invalid-transition'
  | 'runtime-failed'
  | 'terminal'
  | 'transition-limit'
  | 'waiting';

export interface AgentSessionV3RuntimeControllerResult {
  boundary: AgentSessionV3RuntimeBoundaryContract;
  errorText?: string | null;
  phasePortResult?: AgentSessionV3RuntimePhasePortResult | null;
  reason?: string | null;
  state: AgentSessionV3PilotState;
  status: AgentSessionV3RuntimeControllerStatus;
  stopMetadata?: AgentSessionV3RuntimeRunnerDerivedStopMetadata | null;
  stopReason?: AgentSessionV3RuntimeBoundaryStopReason | null;
  stopSemantic?: AgentSessionV3RuntimeBoundaryStopSemantic | null;
  transition?: AgentSessionV3PilotTransition | null;
  transitions: AgentSessionV3PilotTransition[];
}

export interface RunAgentSessionV3RuntimeControllerOptions {
  boundaryMode?: AgentSessionV3RuntimeBoundaryMode;
  initialState?: AgentSessionV3PilotState | null;
  isCancellationRequested?: (() => boolean) | null;
  maxTransitions?: number | null;
  ports: AgentSessionV3RuntimeBoundaryPorts;
}

const AGENT_SESSION_V3_RUNTIME_CONTROLLER_DEFAULT_MAX_TRANSITIONS = 24;

function getRuntimePhasePort(
  ports: AgentSessionV3RuntimeBoundaryPorts,
  phase: AgentSessionV3RuntimeDrivenPhase,
) {
  return ports[phase] as AgentSessionV3RuntimePhasePort<AgentSessionV3RuntimeDrivenPhase> | undefined;
}

function createAgentSessionV3RuntimeControllerResult(options: {
  boundary: AgentSessionV3RuntimeBoundaryContract;
  errorText?: string | null;
  phasePortResult?: AgentSessionV3RuntimePhasePortResult | null;
  reason?: string | null;
  state: AgentSessionV3PilotState;
  status: AgentSessionV3RuntimeControllerStatus;
  stopMetadata?: AgentSessionV3RuntimeRunnerDerivedStopMetadata | null;
  stopReason?: AgentSessionV3RuntimeBoundaryStopReason | null;
  stopSemantic?: AgentSessionV3RuntimeBoundaryStopSemantic | null;
  transition?: AgentSessionV3PilotTransition | null;
  transitions: AgentSessionV3PilotTransition[];
}): AgentSessionV3RuntimeControllerResult {
  return {
    boundary: options.boundary,
    errorText: options.errorText ?? null,
    phasePortResult: options.phasePortResult ?? null,
    reason: options.reason ?? null,
    state: options.state,
    status: options.status,
    stopMetadata: options.stopMetadata ?? null,
    stopReason: options.stopReason ?? null,
    stopSemantic: options.stopSemantic ?? null,
    transition: options.transition ?? null,
    transitions: options.transitions,
  };
}

function createAgentSessionV3RuntimeControllerDerivedStopMetadata(options: {
  state: AgentSessionV3PilotState;
  status: 'invalid-transition' | 'transition-limit';
  transition?: AgentSessionV3PilotTransition | null;
  transitions: AgentSessionV3PilotTransition[];
}) {
  return extractAgentSessionV3RuntimeRunnerDerivedStopMetadata({
    state: options.state,
    status: options.status === 'transition-limit' ? 'transition-limit' : 'invalid-transition',
    transition: options.transition ?? null,
    transitions: options.transitions,
  });
}

export async function runAgentSessionV3RuntimeController(
  options: RunAgentSessionV3RuntimeControllerOptions,
): Promise<AgentSessionV3RuntimeControllerResult> {
  const boundary = createAgentSessionV3RuntimeBoundaryContract({
    authority: 'experimental-adapter',
    mode: options.boundaryMode ?? 'experimental-non-production',
  });
  const maxTransitions = Math.max(
    1,
    options.maxTransitions ?? AGENT_SESSION_V3_RUNTIME_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
  );
  const transitions: AgentSessionV3PilotTransition[] = [];
  let state = options.initialState ?? createAgentSessionV3PilotInitialState();

  if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
    return createAgentSessionV3RuntimeControllerResult({
      boundary,
      reason: state.terminal?.reason ?? null,
      state,
      status: 'terminal',
      transitions,
    });
  }

  while (transitions.length < maxTransitions) {
    if (options.isCancellationRequested?.()) {
      const transition = advanceAgentSessionV3PilotState(state, {
        reason: 'Runtime controller cancellation requested.',
        type: 'cancel',
      });
      transitions.push(transition);
      if (transition.accepted) {
        state = transition.state;
      }

      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        reason: transition.reason,
        state,
        status: 'cancelled',
        stopReason: 'cancelled',
        transition,
        transitions,
      });
    }

    if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        reason: state.terminal?.reason ?? null,
        state,
        status: 'terminal',
        transitions,
      });
    }

    const phase = state.phase as AgentSessionV3RuntimeDrivenPhase;
    const port = getRuntimePhasePort(options.ports, phase);
    if (!port) {
      const stopSemantic = getAgentSessionV3RuntimeBoundaryStopSemantic('waiting');
      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        reason: `No runtime phase port is available for phase ${phase}.`,
        state,
        status: 'waiting',
        stopReason: stopSemantic.reason,
        stopSemantic,
        transitions,
      });
    }

    let phasePortResult: AgentSessionV3RuntimePhasePortResult;
    try {
      phasePortResult = await port(createAgentSessionV3RuntimePhasePortContext({
        boundaryMode: boundary.mode,
        phase,
        state,
        transitionCount: transitions.length,
        transitions,
      }));
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        errorText,
        reason: errorText,
        state,
        status: 'runtime-failed',
        stopReason: 'runtime-failed',
        transitions,
      });
    }

    if (phasePortResult.kind === 'waiting' || phasePortResult.kind === 'blocked') {
      const stopSemantic = getAgentSessionV3RuntimeBoundaryStopSemantic(phasePortResult.kind);
      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        phasePortResult,
        reason: phasePortResult.reason,
        state,
        status: phasePortResult.kind,
        stopReason: stopSemantic.reason,
        stopSemantic,
        transitions,
      });
    }

    const transition = advanceAgentSessionV3PilotState(state, phasePortResult.event);
    transitions.push(transition);
    if (!transition.accepted) {
      const stopMetadata = createAgentSessionV3RuntimeControllerDerivedStopMetadata({
        state,
        status: 'invalid-transition',
        transition,
        transitions,
      });
      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        phasePortResult,
        reason: transition.reason,
        state,
        status: 'invalid-transition',
        stopMetadata,
        stopReason: 'invalid-transition',
        transition,
        transitions,
      });
    }

    state = transition.state;
    if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
      return createAgentSessionV3RuntimeControllerResult({
        boundary,
        phasePortResult,
        reason: state.terminal?.reason ?? transition.reason ?? null,
        state,
        status: 'terminal',
        transition,
        transitions,
      });
    }
  }

  const stopMetadata = createAgentSessionV3RuntimeControllerDerivedStopMetadata({
    state,
    status: 'transition-limit',
    transitions,
  });
  return createAgentSessionV3RuntimeControllerResult({
    boundary,
    reason: `Runtime controller stopped after ${maxTransitions} transitions.`,
    state,
    status: 'transition-limit',
    stopMetadata,
    stopReason: 'transition-budget-exhausted',
    transitions,
  });
}
