import {
  runAgentSessionV3PilotRunner,
  type AgentSessionV3PilotEventDriver,
  type AgentSessionV3PilotRunnerResult,
} from './agentSessionV3PilotRunner';
import {
  advanceAgentSessionV3PilotState,
  createAgentSessionV3PilotInitialState,
  isAgentSessionV3PilotTerminalPhase,
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotState,
  type AgentSessionV3PilotTransition,
} from './agentSessionV3PilotStateMachine';
import {
  createAgentSessionV3PilotTraceSummaryText,
  type AgentSessionV3PilotTraceSummaryOptions,
} from './agentSessionV3PilotTraceSummary';

export interface AgentSessionV3PilotShadowDebugSummaryOptions extends AgentSessionV3PilotTraceSummaryOptions {
  enabled?: boolean;
}

export type AgentSessionV3PilotShadowModeStatus =
  | 'disabled'
  | 'observed'
  | 'omitted';

export interface RunAgentSessionV3PilotShadowModeOptions {
  debugSummary?: AgentSessionV3PilotShadowDebugSummaryOptions | null;
  driver?: AgentSessionV3PilotEventDriver | null;
  enabled?: boolean | null;
  events?: readonly AgentSessionV3PilotEvent[] | null;
  initialState?: AgentSessionV3PilotState | null;
  maxTransitions?: number | null;
}

export interface RunAgentSessionV3PilotShadowEventListOptions {
  debugSummary?: AgentSessionV3PilotShadowDebugSummaryOptions | null;
  enabled?: boolean | null;
  events?: readonly AgentSessionV3PilotEvent[] | null;
  initialState?: AgentSessionV3PilotState | null;
  maxTransitions?: number | null;
}

export interface AgentSessionV3PilotShadowModeResult {
  consumedEventCount: number;
  debugSummaryText: string | null;
  errorText: string | null;
  eventCount: number | null;
  reason: string | null;
  result: AgentSessionV3PilotRunnerResult | null;
  status: AgentSessionV3PilotShadowModeStatus;
}

function createAgentSessionV3PilotShadowModeResult(options: {
  consumedEventCount?: number | null;
  debugSummaryText?: string | null;
  errorText?: string | null;
  eventCount?: number | null;
  reason?: string | null;
  result?: AgentSessionV3PilotRunnerResult | null;
  status: AgentSessionV3PilotShadowModeStatus;
}): AgentSessionV3PilotShadowModeResult {
  return {
    consumedEventCount: options.consumedEventCount ?? 0,
    debugSummaryText: options.debugSummaryText ?? null,
    errorText: options.errorText ?? null,
    eventCount: options.eventCount ?? null,
    reason: options.reason ?? null,
    result: options.result ?? null,
    status: options.status,
  };
}

export function createAgentSessionV3PilotShadowEventListDriver(
  events: readonly AgentSessionV3PilotEvent[],
): AgentSessionV3PilotEventDriver {
  return (context) => events[context.transitionCount] ?? null;
}

function shouldOmitAgentSessionV3PilotShadowSummary(result: AgentSessionV3PilotRunnerResult) {
  return result.status === 'driver-failed';
}

function createAgentSessionV3PilotShadowObservedResult(options: {
  debugSummary?: AgentSessionV3PilotShadowDebugSummaryOptions | null;
  eventCount: number | null;
  result: AgentSessionV3PilotRunnerResult;
}) {
  const omitSummary = shouldOmitAgentSessionV3PilotShadowSummary(options.result);
  return createAgentSessionV3PilotShadowModeResult({
    consumedEventCount: options.result.transitions.length,
    debugSummaryText: options.debugSummary?.enabled && !omitSummary
      ? createAgentSessionV3PilotTraceSummaryText(options.result, options.debugSummary)
      : null,
    errorText: options.result.errorText ?? null,
    eventCount: options.eventCount,
    reason: options.result.reason ?? null,
    result: options.result,
    status: omitSummary ? 'omitted' : 'observed',
  });
}

function createAgentSessionV3PilotShadowRunnerResult(options: AgentSessionV3PilotRunnerResult) {
  return options;
}

