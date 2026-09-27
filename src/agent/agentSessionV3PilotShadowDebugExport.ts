import { type AgentSessionV3PilotRunnerStatus } from './agentSessionV3PilotRunner';
import {
  type AgentSessionV3PilotEventType,
  type AgentSessionV3PilotPhase,
  type AgentSessionV3PilotTerminalStatus,
  type AgentSessionV3PilotTransition,
} from './agentSessionV3PilotStateMachine';
import {
  type AgentSessionV3PilotShadowModeResult,
  type AgentSessionV3PilotShadowModeStatus,
} from './agentSessionV3PilotShadowMode';

export interface AgentSessionV3PilotShadowDebugExportOptions {
  includeDebugSummaryText?: boolean;
  includePhaseCoverage?: boolean;
  includeTransitions?: boolean;
  maxTransitions?: number;
}

export type AgentSessionV3PilotShadowPhaseCoverageStatus =
  | 'invalid'
  | 'limited'
  | 'partial'
  | 'terminal'
  | 'unavailable';

export interface AgentSessionV3PilotShadowPhaseCoverage {
  acceptedTransitionCount: number;
  eventTypes: AgentSessionV3PilotEventType[];
  knownPhases: AgentSessionV3PilotPhase[];
  rejectedTransitionCount: number;
  status: AgentSessionV3PilotShadowPhaseCoverageStatus;
  terminalObserved: boolean;
  unvisitedPhases: AgentSessionV3PilotPhase[];
  visitedPhases: AgentSessionV3PilotPhase[];
}

export interface AgentSessionV3PilotShadowDebugExportTransition {
  accepted: boolean;
  eventType: AgentSessionV3PilotEventType;
  from: AgentSessionV3PilotPhase;
  reason: string | null;
  to: AgentSessionV3PilotPhase | null;
}

export interface AgentSessionV3PilotShadowDebugExport {
  consumedEventCount: number;
  debugSummaryText?: string | null;
  errorText: string | null;
  eventCount: number | null;
  kind: 'agent-session-v3-pilot-shadow-debug';
  lastEvent: AgentSessionV3PilotEventType | null;
  phase: AgentSessionV3PilotPhase | null;
  phaseCoverage?: AgentSessionV3PilotShadowPhaseCoverage;
  reason: string | null;
  runnerStatus: AgentSessionV3PilotRunnerStatus | null;
  status: AgentSessionV3PilotShadowModeStatus;
  terminalStatus: AgentSessionV3PilotTerminalStatus | null;
  transitionCount: number;
  transitions?: AgentSessionV3PilotShadowDebugExportTransition[];
  version: 1;
}

export const AGENT_SESSION_V3_PILOT_KNOWN_PHASES: AgentSessionV3PilotPhase[] = [
  'init',
  'model_decision',
  'prepare_command',
  'needs_approval',
  'execute_transaction',
  'evaluate',
  'recover',
  'done',
  'failed',
];

function getAgentSessionV3PilotShadowDebugExportLimit(
  limit: number | undefined,
) {
  if (limit === undefined) {
    return Number.POSITIVE_INFINITY;
  }

  if (!Number.isFinite(limit) || limit < 0) {
    return 0;
  }

  return Math.floor(limit);
}

function createAgentSessionV3PilotShadowDebugExportTransition(
  transition: AgentSessionV3PilotTransition,
): AgentSessionV3PilotShadowDebugExportTransition {
  return {
    accepted: transition.accepted,
    eventType: transition.event.type,
    from: transition.from,
    reason: transition.reason ?? null,
    to: transition.accepted ? transition.to : null,
  };
}

function createAgentSessionV3PilotShadowDebugExportTransitions(
  transitions: readonly AgentSessionV3PilotTransition[],
  limit: number | undefined,
) {
  return transitions
    .slice(0, getAgentSessionV3PilotShadowDebugExportLimit(limit))
    .map(createAgentSessionV3PilotShadowDebugExportTransition);
}

function pushUniqueAgentSessionV3PilotShadowPhase(
  phases: AgentSessionV3PilotPhase[],
  phase: AgentSessionV3PilotPhase | null | undefined,
) {
  if (phase && !phases.includes(phase)) {
    phases.push(phase);
  }
}

