import { type AgentChatCommand, type AgentChatCommandResult } from '../../../agent';
import { type AgentRunControllerAutoContinuationStartEvent } from './controllerTypes';
import { type ChatAgentRunTraceStatus, type ChatAgentWorkStage, type ChatAgentRunTraceItem } from '../../../types';
import { formatAgentCommandResultForTrace } from './executionReceipt';
import { updateAgentRunMessage } from '../agentApprovalMessageStore';
import { isStoppableAgentRunStatus, isStoppableAgentApprovalStatus } from '../agentProgressMessageProjection';
import { updateAgentWorkStage } from './workStageProjection';
import { markAgentRunTraceToolSteps } from './runTraceProjection';

export function resolveAgentCommandToolLabel(command: AgentChatCommand) {
  return command.toolCall?.name ?? command.kind;
}

export function updateAgentToolExecutionProgressMessage(options: {
  autoContinuation?: AgentRunControllerAutoContinuationStartEvent | null;
  command: AgentChatCommand;
  messageId: string | null;
  phase: 'started' | 'completed' | 'failed';
  result?: AgentChatCommandResult | null;
}) {
  const { autoContinuation = null, command, messageId, phase, result } = options;
  if (!messageId) {
    return;
  }

  const toolLabel = resolveAgentCommandToolLabel(command);
  const statusText = phase === 'started'
    ? `正在调用工具：${toolLabel}`
    : phase === 'failed'
      ? `工具调用失败：${toolLabel}`
      : `工具调用完成：${toolLabel}`;
  const traceStatus: ChatAgentRunTraceStatus = phase === 'started'
    ? 'running'
    : phase === 'failed'
      ? 'failed'
      : 'completed';
  const receiptStatus = result?.receipt?.status ?? null;
  const traceDetail = phase === 'started'
    ? `Starting tool ${toolLabel}.`
    : result
      ? formatAgentCommandResultForTrace(result)
      : statusText;
  const progressDetailLines = result
    ? [
        ...(result.observations ?? []).filter((line) => /^Step \d+\//u.test(line)).slice(0, 6),
        ...(result.receipt?.summaryLines ?? []).slice(0, 4),
        ...(result.receipt?.evidenceLines ?? []).filter((line) => /^Step \d+\//u.test(line)).slice(0, 6),
        ...(result.observations ?? []).slice(0, 4),
      ]
    : [];

  updateAgentRunMessage(messageId, (message) => {
    const canUpdateRun = Boolean(message.agentRun && isStoppableAgentRunStatus(message.agentRun.status));
    const canUpdateApproval = Boolean(message.agentApproval && isStoppableAgentApprovalStatus(message.agentApproval.status));
    if (!canUpdateRun && !canUpdateApproval) {
      return message;
    }

    const nextStages = (stages: ChatAgentWorkStage[] | undefined) => updateAgentWorkStage(
      stages,
      'execute-tools',
      phase === 'started' || receiptStatus === 'unverified' ? 'running' : traceStatus === 'failed' ? 'failed' : 'completed',
      statusText,
      progressDetailLines.length ? [...new Set(progressDetailLines)].slice(0, 10) : undefined,
    );
    const nextTrace = (trace: ChatAgentRunTraceItem[] | undefined) => markAgentRunTraceToolSteps(
      trace,
      traceStatus,
      traceDetail,
    );

    return {
      ...message,
      text: statusText,
      agentApproval: canUpdateApproval && message.agentApproval
        ? {
            ...message.agentApproval,
            stages: nextStages(message.agentApproval.stages),
            trace: nextTrace(message.agentApproval.trace),
          }
        : message.agentApproval ?? null,
      agentRun: canUpdateRun && message.agentRun
        ? {
            ...message.agentRun,
            stages: nextStages(message.agentRun.stages),
            status: 'running',
            trace: nextTrace(message.agentRun.trace),
          }
        : message.agentRun ?? null,
    };
  });
}
