import {
  evaluateGroupMemoryCandidateEvidence,
  type GroupMemoryCandidateScreeningDecision,
  type GroupMemoryCandidateScreeningReason,
} from './groupMemoryCandidateScreening';
import type { GroupMemoryCandidate } from './groupMemoryTypes';

export const GROUP_MEMORY_SHADOW_THRESHOLDS = {
  minimumAccuracy: 0.9,
  minimumEligiblePrecision: 0.95,
  minimumEligibleSamples: 5,
  minimumSamples: 20,
} as const;

export interface GroupMemoryCandidateShadowSample {
  candidate: GroupMemoryCandidate;
  expectedDecision: GroupMemoryCandidateScreeningDecision;
  id: string;
}

export interface GroupMemoryCandidateShadowObservation {
  candidateId: string;
  decision: GroupMemoryCandidateScreeningDecision;
  mode: 'shadow';
  observedAt: number;
  reasons: GroupMemoryCandidateScreeningReason[];
}

export type GroupMemoryCandidateShadowReadiness =
  | 'ready'
  | 'insufficient-samples'
  | 'insufficient-eligible-samples'
  | 'unsafe-false-eligible'
  | 'below-eligible-precision'
  | 'below-overall-accuracy';

export interface GroupMemoryCandidateShadowReport {
  accuracy: number;
  actualEligibleCount: number;
  eligiblePrecision: number;
  expectedEligibleCount: number;
  falseEligibleCount: number;
  matchedCount: number;
  mismatches: GroupMemoryCandidateShadowMismatch[];
  readiness: GroupMemoryCandidateShadowReadiness;
  sampleCount: number;
}

export interface GroupMemoryCandidateShadowMismatch {
  actualDecision: GroupMemoryCandidateScreeningDecision;
  candidateId: string;
  expectedDecision: GroupMemoryCandidateScreeningDecision;
  reasons: GroupMemoryCandidateScreeningReason[];
  sampleId: string;
}

const MAX_REPORTED_MISMATCHES = 50;

export function createGroupMemoryCandidateShadowObservation(
  candidate: GroupMemoryCandidate,
  observedAt = Date.now(),
): GroupMemoryCandidateShadowObservation {
  const screening = evaluateGroupMemoryCandidateEvidence(candidate);
  return {
    candidateId: candidate.id,
    decision: screening.decision,
    mode: 'shadow',
    observedAt,
    reasons: [...screening.reasons],
  };
}

function resolveReadiness(metrics: Omit<GroupMemoryCandidateShadowReport, 'readiness'>) {
  const thresholds = GROUP_MEMORY_SHADOW_THRESHOLDS;
  if (metrics.sampleCount < thresholds.minimumSamples) return 'insufficient-samples' as const;
  if (metrics.expectedEligibleCount < thresholds.minimumEligibleSamples) {
    return 'insufficient-eligible-samples' as const;
  }
  if (metrics.falseEligibleCount > 0) return 'unsafe-false-eligible' as const;
  if (metrics.eligiblePrecision < thresholds.minimumEligiblePrecision) {
    return 'below-eligible-precision' as const;
  }
  if (metrics.accuracy < thresholds.minimumAccuracy) return 'below-overall-accuracy' as const;
  return 'ready' as const;
}

export function evaluateGroupMemoryCandidateShadowCorpus(
  samples: GroupMemoryCandidateShadowSample[],
  observedAt = Date.now(),
): GroupMemoryCandidateShadowReport {
  const evaluations = samples.map((sample) => ({
    observation: createGroupMemoryCandidateShadowObservation(sample.candidate, observedAt),
    expected: sample.expectedDecision,
    sampleId: sample.id,
  }));
  const matchedCount = evaluations
    .filter((item) => item.observation.decision === item.expected).length;
  const actualEligible = evaluations.filter((item) => item.observation.decision === 'eligible');
  const expectedEligibleCount = evaluations.filter((item) => item.expected === 'eligible').length;
  const falseEligibleCount = actualEligible.filter((item) => item.expected !== 'eligible').length;
  const mismatches = evaluations.filter((item) => item.observation.decision !== item.expected)
    .slice(0, MAX_REPORTED_MISMATCHES)
    .map((item) => ({
      actualDecision: item.observation.decision,
      candidateId: item.observation.candidateId,
      expectedDecision: item.expected,
      reasons: item.observation.reasons,
      sampleId: item.sampleId,
    }));
  const metrics = {
    accuracy: samples.length ? matchedCount / samples.length : 0,
    actualEligibleCount: actualEligible.length,
    eligiblePrecision: actualEligible.length
      ? (actualEligible.length - falseEligibleCount) / actualEligible.length : 0,
    expectedEligibleCount,
    falseEligibleCount,
    matchedCount,
    mismatches,
    sampleCount: samples.length,
  };
  return { ...metrics, readiness: resolveReadiness(metrics) };
}
