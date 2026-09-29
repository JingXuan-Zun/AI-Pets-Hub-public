import { desktopPetChatStore } from '../../chatStore';
import {
  type DesktopPetChatState,
  type DesktopPetGroupChatContinuationMode,
} from '../../chatState';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type ChatMessage, type ChatMessageImageAttachment, type PetConfig } from '../../types';
import type { StoryDefinition } from './story/storyTypes';
import { type VoiceInputSession } from '../../voice/types';
import {
  createChatMessageId,
  resolveActiveChatPetId,
  resolveChatTargetSlots,
} from './multiPetChat';
import {
  shouldResetChat,
  shouldStopGroupChat,
} from './chatSessionControlUtils';

export type ChatSendTargetSlot = ReturnType<typeof resolveChatTargetSlots>[number];

export function resetVoiceInputSession(
  voiceInputSessionRef: { current: VoiceInputSession | null },
  voiceTranscriptRef: { current: string },
) {
  voiceInputSessionRef.current?.stop();
  voiceInputSessionRef.current = null;
  voiceTranscriptRef.current = '';
}

export function resolveChatSendPrecheck(
  currentChatState: DesktopPetChatState,
  outgoingText: string,
  outgoingAttachments: ChatMessageImageAttachment[] = [],
) {
  if (!outgoingText && outgoingAttachments.length === 0) {
    return { kind: 'empty' as const, isGroupMode: false };
  }

  if (outgoingText && shouldResetChat(outgoingText)) {
    return { kind: 'reset' as const, isGroupMode: false };
  }

  const isGroupMode = currentChatState.chatMode === 'group';
  const isStopCommand = isGroupMode && shouldStopGroupChat(outgoingText);

  if (isStopCommand && currentChatState.isGroupChatRunning) {
    return { kind: 'stop-group' as const, isGroupMode };
  }

  return { kind: 'ready' as const, isGroupMode };
}

export function resolveChatSendTargets(
  config: PetConfig,
  currentChatState: DesktopPetChatState,
) {
  const resolvedActivePetId = resolveActiveChatPetId(config, currentChatState.activePetId);
  const targetSlots = resolveChatTargetSlots(
    config,
    currentChatState.chatMode,
    resolvedActivePetId,
    currentChatState.storySession?.definition.participantIds,
  );

  return {
    resolvedActivePetId,
    targetSlots,
  };
}

export function beginChatSendRequest(options: {
  activeChatRequestTokenRef: { current: number };
  currentChatState: DesktopPetChatState;
  outgoingAttachments?: ChatMessageImageAttachment[];
  groupChatContinuationEnabledRef: { current: boolean };
  isGroupMode: boolean;
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode;
  outgoingText: string;
  storyDefinition?: StoryDefinition;
  browserSearchMode?: 'allow' | 'block' | 'force';
  resolvedActivePetId: string;
  targetSlots: ChatSendTargetSlot[];
}) {
  const {
    activeChatRequestTokenRef,
    currentChatState,
    outgoingAttachments = [],
    groupChatContinuationEnabledRef,
    isGroupMode,
    groupChatContinuationMode,
    outgoingText,
    storyDefinition,
    browserSearchMode,
    resolvedActivePetId,
    targetSlots,
  } = options;

  const requestToken = activeChatRequestTokenRef.current + 1;
  activeChatRequestTokenRef.current = requestToken;
  const shouldRunInfiniteGroupChat = isGroupMode && groupChatContinuationMode === 'infinite';
  groupChatContinuationEnabledRef.current = shouldRunInfiniteGroupChat;
  desktopPetChatStore.setGroupChatRunning(shouldRunInfiniteGroupChat);

  const chatMode = currentChatState.chatMode;
  const storyId = chatMode === 'story' ? currentChatState.storySession?.definition.id ?? null : null;
  const userMessage: ChatMessage = {
    id: createChatMessageId('user'),
    role: 'user',
    text: outgoingText,
    attachments: outgoingAttachments.length > 0 ? outgoingAttachments : undefined,
    chatMode,
    petId: chatMode === 'single' ? targetSlots[0]?.id ?? resolvedActivePetId : null,
    petName: chatMode === 'group'
      ? '\u7fa4\u804a'
      : chatMode === 'story' ? '\u6545\u4e8b' : targetSlots[0]?.personality.name ?? null,
    storyDefinition: chatMode === 'story' && storyDefinition
      ? currentChatState.storySession?.definition ?? storyDefinition
      : undefined,
    storyId,
  };

  pushFrontendRuntimeLog('chat', 'send chat message', {
    textLength: outgoingText.length,
    attachmentCount: outgoingAttachments.length,
    historyCount: currentChatState.messages.length,
    chatMode: currentChatState.chatMode,
    targetCount: targetSlots.length,
  });

  desktopPetChatStore.addMessage(userMessage);
  if (chatMode === 'story') desktopPetChatStore.advanceStoryTurn(outgoingText);
  desktopPetChatStore.setInputValue('');
  desktopPetChatStore.setTyping(true);
  desktopPetChatStore.setTypingPetId(targetSlots[0]?.id ?? null);
  desktopPetChatStore.setStatusMessage('');

  return {
    requestToken,
    userMessage,
    browserSearchMode,
  };
}

export function finalizeChatSendRequest(
  requestToken: number,
  activeChatRequestTokenRef: { current: number },
  groupChatContinuationEnabledRef: { current: boolean },
) {
  if (requestToken !== activeChatRequestTokenRef.current) {
    return;
  }

  groupChatContinuationEnabledRef.current = false;
  desktopPetChatStore.setGroupChatRunning(false);
  desktopPetChatStore.setTyping(false);
  desktopPetChatStore.setTypingPetId(null);
}
