import { type AgentChatCommandResult, type AgentToolCallCommand } from './agentChatCommand';
import { type AgentRuntimeExecutorContext } from './agentRuntimeExecutor';

const AGENT_RUNTIME_CANCELLED_TEXT = '已终止当前 Agent 执行。';

export function isAgentRuntimeCancellationRequested(runtime: AgentRuntimeExecutorContext) {
  return Boolean(runtime.signal?.aborted);
}

export function createAgentRuntimeCancelledResult(target: AgentToolCallCommand | string): AgentChatCommandResult {
  const toolName = typeof target === 'string' ? target : target.name;
  return {
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  };
}

export async function runCancellableAgentRuntimeTask<T>(
  runtime: AgentRuntimeExecutorContext,
  target: AgentToolCallCommand | string,
  task: Promise<T> | (() => Promise<T>),
): Promise<{ cancelled: true; result: AgentChatCommandResult } | { cancelled: false; value: T }> {
  if (isAgentRuntimeCancellationRequested(runtime)) {
    return {
      cancelled: true,
      result: createAgentRuntimeCancelledResult(target),
    };
  }

  let removeAbortListener: (() => void) | null = null;
  try {
    const taskPromise = typeof task === 'function' ? task() : task;
    const racedValue = await new Promise<T | symbol>((resolve, reject) => {
      const cancelledMarker = Symbol('agent-runtime-cancelled');
      const signal = runtime.signal;
      const handleAbort = () => resolve(cancelledMarker);

      if (signal) {
        if (signal.aborted) {
          resolve(cancelledMarker);
          return;
        }

        signal.addEventListener('abort', handleAbort, { once: true });
        removeAbortListener = () => signal.removeEventListener('abort', handleAbort);
      }

      taskPromise.then(resolve, reject);
    });

    removeAbortListener?.();
    removeAbortListener = null;

    if (typeof racedValue === 'symbol' || isAgentRuntimeCancellationRequested(runtime)) {
      return {
        cancelled: true,
        result: createAgentRuntimeCancelledResult(target),
      };
    }

    return {
      cancelled: false,
      value: racedValue,
    };
  } finally {
    removeAbortListener?.();
  }
}
