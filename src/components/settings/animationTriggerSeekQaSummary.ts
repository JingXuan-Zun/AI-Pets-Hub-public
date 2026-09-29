import { parseRuntimeLogNumberField, parseRuntimeLogStringField } from './runtimeLogFieldParser';

export type AnimationTriggerSeekQaOutcome = 'applied' | 'empty' | 'unavailable';

export interface AnimationTriggerSeekQaSample {
  controlToken: number;
  firstDelayMs: number;
  lastDelayMs: number;
  line: string;
  originalItemCount: number;
  outcome: AnimationTriggerSeekQaOutcome;
  reason: string;
  remainingItemCount: number;
  replayToken: number;
  seekPositionMs: number;
}

export interface AnimationTriggerSeekQaSummary {
  appliedCount: number;
  emptyCount: number;
  latestSample: AnimationTriggerSeekQaSample | null;
  recentSamples: AnimationTriggerSeekQaSample[];
  sampleCount: number;
  unavailableCount: number;
}

const SEEK_LOG_PATTERN = /skill animation schedule seek\s+(applied|empty|unavailable)/iu;
const EMPTY_SEEK_QA_SUMMARY: AnimationTriggerSeekQaSummary = {
  appliedCount: 0,
  emptyCount: 0,
  latestSample: null,
  recentSamples: [],
  sampleCount: 0,
  unavailableCount: 0,
};

function countOutcome(samples: AnimationTriggerSeekQaSample[], outcome: AnimationTriggerSeekQaOutcome) {
  return samples.filter((sample) => sample.outcome === outcome).length;
}

export function parseAnimationTriggerSeekQaSample(line: string): AnimationTriggerSeekQaSample | null {
  const outcome = SEEK_LOG_PATTERN.exec(line)?.[1] as AnimationTriggerSeekQaOutcome | undefined;
  if (!outcome) {
    return null;
  }

  return {
    controlToken: parseRuntimeLogNumberField(line, 'controlToken'),
    firstDelayMs: parseRuntimeLogNumberField(line, 'firstDelayMs'),
    lastDelayMs: parseRuntimeLogNumberField(line, 'lastDelayMs'),
    line,
    originalItemCount: parseRuntimeLogNumberField(line, 'originalItemCount'),
    outcome,
    reason: parseRuntimeLogStringField(line, 'reason') || 'unknown',
    remainingItemCount: parseRuntimeLogNumberField(line, 'remainingItemCount'),
    replayToken: parseRuntimeLogNumberField(line, 'replayToken'),
    seekPositionMs: parseRuntimeLogNumberField(line, 'seekPositionMs'),
  };
}

export function createAnimationTriggerSeekQaSummary(
  logs: string[],
  recentLimit = 3,
): AnimationTriggerSeekQaSummary {
  const samples = logs
    .map((line) => parseAnimationTriggerSeekQaSample(line))
    .filter((sample): sample is AnimationTriggerSeekQaSample => Boolean(sample));
  if (samples.length === 0) {
    return EMPTY_SEEK_QA_SUMMARY;
  }

  return {
    appliedCount: countOutcome(samples, 'applied'),
    emptyCount: countOutcome(samples, 'empty'),
    latestSample: samples[0] ?? null,
    recentSamples: samples.slice(0, Math.max(1, recentLimit)),
    sampleCount: samples.length,
    unavailableCount: countOutcome(samples, 'unavailable'),
  };
}
