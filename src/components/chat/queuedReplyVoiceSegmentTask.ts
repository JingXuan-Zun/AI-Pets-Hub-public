import { desktopPetChatStore } from '../../chatStore';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { prepareIndependentVoicePlayback } from '../../services/voiceService';
import { type PetConfig } from '../../types';
import { type PreparedVoicePlayback } from '../../voice/types';
import { finalizeQueuedReplySegmentCount } from './queuedReplyVoicePlaybackState';
import { handleQueuedReplyVoiceSegmentFailure } from './queuedReplyVoiceSegmentQueueState';
import { resolveClockedPlaybackOverlapMs } from './streamingSpeechSegmentationUtils';
import { type EnqueueQueuedReplyVoiceSegmentOptions } from './queuedReplyVoiceSegmentQueueTypes';
import { resolvePetMessageExpressionAction } from '../../pet-runtime/interactions/petMessageExpressionSignals';
import { registerReplyMouthPlayback } from '../../pet-runtime/performance/replyMouthSignalRuntime';
import { resolvePetVoiceSettings } from '../../voice/petVoiceSettings';

type PreparedQueuedReplyVoiceSegment = {
  playback: PreparedVoicePlayback;
  prepareElapsedMs: number;
  provider: PetConfig['settings']['ttsProvider'];
};

let queuedMouthPlaybackSourceSerial = 0;
const SEGMENT_END_MARGIN_MS = 15_000;
const SEGMENT_END_FALLBACK_MS = 90_000;

function getNowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

interface RunQueuedReplyVoiceSegmentTaskOptions extends Pick<
  EnqueueQueuedReplyVoiceSegmentOptions,
  'configRef'
  | 'playbackToken'
  | 'publishStatusMessage'
  | 'queuedVoicePlaybackCursorRef'
  | 'queuedVoicePlaybackSessionsRef'
  | 'queuedVoiceSegmentCountRef'
  | 'voicePlaybackTokenRef'
> {
  preparedPlaybackPromise: Promise<PreparedQueuedReplyVoiceSegment>;
  queueDepth: number;
  segmentText: string;
  targetPetId: string | null;
}

export async function prepareQueuedReplyVoiceSegmentTask({
  configRef,
  segmentText,
  targetPetId,
}: Pick<RunQueuedReplyVoiceSegmentTaskOptions, 'configRef' | 'segmentText' | 'targetPetId'>): Promise<PreparedQueuedReplyVoiceSegment> {
  const settings = resolvePetVoiceSettings(configRef.current, targetPetId);
  const startedAt = getNowMs();

  return {
    playback: await prepareIndependentVoicePlayback(segmentText, settings, {
      expressionAction: resolvePetMessageExpressionAction(segmentText),
    }),
    prepareElapsedMs: Math.round(getNowMs() - startedAt),
    provider: settings.ttsProvider,
  };
}

