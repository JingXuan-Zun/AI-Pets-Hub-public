import { type ChatMessage } from '../../../types';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { createDeniedAgentExecutionReceipt } from './executionReceipt';
import { updateAgentWorkStage, markAgentWorkStageToolsRunning } from './workStageProjection';
import { updateAgentRunTraceItem, markAgentRunTraceToolSteps } from './runTraceProjection';
import { createAgentApprovalDeniedVisibleText, createAgentApprovalAcceptedVisibleText } from './sessionVisibleText';

export function projectAgentApprovalDenied(message: ChatMessage, { deniedGroupTaskEvent, approval }: {
  deniedGroupTaskEvent: ChatMessage['groupTaskEvent'];
  approval: NonNullable<ChatMessage['agentApproval']>;
}): ChatMessage {
  return ({
    ...message,
    groupTaskEvent: deniedGroupTaskEvent,
    text: createAgentApprovalDeniedVisibleText(),
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        groupTaskEvent: deniedGroupTaskEvent,
        receipt: createDeniedAgentExecutionReceipt(approval.command),
        status: 'denied',
        resultText: 'User denied execution.',
        stages: updateAgentWorkStage(message.agentApproval.stages, 'await-approval', 'blocked', 'User denied execution.'),
        trace: updateAgentRunTraceItem(message.agentApproval.trace, 'wait-for-approval', 'blocked', 'User denied this operation.'),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        groupTaskEvent: deniedGroupTaskEvent,
        errorText: 'User denied execution.',
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createDeniedAgentExecutionReceipt(approval.command),
        resultText: 'User denied execution.',
        status: 'blocked',
      }
      : null,
  });
}

export function projectAgentApprovalAccepted(message: ChatMessage, { approvalRuntime }: {
  approvalRuntime: ReturnType<typeof resolveChatAgentRuntimeContinuation>;
}): ChatMessage {
  return ({
    ...message,
    text: createAgentApprovalAcceptedVisibleText(),
    agentApproval: message.agentApproval
      ? {
        ...message.agentApproval,
        stages: markAgentWorkStageToolsRunning(updateAgentWorkStage(message.agentApproval.stages, 'await-approval', 'completed', 'User approved execution.')),
        status: 'running',
        trace: markAgentRunTraceToolSteps(updateAgentRunTraceItem(message.agentApproval.trace, 'wait-for-approval', 'completed', 'User approved execution.'), 'running', 'Calling local tool executor.'),
      }
      : null,
    agentRun: message.agentRun
      ? {
        ...message.agentRun,
        agentRuntime: approvalRuntime ?? resolveChatAgentRuntimeContinuation(message.agentRun),
        status: 'running',
      }
      : null,
  });
}
