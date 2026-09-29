import { useRef, type MutableRefObject } from 'react';
import { type PetConfig } from '../../types';
import { type VoicePlaybackSession } from '../../voice/types';
import { useDirectChatVoicePlayback } from './useDirectChatVoicePlayback';
import { type QueuedVoicePreparationWaiter } from './queuedReplyVoicePlaybackTypes';
import { useQueuedReplyVoicePlayback } from './useQueuedReplyVoicePlayback';

interface UsePetChatVoicePlaybackOptions {
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: (config: PetConfig) => void;
  publishStatusMessage: (message: string) => void;
}

export function usePetChatVoicePlayback({
  configRef,
  onUpdateConfig,
  publishStatusMessage,
}: UsePetChatVoicePlaybackOptions) {
  const voicePlaybackStopRef = useRef<(() => void) | null>(null);
  const queuedVoicePlaybackSessionsRef = useRef<Set<VoicePlaybackSession>>(new Set());
  const queuedVoicePlaybackCursorRef = useRef<number | null>(null);
  const queuedVoicePreparationActiveCountRef = useRef(0);
  const queuedVoicePreparationEpochRef = useRef(0);
  const queuedVoicePreparationWaitersRef = useRef<QueuedVoicePreparationWaiter[]>([]);
  const queuedVoicePlaybackTaskRef = useRef<Promise<void>>(Promise.resolve());
  const queuedVoiceSegmentCountRef = useRef(0);
  const voicePlaybackTokenRef = useRef(0);
  const replyVoiceWarmupActiveKeyRef = useRef('');
  const replyVoiceWarmupReadyKeyRef = useRef('');

  const {
    enqueueReplyVoiceSegment,
    extractStreamingSpeech,
    stopQueuedVoicePlayback,
  } = useQueuedReplyVoicePlayback({
    configRef,
    publishStatusMessage,
    queuedVoicePlaybackCursorRef,
    queuedVoicePlaybackSessionsRef,
    queuedVoicePreparationActiveCountRef,
    queuedVoicePreparationEpochRef,
    queuedVoicePreparationWaitersRef,
    queuedVoicePlaybackTaskRef,
    queuedVoiceSegmentCountRef,
    voicePlaybackTokenRef,
  });

  const {
    getPlaybackToken,
    playVoiceText,
    stopPetSpeech,
    toggleVoiceEnabled,
    warmLocalReplyVoice,
  } = useDirectChatVoicePlayback({
    configRef,
    onUpdateConfig,
    publishStatusMessage,
    replyVoiceWarmupActiveKeyRef,
    replyVoiceWarmupReadyKeyRef,
    stopQueuedVoicePlayback,
    voicePlaybackStopRef,
    voicePlaybackTokenRef,
  });

  return {
    enqueueReplyVoiceSegment,
    extractStreamingSpeech,
    getPlaybackToken,
    playVoiceText,
    stopPetSpeech,
    toggleVoiceEnabled,
    warmLocalReplyVoice,
  };
}
