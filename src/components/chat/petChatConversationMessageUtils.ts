import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type ChatMessage, type DesktopPetChatMode, type PetConfig } from '../../types';
import { resolveChatUserDisplayName } from './chatAppearanceUtils';
import { isChatMessageInMode } from './chatMessageScopeUtils';

function resolveReplyTargetLabel(message: ChatMessage) {
  if (message.groupInteractionKind === 'group') {
    return '全体';
  }

  const replyToPetNames = message.replyToPetNames?.filter((name) => name.trim()) ?? [];
  if (replyToPetNames.length > 0) {
    return replyToPetNames.join('、');
  }

  return message.replyToPetName?.trim() ?? '';
}

export function resolveConversationMessageLabel(message: ChatMessage, config: PetConfig) {
  if (message.storyMessageKind === 'narration') {
    return '旁白';
  }

  if (message.role === 'user') {
    const userDisplayLabel = resolveChatUserDisplayName(config);
    return message.petName ? `${userDisplayLabel} -> ${message.petName}` : userDisplayLabel;
  }

  const petName = message.petName?.trim() || '桌宠';
  const replyTargetLabel = message.chatMode === 'group'
    ? resolveReplyTargetLabel(message)
    : '';

  return replyTargetLabel ? `${petName} -> ${replyTargetLabel}` : petName;
}

export function buildConversationEmptyState(greeting: string, chatMode: DesktopPetChatMode, petCount: number) {
  if (chatMode === 'single') {
    return greeting;
  }

  if (chatMode === 'story') {
    return '先创建、导入或随机生成一个故事，确认设定后即可开始。';
  }

  return `把消息发进群聊后，${petCount} 只桌宠会完成这一轮回复；需要持续接话时，请在左侧栏切到无限群聊。`;
}

function resolveDisplayPetId(message: ChatMessage) {
  if (message.role === 'model') {
    return message.petId ?? PRIMARY_DESKTOP_PET_SLOT_ID;
  }

  return message.petId ?? null;
}

export function filterConversationMessages(
  messages: ChatMessage[],
  chatMode: DesktopPetChatMode,
  activePetId: string,
) {
  if (chatMode === 'group') {
    return messages.filter((message) => isChatMessageInMode(message, 'group'));
  }

  if (chatMode === 'story') {
    const latestStoryId = [...messages].reverse()
      .find((message) => message.chatMode === 'story' && message.storyId)?.storyId;
    return messages.filter((message) => (
      isChatMessageInMode(message, 'story')
      && (!latestStoryId || message.storyId === latestStoryId)
    ));
  }

  return messages.filter((message) => (
    isChatMessageInMode(message, 'single')
    && resolveDisplayPetId(message) === activePetId
  ));
}