export function runAgentSessionV3PilotShadowEventList(
  options: RunAgentSessionV3PilotShadowEventListOptions,
): AgentSessionV3PilotShadowModeResult {
  if (options.enabled !== true) {
    return createAgentSessionV3PilotShadowModeResult({
      reason: 'v3 pilot shadow mode is disabled.',
      status: 'disabled',
    });
  }

  if (!options.events) {
    return createAgentSessionV3PilotShadowModeResult({
      reason: 'No v3 pilot shadow event source was provided.',
      status: 'omitted',
    });
  }

  const maxTransitions = Math.max(1, options.maxTransitions ?? 24);
  const transitions: AgentSessionV3PilotTransition[] = [];
  let state = options.initialState ?? createAgentSessionV3PilotInitialState();

  if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
    return createAgentSessionV3PilotShadowObservedResult({
      debugSummary: options.debugSummary,
      eventCount: options.events.length,
      result: createAgentSessionV3PilotShadowRunnerResult({
        reason: state.terminal?.reason ?? null,
        state,
        status: 'terminal',
        transition: null,
        transitions,
      }),
    });
  }

  while (transitions.length < maxTransitions) {
    const event = options.events[transitions.length] ?? null;
    if (!event) {
      return createAgentSessionV3PilotShadowObservedResult({
        debugSummary: options.debugSummary,
        eventCount: options.events.length,
        result: createAgentSessionV3PilotShadowRunnerResult({
          reason: `No pilot event was available for phase ${state.phase}.`,
          state,
          status: 'waiting-for-event',
          transition: null,
          transitions,
        }),
      });
    }

    const transition = advanceAgentSessionV3PilotState(state, event);
    transitions.push(transition);
    if (!transition.accepted) {
      return createAgentSessionV3PilotShadowObservedResult({
        debugSummary: options.debugSummary,
        eventCount: options.events.length,
        result: createAgentSessionV3PilotShadowRunnerResult({
          reason: transition.reason,
          state,
          status: 'invalid-transition',
          transition,
          transitions,
        }),
      });
    }

    state = transition.state;
    if (isAgentSessionV3PilotTerminalPhase(state.phase)) {
      return createAgentSessionV3PilotShadowObservedResult({
        debugSummary: options.debugSummary,
        eventCount: options.events.length,
        result: createAgentSessionV3PilotShadowRunnerResult({
          reason: state.terminal?.reason ?? transition.reason ?? null,
          state,
          status: 'terminal',
          transition,
          transitions,
        }),
      });
    }
  }

  return createAgentSessionV3PilotShadowObservedResult({
    debugSummary: options.debugSummary,
    eventCount: options.events.length,
    result: createAgentSessionV3PilotShadowRunnerResult({
      reason: `Pilot runner stopped after ${maxTransitions} transitions.`,
      state,
      status: 'transition-limit',
      transition: null,
      transitions,
    }),
  });
}

export async function runAgentSessionV3PilotShadowMode(
  options: RunAgentSessionV3PilotShadowModeOptions,
): Promise<AgentSessionV3PilotShadowModeResult> {
  if (options.enabled !== true) {
    return createAgentSessionV3PilotShadowModeResult({
      reason: 'v3 pilot shadow mode is disabled.',
      status: 'disabled',
    });
  }

  const eventCount = options.events?.length ?? null;
  const driver = options.driver ?? (
    options.events
      ? createAgentSessionV3PilotShadowEventListDriver(options.events)
      : null
  );

  if (!driver) {
    return createAgentSessionV3PilotShadowModeResult({
      eventCount,
      reason: 'No v3 pilot shadow event source was provided.',
      status: 'omitted',
    });
  }

  try {
    const result = await runAgentSessionV3PilotRunner({
      driver,
      initialState: options.initialState,
      maxTransitions: options.maxTransitions,
    });
    return createAgentSessionV3PilotShadowObservedResult({
      debugSummary: options.debugSummary,
      eventCount,
      result,
    });
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    return createAgentSessionV3PilotShadowModeResult({
      errorText,
      eventCount,
      reason: errorText,
      status: 'omitted',
    });
  }
}
