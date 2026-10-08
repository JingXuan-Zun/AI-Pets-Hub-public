import type { AgentChatCommandResult, AgentProductionSessionResult, AgentRuntimeProgressHandler, AgentRuntimeToolExecutor } from '../../../agent';
import type { ChatMessage, PetConfig } from '../../../types';
import type { AgentCanonicalEventJournal } from '../../../agent/runtime/agentCanonicalEventJournal';
import { runChatAgentApprovalContinuations } from '../agentApprovalContinuationExecution';
import { createSkippedStaleOuterApprovalResult } from './approvalConflictResult';
import { runAgentControllerToolTransactionWithLiveProgress } from './toolExecutionAdapter';

interface ApprovalContinuationConsumerOptions {
  approval: NonNullable<ChatMessage['agentApproval']>;
  canonicalEventJournal: AgentCanonicalEventJournal | null;
  signal: AbortSignal;
  executor?: AgentRuntimeToolExecutor;
  messageId: string;
  missingExecutorResult: AgentChatCommandResult;
  isCancelled: () => boolean;
  onProgress: AgentRuntimeProgressHandler;
  configRef: { current: PetConfig };
  toolExecutor: AgentRuntimeToolExecutor;
}

export function createAgentApprovalContinuationConsumer({
  approval, canonicalEventJournal, signal, executor, messageId, missingExecutorResult,
  isCancelled, onProgress, configRef, toolExecutor,
}: ApprovalContinuationConsumerOptions) {
  return (initialSessionResult: AgentProductionSessionResult, options: { logLabel: string }) => runChatAgentApprovalContinuations({
    approvedCommand: approval.command,
    approvedPlan: approval.plan,
    canonicalEventJournal,
    cancellationSignal: signal,
    createSkippedResult: createSkippedStaleOuterApprovalResult,
    executeApprovedCommand: async (command) => executor
      ? runAgentControllerToolTransactionWithLiveProgress({ command, executor, messageId, signal })
      : missingExecutorResult,
    initialResult: initialSessionResult,
    isCancelled,
    logLabel: options.logLabel,
    onProgress,
    settings: configRef.current.settings,
    toolExecutor,
  });
}
