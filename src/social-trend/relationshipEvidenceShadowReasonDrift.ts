import type { RelationshipEvidenceWindowReason } from './relationshipEvidenceWindowTypes';
import type {
  RelationshipEvidenceShadowReasonConfidenceInterval,
  buildRelationshipEvidenceShadowReasonConfidenceReport,
} from './relationshipEvidenceShadowReasonConfidence';

export type RelationshipEvidenceShadowReasonDriftMovement =
  | 'higher-non-overlapping'
  | 'insufficient-denominator'
  | 'lower-non-overlapping'
  | 'overlapping-intervals';

export type RelationshipEvidenceShadowReasonConfidenceSource = {
  corpusId: string;
  createdAt: number;
  reasonConfidenceReport: ReturnType<
    typeof buildRelationshipEvidenceShadowReasonConfidenceReport
  >;
};

type IntervalComparison = {
  current: RelationshipEvidenceShadowReasonConfidenceInterval;
  delta: number;
  movement: RelationshipEvidenceShadowReasonDriftMovement;
  previous: RelationshipEvidenceShadowReasonConfidenceInterval;
};

export type RelationshipEvidenceShadowReasonDriftComparison = {
  claimLevel: 'descriptive-reason-drift-only';
  currentCorpusId: string;
  currentCreatedAt: number;
  metrics: Array<{
    precision: IntervalComparison;
    reason: RelationshipEvidenceWindowReason;
    recall: IntervalComparison;
  }>;
  previousCorpusId: string;
  previousCreatedAt: number;
};

function movement(
  previous: RelationshipEvidenceShadowReasonConfidenceInterval,
  current: RelationshipEvidenceShadowReasonConfidenceInterval,
): RelationshipEvidenceShadowReasonDriftMovement {
  if (!previous.denominatorSufficient || !current.denominatorSufficient) {
    return 'insufficient-denominator';
  }
  if (current.lowerBound > previous.upperBound) return 'higher-non-overlapping';
  if (current.upperBound < previous.lowerBound) return 'lower-non-overlapping';
  return 'overlapping-intervals';
}

function compareIntervals(
  previous: RelationshipEvidenceShadowReasonConfidenceInterval,
  current: RelationshipEvidenceShadowReasonConfidenceInterval,
): IntervalComparison {
  return {
    current, delta: current.observedRate - previous.observedRate,
    movement: movement(previous, current), previous,
  };
}

function compare(
  previous: RelationshipEvidenceShadowReasonConfidenceSource,
  current: RelationshipEvidenceShadowReasonConfidenceSource,
): RelationshipEvidenceShadowReasonDriftComparison {
  return {
    claimLevel: 'descriptive-reason-drift-only',
    currentCorpusId: current.corpusId, currentCreatedAt: current.createdAt,
    metrics: current.reasonConfidenceReport.metrics.map((currentMetric) => {
      const previousMetric = previous.reasonConfidenceReport.metrics.find(
        (item) => item.reason === currentMetric.reason,
      )!;
      return {
        precision: compareIntervals(previousMetric.precision, currentMetric.precision),
        reason: currentMetric.reason,
        recall: compareIntervals(previousMetric.recall, currentMetric.recall),
      };
    }),
    previousCorpusId: previous.corpusId, previousCreatedAt: previous.createdAt,
  };
}

export function buildRelationshipEvidenceShadowReasonDriftComparisons(
  reports: RelationshipEvidenceShadowReasonConfidenceSource[],
) {
  const ordered = [...reports].sort((left, right) => left.createdAt - right.createdAt
    || left.corpusId.localeCompare(right.corpusId));
  return ordered.slice(1).map((current, index) => compare(ordered[index]!, current));
}
