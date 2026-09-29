import {
  type AgentRuntimeDiagnosticCategory,
  type AgentRuntimeDiagnosticEnvelope,
  type AgentRuntimeDiagnosticPayload,
  type AgentTaskRuntimeStateRecord,
} from './agentRuntimeContract';

export function createAgentRuntimeDiagnostic(options: {
  category: AgentRuntimeDiagnosticCategory;
  details?: Record<string, unknown> | null;
  source: string;
  status?: string | null;
  summary: string;
  timestamp?: number;
  tool?: string | null;
}): AgentRuntimeDiagnosticEnvelope {
  return {
    authority: 'diagnostic-only',
    category: options.category,
    payload: {
      details: options.details ?? null,
      status: options.status ?? null,
      summary: options.summary,
      tool: options.tool ?? null,
    },
    source: options.source,
    timestamp: options.timestamp ?? Date.now(),
  };
}

export function upsertAgentRuntimeDiagnostic(
  diagnostics: AgentRuntimeDiagnosticEnvelope[] | null | undefined,
  diagnostic: AgentRuntimeDiagnosticEnvelope,
) {
  return [
    ...(diagnostics ?? []).filter((candidate) => (
      candidate.category !== diagnostic.category
      || candidate.source !== diagnostic.source
    )),
    diagnostic,
  ];
}

export function findLatestAgentRuntimeDiagnostic(
  diagnostics: AgentRuntimeDiagnosticEnvelope[] | null | undefined,
  category: AgentRuntimeDiagnosticCategory,
): AgentRuntimeDiagnosticEnvelope<AgentRuntimeDiagnosticPayload> | null {
  return [...(diagnostics ?? [])]
    .reverse()
    .find((diagnostic) => diagnostic.category === category) ?? null;
}

export function createAgentTaskRuntimeStateDiagnostic(
  taskState: AgentTaskRuntimeStateRecord,
  timestamp?: number,
): AgentRuntimeDiagnosticEnvelope {
  return createAgentRuntimeDiagnostic({
    category: 'task-runtime',
    details: {
      currentSubgoalId: taskState.currentSubgoalId ?? null,
      lastRejectedTransitionKind: taskState.lastRejectedTransitionKind ?? null,
      lastTransitionError: taskState.lastTransitionError ?? null,
      lastTransitionKind: taskState.lastTransitionKind ?? null,
      modelIterationCount: taskState.modelIterationCount,
      modelIterationLimit: taskState.modelIterationLimit,
      nextSubgoalAction: taskState.nextSubgoalAction ?? null,
      nextSubgoalId: taskState.nextSubgoalId ?? null,
      phase: taskState.phase,
      recoveryAttemptCount: taskState.recoveryAttemptCount,
      recoveryLimit: taskState.recoveryLimit,
      revision: taskState.revision,
      taskId: taskState.taskId,
    },
    source: 'task-runtime-state',
    status: taskState.state,
    summary: `Task Runtime state: ${taskState.state}/${taskState.phase} (revision ${taskState.revision}).`,
    timestamp,
  });
}
