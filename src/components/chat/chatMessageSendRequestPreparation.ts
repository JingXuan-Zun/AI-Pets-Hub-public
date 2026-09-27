import {
  beginChatSendRequest,
  resetVoiceInputSession,
  resolveChatSendTargets,
} from './chatMessageSendUtils';
import {
  type PrepareChatSendRequestOptions,
  type PreparedChatSendRequest,
} from './chatMessageSendFlowTypes';

export function prepareChatSendRequest({
  activeChatRequestTokenRef,
  configRef,
  currentChatState,
  getPlaybackToken,
  groupChatContinuationEnabledRef,
  isGroupMode,
  outgoingText,
  outgoingAttachments = [],
  browserSearchMode,
  storyDefinition,
  stopGroupChat,
  stopPetSpeech,
  voiceInputSessionRef,
  voiceTranscriptRef,
}: PrepareChatSendRequestOptions): PreparedChatSendRequest | null {
  resetVoiceInputSession(voiceInputSessionRef, voiceTranscriptRef);

  if (currentChatState.isGroupChatRunning || currentChatState.isTyping) {
    // In infinite group chat, the caller waits for the current speaker to
    // finish. Preserve that completed reply instead of aborting it mid-stream.
    if (!(isGroupMode && currentChatState.groupChatContinuationMode === 'infinite')) {
      stopGroupChat({ immediate: true });
    }
  }

  const currentConfig = configRef.current;
  const { resolvedActivePetId, targetSlots } = resolveChatSendTargets(currentConfig, currentChatState);
  if (targetSlots.length === 0) {
    return null;
  }

  const { requestToken, userMessage } = beginChatSendRequest({
    activeChatRequestTokenRef,
    currentChatState,
    groupChatContinuationEnabledRef,
    isGroupMode,
    groupChatContinuationMode: currentChatState.groupChatContinuationMode,
    outgoingText,
    outgoingAttachments,
    browserSearchMode,
    storyDefinition,
    resolvedActivePetId,
    targetSlots,
  });
  stopPetSpeech();

  return {
    currentChatState,
    currentConfig,
    isGroupMode,
    promptHistoryMessages: currentChatState.messages,
    userMessage,
    outgoingText,
    playbackToken: getPlaybackToken(),
    requestToken,
    browserSearchMode,
    targetSlots,
  };
}
