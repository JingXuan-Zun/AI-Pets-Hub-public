import { type ChatMessage } from '../../../types';
import {
  type AgentProductionSessionResult,
  type AgentChatCommandResult,
  resolveAgentRuntimePendingFollowUpApproval,
  createAgentContextFromResult,
} from '../../../agent';
import { createAgentExecutionReceipt } from './executionReceipt';
import { completeAgentWorkStagesWithResult } from './workStageProjection';
import { completeAgentRunTraceWithResult } from './runTraceProjection';
import { createAgentProductionSessionResultVisibleText } from './sessionVisibleText';

export function projectAgentDuplicateApproval(message: ChatMessage, { duplicateResult, sessionResult }: {
  duplicateResult: AgentChatCommandResult;
  sessionResult: AgentProductionSessionResult;
}): ChatMessage {
  return ({
    ...message,
    text: duplicateResult.responseText,
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        assessment: duplicateResult.assessment ?? null,
        agentRuntime: sessionResult.continuation,
        context: createAgentContextFromResult(sessionResult.pendingApproval!.command, duplicateResult),
        errorText: duplicateResult.errorText ?? duplicateResult.responseText,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createAgentExecutionReceipt(sessionResult.pendingApproval!.command, duplicateResult),
        resultText: duplicateResult.responseText,
        stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, duplicateResult),
        status: 'blocked',
        trace: completeAgentRunTraceWithResult(message.agentApproval.trace, duplicateResult),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: sessionResult.continuation,
        assessment: duplicateResult.assessment ?? null,
        context: createAgentContextFromResult(sessionResult.pendingApproval!.command, duplicateResult),
        errorText: duplicateResult.errorText ?? duplicateResult.responseText,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createAgentExecutionReceipt(sessionResult.pendingApproval!.command, duplicateResult),
        resultText: duplicateResult.responseText,
        status: 'blocked',
      }
      : null,
  });
}

export function projectAgentApprovalContinuationResult(message: ChatMessage, { continuationGroupTaskEvent, continuationSessionResult, continuationStatus }: {
  continuationGroupTaskEvent: ChatMessage['groupTaskEvent'];
  continuationSessionResult: AgentProductionSessionResult;
  continuationStatus: NonNullable<ChatMessage['agentRun']>['status'];
}): ChatMessage {
  return ({
    ...message,
    groupTaskEvent: continuationGroupTaskEvent,
    text: createAgentProductionSessionResultVisibleText(continuationSessionResult),
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        agentRuntime: continuationSessionResult.continuation,
        groupTaskEvent: continuationGroupTaskEvent,
        resultText: continuationSessionResult.finalAnswer,
        status: continuationStatus === 'awaiting-approval'
          ? 'awaiting-approval'
          : continuationStatus === 'completed'
            ? 'completed'
            : continuationStatus === 'blocked'
              ? 'blocked'
              : 'failed',
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: continuationSessionResult.continuation,
        groupTaskEvent: continuationGroupTaskEvent,
        resultText: continuationSessionResult.finalAnswer,
        status: continuationStatus,
      }
      : null,
  });
}

export function projectAgentDuplicateFollowUpApproval(message: ChatMessage, { duplicateResult, sessionResult, pendingReadOnlyFollowUpApproval }: {
  duplicateResult: AgentChatCommandResult;
  sessionResult: AgentProductionSessionResult;
  pendingReadOnlyFollowUpApproval: NonNullable<ReturnType<typeof resolveAgentRuntimePendingFollowUpApproval>>;
}): ChatMessage {
  return ({
    ...message,
    text: duplicateResult.responseText,
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        assessment: duplicateResult.assessment ?? null,
        agentRuntime: sessionResult.continuation,
        context: createAgentContextFromResult(pendingReadOnlyFollowUpApproval.command, duplicateResult),
        errorText: duplicateResult.errorText ?? duplicateResult.responseText,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createAgentExecutionReceipt(pendingReadOnlyFollowUpApproval.command, duplicateResult),
        resultText: duplicateResult.responseText,
        stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, duplicateResult),
        status: 'blocked',
        trace: completeAgentRunTraceWithResult(message.agentApproval.trace, duplicateResult),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: sessionResult.continuation,
        assessment: duplicateResult.assessment ?? null,
        context: createAgentContextFromResult(pendingReadOnlyFollowUpApproval.command, duplicateResult),
        errorText: duplicateResult.errorText ?? duplicateResult.responseText,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createAgentExecutionReceipt(pendingReadOnlyFollowUpApproval.command, duplicateResult),
        resultText: duplicateResult.responseText,
        status: 'blocked',
      }
      : null,
  });
}
