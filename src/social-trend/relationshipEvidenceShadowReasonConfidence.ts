import type {
  RelationshipEvidenceShadowReasonMetric,
  RelationshipEvidenceShadowReasonReport,
} from './relationshipEvidenceShadowCorpusTypes';
import type { RelationshipEvidenceWindowReason } from './relationshipEvidenceWindowTypes';
import {
  calculateRelationshipEvidenceShadowWilson95,
  RELATIONSHIP_EVIDENCE_SHADOW_CONFIDENCE_LEVEL,
} from './relationshipEvidenceShadowConfidence';
import { RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES } from './relationshipEvidenceShadowReasonEvaluation';

export const MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_DENOMINATOR = 20;

export type RelationshipEvidenceShadowReasonConfidenceInterval = {
  confidenceLevel: 0.95;
  denominator: number;
  denominatorSufficient: boolean;
  lowerBound: number;
  numerator: number;
  observedRate: number;
  upperBound: number;
};

export type RelationshipEvidenceShadowReasonConfidenceMetric = {
  precision: RelationshipEvidenceShadowReasonConfidenceInterval;
  reason: RelationshipEvidenceWindowReason;
  recall: RelationshipEvidenceShadowReasonConfidenceInterval;
};

function interval(numerator: number, denominator: number) {
  return {
    confidenceLevel: RELATIONSHIP_EVIDENCE_SHADOW_CONFIDENCE_LEVEL,
    denominator,
    denominatorSufficient: denominator
      >= MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_DENOMINATOR,
    numerator,
    observedRate: denominator ? numerator / denominator : 0,
    ...calculateRelationshipEvidenceShadowWilson95(numerator, denominator),
  } satisfies RelationshipEvidenceShadowReasonConfidenceInterval;
}

function confidenceMetric(
  reason: RelationshipEvidenceWindowReason,
  metric?: RelationshipEvidenceShadowReasonMetric,
): RelationshipEvidenceShadowReasonConfidenceMetric {
  const truePositiveCount = metric?.truePositiveCount ?? 0;
  return {
    precision: interval(truePositiveCount, metric?.actualCount ?? 0),
    reason,
    recall: interval(truePositiveCount, metric?.expectedCount ?? 0),
  };
}

export function buildRelationshipEvidenceShadowReasonConfidenceReport(
  report: RelationshipEvidenceShadowReasonReport,
) {
  const metrics = RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.map((reason) => (
    confidenceMetric(reason, report.metrics.find((item) => item.reason === reason))
  ));
  const insufficientPrecisionReasons = metrics.filter(
    (item) => !item.precision.denominatorSufficient,
  ).map((item) => item.reason);
  const insufficientRecallReasons = metrics.filter(
    (item) => !item.recall.denominatorSufficient,
  ).map((item) => item.reason);
  return {
    claimLevel: 'descriptive-reason-confidence-only' as const,
    insufficientPrecisionReasons,
    insufficientRecallReasons,
    metrics,
    minimumDenominator: MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_DENOMINATOR,
    status: insufficientPrecisionReasons.length || insufficientRecallReasons.length
      ? 'insufficient-reason-denominators' as const
      : 'reason-confidence-ready' as const,
  };
}
