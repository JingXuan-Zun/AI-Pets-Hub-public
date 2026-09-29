import { useCallback, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { type DesktopPetGroupChatContinuationMode } from '../../chatState';
import { type DesktopPetChatMode, type PetConfig } from '../../types';
import { type VoiceInputSession } from '../../voice/types';
import {
  GROUP_CHAT_STOPPED_MESSAGE,
  clearPrivateChatMessages,
  getPrivateChatResetCompletedMessage,
  type PrivateChatResetScope,
  shouldCancelActiveRequestForChatModeSwitch,
} from './chatSessionControlUtils';
import { stopAgentRunMessage } from './agentRunController';
import { resolveActiveChatPetId } from './multiPetChat';
import type { ActiveGroupRuntimeRef } from './group/runtime/activeGroupRuntimeRef';

interface UsePetChatSessionControlsOptions {
  activeGroupRuntimeRef: ActiveGroupRuntimeRef;
  activeChatRequestTokenRef: MutableRefObject<number>;
  configRef: MutableRefObject<PetConfig>;
  groupChatContinuationEnabledRef: MutableRefObject<boolean>;
  publishStatusMessage: (message: string) => void;
  stopPetSpeech: () => void;
  voiceInputSessionRef: MutableRefObject<VoiceInputSession | null>;
  voiceTranscriptRef: MutableRefObject<string>;
}

type StopGroupChatOptions = {
  immediate?: boolean;
  announce?: boolean;
  cancelActiveRequest?: boolean;
};

export function usePetChatSessionControls({
  activeChatRequestTokenRef,
  activeGroupRuntimeRef,
  configRef,
  groupChatContinuationEnabledRef,
  publishStatusMessage,
  stopPetSpeech,
  voiceInputSessionRef,
  voiceTranscriptRef,
}: UsePetChatSessionControlsOptions) {
  const stopAgentRun = useCallback((messageId?: string | null) => {
    const didStop = stopAgentRunMessage(messageId);
    const currentState = desktopPetChatStore.getState();
    const hasActiveStream = currentState.isTyping
      || currentState.isGroupChatRunning
      || Boolean(currentState.typingPetId);

    if (didStop || hasActiveStream) {
      groupChatContinuationEnabledRef.current = false;
      activeChatRequestTokenRef.current += 1;
      desktopPetChatStore.setGroupChatRunning(false);
      desktopPetChatStore.setTyping(false);
      desktopPetChatStore.setTypingPetId(null);
      stopPetSpeech();
    }

    publishStatusMessage(didStop
      ? '\u5df2\u7ec8\u6b62\u5f53\u524d Agent \u6267\u884c\u3002'
      : hasActiveStream
        ? '\u5df2\u505c\u6b62\u5f53\u524d\u56de\u590d\u3002'
        : '\u5f53\u524d\u6ca1\u6709\u6b63\u5728\u6267\u884c\u7684 Agent\u3002');
  }, [
    activeChatRequestTokenRef,
    groupChatContinuationEnabledRef,
    publishStatusMessage,
    stopPetSpeech,
  ]);

  const stopGroupChat = useCallback((options?: StopGroupChatOptions) => {
    const cancelActiveRequest = options?.cancelActiveRequest ?? true;

    groupChatContinuationEnabledRef.current = false;
    activeGroupRuntimeRef.cancel();
    desktopPetChatStore.resolveGroupUserAttention();
    desktopPetChatStore.setGroupChatRunning(false);

    if (cancelActiveRequest) {
      activeChatRequestTokenRef.current += 1;
      desktopPetChatStore.setTyping(false);
      desktopPetChatStore.setTypingPetId(null);
    }

    if (cancelActiveRequest && options?.immediate) {
      stopPetSpeech();
    }

    if (options?.announce) {
      publishStatusMessage(GROUP_CHAT_STOPPED_MESSAGE);
    }
  }, [
    activeGroupRuntimeRef,
    activeChatRequestTokenRef,
    groupChatContinuationEnabledRef,
    publishStatusMessage,
    stopPetSpeech,
  ]);

  const resetChatSession = useCallback((scope: PrivateChatResetScope) => {
    groupChatContinuationEnabledRef.current = false;
    activeChatRequestTokenRef.current += 1;
    voiceInputSessionRef.current?.stop();
    voiceInputSessionRef.current = null;
    voiceTranscriptRef.current = '';
    stopPetSpeech();
    desktopPetChatStore.setListening(false);
    desktopPetChatStore.resolveGroupUserAttention();
    desktopPetChatStore.setGroupChatRunning(false);
    desktopPetChatStore.setTyping(false);
    desktopPetChatStore.setTypingPetId(null);
    desktopPetChatStore.setInputValue('');
    const state = desktopPetChatStore.getState();
    desktopPetChatStore.replaceMessages(
      clearPrivateChatMessages(state.messages, state.activePetId, scope),
    );
    publishStatusMessage(getPrivateChatResetCompletedMessage(scope));
  }, [
    activeChatRequestTokenRef,
    groupChatContinuationEnabledRef,
    publishStatusMessage,
    stopPetSpeech,
    voiceInputSessionRef,
    voiceTranscriptRef,
  ]);

  const setChatMode = useCallback((mode: DesktopPetChatMode) => {
    // Navigation only changes the visible conversation. Active replies in
    // other modes keep running and continue publishing to their own scope.
    desktopPetChatStore.setChatMode(mode);
  }, []);

  const setGroupChatContinuationMode = useCallback((mode: DesktopPetGroupChatContinuationMode) => {
    desktopPetChatStore.setGroupChatContinuationMode(mode);
    groupChatContinuationEnabledRef.current = mode === 'infinite';

    if (mode !== 'infinite') {
      desktopPetChatStore.setGroupChatRunning(false);
    }
  }, [groupChatContinuationEnabledRef]);

  const setActivePetId = useCallback((petId: string) => {
    desktopPetChatStore.setActivePetId(resolveActiveChatPetId(configRef.current, petId));
  }, [configRef]);

  return {
    resetChatSession,
    setActivePetId,
    setChatMode,
    setGroupChatContinuationMode,
    stopAgentRun,
    stopGroupChat,
  };
}
