import {
  assessAgentCommandResult,
  type AgentChatCommandResult,
  type AgentRuntimeProgressHandler,
  type AgentRuntimeToolExecutor,
} from '../../../agent';
import { publishAgentRuntimeWorldProgress } from '../../../runtime-world/agentRuntimeWorldBridge';
import { createStoppedAgentExecutionReceipt } from './executionReceipt';
import { updateAgentProductionSessionProgressMessage } from './sessionMessageProjection';
import { AGENT_STOPPED_DETAIL_TEXT } from './stoppedText';
import { runAgentToolExecutorWithLiveProgress } from './toolExecutionAdapter';

// The controller owns request identity and cancellation. Read its live guard
// on every callback; never cache whether a request was current at creation.
export function createAgentRunToolExecutor({
  isCancelled,
  executor,
  messageId,
  missingExecutorResult,
  signal,
}: {
  isCancelled: () => boolean;
  executor?: AgentRuntimeToolExecutor;
  messageId: string | null;
  missingExecutorResult: AgentChatCommandResult;
  signal: AbortSignal;
}): AgentRuntimeToolExecutor {
  return async (command) => {
    if (isCancelled()) {
      return assessAgentCommandResult(command, {
        errorText: AGENT_STOPPED_DETAIL_TEXT,
        ok: false,
        responseText: AGENT_STOPPED_DETAIL_TEXT,
        receipt: createStoppedAgentExecutionReceipt(command),
      });
    }
    if (!executor) return missingExecutorResult;
    return runAgentToolExecutorWithLiveProgress({ command, executor, messageId, signal });
  };
}

export function createAgentRunProgressHandler({
  isCancelled,
  messageId,
}: {
  isCancelled: () => boolean;
  messageId: string | null;
}): AgentRuntimeProgressHandler {
  return (event) => {
    if (isCancelled()) return;
    publishAgentRuntimeWorldProgress(event);
    updateAgentProductionSessionProgressMessage(messageId, event);
  };
}
