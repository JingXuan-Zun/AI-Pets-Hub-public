import { type AgentSessionV3PilotRunnerResult } from './agentSessionV3PilotRunner';
import {
  type AgentSessionV3PilotEvent,
  type AgentSessionV3PilotTransition,
} from './agentSessionV3PilotStateMachine';

export interface AgentSessionV3PilotTraceSummaryOptions {
  includeReasons?: boolean;
  maxReasonLength?: number;
}

const AGENT_SESSION_V3_PILOT_REASON_MAX_LENGTH = 120;

function compactAgentSessionV3PilotReason(
  reason: string | null | undefined,
  maxLength: number,
) {
  const normalized = reason?.replace(/\s+/gu, ' ').trim() ?? '';
  if (!normalized) {
    return null;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function getAgentSessionV3PilotEventReason(event: AgentSessionV3PilotEvent) {
  if ('reason' in event && typeof event.reason === 'string') {
    return event.reason;
  }

  if ('errorText' in event && typeof event.errorText === 'string') {
    return event.errorText;
  }

  return null;
}

export function formatAgentSessionV3PilotTransitionLine(
  transition: AgentSessionV3PilotTransition,
  index: number,
  options: AgentSessionV3PilotTraceSummaryOptions = {},
) {
  const eventReason = getAgentSessionV3PilotEventReason(transition.event);
  const reason = compactAgentSessionV3PilotReason(
    transition.reason ?? eventReason,
    options.maxReasonLength ?? AGENT_SESSION_V3_PILOT_REASON_MAX_LENGTH,
  );
  const suffix = options.includeReasons && reason ? ` reason=${reason}` : '';

  if (!transition.accepted) {
    return `${index + 1}. ${transition.from} --${transition.event.type}--> rejected${suffix}`;
  }

  return `${index + 1}. ${transition.from} --${transition.event.type}--> ${transition.to}${suffix}`;
}

export function createAgentSessionV3PilotTraceSummaryLines(
  result: AgentSessionV3PilotRunnerResult,
  options: AgentSessionV3PilotTraceSummaryOptions = {},
) {
  const terminal = result.state.terminal;
  const headerParts = [
    `status=${result.status}`,
    `phase=${result.state.phase}`,
    `terminal=${terminal?.status ?? 'none'}`,
    `recoveries=${result.state.recoveryCount}`,
    `transitions=${result.transitions.length}`,
  ];
  const resultReason = compactAgentSessionV3PilotReason(
    result.reason ?? result.errorText ?? terminal?.reason,
    options.maxReasonLength ?? AGENT_SESSION_V3_PILOT_REASON_MAX_LENGTH,
  );

  return [
    `AgentSessionV3Pilot ${headerParts.join(' ')}`,
    ...(options.includeReasons && resultReason ? [`reason=${resultReason}`] : []),
    ...result.transitions.map((transition, index) => (
      formatAgentSessionV3PilotTransitionLine(transition, index, options)
    )),
  ];
}

export function createAgentSessionV3PilotTraceSummaryText(
  result: AgentSessionV3PilotRunnerResult,
  options: AgentSessionV3PilotTraceSummaryOptions = {},
) {
  return createAgentSessionV3PilotTraceSummaryLines(result, options).join('\n');
}
