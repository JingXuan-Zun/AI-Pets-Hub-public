import type { AgentProductionSessionResult } from '../../../agent';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import type { runReadOnlyAgentApprovalContinuations } from './approvalContinuationDispatch';
import type { createAgentApprovalContinuationConsumer } from './approvalContinuationConsumer';
import { blockAgentDuplicateApproval, blockAgentDuplicateFollowUpApproval } from './continuationPresentationStages';
import { presentAgentPendingApproval } from './pendingApprovalStages';

type CommonOptions = {
  sessionResult: AgentProductionSessionResult;
  displayResult: Parameters<typeof blockAgentDuplicateApproval>[0]['displayResult'];
  preparedRequest: PreparedChatSendRequest;
  messageId: string;
};

export function dispatchApprovedPendingPresentation({ taskScopedApprovedContinuation, sessionResult, displayResult, preparedRequest, messageId }: CommonOptions & {
  taskScopedApprovedContinuation: Awaited<ReturnType<ReturnType<typeof createAgentApprovalContinuationConsumer>>>;
}) {
  if (taskScopedApprovedContinuation.outcome.kind === 'duplicate-blocked') {
    blockAgentDuplicateApproval({ sessionResult, displayResult, messageId });
  } else {
    return presentAgentPendingApproval({
      agentRuntime: sessionResult.continuation, pendingApproval: sessionResult.pendingApproval, preparedRequest, messageId: messageId,
      initial: false,
    });
  }
}

export function dispatchReadOnlyPendingPresentation({ pendingReadOnlyContinuationRun, pendingReadOnlyFollowUpApproval, sessionResult, displayResult, preparedRequest, messageId }: CommonOptions & {
  pendingReadOnlyContinuationRun: Awaited<ReturnType<typeof runReadOnlyAgentApprovalContinuations>> | null;
  pendingReadOnlyFollowUpApproval: Parameters<typeof blockAgentDuplicateFollowUpApproval>[0]['pendingReadOnlyFollowUpApproval'];
}) {
  if (pendingReadOnlyContinuationRun?.outcome.kind === 'duplicate-blocked') {
    blockAgentDuplicateFollowUpApproval({ pendingReadOnlyFollowUpApproval, sessionResult, displayResult, messageId });
  } else {
    return presentAgentPendingApproval({
      agentRuntime: sessionResult.continuation, pendingApproval: pendingReadOnlyFollowUpApproval, preparedRequest, messageId: messageId,
      initial: false,
    });
  }
}
