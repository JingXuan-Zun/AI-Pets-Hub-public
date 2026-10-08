import { type ChatAgentRunTraceItem, type ChatAgentRunTraceStatus } from '../../../types';
import { type AgentChatCommandResult, createAgentDecisionSummary, resolveAgentResultFollowUpActions } from '../../../agent';
import { type AgentRunControllerAutoContinuationStartEvent } from './controllerTypes';
import { resolveAgentReceiptStatus, formatAgentCommandResultForTrace } from './executionReceipt';
import { AGENT_STOPPED_DETAIL_TEXT } from './stoppedText';

export function updateAgentRunTraceItem(
  trace: ChatAgentRunTraceItem[] | undefined,
  itemId: string,
  status: ChatAgentRunTraceStatus,
  detail?: string | null,
) {
  return (trace ?? []).map((item) => (
    item.id === itemId
      ? {
          ...item,
          detail: detail ?? item.detail,
          status,
          timestamp: Date.now(),
        }
      : item
  ));
}

export function markAgentRunTraceToolSteps(
  trace: ChatAgentRunTraceItem[] | undefined,
  status: ChatAgentRunTraceStatus,
  detail?: string | null,
) {
  return (trace ?? []).map((item) => (
    item.id.startsWith('step-')
      ? {
          ...item,
          detail: detail ?? item.detail,
          status,
          timestamp: Date.now(),
        }
      : item
  ));
}

export function completeAgentRunTrace(
  trace: ChatAgentRunTraceItem[] | undefined,
  resultText: string,
  options: {
    keepPendingVerification?: boolean;
  } = {},
) {
  return (trace ?? []).map((item) => {
    if (item.id === 'summarize-result') {
      return {
        ...item,
        detail: resultText,
        status: 'completed' as const,
        timestamp: Date.now(),
      };
    }

    if (item.id === 'persona-reply') {
      return {
        ...item,
        status: options.keepPendingVerification ? 'pending' as const : 'running' as const,
        timestamp: Date.now(),
      };
    }

    if (options.keepPendingVerification && (item.id === 'verify-result' || item.id === 'decide-next-step')) {
      return {
        ...item,
        detail: item.id === 'verify-result' ? resultText : item.detail,
        status: item.id === 'verify-result' ? 'running' as const : 'pending' as const,
        timestamp: item.timestamp ?? Date.now(),
      };
    }

    if (item.status === 'pending' || item.status === 'running') {
      return {
        ...item,
        status: 'completed' as const,
        timestamp: item.timestamp ?? Date.now(),
      };
    }

    return item;
  });
}

export function completeAgentRunTraceWithResult(
  trace: ChatAgentRunTraceItem[] | undefined,
  result: AgentChatCommandResult,
  autoContinuation?: AgentRunControllerAutoContinuationStartEvent | null,
) {
  const decisionSummary = createAgentDecisionSummary(result, resolveAgentResultFollowUpActions(result));
  const receiptStatus = resolveAgentReceiptStatus(result);
  const keepPendingVerification = receiptStatus === 'unverified';
  const resultText = autoContinuation
    ? [
        `auto continuation: ${autoContinuation.action.label}`,
        formatAgentCommandResultForTrace(result),
      ].join('\n')
    : formatAgentCommandResultForTrace(result);
  const completedTrace = updateAgentRunTraceItem(
    completeAgentRunTrace(trace, resultText, { keepPendingVerification }),
    'decide-next-step',
    keepPendingVerification ? 'pending' : 'completed',
    decisionSummary,
  );
  if (result.ok !== false || result.receipt?.status === 'unverified') {
    return completedTrace;
  }

  return updateAgentRunTraceItem(
    completedTrace,
    'summarize-result',
    'failed',
    formatAgentCommandResultForTrace(result),
  );
}

export function finalizePersonaReplyTrace(trace: ChatAgentRunTraceItem[] | undefined) {
  return updateAgentRunTraceItem(trace, 'persona-reply', 'completed');
}

export function stopPendingAgentRunTrace(trace: ChatAgentRunTraceItem[] | undefined) {
  const now = Date.now();

  return (trace ?? []).map((item) => (
    item.status === 'pending' || item.status === 'running'
      ? {
          ...item,
          detail: AGENT_STOPPED_DETAIL_TEXT,
          status: 'blocked' as const,
          timestamp: now,
        }
      : item
  ));
}
