import { cancelAgentProductionRuntime, getAgentCanonicalEventJournal, releaseAgentCanonicalEventJournal } from '../../../agent';
import { desktopPetChatStore } from '../../../chatStore';
import { resolveAgentStopTarget } from '../agentRunStopPolicy';
import { isStoppableAgentRunStatus, isStoppableAgentApprovalStatus } from '../agentProgressMessageProjection';
import { abortAgentRunController } from '../agentRunAbortRegistry';
import { resolveChatAgentRuntimeContinuation } from '../chatAgentRuntimeCompatibility';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { publishAgentRuntimeWorldResult } from '../../../runtime-world/agentRuntimeWorldBridge';
import { projectStoppedAgentMessage } from './stoppedMessageProjection';

export function stopAgentRunMessage(messageId?: string | null) {
  const messages = desktopPetChatStore.getState().messages;
  const targetMessage = resolveAgentStopTarget(messages, messageId);
  const targetMessageId = targetMessage?.id ?? null;

  if (!targetMessageId) {
    return false;
  }

  const canStopRun = targetMessage.agentRun && isStoppableAgentRunStatus(targetMessage.agentRun.status);
  const canStopApproval = targetMessage.agentApproval && isStoppableAgentApprovalStatus(targetMessage.agentApproval.status);

  if (!canStopRun && !canStopApproval) {
    return false;
  }

  abortAgentRunController(targetMessageId);
  let cancelledTaskState: { phase?: string | null; taskId?: string | null } | null = null;

  desktopPetChatStore.updateMessage(targetMessageId, (message) => {
    const continuation = resolveChatAgentRuntimeContinuation(message.agentRun)
      ?? resolveChatAgentRuntimeContinuation(message.agentApproval);
    const cancelledContinuation = continuation
      ? cancelAgentProductionRuntime({
          canonicalEventJournal: getAgentCanonicalEventJournal(targetMessageId),
          continuation,
        }).continuation
      : null;
    cancelledTaskState = cancelledContinuation?.taskState ?? null;

    return projectStoppedAgentMessage(message, cancelledContinuation);
  });

  pushFrontendRuntimeLog('agent-run', 'user stopped current agent run', {
    messageId: targetMessageId,
  });
  publishAgentRuntimeWorldResult({
    status: 'cancelled',
    taskState: cancelledTaskState,
  });
  releaseAgentCanonicalEventJournal(targetMessageId);

  return true;
}
