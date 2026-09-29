import type { AgentRuntimeProgressEvent } from '../../agent';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { markRendererDiagnosticContext } from '../../rendererEventLoopDiagnostics';
import type { ChatAgentApprovalStatus, ChatAgentRunStatus, ChatMessage } from '../../types';
import { updateAgentRunMessage } from './agentApprovalMessageStore';

export function isStoppableAgentRunStatus(status: ChatAgentRunStatus) {
  return status === 'planned' || status === 'running';
}

export function isStoppableAgentApprovalStatus(status: ChatAgentApprovalStatus) {
  return status === 'pending' || status === 'running' || status === 'awaiting-approval';
}

export function projectAgentProgressMessage(options: {
  event: AgentRuntimeProgressEvent;
  message: ChatMessage;
  visibleText: string;
}) {
  const { event, message, visibleText } = options;
  const canUpdateRun = Boolean(message.agentRun && isStoppableAgentRunStatus(message.agentRun.status));
  const canUpdateApproval = Boolean(
    message.agentApproval && isStoppableAgentApprovalStatus(message.agentApproval.status),
  );
  if (!canUpdateRun && !canUpdateApproval) return message;
  return {
    ...message,
    text: visibleText,
    agentApproval: canUpdateApproval && message.agentApproval
      ? { ...message.agentApproval, agentRuntime: event.continuation, status: 'running' as const }
      : message.agentApproval ?? null,
    agentRun: canUpdateRun && message.agentRun
      ? { ...message.agentRun, agentRuntime: event.continuation, status: 'running' as const }
      : message.agentRun ?? null,
  };
}

export function updateAgentProgressMessage(options: {
  event: AgentRuntimeProgressEvent;
  messageId: string | null;
  visibleText: string;
}) {
  if (!options.messageId) return;
  const { event } = options;
  const metrics = {
    eventType: event.type,
    stepIndex: event.stepIndex,
    taskPhase: event.taskPhase ?? null,
    sessionStepCount: event.continuation.steps.length,
    toolResultCount: event.continuation.toolResults.length,
  };
  markRendererDiagnosticContext('agent-progress', metrics);
  const updateStartedAt = performance.now();
  updateAgentRunMessage(options.messageId, (message) => projectAgentProgressMessage({
    event,
    message,
    visibleText: options.visibleText,
  }));
  const updateDurationMs = performance.now() - updateStartedAt;
  if (updateDurationMs >= 32) {
    pushFrontendRuntimeLog('agent-progress-performance', 'Agent progress store update was slow', {
      ...metrics,
      durationMs: Math.round(updateDurationMs),
    });
  }
}
