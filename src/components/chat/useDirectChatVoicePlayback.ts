import { useCallback, useEffect, type MutableRefObject } from 'react';
import { type PetConfig } from '../../types';
import {
  buildNextVoiceConfig,
} from './chatVoiceControlUtils';
import { useDirectVoiceTextPlayback } from './useDirectVoiceTextPlayback';
import { useReplyVoiceWarmup } from './useReplyVoiceWarmup';

interface UseDirectChatVoicePlaybackOptions {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: (config: PetConfig) => void;
  publishStatusMessage: (message: string) => void;
  replyVoiceWarmupActiveKeyRef: MutableRefObject<string>;
  replyVoiceWarmupReadyKeyRef: MutableRefObject<string>;
  stopQueuedVoicePlayback: () => void;
  voicePlaybackStopRef: MutableRefObject<(() => void) | null>;
  voicePlaybackTokenRef: MutableRefObject<number>;
}

export function useDirectChatVoicePlayback({
  configRef,
  onUpdateConfig,
  publishStatusMessage,
  replyVoiceWarmupActiveKeyRef,
  replyVoiceWarmupReadyKeyRef,
  stopQueuedVoicePlayback,
  voicePlaybackStopRef,
  voicePlaybackTokenRef,
}: UseDirectChatVoicePlaybackOptions) {
  const { clearReplyVoiceWarmup, warmLocalReplyVoice } = useReplyVoiceWarmup({
    replyVoiceWarmupActiveKeyRef,
    replyVoiceWarmupReadyKeyRef,
  });
  const {
    playVoiceText,
    stopDirectVoicePlayback,
  } = useDirectVoiceTextPlayback({
    configRef,
    publishStatusMessage,
    stopQueuedVoicePlayback,
    voicePlaybackStopRef,
    voicePlaybackTokenRef,
  });

  const stopPetSpeech = useCallback(() => {
    clearReplyVoiceWarmup();
    stopDirectVoicePlayback();
  }, [clearReplyVoiceWarmup, stopDirectVoicePlayback]);

  useEffect(() => () => {
    clearReplyVoiceWarmup();
    stopDirectVoicePlayback();
  }, [clearReplyVoiceWarmup, stopDirectVoicePlayback]);

  const toggleVoiceEnabled = useCallback(() => {
    const nextConfig = buildNextVoiceConfig(configRef.current);
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig);

    if (!nextConfig.settings.voiceEnabled) {
      stopPetSpeech();
    }
  }, [configRef, onUpdateConfig, stopPetSpeech]);

  const getPlaybackToken = useCallback(() => voicePlaybackTokenRef.current, [voicePlaybackTokenRef]);

  return {
    getPlaybackToken,
    playVoiceText,
    stopPetSpeech,
    toggleVoiceEnabled,
    warmLocalReplyVoice,
  };
}
