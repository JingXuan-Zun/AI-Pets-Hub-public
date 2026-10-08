import type { ChatMessage } from '../../../types';
import type { AgentRuntimeContinuation } from '../../../agent';
import { isStoppableAgentRunStatus, isStoppableAgentApprovalStatus } from '../agentProgressMessageProjection';
import { AGENT_STOPPED_VISIBLE_TEXT, AGENT_STOPPED_DETAIL_TEXT } from './stoppedText';
import { createStoppedAgentExecutionReceipt } from './executionReceipt';
import { stopPendingAgentWorkStages } from './workStageProjection';
import { stopPendingAgentRunTrace } from './runTraceProjection';

export function projectStoppedAgentMessage(message: ChatMessage, cancelledContinuation: AgentRuntimeContinuation | null): ChatMessage {
  return {
    ...message,
    text: AGENT_STOPPED_VISIBLE_TEXT,
    agentApproval: message.agentApproval && isStoppableAgentApprovalStatus(message.agentApproval.status)
      ? {
        ...message.agentApproval,
        agentRuntime: cancelledContinuation,
        errorText: AGENT_STOPPED_DETAIL_TEXT,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createStoppedAgentExecutionReceipt(message.agentApproval.command),
        resultText: AGENT_STOPPED_DETAIL_TEXT,
        stages: stopPendingAgentWorkStages(message.agentApproval.stages),
        status: 'blocked',
        stoppedByUser: true,
        trace: stopPendingAgentRunTrace(message.agentApproval.trace),
      }
      : message.agentApproval ?? null,
    agentRun: message.agentRun && isStoppableAgentRunStatus(message.agentRun.status)
      ? {
        ...message.agentRun,
        agentRuntime: cancelledContinuation,
        errorText: AGENT_STOPPED_DETAIL_TEXT,
        followUpAction: null,
        followUpActions: null,
        followUpText: null,
        receipt: createStoppedAgentExecutionReceipt(message.agentRun.command),
        resultText: AGENT_STOPPED_DETAIL_TEXT,
        stages: stopPendingAgentWorkStages(message.agentRun.stages),
        status: 'blocked',
        stoppedByUser: true,
        trace: stopPendingAgentRunTrace(message.agentRun.trace),
      }
      : message.agentRun ?? null,
  };
}