function pushUniqueAgentSessionV3PilotShadowEventType(
  eventTypes: AgentSessionV3PilotEventType[],
  eventType: AgentSessionV3PilotEventType,
) {
  if (!eventTypes.includes(eventType)) {
    eventTypes.push(eventType);
  }
}

function getAgentSessionV3PilotShadowPhaseCoverageStatus(
  runnerStatus: AgentSessionV3PilotRunnerStatus | null,
): AgentSessionV3PilotShadowPhaseCoverageStatus {
  switch (runnerStatus) {
    case 'terminal':
      return 'terminal';
    case 'transition-limit':
      return 'limited';
    case 'driver-failed':
    case 'invalid-transition':
      return 'invalid';
    case 'waiting-for-event':
      return 'partial';
    default:
      return 'unavailable';
  }
}

export function createAgentSessionV3PilotShadowPhaseCoverage(
  shadow: AgentSessionV3PilotShadowModeResult,
): AgentSessionV3PilotShadowPhaseCoverage {
  const result = shadow.result ?? null;
  const visitedPhases: AgentSessionV3PilotPhase[] = [];
  const eventTypes: AgentSessionV3PilotEventType[] = [];
  let acceptedTransitionCount = 0;
  let rejectedTransitionCount = 0;

  for (const transition of result?.transitions ?? []) {
    pushUniqueAgentSessionV3PilotShadowPhase(visitedPhases, transition.from);
    pushUniqueAgentSessionV3PilotShadowEventType(eventTypes, transition.event.type);
    if (transition.accepted) {
      acceptedTransitionCount += 1;
      pushUniqueAgentSessionV3PilotShadowPhase(visitedPhases, transition.to);
    } else {
      rejectedTransitionCount += 1;
    }
  }

  pushUniqueAgentSessionV3PilotShadowPhase(visitedPhases, result?.state.phase);

  return {
    acceptedTransitionCount,
    eventTypes,
    knownPhases: [...AGENT_SESSION_V3_PILOT_KNOWN_PHASES],
    rejectedTransitionCount,
    status: getAgentSessionV3PilotShadowPhaseCoverageStatus(result?.status ?? null),
    terminalObserved: result?.status === 'terminal' && Boolean(result.state.terminal),
    unvisitedPhases: AGENT_SESSION_V3_PILOT_KNOWN_PHASES.filter((phase) => !visitedPhases.includes(phase)),
    visitedPhases,
  };
}

export function createAgentSessionV3PilotShadowDebugExport(
  shadow: AgentSessionV3PilotShadowModeResult,
  options: AgentSessionV3PilotShadowDebugExportOptions = {},
): AgentSessionV3PilotShadowDebugExport {
  const result = shadow.result ?? null;
  const exportValue: AgentSessionV3PilotShadowDebugExport = {
    consumedEventCount: shadow.consumedEventCount,
    errorText: shadow.errorText,
    eventCount: shadow.eventCount,
    kind: 'agent-session-v3-pilot-shadow-debug',
    lastEvent: result?.state.lastEvent ?? null,
    phase: result?.state.phase ?? null,
    reason: shadow.reason,
    runnerStatus: result?.status ?? null,
    status: shadow.status,
    terminalStatus: result?.state.terminal?.status ?? null,
    transitionCount: result?.transitions.length ?? 0,
    version: 1,
  };

  if (options.includeDebugSummaryText ?? true) {
    exportValue.debugSummaryText = shadow.debugSummaryText;
  }

  if (options.includePhaseCoverage ?? true) {
    exportValue.phaseCoverage = createAgentSessionV3PilotShadowPhaseCoverage(shadow);
  }

  if (options.includeTransitions ?? true) {
    exportValue.transitions = createAgentSessionV3PilotShadowDebugExportTransitions(
      result?.transitions ?? [],
      options.maxTransitions,
    );
  }

  return exportValue;
}

export function stringifyAgentSessionV3PilotShadowDebugExport(
  shadowExport: AgentSessionV3PilotShadowDebugExport,
  options: { pretty?: boolean } = {},
) {
  return JSON.stringify(shadowExport, null, options.pretty ? 2 : 0);
}
