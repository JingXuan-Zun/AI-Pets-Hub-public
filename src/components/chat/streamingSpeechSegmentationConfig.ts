import {
  type ReadySpeechSegmentOptions,
  type StreamingSpeechSegmentationProfile,
} from './streamingSpeechSegmentationTypes';

const STREAM_TTS_FIRST_SEGMENT_SOFT_LIMIT = 10;
const STREAM_TTS_FIRST_SEGMENT_HARD_LIMIT = 16;
const STREAM_TTS_CATCHUP_SEGMENT_SOFT_LIMIT = 54;
const STREAM_TTS_CATCHUP_SEGMENT_HARD_LIMIT = 64;
const STREAM_TTS_BACKLOG_SEGMENT_SOFT_LIMIT = 48;
const STREAM_TTS_BACKLOG_SEGMENT_HARD_LIMIT = 64;
const STREAM_TTS_STABLE_FIRST_SEGMENT_SOFT_LIMIT = 88;
const STREAM_TTS_STABLE_FIRST_SEGMENT_HARD_LIMIT = 120;
const STREAM_TTS_STABLE_CATCHUP_SEGMENT_SOFT_LIMIT = 144;
const STREAM_TTS_STABLE_CATCHUP_SEGMENT_HARD_LIMIT = 196;
const STREAM_TTS_STABLE_BACKLOG_SEGMENT_SOFT_LIMIT = 136;
const STREAM_TTS_STABLE_BACKLOG_SEGMENT_HARD_LIMIT = 184;
const STREAM_TTS_SEGMENT_MIN_LENGTH = 8;
const STREAM_TTS_FIRST_SEGMENT_STRONG_BREAK_MIN_LENGTH = 4;
const STREAM_TTS_CATCHUP_SEGMENT_STRONG_BREAK_MIN_LENGTH = 22;
const STREAM_TTS_BACKLOG_SEGMENT_STRONG_BREAK_MIN_LENGTH = 20;
const STREAM_TTS_STABLE_FIRST_SEGMENT_STRONG_BREAK_MIN_LENGTH = 56;
const STREAM_TTS_STABLE_CATCHUP_SEGMENT_STRONG_BREAK_MIN_LENGTH = 72;
const STREAM_TTS_STABLE_BACKLOG_SEGMENT_STRONG_BREAK_MIN_LENGTH = 64;
const STREAM_TTS_VOICE_TONE_STABILITY_MAX = 100;

export const STREAM_TTS_CLOCKED_OVERLAP_MIN_MS = 10;
export const STREAM_TTS_CLOCKED_OVERLAP_MAX_MS = 32;
export const STREAM_TTS_CLOCKED_OVERLAP_DURATION_RATE = 0.03;
export const STREAM_TTS_CLOCKED_MIN_REMAINING_MS = 90;
export const STREAM_TTS_SEGMENT_MINIMUM_LENGTH = STREAM_TTS_SEGMENT_MIN_LENGTH;
export const STREAM_TTS_DEFAULT_SOFT_BREAK_MIN_LENGTH = STREAM_TTS_FIRST_SEGMENT_STRONG_BREAK_MIN_LENGTH;

export const STREAM_TTS_STRONG_BREAKS = new Set(['。', '！', '？', '!', '?', ';', '；', '\n']);
export const STREAM_TTS_SOFT_BREAKS = new Set(['，', ',', '。', '；', ':', '：']);
export const STREAM_TTS_BREAK_FOLLOWERS = new Set(['”', '"', '’', '\'', '）', ')', '】', ']', '》', '」']);
export const STREAM_TTS_REPEATABLE_BREAKS = new Set(['。', '！', '？', '!', '?', ';', '；', '，', ',', ':', '：', '”', '’', '~']);

export function buildReadySpeechSegmentOptions(options: ReadySpeechSegmentOptions = {}) {
  const {
    flushAll = false,
    softLimit = STREAM_TTS_BACKLOG_SEGMENT_SOFT_LIMIT,
    hardLimit = Math.max(softLimit, Math.floor(softLimit * 1.35)),
    strongBreakMinLength = Math.max(
      STREAM_TTS_SEGMENT_MIN_LENGTH,
      Math.floor(softLimit * 0.75),
    ),
    softBreakMinLength = Math.max(
      STREAM_TTS_FIRST_SEGMENT_STRONG_BREAK_MIN_LENGTH,
      Math.floor(softLimit * 0.5),
    ),
    allowSoftBreaks = true,
  } = options;

  return {
    allowSoftBreaks,
    flushAll,
    hardLimit,
    softBreakMinLength,
    softLimit,
    strongBreakMinLength,
  };
}

