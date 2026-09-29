import type { RelationshipEvidenceWindowReason } from './relationshipEvidenceWindowTypes';
import { RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES } from './relationshipEvidenceShadowReasonEvaluation';
import type {
  RelationshipEvidenceShadowReasonDriftComparison,
  RelationshipEvidenceShadowReasonDriftMovement,
} from './relationshipEvidenceShadowReasonDrift';

export const MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_STABILITY_BATCHES = 3;

export type RelationshipEvidenceShadowReasonStabilityStatus =
  | 'consistent-higher-movement'
  | 'consistent-lower-movement'
  | 'insufficient-comparable-batches'
  | 'intermittent-movement'
  | 'mixed-direction-movement'
  | 'no-non-overlapping-movement';

type StabilityMetric = {
  comparableBatchCount: number;
  comparisonCount: number;
  status: RelationshipEvidenceShadowReasonStabilityStatus;
};

type Dimension = 'precision' | 'recall';

function latestComparableMovements(
  comparisons: RelationshipEvidenceShadowReasonDriftComparison[],
  reason: RelationshipEvidenceWindowReason,
  dimension: Dimension,
) {
  let latest: RelationshipEvidenceShadowReasonDriftMovement[] = [];
  let lastCurrentCorpusId: string | undefined;
  comparisons.forEach((comparison) => {
    if (lastCurrentCorpusId && comparison.previousCorpusId !== lastCurrentCorpusId) latest = [];
    lastCurrentCorpusId = comparison.currentCorpusId;
    const metric = comparison.metrics.find((item) => item.reason === reason);
    const movement = metric?.[dimension].movement ?? 'insufficient-denominator';
    if (movement === 'insufficient-denominator') latest = [];
    else latest.push(movement);
  });
  return latest;
}

function stabilityStatus(movements: RelationshipEvidenceShadowReasonDriftMovement[]) {
  if (movements.length + 1 < MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_STABILITY_BATCHES) {
    return 'insufficient-comparable-batches' as const;
  }
  const directional = movements.filter((item) => item !== 'overlapping-intervals');
  if (!directional.length) return 'no-non-overlapping-movement' as const;
  const higher = directional.some((item) => item === 'higher-non-overlapping');
  const lower = directional.some((item) => item === 'lower-non-overlapping');
  if (higher && lower) return 'mixed-direction-movement' as const;
  if (directional.length !== movements.length) return 'intermittent-movement' as const;
  return higher ? 'consistent-higher-movement' as const
    : 'consistent-lower-movement' as const;
}

function metric(movements: RelationshipEvidenceShadowReasonDriftMovement[]): StabilityMetric {
  return {
    comparableBatchCount: movements.length ? movements.length + 1 : 0,
    comparisonCount: movements.length,
    status: stabilityStatus(movements),
  };
}

export function buildRelationshipEvidenceShadowReasonStabilityReport(
  comparisons: RelationshipEvidenceShadowReasonDriftComparison[],
) {
  const ordered = [...comparisons].sort((left, right) => (
    left.currentCreatedAt - right.currentCreatedAt
      || left.currentCorpusId.localeCompare(right.currentCorpusId)
  ));
  const metrics = RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.map((reason) => ({
    precision: metric(latestComparableMovements(ordered, reason, 'precision')),
    reason,
    recall: metric(latestComparableMovements(ordered, reason, 'recall')),
  }));
  const insufficientPrecisionReasons = metrics.filter((item) => (
    item.precision.status === 'insufficient-comparable-batches'
  )).map((item) => item.reason);
  const insufficientRecallReasons = metrics.filter((item) => (
    item.recall.status === 'insufficient-comparable-batches'
  )).map((item) => item.reason);
  return {
    claimLevel: 'descriptive-reason-stability-only' as const,
    insufficientPrecisionReasons, insufficientRecallReasons, metrics,
    minimumComparableBatches: MIN_RELATIONSHIP_EVIDENCE_SHADOW_REASON_STABILITY_BATCHES,
    status: insufficientPrecisionReasons.length || insufficientRecallReasons.length
      ? 'insufficient-reason-stability' as const : 'reason-stability-ready' as const,
  };
}
