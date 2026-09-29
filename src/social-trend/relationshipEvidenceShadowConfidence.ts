import type { RelationshipEvidenceShadowMetrics } from './relationshipEvidenceShadowCorpusTypes';

export const RELATIONSHIP_EVIDENCE_SHADOW_CONFIDENCE_LEVEL = 0.95;
export const MIN_RELATIONSHIP_EVIDENCE_SHADOW_METRIC_DENOMINATOR = 20;
const WILSON_Z_95 = 1.959963984540054;

export type RelationshipEvidenceShadowRateMetric =
  | 'insufficient-misclassification'
  | 'sustained-false-positive'
  | 'sustained-recall'
  | 'volatile-miss';

export type RelationshipEvidenceShadowConfidenceInterval = {
  confidenceLevel: 0.95;
  denominator: number;
  denominatorSufficient: boolean;
  lowerBound: number;
  metric: RelationshipEvidenceShadowRateMetric;
  numerator: number;
  observedRate: number;
  upperBound: number;
};

export function calculateRelationshipEvidenceShadowWilson95(
  numerator: number,
  denominator: number,
) {
  if (!denominator) return { lowerBound: 0, upperBound: 1 };
  const rate = numerator / denominator;
  const zSquared = WILSON_Z_95 ** 2;
  const scale = 1 + zSquared / denominator;
  const center = (rate + zSquared / (2 * denominator)) / scale;
  const margin = WILSON_Z_95 * Math.sqrt(
    (rate * (1 - rate) + zSquared / (4 * denominator)) / denominator,
  ) / scale;
  return {
    lowerBound: Math.max(0, center - margin),
    upperBound: Math.min(1, center + margin),
  };
}

function metricInputs(metrics: RelationshipEvidenceShadowMetrics) {
  const counts = metrics.classCounts;
  const matrix = metrics.confusionMatrix;
  return [
    { denominator: counts['insufficient-evidence'] + counts['volatile-shadow'],
      metric: 'sustained-false-positive' as const,
      numerator: matrix['insufficient-evidence']['sustained-shadow']
        + matrix['volatile-shadow']['sustained-shadow'] },
    { denominator: counts['sustained-shadow'], metric: 'sustained-recall' as const,
      numerator: matrix['sustained-shadow']['sustained-shadow'] },
    { denominator: counts['volatile-shadow'], metric: 'volatile-miss' as const,
      numerator: counts['volatile-shadow'] - matrix['volatile-shadow']['volatile-shadow'] },
    { denominator: counts['insufficient-evidence'],
      metric: 'insufficient-misclassification' as const,
      numerator: counts['insufficient-evidence']
        - matrix['insufficient-evidence']['insufficient-evidence'] },
  ];
}

export function buildRelationshipEvidenceShadowConfidenceReport(
  metrics: RelationshipEvidenceShadowMetrics,
) {
  const intervals: RelationshipEvidenceShadowConfidenceInterval[] = metricInputs(metrics)
    .map((input) => ({
      ...input, confidenceLevel: RELATIONSHIP_EVIDENCE_SHADOW_CONFIDENCE_LEVEL,
      denominatorSufficient: input.denominator
        >= MIN_RELATIONSHIP_EVIDENCE_SHADOW_METRIC_DENOMINATOR,
      observedRate: input.denominator ? input.numerator / input.denominator : 0,
      ...calculateRelationshipEvidenceShadowWilson95(input.numerator, input.denominator),
    }));
  return {
    claimLevel: 'descriptive-confidence-only' as const,
    insufficientDenominatorMetrics: intervals.filter((item) => !item.denominatorSufficient)
      .map((item) => item.metric),
    intervals,
    minimumDenominator: MIN_RELATIONSHIP_EVIDENCE_SHADOW_METRIC_DENOMINATOR,
  };
}

export function hasSufficientRelationshipEvidenceShadowDenominators(
  metrics: RelationshipEvidenceShadowMetrics,
) {
  return buildRelationshipEvidenceShadowConfidenceReport(metrics)
    .insufficientDenominatorMetrics.length === 0;
}
