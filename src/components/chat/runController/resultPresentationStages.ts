import {
  resolveAgentRuntimePendingFollowUpApproval,
  type AgentProductionSessionResult,
  type AgentRuntimeContinuation,
} from '../../../agent';
import type { ChatMessage } from '../../../types';
import type { PreparedChatSendRequest } from '../chatMessageSendFlowTypes';
import { updateAgentApprovalMessage, updateAgentRunMessage } from '../agentApprovalMessageStore';
import {
  getAgentTaskRuntimeRunStatus,
  isAgentTaskRuntimeWaitingApproval,
  resolveAgentApprovalUiStatus,
} from '../agentRuntimeUiStatusProjection';
import { updatePreparedGroupTaskEvent, type GroupTaskLifecycleCallbacks } from '../group/task/groupTaskApprovalLifecycle';
import { resolveGroupTaskContinuationOutcome } from '../group/task/groupTaskContinuationPolicy';
import { createAgentProductionSessionPlaceholderCommand } from './sessionMessageProjection';
import { createAgentProductionSessionDisplayResult } from './sessionDisplayResult';
import { projectAgentRunResult } from './runResultProjection';
import { projectAgentApprovalResult } from './approvalResultProjection';

interface InitialRunPresentationOptions {
  result: AgentProductionSessionResult;
  instruction: string;
  preparedRequest: PreparedChatSendRequest;
  runMessageId: string | null;
}

export function updateInitialAgentRunPresentation({ result, instruction, preparedRequest, runMessageId }: InitialRunPresentationOptions) {
  const fallbackCommand = createAgentProductionSessionPlaceholderCommand(instruction, preparedRequest.outgoingText);
  const displayResult = createAgentProductionSessionDisplayResult(result, fallbackCommand);
  const runStatus = getAgentTaskRuntimeRunStatus(result);
  const pendingRunFollowUpApproval = resolveAgentRuntimePendingFollowUpApproval({
    command: displayResult.command,
    result: displayResult.result,
    runtimeResult: result,
    sourceText: preparedRequest.outgoingText,
    userGoal: instruction,
  });

  if (runMessageId) {
    const shouldHideRunFollowUps = isAgentTaskRuntimeWaitingApproval(result) || Boolean(pendingRunFollowUpApproval);
    updateAgentRunMessage(runMessageId, (message) => projectAgentRunResult(message, { result, displayResult, shouldHideRunFollowUps, runStatus }));
  }
  return pendingRunFollowUpApproval;
}

interface ApprovedRunPresentationOptions {
  sessionResult: AgentProductionSessionResult;
  approval: NonNullable<ChatMessage['agentApproval']>;
  approvalRuntime: AgentRuntimeContinuation;
  approvalMessage: ChatMessage;
  preparedRequest: PreparedChatSendRequest;
  groupTaskLifecycle?: GroupTaskLifecycleCallbacks;
  messageId: string;
}

export function updateApprovedAgentRunPresentation({
  sessionResult, approval, approvalRuntime, approvalMessage, preparedRequest, groupTaskLifecycle, messageId,
}: ApprovedRunPresentationOptions) {
  const displayResult = createAgentProductionSessionDisplayResult(sessionResult, approval.command);
  const taskRunStatus = getAgentTaskRuntimeRunStatus(sessionResult);
  const approvalRunStatus = resolveAgentApprovalUiStatus(taskRunStatus);
  const shouldHideApprovalFollowUps = isAgentTaskRuntimeWaitingApproval(sessionResult);
  const pendingReadOnlyFollowUpApproval = resolveAgentRuntimePendingFollowUpApproval({
    command: displayResult.command,
    result: displayResult.result,
    runtimeResult: sessionResult,
    sourceText: approvalRuntime.sourceText,
    userGoal: approvalRuntime.userGoal,
  });
  const nextGroupTaskEvent = updatePreparedGroupTaskEvent({
    callbacks: groupTaskLifecycle,
    event: approval.groupTaskEvent ?? approvalMessage.groupTaskEvent,
    outcome: resolveGroupTaskContinuationOutcome({
      hasPendingFollowUp: Boolean(pendingReadOnlyFollowUpApproval),
      runStatus: taskRunStatus,
    }),
    preparedRequest,
    summary: sessionResult.finalAnswer,
  });
  updateAgentApprovalMessage(messageId, (message) => projectAgentApprovalResult(message, { nextGroupTaskEvent, sessionResult, displayResult, shouldHideApprovalFollowUps, approvalRunStatus, taskRunStatus }));
  return { displayResult, pendingReadOnlyFollowUpApproval };
}
