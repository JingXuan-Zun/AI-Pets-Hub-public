import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import {
  compactAgentPlanningSignalText,
  getAgentActionEvidence,
  getAgentStructuredEvidence,
} from './agentPlanningSignalEvidence';
import {
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTraceEvent,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';
import { isAgentCachedToolResult } from './agentToolResultCacheEvidence';

const AGENT_TRACE_RETAIN_MAX = 80;
const AGENT_TRACE_RETAIN_RECENT = 60;

export interface AgentTraceRecorder {
  append: (event: AgentRuntimeTraceEventDraft) => AgentRuntimeTraceEvent;
  compact: () => void;
  nextId: () => string;
}

function compactAgentTraceValue(value: unknown, maxLength = 360): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return compactAgentPlanningSignalText(value, maxLength);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return compactAgentPlanningSignalText(value, maxLength);
}

export function compactAgentTraceDetails(
  details?: Record<string, unknown> | null,
): Record<string, unknown> | undefined {
  if (!details) {
    return undefined;
  }

  const compactDetails = Object.fromEntries(
    Object.entries(details)
      .map(([key, value]) => [key, compactAgentTraceValue(value)])
      .filter(([, value]) => value !== undefined && value !== ''),
  );

  return Object.keys(compactDetails).length ? compactDetails : undefined;
}

export function resolveAgentTraceEventSequence(traceEvents: AgentRuntimeTraceEvent[]) {
  return traceEvents.reduce((max, event) => {
    const match = /^trace-(\d+)$/u.exec(event.id);
    const sequence = match ? Number(match[1]) : 0;
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 0);
}

function countAgentCompactedTraceEvents(event: AgentRuntimeTraceEvent) {
  if (event.type !== 'trace_compacted') {
    return 1;
  }

  const count = Number(event.details?.compactedEventCount);
  return Number.isFinite(count) && count > 0 ? count : 1;
}

function createAgentTraceCountSummary(
  traceEvents: AgentRuntimeTraceEvent[],
  key: 'status' | 'tool' | 'type',
) {
  const counts = new Map<string, number>();
  for (const event of traceEvents) {
    const rawValue = key === 'type' ? event.type : event[key] ?? 'none';
    const value = String(rawValue || 'none');
    counts.set(value, (counts.get(value) ?? 0) + countAgentCompactedTraceEvents(event));
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([value, count]) => `${value}:${count}`)
    .join(', ');
}

export function compactAgentTraceEvents(
  traceEvents: AgentRuntimeTraceEvent[],
  createTraceId: () => string,
) {
  if (traceEvents.length <= AGENT_TRACE_RETAIN_MAX) {
    return;
  }

  const compactedEvents = traceEvents.slice(0, Math.max(0, traceEvents.length - AGENT_TRACE_RETAIN_RECENT));
  const retainedEvents = traceEvents.slice(-AGENT_TRACE_RETAIN_RECENT);
  if (!compactedEvents.length) {
    return;
  }

  const compactedEventCount = compactedEvents.reduce(
    (count, event) => count + countAgentCompactedTraceEvents(event),
    0,
  );
  const firstTimestamp = compactedEvents[0]?.timestamp ?? Date.now();
  const lastCompactedEvent = compactedEvents[compactedEvents.length - 1] ?? null;
  const compactedEvent: AgentRuntimeTraceEvent = {
    details: compactAgentTraceDetails({
      compactedEventCount,
      firstTimestamp,
      lastStatus: lastCompactedEvent?.status,
      lastSummary: lastCompactedEvent?.summary,
      lastTimestamp: lastCompactedEvent?.timestamp ?? firstTimestamp,
      statusCounts: createAgentTraceCountSummary(compactedEvents, 'status'),
      toolCounts: createAgentTraceCountSummary(compactedEvents, 'tool'),
      typeCounts: createAgentTraceCountSummary(compactedEvents, 'type'),
    }),
    id: createTraceId(),
    status: 'compacted',
    stepIndex: lastCompactedEvent?.stepIndex ?? 0,
    summary: `Compacted ${compactedEventCount} older trace events.`,
    timestamp: Date.now(),
    tool: null,
    type: 'trace_compacted',
  };

  traceEvents.splice(0, traceEvents.length, compactedEvent, ...retainedEvents);
}

export function createAgentTraceRecorder(traceEvents: AgentRuntimeTraceEvent[]): AgentTraceRecorder {
  let traceEventSequence = resolveAgentTraceEventSequence(traceEvents);
  const createTraceEventId = () => {
    traceEventSequence += 1;
    return `trace-${traceEventSequence}`;
  };
  const compact = () => compactAgentTraceEvents(traceEvents, createTraceEventId);
  compact();

  return {
    append: (event) => {
      const traceEvent: AgentRuntimeTraceEvent = {
        action: event.action ?? null,
        details: compactAgentTraceDetails(event.details),
        id: createTraceEventId(),
        status: event.status ?? null,
        stepIndex: event.stepIndex,
        summary: compactAgentPlanningSignalText(event.summary, 520),
        timestamp: Date.now(),
        tool: event.tool ?? null,
        type: event.type,
      };
      traceEvents.push(traceEvent);
      compact();
      return traceEvent;
    },
    compact,
    nextId: createTraceEventId,
  };
}

function createAgentTraceVisualActionBlocker(value: unknown) {
  const readiness = typeof value === 'string' ? value.trim() : '';
  switch (readiness) {
    case 'needs-target-selection':
      return 'target-visible-but-not-selected-or-current';
    case 'needs-primary-action':
      return 'primary-open-start-play-action-not-identified';
    case 'needs-coordinate':
      return 'native-screen-coordinate-not-resolved';
    case 'needs-relation':
      return 'target-action-ownership-not-proven';
    case 'low-confidence':
      return 'visual-confidence-too-low';
    case 'not-actionable':
      return 'visible-evidence-not-actionable';
    default:
      return '';
  }
}

export function createAgentToolFinishedTraceDetails(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
  timing?: AgentRuntimeTimingEntry | null,
  extra?: Record<string, unknown>,
) {
  const actionEvidence = getAgentActionEvidence(result);
  const structuredEvidence = getAgentStructuredEvidence({ command, result });
  const visualActionReadiness = structuredEvidence?.visualActionReadiness ?? null;
  return {
    actionDiff: actionEvidence?.diff?.summary,
    actionOutcome: actionEvidence?.outcome,
    actionTarget: actionEvidence?.targetRef?.label,
    actionTool: actionEvidence?.tool,
    args: command.toolCall?.input ?? {},
    cacheHit: isAgentCachedToolResult(result),
    durationMs: timing?.durationMs,
    errorText: result.errorText,
    ok: result.ok !== false,
    receiptStatus: result.receipt?.status,
    responseText: result.responseText,
    timingDetail: timing?.detail,
    timingStatus: timing?.status,
    verification: result.verification,
    visualActionBlocker: createAgentTraceVisualActionBlocker(visualActionReadiness),
    visualActionReadiness,
    launcherReason: structuredEvidence?.launcherVerification?.reason,
    ...extra,
  };
}
