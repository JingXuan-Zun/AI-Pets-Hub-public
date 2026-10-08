import { type ChatMessage } from '../../../types';
import {
  type AgentChatCommandResult,
  createAgentContextFromResult,
  resolveAgentResultFollowUpActions,
  createAgentDecisionSummary,
} from '../../../agent';
import { createAgentExecutionReceipt } from './executionReceipt';
import { updateAgentWorkStage } from './workStageProjection';
import { updateAgentRunTraceItem, markAgentRunTraceToolSteps } from './runTraceProjection';
import { createAgentApprovalFailureVisibleText } from './sessionVisibleText';

export function projectAgentApprovalFailure(message: ChatMessage, { failedGroupTaskEvent, errorText, result, approval }: {
  failedGroupTaskEvent: ChatMessage['groupTaskEvent'];
  errorText: string;
  result: AgentChatCommandResult;
  approval: NonNullable<ChatMessage['agentApproval']>;
}): ChatMessage {
  return ({
    ...message,
    groupTaskEvent: failedGroupTaskEvent,
    text: createAgentApprovalFailureVisibleText(errorText),
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        assessment: result.assessment ?? null,
        context: createAgentContextFromResult(approval.command, result),
        errorText,
        followUpAction: result.followUpAction ?? null,
        followUpActions: resolveAgentResultFollowUpActions(result),
        followUpText: result.followUp ?? null,
        groupTaskEvent: failedGroupTaskEvent,
        receipt: createAgentExecutionReceipt(approval.command, result),
        stages: updateAgentWorkStage(updateAgentWorkStage(updateAgentWorkStage(message.agentApproval.stages, 'execute-tools', 'failed', errorText), 'verify-result', 'failed', result.assessment?.summary ?? errorText, result.assessment?.evidence), 'decide-next-step', 'completed', createAgentDecisionSummary(result, resolveAgentResultFollowUpActions(result))),
        status: 'failed',
        trace: updateAgentRunTraceItem(updateAgentRunTraceItem(markAgentRunTraceToolSteps(message.agentApproval.trace, 'failed', errorText), 'summarize-result', 'failed', errorText), 'decide-next-step', 'completed', createAgentDecisionSummary(result, resolveAgentResultFollowUpActions(result))),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        assessment: result.assessment ?? null,
        context: createAgentContextFromResult(approval.command, result),
        errorText,
        followUpAction: result.followUpAction ?? null,
        followUpActions: resolveAgentResultFollowUpActions(result),
        followUpText: result.followUp ?? null,
        groupTaskEvent: failedGroupTaskEvent,
        receipt: createAgentExecutionReceipt(approval.command, result),
        resultText: result.responseText,
        status: 'failed',
      }
      : null,
  });
}
