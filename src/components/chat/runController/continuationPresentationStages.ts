import { type AgentProductionSessionResult, type resolveAgentRuntimePendingFollowUpApproval } from '../../../agent';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import { updateAgentApprovalMessage } from '../agentApprovalMessageStore';
import { getAgentTaskRuntimeRunStatus } from '../agentRuntimeUiStatusProjection';
import { updatePreparedGroupTaskEvent, type GroupTaskLifecycleCallbacks } from '../group/task/groupTaskApprovalLifecycle';
import { resolveGroupTaskContinuationOutcome } from '../group/task/groupTaskContinuationPolicy';
import { createRepeatedApprovalLoopResult } from './approvalConflictResult';
import { projectAgentDuplicateApproval, projectAgentDuplicateFollowUpApproval, projectAgentApprovalContinuationResult } from './approvalContinuationProjection';
import type { createAgentProductionSessionDisplayResult } from './sessionDisplayResult';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
type DuplicatePresentationOptions = {
    sessionResult: AgentProductionSessionResult;
    displayResult: ReturnType<typeof createAgentProductionSessionDisplayResult>;
    messageId: string;
};
export function blockAgentDuplicateApproval({ sessionResult, displayResult, messageId }: DuplicatePresentationOptions) {
    const duplicateResult = createRepeatedApprovalLoopResult(sessionResult.pendingApproval!.command, displayResult.result);
    updateAgentApprovalMessage(messageId, (message) => projectAgentDuplicateApproval(message, { duplicateResult, sessionResult }));
    pushFrontendRuntimeLog('agent-run', 'duplicate approval blocked', {
        goal: sessionResult.pendingApproval!.plan.goal,
        tool: sessionResult.pendingApproval!.command.toolCall?.name ?? sessionResult.pendingApproval!.command.kind,
    });
}
export function updateAgentApprovalContinuationPresentation({ continuationSessionResult, preparedRequest, groupTaskLifecycle, messageId }: {
    continuationSessionResult: AgentProductionSessionResult;
    preparedRequest: PreparedChatSendRequest;
    groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
    messageId: string;
}) {
    const continuationStatus = getAgentTaskRuntimeRunStatus(continuationSessionResult);
    const continuationGroupTaskEvent = updatePreparedGroupTaskEvent({
        callbacks: groupTaskLifecycle,
        event: preparedRequest.groupTaskConversationEvent,
        outcome: resolveGroupTaskContinuationOutcome({ runStatus: continuationStatus }),
        preparedRequest,
        summary: continuationSessionResult.finalAnswer,
    });
    updateAgentApprovalMessage(messageId, (message) => projectAgentApprovalContinuationResult(message, { continuationGroupTaskEvent, continuationSessionResult, continuationStatus }));
    return continuationStatus;
}
export function blockAgentDuplicateFollowUpApproval({ pendingReadOnlyFollowUpApproval, sessionResult, displayResult, messageId }: DuplicatePresentationOptions & {
    pendingReadOnlyFollowUpApproval: NonNullable<ReturnType<typeof resolveAgentRuntimePendingFollowUpApproval>>;
}) {
    const duplicateResult = createRepeatedApprovalLoopResult(pendingReadOnlyFollowUpApproval.command, displayResult.result);
    updateAgentApprovalMessage(messageId, (message) => projectAgentDuplicateFollowUpApproval(message, { duplicateResult, sessionResult, pendingReadOnlyFollowUpApproval }));
    pushFrontendRuntimeLog('agent-run', 'duplicate follow-up approval blocked', {
        goal: pendingReadOnlyFollowUpApproval.plan.goal,
        tool: pendingReadOnlyFollowUpApproval.command.toolCall?.name ?? pendingReadOnlyFollowUpApproval.command.kind,
    });
}
