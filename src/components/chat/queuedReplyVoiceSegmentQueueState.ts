import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { isVoiceCancellationError } from '../../voice/errorMessages';
import { buildVoicePlaybackFailedMessage } from './chatVoiceControlUtils';
import { finalizeQueuedReplySegmentCount } from './queuedReplyVoicePlaybackState';
import { type EnqueueQueuedReplyVoiceSegmentOptions } from './queuedReplyVoiceSegmentQueueTypes';

export const QUEUED_REPLY_VOICE_PREPARATION_CANCELLED = 'queued_reply_voice_preparation_cancelled';

export function isQueuedReplyVoicePreparationCancellationError(error: unknown) {
  return error instanceof Error && error.message === QUEUED_REPLY_VOICE_PREPARATION_CANCELLED;
}

interface HandleQueuedReplyVoiceSegmentFailureOptions extends Pick<
  EnqueueQueuedReplyVoiceSegmentOptions,
  'configRef'
  | 'playbackToken'
  | 'publishStatusMessage'
  | 'queuedVoicePlaybackSessionsRef'
  | 'queuedVoiceSegmentCountRef'
  | 'voicePlaybackTokenRef'
> {
  didFinalizeSegmentCount: boolean;
  error: unknown;
  segmentText: string;
}

export function beginQueuedReplyVoiceSegment(
  targetPetId: string | null,
  queuedVoiceSegmentCountRef: EnqueueQueuedReplyVoiceSegmentOptions['queuedVoiceSegmentCountRef'],
) {
  queuedVoiceSegmentCountRef.current += 1;
  desktopPetChatStore.setSpeaking(true);
  desktopPetChatStore.setSpeakingPetId(targetPetId);
  return queuedVoiceSegmentCountRef.current;
}

export function handleQueuedReplyVoiceSegmentFailure({
  configRef,
  didFinalizeSegmentCount,
  error,
  playbackToken,
  publishStatusMessage,
  queuedVoicePlaybackSessionsRef,
  queuedVoiceSegmentCountRef,
  segmentText,
  voicePlaybackTokenRef,
}: HandleQueuedReplyVoiceSegmentFailureOptions) {
  if (!didFinalizeSegmentCount) {
    finalizeQueuedReplySegmentCount(queuedVoiceSegmentCountRef);
  }

  if (
    isVoiceCancellationError(error)
    || isQueuedReplyVoicePreparationCancellationError(error)
    || playbackToken !== voicePlaybackTokenRef.current
  ) {
    pushFrontendRuntimeLog('voice', 'streaming voice segment cancelled', {
      textLength: segmentText.length,
    });
  } else {
    pushFrontendRuntimeError('voice', 'streaming voice segment playback failed', error, {
      provider: configRef.current.settings.ttsProvider,
      textLength: segmentText.length,
    });
    console.error('Streaming voice playback failed:', error);
    publishStatusMessage(buildVoicePlaybackFailedMessage(error));
  }

  if (
    playbackToken === voicePlaybackTokenRef.current
    && queuedVoicePlaybackSessionsRef.current.size === 0
    && queuedVoiceSegmentCountRef.current === 0
  ) {
    desktopPetChatStore.setSpeaking(false);
    const speakingPetId = desktopPetChatStore.getState().speakingPetId;
    desktopPetChatStore.setSpeakingPetId(null);
    desktopPetChatStore.setSpeechExpressionAction(speakingPetId, null);
  }
}
