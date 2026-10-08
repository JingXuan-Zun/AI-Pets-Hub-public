import { type AgentChatCommand, type AgentRuntimeToolExecutor, assessAgentCommandResult, runAgentToolTransaction } from '../../../agent';
import { updateAgentToolExecutionProgressMessage } from './toolExecutionProgress';
import { desktopPetChatStore } from '../../../chatStore';

export async function runAgentToolExecutorWithLiveProgress(options: {
  command: AgentChatCommand;
  executor: AgentRuntimeToolExecutor;
  messageId: string | null;
  signal?: AbortSignal | null;
}) {
  updateAgentToolExecutionProgressMessage({
    command: options.command,
    messageId: options.messageId,
    phase: 'started',
  });

  try {
    const petId = desktopPetChatStore.getState().messages.find((message) => message.id === options.messageId)?.petId ?? null;
    const result = await options.executor(options.command, { petId, signal: options.signal ?? null });
    updateAgentToolExecutionProgressMessage({
      command: options.command,
      messageId: options.messageId,
      phase: result.ok === false ? 'failed' : 'completed',
      result,
    });
    return result;
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const result = assessAgentCommandResult(options.command, {
      errorText,
      ok: false,
      responseText: errorText,
    });
    updateAgentToolExecutionProgressMessage({
      command: options.command,
      messageId: options.messageId,
      phase: 'failed',
      result,
    });
    throw error;
  }
}

export async function runAgentControllerToolTransactionWithLiveProgress(options: {
  command: AgentChatCommand;
  executor: AgentRuntimeToolExecutor;
  messageId: string | null;
  signal?: AbortSignal | null;
}) {
  const transaction = await runAgentToolTransaction({
    appendTraceEvent: () => undefined,
    command: options.command,
    executeCommand: (command) => runAgentToolExecutorWithLiveProgress({
      command,
      executor: options.executor,
      messageId: options.messageId,
      signal: options.signal ?? null,
    }),
    getTimingDetail: (command) => {
      const action = command.toolCall?.input?.action;
      return typeof action === 'string' && action.trim()
        ? action.trim()
        : command.toolCall?.name ?? command.kind;
    },
    resolveTimingStatus: (result) => (
      options.signal?.aborted
        ? 'cancelled'
        : result.ok === false
          ? 'failed'
          : 'success'
    ),
    source: 'agent-run-controller',
    stepIndex: 0,
    timingTracker: {
      beginEntry: (kind, label, stepIndex, detail) => ({
        detail,
        id: `controller-tool-${Date.now()}`,
        kind,
        label,
        startedAt: Date.now(),
        status: 'running',
        stepIndex,
      }),
      finishEntry: (entry, status, detail) => ({
        ...entry,
        detail: detail ?? entry.detail ?? null,
        durationMs: Math.max(0, Date.now() - entry.startedAt),
        endedAt: Date.now(),
        status,
      }),
    },
  });

  return transaction.result;
}
