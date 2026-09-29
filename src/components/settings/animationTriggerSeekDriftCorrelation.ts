import {
  parseAnimationTriggerDriftQaSample,
  type AnimationTriggerDriftQaSample,
} from './animationTriggerDriftQaSummary';
import {
  parseAnimationTriggerSeekQaSample,
  type AnimationTriggerSeekQaOutcome,
  type AnimationTriggerSeekQaSample,
} from './animationTriggerSeekQaSummary';

export type AnimationTriggerSeekDriftStatus = 'no-drift' | 'ok' | 'notice' | 'warn';

export interface AnimationTriggerSeekDriftCorrelation {
  averageAbsoluteDriftMs: number;
  driftSampleCount: number;
  latestDrift: AnimationTriggerDriftQaSample | null;
  maxAbsoluteDriftMs: number;
  seek: AnimationTriggerSeekQaSample;
  status: AnimationTriggerSeekDriftStatus;
  warnCount: number;
}

export interface AnimationTriggerSeekDriftSummary {
  appliedCount: number;
  correlatedCount: number;
  emptyCount: number;
  recentCorrelations: AnimationTriggerSeekDriftCorrelation[];
  sampleCount: number;
  unavailableCount: number;
}

interface MutableSeekDriftCorrelation {
  driftSamples: AnimationTriggerDriftQaSample[];
  seek: AnimationTriggerSeekQaSample;
}

const EMPTY_SEEK_DRIFT_SUMMARY: AnimationTriggerSeekDriftSummary = {
  appliedCount: 0,
  correlatedCount: 0,
  emptyCount: 0,
  recentCorrelations: [],
  sampleCount: 0,
  unavailableCount: 0,
};

function countSeekOutcome(
  correlations: MutableSeekDriftCorrelation[],
  outcome: AnimationTriggerSeekQaOutcome,
) {
  return correlations.filter((correlation) => correlation.seek.outcome === outcome).length;
}

function canAttachDriftToSeek(
  seek: AnimationTriggerSeekQaSample,
  drift: AnimationTriggerDriftQaSample,
) {
  return seek.outcome === 'applied'
    && seek.replayToken > 0
    && drift.token === seek.replayToken;
}

function resolveSeekDriftStatus(samples: AnimationTriggerDriftQaSample[]): AnimationTriggerSeekDriftStatus {
  if (samples.length === 0) {
    return 'no-drift';
  }

  if (samples.some((sample) => sample.severity === 'warn')) {
    return 'warn';
  }

  return samples.some((sample) => sample.severity === 'notice') ? 'notice' : 'ok';
}

function finalizeCorrelation(
  correlation: MutableSeekDriftCorrelation,
): AnimationTriggerSeekDriftCorrelation {
  const driftTotal = correlation.driftSamples
    .reduce((total, sample) => total + sample.absoluteDriftMs, 0);
  return {
    averageAbsoluteDriftMs: correlation.driftSamples.length > 0
      ? Math.round(driftTotal / correlation.driftSamples.length)
      : 0,
    driftSampleCount: correlation.driftSamples.length,
    latestDrift: correlation.driftSamples[correlation.driftSamples.length - 1] ?? null,
    maxAbsoluteDriftMs: correlation.driftSamples.length > 0
      ? Math.max(...correlation.driftSamples.map((sample) => sample.absoluteDriftMs))
      : 0,
    seek: correlation.seek,
    status: resolveSeekDriftStatus(correlation.driftSamples),
    warnCount: correlation.driftSamples.filter((sample) => sample.severity === 'warn').length,
  };
}

function collectSeekDriftCorrelations(logs: string[]) {
  const correlations: MutableSeekDriftCorrelation[] = [];
  let activeCorrelation: MutableSeekDriftCorrelation | null = null;

  logs.slice().reverse().forEach((line) => {
    const seek = parseAnimationTriggerSeekQaSample(line);
    if (seek) {
      activeCorrelation = { driftSamples: [], seek };
      correlations.push(activeCorrelation);
      return;
    }

    const drift = parseAnimationTriggerDriftQaSample(line);
    if (drift && activeCorrelation && canAttachDriftToSeek(activeCorrelation.seek, drift)) {
      activeCorrelation.driftSamples.push(drift);
    }
  });

  return correlations;
}

export function createAnimationTriggerSeekDriftSummary(
  logs: string[],
  recentLimit = 3,
): AnimationTriggerSeekDriftSummary {
  const correlations = collectSeekDriftCorrelations(logs);
  if (correlations.length === 0) {
    return EMPTY_SEEK_DRIFT_SUMMARY;
  }

  const finalizedCorrelations = correlations.map(finalizeCorrelation).reverse();
  return {
    appliedCount: countSeekOutcome(correlations, 'applied'),
    correlatedCount: finalizedCorrelations.filter((correlation) => correlation.driftSampleCount > 0).length,
    emptyCount: countSeekOutcome(correlations, 'empty'),
    recentCorrelations: finalizedCorrelations.slice(0, Math.max(1, recentLimit)),
    sampleCount: correlations.length,
    unavailableCount: countSeekOutcome(correlations, 'unavailable'),
  };
}