export async function runQueuedReplyVoiceSegmentTask({
  configRef,
  playbackToken,
  preparedPlaybackPromise,
  publishStatusMessage,
  queueDepth,
  queuedVoicePlaybackCursorRef,
  queuedVoicePlaybackSessionsRef,
  queuedVoiceSegmentCountRef,
  segmentText,
  targetPetId,
  voicePlaybackTokenRef,
}: RunQueuedReplyVoiceSegmentTaskOptions) {
  let didFinalizeSegmentCount = false;
  let unregisterMouthPlayback = () => undefined;

  try {
    if (playbackToken !== voicePlaybackTokenRef.current) {
      // The reply was cancelled (stop, cleared chat) before this sentence's turn. Its audio is
      // still being prepared and counts as voice output until disposed; skipping it without
      // disposing kept the hands-free microphone on "稍等，马上继续听" for two minutes.
      void preparedPlaybackPromise.then((segment) => segment.playback.dispose(), () => undefined);
      finalizeQueuedReplySegmentCount(queuedVoiceSegmentCountRef);
      didFinalizeSegmentCount = true;
      return;
    }

    const preparedSegment = await preparedPlaybackPromise;
    const preparedPlayback = preparedSegment.playback;
    if (playbackToken !== voicePlaybackTokenRef.current) {
      preparedPlayback.dispose();
      finalizeQueuedReplySegmentCount(queuedVoiceSegmentCountRef);
      didFinalizeSegmentCount = true;
      return;
    }

    const scheduledCursor = preparedPlayback.supportsGaplessScheduling
      && typeof queuedVoicePlaybackCursorRef.current === 'number'
      ? queuedVoicePlaybackCursorRef.current
      : null;
    const playback = scheduledCursor === null
      ? preparedPlayback.play()
      : preparedPlayback.play({ startAtTime: scheduledCursor });
    unregisterMouthPlayback = registerReplyMouthPlayback({
      petId: targetPetId,
      playback,
      sourceId: `queued:${playbackToken}:${++queuedMouthPlaybackSourceSerial}`,
      text: segmentText,
    });
    desktopPetChatStore.setSpeechExpressionAction(
      targetPetId,
      resolvePetMessageExpressionAction(segmentText),
    );
    const overlapMs = resolveClockedPlaybackOverlapMs(preparedPlayback.durationMs);
    const scheduleSlipMs = scheduledCursor !== null && typeof playback.scheduledStartTime === 'number'
      ? Math.round((playback.scheduledStartTime - scheduledCursor) * 1000)
      : null;

    queuedVoicePlaybackSessionsRef.current.add(playback);
    queuedVoicePlaybackCursorRef.current = typeof playback.scheduledEndTime === 'number'
      ? Math.max(
        typeof playback.scheduledStartTime === 'number'
          ? playback.scheduledStartTime
          : playback.scheduledEndTime,
        playback.scheduledEndTime - (overlapMs / 1000),
      )
      : null;

    pushFrontendRuntimeLog('voice', 'streaming voice segment scheduled', {
      provider: preparedSegment.provider,
      textLength: segmentText.length,
      queueDepth,
      scheduler: playback.scheduler ?? 'immediate',
      durationMs: preparedPlayback.durationMs ?? null,
      overlapMs,
      prepareElapsedMs: preparedSegment.prepareElapsedMs,
      scheduleSlipMs,
    });

    try {
      if (playbackToken !== voicePlaybackTokenRef.current) {
        playback.stop();
        return;
      }

      // A segment whose end never arrives (a scheduled gapless playback that was cut short)
      // held every later segment and left her "speaking" for good, which also kept the
      // hands-free microphone shut. Each segment waits at most its own length plus a margin.
      const limitMs = typeof preparedPlayback.durationMs === 'number' && preparedPlayback.durationMs > 0
        ? preparedPlayback.durationMs + SEGMENT_END_MARGIN_MS
        : SEGMENT_END_FALLBACK_MS;
      let limitTimer: ReturnType<typeof setTimeout> | null = null;
      const timedOut = await Promise.race([
        playback.done.then(() => false, () => false),
        new Promise<boolean>((resolve) => { limitTimer = setTimeout(() => resolve(true), limitMs); }),
      ]);
      if (limitTimer) clearTimeout(limitTimer);
      if (timedOut) {
        pushFrontendRuntimeLog('voice', 'streaming voice segment never reported its end; moving on', { limitMs, textLength: segmentText.length });
        playback.stop();
      }
    } finally {
      queuedVoicePlaybackSessionsRef.current.delete(playback);
      preparedPlayback.dispose();
      finalizeQueuedReplySegmentCount(queuedVoiceSegmentCountRef);
      didFinalizeSegmentCount = true;

      if (
        playbackToken === voicePlaybackTokenRef.current
        && queuedVoicePlaybackSessionsRef.current.size === 0
        && queuedVoiceSegmentCountRef.current === 0
      ) {
        desktopPetChatStore.setSpeaking(false);
        desktopPetChatStore.setSpeakingPetId(null);
        desktopPetChatStore.setSpeechExpressionAction(targetPetId, null);
      }
    }
  } catch (error) {
    handleQueuedReplyVoiceSegmentFailure({
      configRef,
      didFinalizeSegmentCount,
      error,
      playbackToken,
      publishStatusMessage,
      queuedVoicePlaybackSessionsRef,
      queuedVoiceSegmentCountRef,
      segmentText,
      voicePlaybackTokenRef,
    });
  } finally {
    unregisterMouthPlayback();
  }
}
