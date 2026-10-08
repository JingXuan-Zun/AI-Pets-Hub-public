import type { AgentChatCommandResult } from '../../../agent';
import { createAgentRunToolExecutor, createAgentRunProgressHandler } from './guardedRequestCallbacks';
import { createAgentApprovalContinuationConsumer } from './approvalContinuationConsumer';

type ApprovedCallbacksOptions = Omit<Parameters<typeof createAgentApprovalContinuationConsumer>[0], 'onProgress' | 'toolExecutor'>;

export function createMissingAgentExecutorResult(): AgentChatCommandResult {
  return {
    errorText: '当前没有可用的本机执行器。',
    ok: false,
    responseText: '当前没有可用的本机执行器。',
  };
}

export function createApprovedAgentRuntimeCallbacks({ approval, canonicalEventJournal, signal, executor, messageId, missingExecutorResult, isCancelled, configRef }: ApprovedCallbacksOptions) {
  const onProgress = createAgentRunProgressHandler({ isCancelled, messageId: messageId });
  const toolExecutor = createAgentRunToolExecutor({
    isCancelled,
    executor: executor,
    messageId: messageId,
    missingExecutorResult,
    signal: signal,
  });
  const consumeTaskScopedApprovedContinuations = createAgentApprovalContinuationConsumer({
    approval, canonicalEventJournal, signal: signal, executor: executor,
    messageId, missingExecutorResult, isCancelled, onProgress, configRef, toolExecutor,
  });
  return { onProgress, toolExecutor, consumeTaskScopedApprovedContinuations };
}
