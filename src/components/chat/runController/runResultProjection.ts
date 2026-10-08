import { type ChatMessage } from '../../../types';
import {
  type AgentRuntimeToolResultEntry,
  type AgentProductionSessionResult,
  createAgentContextFromResult,
  resolveAgentResultFollowUpActions,
} from '../../../agent';
import { createAgentExecutionReceipt } from './executionReceipt';
import { completeAgentWorkStagesWithResult } from './workStageProjection';
import { completeAgentRunTraceWithResult } from './runTraceProjection';
import { getAgentTaskRuntimeRunStatus } from '../agentRuntimeUiStatusProjection';
import { createAgentProductionSessionResultVisibleText } from './sessionVisibleText';

export function projectAgentRunResult(message: ChatMessage, { result, displayResult, shouldHideRunFollowUps, runStatus }: {
  result: AgentProductionSessionResult;
  displayResult: AgentRuntimeToolResultEntry;
  shouldHideRunFollowUps: boolean;
  runStatus: NonNullable<ChatMessage['agentRun']>['status'];
}): ChatMessage {
  return ({
    ...message,
    text: createAgentProductionSessionResultVisibleText(result),
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: result.continuation,
        assessment: displayResult.result.assessment ?? null,
        context: createAgentContextFromResult(displayResult.command, displayResult.result),
        errorText: result.status === 'failed' || result.status === 'max-steps' || result.status === 'budget-exceeded'
          ? displayResult.result.errorText ?? result.finalAnswer
          : null,
        followUpAction: shouldHideRunFollowUps ? null : displayResult.result.followUpAction ?? null,
        followUpActions: shouldHideRunFollowUps ? null : resolveAgentResultFollowUpActions(displayResult.result),
        followUpText: shouldHideRunFollowUps
          ? null
          : result.status === 'needs-user' ? result.finalAnswer : displayResult.result.followUp ?? null,
        receipt: createAgentExecutionReceipt(displayResult.command, displayResult.result),
        resultText: result.finalAnswer,
        stages: completeAgentWorkStagesWithResult(message.agentRun.stages, displayResult.result),
        status: runStatus,
        trace: completeAgentRunTraceWithResult(message.agentRun.trace, displayResult.result),
      }
      : null,
  });
}

export function projectAgentRunContinuationResult(message: ChatMessage, { result }: {
  result: AgentProductionSessionResult;
}): ChatMessage {
  return ({
    ...message,
    text: createAgentProductionSessionResultVisibleText(result),
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: result.continuation,
        resultText: result.finalAnswer,
        status: getAgentTaskRuntimeRunStatus(result),
      }
      : null,
  });
}
