import { useCallback } from 'react';
import {
  type AgentChatCommandHandler,
} from '../../agent';
import { desktopPetChatStore, useDesktopPetChatStore } from '../../chatStore';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { publishChatStatusMessage } from './chatSessionRuntimeUtils';
import { usePetChatMessageSender } from './usePetChatMessageSender';
import { usePetChatSessionControls } from './usePetChatSessionControls';
import { usePetChatSessionRuntime } from './usePetChatSessionRuntime';
import { usePetChatVoicePlayback } from './usePetChatVoicePlayback';
import { usePetChatVoiceInputController } from './usePetChatVoiceInputController';
import { usePetChatResponseTurn } from './usePetChatResponseTurn';
import { useGroupTopicLifecycleScheduler } from './group/topic/useGroupTopicLifecycleScheduler';

interface UsePetChatSessionOptions {
  config: PetConfig;
  onUpdateConfig: PetConfigUpdateHandler;
  onPetMessage?: (text: string) => void;
  onStatusMessage?: (message: string) => void;
  onAgentChatCommand?: AgentChatCommandHandler;
  onOpenChat?: () => void;
}

export function usePetChatSession({
  config,
  onUpdateConfig,
  onPetMessage,
  onStatusMessage,
  onAgentChatCommand,
  onOpenChat,
}: UsePetChatSessionOptions) {
  const chatState = useDesktopPetChatStore();
  const {
    activePetId,
    animationToolTriggersByPetId,
    chatMode,
    groupChatContinuationMode,
    groupUserAttention,
    inputValue,
    isGroupChatRunning,
    isListening,
    isSpeaking,
    isTyping,
    lastReplayableAnimationToolTriggersByPetId,
    latestPetMessage,
    latestPetMessages,
    messages,
    speakingPetId,
    statusMessage,
    typingPetId,
    webSearchStatusMessage,
  } = chatState;
  const {
    activeChatRequestTokenRef,
    configRef,
    groupChatContinuationEnabledRef,
    activeGroupRuntimeRef,
    voiceInputSessionRef,
    voiceTranscriptRef,
  } = usePetChatSessionRuntime({ config });
  useGroupTopicLifecycleScheduler({ activeGroupRuntimeRef, configRef, onUpdateConfig });

  const publishStatusMessage = useCallback((message: string) => {
    publishChatStatusMessage(message, onStatusMessage);
  }, [onStatusMessage]);
  const {
    enqueueReplyVoiceSegment,
    extractStreamingSpeech,
    getPlaybackToken,
    playVoiceText,
    stopPetSpeech,
    toggleVoiceEnabled,
    warmLocalReplyVoice,
  } = usePetChatVoicePlayback({
    configRef,
    onUpdateConfig,
    publishStatusMessage,
  });
  const {
    resetChatSession,
    setActivePetId,
    setChatMode,
    setGroupChatContinuationMode,
    stopAgentRun,
    stopGroupChat,
  } = usePetChatSessionControls({
    activeChatRequestTokenRef,
    configRef,
    groupChatContinuationEnabledRef,
    activeGroupRuntimeRef,
    publishStatusMessage,
    stopPetSpeech,
    voiceInputSessionRef,
    voiceTranscriptRef,
  });
  const runPetResponseTurn = usePetChatResponseTurn({
    activeChatRequestTokenRef,
    configRef,
    enqueueReplyVoiceSegment,
    extractStreamingSpeech,
    onPetMessage,
  });
  const {
    resolveAgentApproval,
    resolveGroupUserAttention,
    sendMessage,
  } = usePetChatMessageSender({
    activeChatRequestTokenRef,
    activeGroupRuntimeRef,
    configRef,
    getPlaybackToken,
    groupChatContinuationEnabledRef,
    onUpdateConfig,
    playVoiceText,
    resetChatSession,
    runPetResponseTurn,
    stopGroupChat,
    stopPetSpeech,
    onAgentChatCommand,
    voiceInputSessionRef,
    voiceTranscriptRef,
    warmLocalReplyVoice,
  });

  const playMessageVoice = useCallback(async (text: string) => {
    await playVoiceText(text, {
      force: true,
      petId: desktopPetChatStore.getState().activePetId,
      source: 'manual',
    });
  }, [playVoiceText]);

  const voiceInputController = usePetChatVoiceInputController({
    configRef,
    onOpenChat,
    publishStatusMessage,
    sendMessage,
    stopPetSpeech,
    voiceInputSessionRef,
    voiceTranscriptRef,
  });

  return {
    activePetId,
    animationToolTriggersByPetId,
    chatMode,
    groupChatContinuationMode,
    groupUserAttention,
    inputValue,
    isGroupChatRunning,
    isListening,
    isSpeaking,
    isTyping,
    lastReplayableAnimationToolTriggersByPetId,
    latestPetMessage,
    latestPetMessages,
    messages,
    playMessageVoice,
    resolveAgentApproval,
    resolveGroupUserAttention,
    sendMessage,
    setActivePetId,
    setChatMode,
    setGroupChatContinuationMode,
    setInputValue: desktopPetChatStore.setInputValue,
    speakingPetId,
    statusMessage,
    stopAgentRun,
    stopGroupChat: () => stopGroupChat({ immediate: true, announce: true }),
    stopPetSpeech,
    typingPetId,
    webSearchStatusMessage,
    toggleVoiceEnabled,
    toggleVoiceInput: voiceInputController.toggleVoiceInput,
    voiceInputController,
  };
}
