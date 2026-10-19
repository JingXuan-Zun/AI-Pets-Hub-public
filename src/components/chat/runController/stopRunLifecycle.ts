import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { resolveAgentStopTarget } from '../agentRunStopPolicy';
import { isStoppableAgentApprovalStatus, isStoppableAgentRunStatus } from '../agentProgressMessageProjection';
import { resolveAgentLoopApproval } from './agentLoopApprovalRegistry';
import { stopConversationTask } from './conversationTaskCard';
import { projectStoppedAgentMessage } from './stoppedMessageProjection';

/** The user pressed stop on a waiting approval card: the conversation loop gets a "no". */
export function stopAgentRunMessage(messageId?: string | null) {
  if (messageId && stopConversationTask(messageId)) {
    pushFrontendRuntimeLog('agent-run', 'user stopped conversation task', { messageId });
    return true;
  }
  const targetMessage = resolveAgentStopTarget(desktopPetChatStore.getState().messages, messageId);
  const targetMessageId = targetMessage?.id ?? null;
  if (!targetMessage || !targetMessageId) return false;
  const canStopRun = targetMessage.agentRun && isStoppableAgentRunStatus(targetMessage.agentRun.status);
  const canStopApproval = targetMessage.agentApproval && isStoppableAgentApprovalStatus(targetMessage.agentApproval.status);
  if (!canStopRun && !canStopApproval) return false;

  if (!resolveAgentLoopApproval(targetMessageId, 'deny')) {
    desktopPetChatStore.updateMessage(targetMessageId, (message) => projectStoppedAgentMessage(message, null));
  }
  pushFrontendRuntimeLog('agent-run', 'user stopped current agent run', { messageId: targetMessageId });
  return true;
}
