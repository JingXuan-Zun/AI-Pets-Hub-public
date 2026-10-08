import { type ChatMessage } from '../../../types';
import {
  type AgentRuntimeToolResultEntry,
  type AgentProductionSessionResult,
  type AgentChatCommandResult,
  createAgentContextFromResult,
  resolveAgentResultFollowUpActions,
} from '../../../agent';
import { createAgentExecutionReceipt } from './executionReceipt';
import { completeAgentWorkStagesWithResult } from './workStageProjection';
import { completeAgentRunTraceWithResult } from './runTraceProjection';
import { createAgentUnsupportedApprovalVisibleText, createAgentApprovalContinuationVisibleText } from './sessionVisibleText';

export function projectAgentUnsupportedApproval(message: ChatMessage, { result, approval }: {
  result: AgentChatCommandResult;
  approval: NonNullable<ChatMessage['agentApproval']>;
}): ChatMessage {
  return ({
    ...message,
    text: createAgentUnsupportedApprovalVisibleText(),
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        assessment: result.assessment ?? null,
        context: createAgentContextFromResult(approval.command, result),
        errorText: result.errorText ?? result.responseText,
        receipt: createAgentExecutionReceipt(approval.command, result),
        resultText: result.responseText,
        stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, result),
        status: 'failed',
        trace: completeAgentRunTraceWithResult(message.agentApproval.trace, result),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        assessment: result.assessment ?? null,
        context: createAgentContextFromResult(approval.command, result),
        errorText: result.errorText ?? result.responseText,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createAgentExecutionReceipt(approval.command, result),
        resultText: result.responseText,
        status: 'failed',
      }
      : null,
  });
}

export function projectAgentApprovalResult(message: ChatMessage, { nextGroupTaskEvent, sessionResult, displayResult, shouldHideApprovalFollowUps, approvalRunStatus, taskRunStatus }: {
  nextGroupTaskEvent: ChatMessage['groupTaskEvent'];
  sessionResult: AgentProductionSessionResult;
  displayResult: AgentRuntimeToolResultEntry;
  shouldHideApprovalFollowUps: boolean;
  approvalRunStatus: NonNullable<ChatMessage['agentApproval']>['status'];
  taskRunStatus: NonNullable<ChatMessage['agentRun']>['status'];
}): ChatMessage {
  return ({
    ...message,
    groupTaskEvent: nextGroupTaskEvent,
    text: createAgentApprovalContinuationVisibleText(sessionResult),
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        assessment: displayResult.result.assessment ?? null,
        agentRuntime: sessionResult.continuation,
        context: createAgentContextFromResult(displayResult.command, displayResult.result),
        errorText: displayResult.result.ok === false
          ? displayResult.result.errorText ?? displayResult.result.responseText
          : null,
        followUpAction: shouldHideApprovalFollowUps ? null : displayResult.result.followUpAction ?? null,
        followUpActions: shouldHideApprovalFollowUps ? null : resolveAgentResultFollowUpActions(displayResult.result),
        followUpText: shouldHideApprovalFollowUps ? null : displayResult.result.followUp ?? null,
        groupTaskEvent: nextGroupTaskEvent,
        receipt: createAgentExecutionReceipt(displayResult.command, displayResult.result),
        resultText: sessionResult.finalAnswer,
        stages: completeAgentWorkStagesWithResult(message.agentApproval.stages, displayResult.result),
        status: approvalRunStatus,
        trace: completeAgentRunTraceWithResult(message.agentApproval.trace, displayResult.result),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: sessionResult.continuation,
        assessment: displayResult.result.assessment ?? null,
        context: createAgentContextFromResult(displayResult.command, displayResult.result),
        errorText: displayResult.result.ok === false
          ? displayResult.result.errorText ?? displayResult.result.responseText
          : null,
        followUpAction: shouldHideApprovalFollowUps ? null : displayResult.result.followUpAction ?? null,
        followUpActions: shouldHideApprovalFollowUps ? null : resolveAgentResultFollowUpActions(displayResult.result),
        followUpText: shouldHideApprovalFollowUps ? null : displayResult.result.followUp ?? null,
        groupTaskEvent: nextGroupTaskEvent,
        receipt: createAgentExecutionReceipt(displayResult.command, displayResult.result),
        resultText: sessionResult.finalAnswer,
        status: taskRunStatus,
      }
      : null,
  });
}