function clampVoiceToneStability(value: unknown) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.min(STREAM_TTS_VOICE_TONE_STABILITY_MAX, Math.max(0, Math.round(numericValue)));
}

function interpolateSegmentValue(baseValue: number, stableValue: number, stabilityRate: number) {
  return Math.round(baseValue + ((stableValue - baseValue) * stabilityRate));
}

function buildStableAwareStreamingLimit(
  baseValue: number,
  stableValue: number,
  stabilityRate: number,
) {
  return interpolateSegmentValue(baseValue, stableValue, stabilityRate);
}

export function resolveStreamingSpeechSegmentation(
  hasQueuedSpeechSegment: boolean,
  queuedSegmentCount: number,
  profile: StreamingSpeechSegmentationProfile = {},
) {
  const stabilityRate = clampVoiceToneStability(profile.voiceToneStability) / STREAM_TTS_VOICE_TONE_STABILITY_MAX;

  if (!hasQueuedSpeechSegment) {
    const softLimit = buildStableAwareStreamingLimit(
      STREAM_TTS_FIRST_SEGMENT_SOFT_LIMIT,
      STREAM_TTS_STABLE_FIRST_SEGMENT_SOFT_LIMIT,
      stabilityRate,
    );
    const hardLimit = buildStableAwareStreamingLimit(
      STREAM_TTS_FIRST_SEGMENT_HARD_LIMIT,
      STREAM_TTS_STABLE_FIRST_SEGMENT_HARD_LIMIT,
      stabilityRate,
    );
    const strongBreakMinLength = buildStableAwareStreamingLimit(
      STREAM_TTS_FIRST_SEGMENT_STRONG_BREAK_MIN_LENGTH,
      STREAM_TTS_STABLE_FIRST_SEGMENT_STRONG_BREAK_MIN_LENGTH,
      stabilityRate,
    );

    return {
      allowSoftBreaks: stabilityRate < 0.85,
      hardLimit,
      softBreakMinLength: strongBreakMinLength,
      softLimit,
      strongBreakMinLength,
    };
  }

  if (queuedSegmentCount <= 1) {
    const softLimit = buildStableAwareStreamingLimit(
      STREAM_TTS_CATCHUP_SEGMENT_SOFT_LIMIT,
      STREAM_TTS_STABLE_CATCHUP_SEGMENT_SOFT_LIMIT,
      stabilityRate,
    );
    const hardLimit = buildStableAwareStreamingLimit(
      STREAM_TTS_CATCHUP_SEGMENT_HARD_LIMIT,
      STREAM_TTS_STABLE_CATCHUP_SEGMENT_HARD_LIMIT,
      stabilityRate,
    );
    const strongBreakMinLength = buildStableAwareStreamingLimit(
      STREAM_TTS_CATCHUP_SEGMENT_STRONG_BREAK_MIN_LENGTH,
      STREAM_TTS_STABLE_CATCHUP_SEGMENT_STRONG_BREAK_MIN_LENGTH,
      stabilityRate,
    );

    return {
      allowSoftBreaks: false,
      hardLimit,
      softBreakMinLength: strongBreakMinLength,
      softLimit,
      strongBreakMinLength,
    };
  }

  const softLimit = buildStableAwareStreamingLimit(
    STREAM_TTS_BACKLOG_SEGMENT_SOFT_LIMIT,
    STREAM_TTS_STABLE_BACKLOG_SEGMENT_SOFT_LIMIT,
    stabilityRate,
  );
  const hardLimit = buildStableAwareStreamingLimit(
    STREAM_TTS_BACKLOG_SEGMENT_HARD_LIMIT,
    STREAM_TTS_STABLE_BACKLOG_SEGMENT_HARD_LIMIT,
    stabilityRate,
  );
  const strongBreakMinLength = buildStableAwareStreamingLimit(
    STREAM_TTS_BACKLOG_SEGMENT_STRONG_BREAK_MIN_LENGTH,
    STREAM_TTS_STABLE_BACKLOG_SEGMENT_STRONG_BREAK_MIN_LENGTH,
    stabilityRate,
  );

  return {
    allowSoftBreaks: stabilityRate < 0.85,
    hardLimit,
    softBreakMinLength: strongBreakMinLength,
    softLimit,
    strongBreakMinLength,
  };
}
