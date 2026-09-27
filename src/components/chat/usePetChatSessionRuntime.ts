import { useEffect, useRef } from 'react';
import { desktopPetChatStore } from '../../chatStore';
import { type PetConfig } from '../../types';
import { type VoiceInputSession } from '../../voice/types';
import { resolveActiveChatPetId } from './multiPetChat';
import { ActiveGroupRuntimeRef } from './group/runtime/activeGroupRuntimeRef';

interface UsePetChatSessionRuntimeOptions {
  config: PetConfig;
}

export function usePetChatSessionRuntime({
  config,
}: UsePetChatSessionRuntimeOptions) {
  const configRef = useRef(config);
  const voiceInputSessionRef = useRef<VoiceInputSession | null>(null);
  const voiceTranscriptRef = useRef('');
  const activeChatRequestTokenRef = useRef(0);
  const groupChatContinuationEnabledRef = useRef(false);
  const activeGroupRuntimeRef = useRef(new ActiveGroupRuntimeRef()).current;

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const nextActivePetId = resolveActiveChatPetId(
      config,
      desktopPetChatStore.getState().activePetId,
    );

    if (nextActivePetId !== desktopPetChatStore.getState().activePetId) {
      desktopPetChatStore.setActivePetId(nextActivePetId);
    }
  }, [config]);

  useEffect(() => () => {
    voiceInputSessionRef.current?.stop();
    voiceInputSessionRef.current = null;
    activeChatRequestTokenRef.current += 1;
    groupChatContinuationEnabledRef.current = false;
    activeGroupRuntimeRef.cancel();
  }, []);

  return {
    activeChatRequestTokenRef,
    configRef,
    groupChatContinuationEnabledRef,
    activeGroupRuntimeRef,
    voiceInputSessionRef,
    voiceTranscriptRef,
  };
}
