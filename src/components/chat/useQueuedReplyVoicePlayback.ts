import { useCallback, type MutableRefObject } from 'react';
import { type PetConfig } from '../../types';
import { stopQueuedReplyVoicePlayback } from './queuedReplyVoicePlaybackState';
import { type QueuedReplyVoicePlaybackRefs } from './queuedReplyVoicePlaybackTypes';
import { enqueueQueuedReplyVoiceSegment } from './queuedReplyVoiceSegmentQueue';
import { extractQueuedReplyStreamingSpeech, resolveReplySpeechSegmentationProfile } from './queuedReplyStreamingSpeechUtils';

interface UseQueuedReplyVoicePlaybackOptions extends QueuedReplyVoicePlaybackRefs {
  configRef: MutableRefObject<PetConfig>;
  publishStatusMessage: (message: string) => void;
}

export function useQueuedReplyVoicePlayback({
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
}: UseQueuedReplyVoicePlaybackOptions) {
  const stopQueuedVoicePlayback = useCallback(() => {
    stopQueuedReplyVoicePlayback({
      queuedVoicePlaybackCursorRef,
      queuedVoicePlaybackSessionsRef,
      queuedVoicePreparationActiveCountRef,
      queuedVoicePreparationEpochRef,
      queuedVoicePreparationWaitersRef,
      queuedVoicePlaybackTaskRef,
      queuedVoiceSegmentCountRef,
    });
  }, [
    queuedVoicePlaybackCursorRef,
    queuedVoicePlaybackSessionsRef,
    queuedVoicePreparationActiveCountRef,
    queuedVoicePreparationEpochRef,
    queuedVoicePreparationWaitersRef,
    queuedVoicePlaybackTaskRef,
    queuedVoiceSegmentCountRef,
  ]);

  const enqueueReplyVoiceSegment = useCallback((text: string, playbackToken: number, targetPetId: string | null) => {
    enqueueQueuedReplyVoiceSegment({
      configRef,
      playbackToken,
      publishStatusMessage,
      queuedVoicePlaybackCursorRef,
      queuedVoicePlaybackSessionsRef,
      queuedVoicePreparationActiveCountRef,
      queuedVoicePreparationEpochRef,
      queuedVoicePreparationWaitersRef,
      queuedVoicePlaybackTaskRef,
      queuedVoiceSegmentCountRef,
      targetPetId,
      text,
      voicePlaybackTokenRef,
    });
  }, [
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
  ]);

  const extractStreamingSpeech = useCallback((buffer: string, hasQueuedSpeechSegment: boolean) => {
    const profile = resolveReplySpeechSegmentationProfile(configRef.current.settings);

    return extractQueuedReplyStreamingSpeech(
      buffer,
      hasQueuedSpeechSegment,
      queuedVoiceSegmentCountRef.current,
      profile,
    );
  }, [configRef, queuedVoiceSegmentCountRef]);

  return {
    enqueueReplyVoiceSegment,
    extractStreamingSpeech,
    stopQueuedVoicePlayback,
  };
}
