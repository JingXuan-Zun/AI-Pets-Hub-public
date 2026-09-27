import { desktopPetChatStore } from '../../chatStore';
import type { ChatAgentApproval, ChatMessage } from '../../types';
import { resolveChatAgentRuntimeContinuation } from './chatAgentRuntimeCompatibility';
import { createChatMessageId } from './multiPetChat';

export function updateAgentApprovalMessage(
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) {
  desktopPetChatStore.updateMessage(messageId, updater);
}

export function updateAgentRunMessage(
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) {
  desktopPetChatStore.updateMessage(messageId, updater);
}

export function mergeAgentApprovalMessageIntoExistingMessage(
  message: ChatMessage,
  approvalMessage: ChatMessage,
): ChatMessage {
  const approval = approvalMessage.agentApproval;
  const mergedApproval = approval
    ? {
        ...approval,
        id: approval.id || createChatMessageId('agent-approval-state'),
      } satisfies ChatAgentApproval
    : null;
  return {
    ...message,
    groupTaskEvent: approvalMessage.groupTaskEvent ?? message.groupTaskEvent ?? null,
    agentApproval: mergedApproval,
    agentRun: message.agentRun
      ? {
          ...message.agentRun,
          agentRuntime: resolveChatAgentRuntimeContinuation(mergedApproval)
            ?? resolveChatAgentRuntimeContinuation(message.agentRun),
          followUpAction: null,
          followUpActions: null,
          followUpText: null,
          status: 'awaiting-approval',
        }
      : null,
    chatMode: approvalMessage.chatMode ?? message.chatMode,
    petId: approvalMessage.petId ?? message.petId ?? null,
    petName: approvalMessage.petName ?? message.petName ?? null,
    text: approvalMessage.text,
  };
}
