import { desktopPetChatStore } from '../../../chatStore';
import type { ChatMessage } from '../../../types';
import {
  mergeAgentApprovalMessageIntoExistingMessage,
  updateAgentApprovalMessage,
  updateAgentRunMessage,
} from '../agentApprovalMessageStore';

export function attachAgentRunPendingApproval(messageId: string | null, approvalMessage: ChatMessage) {
  if (messageId) {
    updateAgentRunMessage(messageId, (message) => (
      mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
    ));
  } else {
    desktopPetChatStore.addMessage(approvalMessage);
  }
}

export function attachAgentPendingApproval(messageId: string, approvalMessage: ChatMessage) {
  updateAgentApprovalMessage(messageId, (message) => (
    mergeAgentApprovalMessageIntoExistingMessage(message, approvalMessage)
  ));
}
