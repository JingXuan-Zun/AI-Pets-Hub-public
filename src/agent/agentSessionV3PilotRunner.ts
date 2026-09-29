import {
  advanceAgentSessionV3PilotState,
  createAgentSessionV3PilotInitialState,
  isAgentSessionV3PilotTerminalPhase,
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotState,
  type AgentSessionV3PilotTransition,
} from './agentSessionV3PilotStateMachine';

export interface AgentSessionV3PilotRunnerContext {
  state: AgentSessionV3PilotState;
  transitionCount: number;
  transitions: readonly AgentSessionV3PilotTransition[];
}

export type AgentSessionV3PilotEventDriver = (
  context: AgentSessionV3PilotRunnerContext,
) => AgentSessionV3PilotEvent | null | Promise<AgentSessionV3PilotEvent | null>;

export type AgentSessionV3PilotRunnerStatus =
  | 'driver-failed'
  | 'invalid-transition'
  | 'terminal'
  | 'transition-limit'
  | 'waiting-for-event';

export interface AgentSessionV3PilotRunnerResult {
  errorText?: string | null;
  reason?: string | null;
  state: AgentSessionV3PilotState;
  status: AgentSessionV3PilotRunnerStatus;
  transition?: AgentSessionV3PilotTransition | null;
  transitions: AgentSessionV3PilotTransition[];
}

export interface RunAgentSessionV3PilotRunnerOptions {
  driver: AgentSessionV3PilotEventDriver;
  initialState?: AgentSessionV3PilotState | null;
  maxTransitions?: number | null;
}

const AGENT_SESSION_V3_PILOT_DEFAULT_MAX_TRANSITIONS = 24;

function createAgentSessionV3PilotRunnerResult(options: {
  errorText?: string | null;
  reason?: string | null;
  state: AgentSessionV3PilotState;
  status: AgentSessionV3PilotRunnerStatus;
  transition?: AgentSessionV3PilotTransition | null;
  transitions: AgentSessionV3PilotTransition[];
}): AgentSessionV3PilotRunnerResult {
  return {
    errorText: options.errorText ?? null,
    reason: options.reason ?? null,
    state: options.state,
    status: options.status,
    transition: options.transition ?? null,
    transitions: options.transitions,
  };
}

export async function runAgentSessionV3PilotRunner(
  options: RunAgentSessionV3PilotRunnerOptions,
): Promise<AgentSessionV3PilotRunnerResult> {
  const maxTransitions = Math.max(1, options.maxTransitions ?? AGENT_SESSION_V3_PILOT_DEFAULT_MAX_TRANSITIONS);
  const transitions: AgentSessionV3PilotTransition[] = [];
  let state = options.initialState ?? createAgentSessionV3PilotInitialState();

  if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
    return createAgentSessionV3PilotRunnerResult({
      reason: state.terminal?.reason ?? null,
      state,
      status: 'terminal',
      transitions,
    });
  }

  while (transitions.length < maxTransitions) {
    let event: AgentSessionV3PilotEvent | null;
    try {
      event = await options.driver({
        state,
        transitionCount: transitions.length,
        transitions,
      });
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      return createAgentSessionV3PilotRunnerResult({
        errorText,
        reason: errorText,
        state,
        status: 'driver-failed',
        transitions,
      });
    }

    if (!event) {
      return createAgentSessionV3PilotRunnerResult({
        reason: `No pilot event was available for phase ${state.phase}.`,
        state,
        status: 'waiting-for-event',
        transitions,
      });
    }

    const transition = advanceAgentSessionV3PilotState(state, event);
    transitions.push(transition);
    if (!transition.accepted) {
      return createAgentSessionV3PilotRunnerResult({
        reason: transition.reason,
        state,
        status: 'invalid-transition',
        transition,
        transitions,
      });
    }

    state = transition.state;
    if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
      return createAgentSessionV3PilotRunnerResult({
        reason: state.terminal?.reason ?? transition.reason ?? null,
        state,
        status: 'terminal',
        transition,
        transitions,
      });
    }
  }

  return createAgentSessionV3PilotRunnerResult({
    reason: `Pilot runner stopped after ${maxTransitions} transitions.`,
    state,
    status: 'transition-limit',
    transitions,
  });
}
