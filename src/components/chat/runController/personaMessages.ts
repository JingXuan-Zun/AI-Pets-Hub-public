import { desktopPetChatStore } from '../../../chatStore';
import { type ChatSendTargetSlot } from '../chatMessageSendUtils';
import { type DesktopPetChatMode } from '../../../types';

export function snapshotChatMessageIds() {
  return new Set(
    desktopPetChatStore.getState().messages
      .map((message) => message.id)
      .filter((messageId): messageId is string => typeof messageId === 'string' && messageId.length > 0),
  );
}

export function findNewTargetModelMessageId(
  beforeMessageIds: Set<string>,
  targetSlot: ChatSendTargetSlot,
  chatMode: DesktopPetChatMode,
) {
  const messages = desktopPetChatStore.getState().messages;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (
      message
      && typeof message.id === 'string'
      && !beforeMessageIds.has(message.id)
      && message.role === 'model'
      && message.petId === targetSlot.id
      && message.chatMode === chatMode
    ) {
      return message.id;
    }
  }

  return null;
}

export function getChatMessageText(messageId: string | null) {
  if (!messageId) {
    return '';
  }

  return desktopPetChatStore.getState().messages.find((message) => message.id === messageId)?.text ?? '';
}

export function moveAgentPersonaReplyIntoExistingMessage(options: {
  compactReplyIntoMessageId?: string | null;
  finalResponse: string;
  generatedMessageId: string | null;
}) {
  const {
    compactReplyIntoMessageId,
    finalResponse,
    generatedMessageId,
  } = options;
  const generatedText = getChatMessageText(generatedMessageId);
  const replyText = (generatedText || finalResponse).trim();

  if (compactReplyIntoMessageId && replyText) {
    desktopPetChatStore.updateMessage(compactReplyIntoMessageId, (message) => ({
      ...message,
      text: replyText,
    }));

    if (generatedMessageId && generatedMessageId !== compactReplyIntoMessageId) {
      desktopPetChatStore.removeMessage(generatedMessageId);
    }
  }

  return replyText;
}
