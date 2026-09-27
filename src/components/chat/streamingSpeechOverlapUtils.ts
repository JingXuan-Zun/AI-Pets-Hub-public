import {
  STREAM_TTS_CLOCKED_MIN_REMAINING_MS,
  STREAM_TTS_CLOCKED_OVERLAP_DURATION_RATE,
  STREAM_TTS_CLOCKED_OVERLAP_MAX_MS,
  STREAM_TTS_CLOCKED_OVERLAP_MIN_MS,
} from './streamingSpeechSegmentationConfig';

export function resolveClockedPlaybackOverlapMs(playbackDurationMs: number | null | undefined) {
  if (!Number.isFinite(playbackDurationMs) || Number(playbackDurationMs) <= 0) {
    return 0;
  }

  const durationMs = Math.round(Number(playbackDurationMs));
  const availableOverlapMs = Math.max(0, durationMs - STREAM_TTS_CLOCKED_MIN_REMAINING_MS);
  if (availableOverlapMs <= 0) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(
      STREAM_TTS_CLOCKED_OVERLAP_MAX_MS,
      availableOverlapMs,
      Math.max(
        STREAM_TTS_CLOCKED_OVERLAP_MIN_MS,
        Math.round(durationMs * STREAM_TTS_CLOCKED_OVERLAP_DURATION_RATE),
      ),
    ),
  );
}
