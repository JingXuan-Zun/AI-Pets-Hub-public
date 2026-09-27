import {
  buildReadySpeechSegmentOptions,
  STREAM_TTS_BREAK_FOLLOWERS,
  STREAM_TTS_DEFAULT_SOFT_BREAK_MIN_LENGTH,
  STREAM_TTS_REPEATABLE_BREAKS,
  STREAM_TTS_SEGMENT_MINIMUM_LENGTH,
  STREAM_TTS_SOFT_BREAKS,
  STREAM_TTS_STRONG_BREAKS,
} from './streamingSpeechSegmentationConfig';
import { type ReadySpeechSegmentOptions } from './streamingSpeechSegmentationTypes';

function normalizeSpeechSegment(text: string) {
  return text
    .replace(/\s*\n+\s*/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .trim();
}

function expandSpeechBreakBoundary(text: string, splitIndex: number) {
  let nextIndex = splitIndex;

  while (nextIndex < text.length) {
    const currentChar = text[nextIndex];

    if (
      /\s/u.test(currentChar)
      || STREAM_TTS_BREAK_FOLLOWERS.has(currentChar)
      || STREAM_TTS_REPEATABLE_BREAKS.has(currentChar)
    ) {
      nextIndex += 1;
      continue;
    }

    break;
  }

  return nextIndex;
}

function findBreakIndexes(text: string) {
  let strongBreakIndex = -1;
  let softBreakIndex = -1;

  for (let index = 0; index < text.length; index += 1) {
    const currentChar = text[index];
    if (STREAM_TTS_STRONG_BREAKS.has(currentChar)) {
      strongBreakIndex = expandSpeechBreakBoundary(text, index + 1);
      break;
    }

    if (STREAM_TTS_SOFT_BREAKS.has(currentChar)) {
      softBreakIndex = expandSpeechBreakBoundary(text, index + 1);
    }
  }

  return {
    softBreakIndex,
    strongBreakIndex,
  };
}

function findFallbackSplitIndex(text: string, softLimit: number) {
  const limit = Math.min(text.length, softLimit);

  for (let index = limit - 1; index >= STREAM_TTS_SEGMENT_MINIMUM_LENGTH; index -= 1) {
    const currentChar = text[index];
    if (STREAM_TTS_SOFT_BREAKS.has(currentChar) || /\s/u.test(currentChar)) {
      return expandSpeechBreakBoundary(text, index + 1);
    }
  }

  return limit;
}

function resolveSplitIndex(
  remaining: string,
  options: ReturnType<typeof buildReadySpeechSegmentOptions>,
  breakIndexes: ReturnType<typeof findBreakIndexes>,
) {
  const {
    allowSoftBreaks,
    flushAll,
    hardLimit,
    softBreakMinLength,
    softLimit,
    strongBreakMinLength,
  } = options;
  const { strongBreakIndex, softBreakIndex } = breakIndexes;

  if (strongBreakIndex >= strongBreakMinLength) {
    return strongBreakIndex;
  }

  if (allowSoftBreaks && softBreakIndex >= softBreakMinLength && softBreakIndex === remaining.length) {
    return softBreakIndex;
  }

  if (!allowSoftBreaks && flushAll && softBreakIndex >= softBreakMinLength && softBreakIndex === remaining.length) {
    return softBreakIndex;
  }

  if (flushAll) {
    return strongBreakIndex > 0
      ? strongBreakIndex
      : softBreakIndex > 0
        ? softBreakIndex
        : remaining.length;
  }

  if (remaining.length < softLimit) {
    return -1;
  }

  const softBreakIsReady = allowSoftBreaks
    && softBreakIndex >= softBreakMinLength
    && softBreakIndex >= Math.floor(softLimit * 0.85);

  if (softBreakIsReady) {
    return softBreakIndex;
  }

  if (remaining.length < hardLimit) {
    return -1;
  }

  return allowSoftBreaks && softBreakIndex >= STREAM_TTS_SEGMENT_MINIMUM_LENGTH
    ? softBreakIndex
    : findFallbackSplitIndex(remaining, hardLimit);
}

export function extractReadySpeechSegments(buffer: string, options: ReadySpeechSegmentOptions = {}) {
  const resolvedOptions = buildReadySpeechSegmentOptions(options);
  const segments: string[] = [];
  let remaining = buffer;

  while (remaining.trim()) {
    const splitIndex = resolveSplitIndex(remaining, resolvedOptions, findBreakIndexes(remaining));
    if (splitIndex < 0) {
      break;
    }

    const segment = normalizeSpeechSegment(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex);

    if (segment) {
      segments.push(segment);
    }
  }

  return {
    remaining,
    segments,
  };
}

export { STREAM_TTS_DEFAULT_SOFT_BREAK_MIN_LENGTH };
