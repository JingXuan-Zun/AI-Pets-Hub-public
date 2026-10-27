import { useCallback, useEffect, useRef } from 'react';
import { type AgentChatCommandHandler } from '../../agent/agentChatCommand';
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
import {
  useNeuralMemoryProposalCapture,
  type NeuralMemoryReplyCompletedEvent,
} from '../../neural-memory/useNeuralMemoryProposalCapture';
import { useCharacterMemoryMaintenance } from '../../character-memory/useCharacterMemoryMaintenance';
import { useSharedUserMemoryCapture } from '../../character-memory/useSharedUserMemoryCapture';
import { useVoiceWakeListener } from './useVoiceWakeListener';
import { useApprovalVoiceListener } from './useApprovalVoiceListener';
import { useQqBridge } from '../../qq-bridge/useQqBridge';
import { loadChatTargetSnapshot } from '../../chatTargetSnapshot';
import { getDesktopPetSlot } from '../../multiPetRoster';

// Read before anything at startup can change the chat partner.
const initialChatTarget = loadChatTargetSnapshot();
import { registerCompanionLineSpeaker } from '../../life-companion/companionLineSpeech';

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
  const captureNeuralMemoryProposals = useNeuralMemoryProposalCapture({ configRef, onUpdateConfig });
  const maintainCharacterMemory = useCharacterMemoryMaintenance({ configRef, onUpdateConfig });
  const captureSharedUserMemory = useSharedUserMemoryCapture({ configRef, onUpdateConfig });
  const onReplyCompleted = useCallback((event: NeuralMemoryReplyCompletedEvent) => {
    captureSharedUserMemory(event);
    captureNeuralMemoryProposals(event);
    maintainCharacterMemory(event);
  }, [captureNeuralMemoryProposals, captureSharedUserMemory, maintainCharacterMemory]);
  const runPetResponseTurn = usePetChatResponseTurn({
    activeChatRequestTokenRef,
    configRef,
    enqueueReplyVoiceSegment,
    extractStreamingSpeech,
    onPetMessage,
    onReplyCompleted,
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

  // Replays only pass the text across windows; the speaker is recovered from the history so the
  // message is replayed in the voice of the character who said it.
  const playMessageVoice = useCallback(async (text: string) => {
    const { activePetId, messages } = desktopPetChatStore.getState();
    const author = [...messages].reverse().find((message) => message.role === 'model' && message.text === text);
    await playVoiceText(text, {
      force: true,
      petId: author?.petId ?? activePetId,
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
  // Waking a character by its own phrase opens a private chat with it (desktop and chat window follow).
  const onWakeCharacter = useCallback((petId: string) => {
    setChatMode('single');
    setActivePetId(petId);
  }, [setActivePetId, setChatMode]);
  // Carry on with the character and mode of the last session, once the roster is loaded and
  // she is still there (a removed or disabled character falls back to the default).
  const chatTargetRestoredRef = useRef(false);
  useEffect(() => {
    if (chatTargetRestoredRef.current) return;
    const { activePetId: savedPetId, chatMode: savedMode } = initialChatTarget;
    const slot = savedPetId ? getDesktopPetSlot(config, savedPetId) : null;
    if (savedPetId && !slot) return;
    chatTargetRestoredRef.current = true;
    if (slot?.enabled) setActivePetId(slot.id);
    if (savedMode) setChatMode(savedMode);
  }, [config, setActivePetId, setChatMode]);
  // Lines the character posts on her own are spoken too; skipped while a reply has the floor.
  useEffect(() => registerCompanionLineSpeaker((text, petId) => {
    const { isTyping, isSpeaking } = desktopPetChatStore.getState();
    if (!isTyping && !isSpeaking) void playVoiceText(text, { petId });
  }), [playVoiceText]);
  useApprovalVoiceListener({ config, conversationActive: voiceInputController.conversation.active });
  useQqBridge({ config, configRef, sendMessage });
  useVoiceWakeListener({
    config,
    conversationActive: voiceInputController.conversation.active,
    onOpenChat,
    onWakeCharacter,
    publishStatusMessage,
    startConversation: voiceInputController.conversation.startConversation,
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
