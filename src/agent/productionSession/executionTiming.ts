import { type AgentChatCommand, type AgentChatCommandResult } from '../agentChatCommand';
import { assessAgentCommandResult } from '../agentResultAssessment';
import { isAgentCachedToolResult } from '../runtime/agentToolResultCacheEvidence';
import {
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryKind,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeTimingTrace,
  type AgentRuntimeToolExecutor,
} from '../runtime/agentRuntimeContract';

export const AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER = 'Agent run was cancelled by the user.';

interface AgentProductionExecutionTimingTrackerOptions {
  continuationTiming?: AgentRuntimeTimingTrace | null;
  maxDurationMs: number;
  maxModelCalls: number;
  maxToolCalls: number;
}

interface AgentProductionExecutionTimingTracker {
  beginEntry: (
    kind: AgentRuntimeTimingEntryKind,
    label: string,
    stepIndex: number,
    detail?: string | null,
  ) => AgentRuntimeTimingEntry;
  finishEntry: (
    entry: AgentRuntimeTimingEntry,
    status: AgentRuntimeTimingEntryStatus,
    detail?: string | null,
  ) => AgentRuntimeTimingEntry;
  getBudgetStopReason: (extraToolCalls?: number) => AgentRuntimeTimingStopReason | null;
  markStopReason: (reason: AgentRuntimeTimingStopReason) => void;
  snapshot: () => AgentRuntimeTimingTrace;
}

export function createAgentProductionExecutionTimingTracker(
  options: AgentProductionExecutionTimingTrackerOptions,
): AgentProductionExecutionTimingTracker {
  const startedAt = Date.now();
  const previousTiming = options.continuationTiming ?? null;
  const priorAccumulatedElapsedMs = previousTiming?.accumulatedElapsedMs ?? previousTiming?.elapsedMs ?? 0;
  const entries: AgentRuntimeTimingEntry[] = [];
  let modelCallCount = 0;
  let toolCallCount = 0;
  let modelDurationMs = 0;
  let toolDurationMs = 0;
  let stopReason: AgentRuntimeTimingStopReason | null = null;

  const getElapsedMs = () => Math.max(0, Date.now() - startedAt);
  const getAccumulatedElapsedMs = () => priorAccumulatedElapsedMs + getElapsedMs();

  const snapshot = (): AgentRuntimeTimingTrace => {
    const now = Date.now();
    return {
      accumulatedElapsedMs: getAccumulatedElapsedMs(),
      elapsedMs: getElapsedMs(),
      entries: entries.map((entry) => ({ ...entry })),
      maxDurationMs: options.maxDurationMs,
      maxModelCalls: options.maxModelCalls,
      maxToolCalls: options.maxToolCalls,
      modelCallCount,
      modelDurationMs,
      startedAt,
      stopReason,
      toolCallCount,
      toolDurationMs,
      updatedAt: now,
    };
  };

  return {
    beginEntry: (kind, label, stepIndex, detail = null) => {
      const entry: AgentRuntimeTimingEntry = {
        detail,
        id: `${kind}-${entries.length + 1}-${Date.now()}`,
        kind,
        label,
        startedAt: Date.now(),
        status: 'running',
        stepIndex,
      };
      entries.push(entry);
      if (kind === 'model') {
        modelCallCount += 1;
      } else {
        toolCallCount += 1;
      }
      return entry;
    },
    finishEntry: (entry, status, detail = entry.detail ?? null) => {
      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - entry.startedAt);
      const updatedEntry: AgentRuntimeTimingEntry = {
        ...entry,
        detail,
        durationMs,
        endedAt,
        status,
      };
      const index = entries.findIndex((item) => item.id === entry.id);
      if (index >= 0) {
        entries[index] = updatedEntry;
      }
      if (entry.kind === 'model') {
        modelDurationMs += durationMs;
      } else {
        toolDurationMs += durationMs;
      }
      return updatedEntry;
    },
    getBudgetStopReason: (extraToolCalls = 0) => {
      if (getElapsedMs() >= options.maxDurationMs) {
        return 'max-duration';
      }
      if (modelCallCount >= options.maxModelCalls) {
        return 'max-model-calls';
      }
      if (toolCallCount + extraToolCalls > options.maxToolCalls) {
        return 'max-tool-calls';
      }
      return null;
    },
    markStopReason: (reason) => {
      stopReason = reason;
    },
    snapshot,
  };
}

export function isAgentProductionExecutionCancellationRequested(signal?: AbortSignal | null) {
  return Boolean(signal?.aborted);
}

export function createAgentProductionExecutionCancelledToolResult(command: AgentChatCommand) {
  return assessAgentCommandResult(command, {
    errorText: AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER,
    ok: false,
    responseText: AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${command.toolCall?.name ?? command.kind}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName: command.toolCall?.name ?? command.kind,
      verification: AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER,
    },
    verification: AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER,
  });
}

export function createAgentProductionExecutionTimingEntrySummary(entry: AgentRuntimeTimingEntry) {
  const durationText = typeof entry.durationMs === 'number' ? `${Math.max(0, Math.round(entry.durationMs))}ms` : 'running';
  return `${entry.kind}:${entry.label}#${entry.stepIndex} ${entry.status} ${durationText}`;
}

export function createAgentProductionExecutionToolTimingEntry(
  command: AgentChatCommand,
  timing: AgentRuntimeTimingEntry,
) {
  const toolName = command.toolCall?.name ?? command.kind;
  return {
    ...timing,
    label: `${toolName}`,
  };
}

export function resolveAgentProductionExecutionToolTimingStatus(
  result: AgentChatCommandResult,
  signal?: AbortSignal | null,
): AgentRuntimeTimingEntryStatus {
  if (isAgentProductionExecutionCancellationRequested(signal)) {
    return 'cancelled';
  }

  if (isAgentCachedToolResult(result)) {
    return 'cached';
  }

  return result.ok === false ? 'failed' : 'success';
}

export async function executeAgentProductionToolCommand(
  command: AgentChatCommand,
  toolExecutor: AgentRuntimeToolExecutor,
  signal?: AbortSignal | null,
) {
  if (isAgentProductionExecutionCancellationRequested(signal)) {
    return createAgentProductionExecutionCancelledToolResult(command);
  }

  try {
    const result = assessAgentCommandResult(command, await toolExecutor(command, { signal }));
    return isAgentProductionExecutionCancellationRequested(signal)
      ? createAgentProductionExecutionCancelledToolResult(command)
      : result;
  } catch (error) {
    if (isAgentProductionExecutionCancellationRequested(signal)) {
      return createAgentProductionExecutionCancelledToolResult(command);
    }

    const errorText = error instanceof Error ? error.message : String(error);
    return assessAgentCommandResult(command, {
      errorText,
      ok: false,
      responseText: `Local tool execution failed: ${errorText}`,
    });
  }
}
