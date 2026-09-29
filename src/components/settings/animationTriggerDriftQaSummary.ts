import { type AnimationTriggerDriftSeverity } from '../pet/animationTriggerDriftMeasurement';
import { parseRuntimeLogNumberField, parseRuntimeLogStringField } from './runtimeLogFieldParser';

export interface AnimationTriggerDriftQaSample {
  absoluteDriftMs: number;
  batchSize: number;
  driftMs: number;
  line: string;
  plannedDelayMs: number;
  scheduler: string;
  severity: AnimationTriggerDriftSeverity;
  token: number;
}

export interface AnimationTriggerDriftQaTokenGroup {
  averageAbsoluteDriftMs: number;
  maxAbsoluteDriftMs: number;
  sampleCount: number;
  scheduler: string;
  token: number;
  warnCount: number;
}

export interface AnimationTriggerDriftQaSummary {
  averageAbsoluteDriftMs: number;
  latestSample: AnimationTriggerDriftQaSample | null;
  maxAbsoluteDriftMs: number;
  okCount: number;
  noticeCount: number;
  recentSamples: AnimationTriggerDriftQaSample[];
  sampleCount: number;
  tokenGroups: AnimationTriggerDriftQaTokenGroup[];
  tokenCount: number;
  warnCount: number;
}

const DRIFT_LOG_PATTERN = /skill animation schedule drift\s+(ok|notice|warn)/iu;
const EMPTY_DRIFT_QA_SUMMARY: AnimationTriggerDriftQaSummary = {
  averageAbsoluteDriftMs: 0,
  latestSample: null,
  maxAbsoluteDriftMs: 0,
  noticeCount: 0,
  okCount: 0,
  recentSamples: [],
  sampleCount: 0,
  tokenGroups: [],
  tokenCount: 0,
  warnCount: 0,
};

export function parseAnimationTriggerDriftQaSample(line: string): AnimationTriggerDriftQaSample | null {
  const severity = DRIFT_LOG_PATTERN.exec(line)?.[1] as AnimationTriggerDriftSeverity | undefined;
  if (!severity) {
    return null;
  }

  return {
    absoluteDriftMs: parseRuntimeLogNumberField(line, 'absoluteDriftMs'),
    batchSize: parseRuntimeLogNumberField(line, 'batchSize'),
    driftMs: parseRuntimeLogNumberField(line, 'driftMs'),
    line,
    plannedDelayMs: parseRuntimeLogNumberField(line, 'plannedDelayMs'),
    scheduler: parseRuntimeLogStringField(line, 'scheduler') || 'unknown',
    severity,
    token: parseRuntimeLogNumberField(line, 'token'),
  };
}

function countSeverity(samples: AnimationTriggerDriftQaSample[], severity: AnimationTriggerDriftSeverity) {
  return samples.filter((sample) => sample.severity === severity).length;
}

function groupSamplesByToken(samples: AnimationTriggerDriftQaSample[]) {
  const groups = new Map<number, AnimationTriggerDriftQaSample[]>();
  samples.forEach((sample) => {
    if (sample.token <= 0) {
      return;
    }

    groups.set(sample.token, [...(groups.get(sample.token) ?? []), sample]);
  });
  return groups;
}

function createTokenGroup(
  token: number,
  samples: AnimationTriggerDriftQaSample[],
): AnimationTriggerDriftQaTokenGroup {
  const driftTotal = samples.reduce((total, sample) => total + sample.absoluteDriftMs, 0);
  return {
    averageAbsoluteDriftMs: Math.round(driftTotal / samples.length),
    maxAbsoluteDriftMs: Math.max(...samples.map((sample) => sample.absoluteDriftMs)),
    sampleCount: samples.length,
    scheduler: samples[0]?.scheduler ?? 'unknown',
    token,
    warnCount: countSeverity(samples, 'warn'),
  };
}

function createTokenGroups(
  samples: AnimationTriggerDriftQaSample[],
  limit: number,
) {
  return Array.from(groupSamplesByToken(samples).entries())
    .map(([token, tokenSamples]) => createTokenGroup(token, tokenSamples))
    .sort((left, right) => right.token - left.token)
    .slice(0, Math.max(1, limit));
}

export function createAnimationTriggerDriftQaSummary(
  logs: string[],
  recentLimit = 5,
): AnimationTriggerDriftQaSummary {
  const samples = logs
    .map((line) => parseAnimationTriggerDriftQaSample(line))
    .filter((sample): sample is AnimationTriggerDriftQaSample => Boolean(sample));
  if (samples.length === 0) {
    return EMPTY_DRIFT_QA_SUMMARY;
  }

  const absoluteDriftTotal = samples.reduce((total, sample) => total + sample.absoluteDriftMs, 0);
  return {
    averageAbsoluteDriftMs: Math.round(absoluteDriftTotal / samples.length),
    latestSample: samples[0] ?? null,
    maxAbsoluteDriftMs: Math.max(...samples.map((sample) => sample.absoluteDriftMs)),
    noticeCount: countSeverity(samples, 'notice'),
    okCount: countSeverity(samples, 'ok'),
    recentSamples: samples.slice(0, Math.max(1, recentLimit)),
    sampleCount: samples.length,
    tokenGroups: createTokenGroups(samples, recentLimit),
    tokenCount: new Set(samples.map((sample) => sample.token).filter((token) => token > 0)).size,
    warnCount: countSeverity(samples, 'warn'),
  };
}
