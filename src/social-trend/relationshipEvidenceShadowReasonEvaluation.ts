import type { RelationshipEvidenceWindowReason } from './relationshipEvidenceWindowTypes';
import type {
  RelationshipEvidenceShadowObservation,
  RelationshipEvidenceShadowReasonMetric,
} from './relationshipEvidenceShadowCorpusTypes';

export const RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES: RelationshipEvidenceWindowReason[] = [
  'contradictory-signals', 'high-rejection-rate', 'high-rollback-rate',
  'insufficient-distinct-messages', 'insufficient-signals', 'short-duration',
  'sustained-pattern', 'unresolved-target',
];
const MAX_REASON_MISMATCHES = 50;

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0;
}

function sameReasons(expected: RelationshipEvidenceWindowReason[],
  actual: RelationshipEvidenceWindowReason[]) {
  const expectedSet = new Set(expected);
  return expected.length === actual.length && actual.every((reason) => expectedSet.has(reason));
}

function reasonMetric(reason: RelationshipEvidenceWindowReason,
  observations: RelationshipEvidenceShadowObservation[]): RelationshipEvidenceShadowReasonMetric {
  const expectedCount = observations.filter((item) => item.expectedReasons?.includes(reason)).length;
  const actualCount = observations.filter((item) => item.actualReasons.includes(reason)).length;
  const truePositiveCount = observations.filter((item) => item.expectedReasons?.includes(reason)
    && item.actualReasons.includes(reason)).length;
  return {
    actualCount, expectedCount, precision: ratio(truePositiveCount, actualCount), reason,
    recall: ratio(truePositiveCount, expectedCount), truePositiveCount,
  };
}

export function evaluateRelationshipEvidenceShadowReasons(
  observations: RelationshipEvidenceShadowObservation[],
) {
  const labeled = observations.filter((item) => item.expectedReasons !== undefined);
  const metrics = RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.map((reason) => (
    reasonMetric(reason, labeled)
  ));
  const mismatches = labeled.filter((item) => !sameReasons(
    item.expectedReasons ?? [], item.actualReasons,
  )).slice(0, MAX_REASON_MISMATCHES).map((item) => ({
    actualReasons: item.actualReasons, expectedReasons: item.expectedReasons ?? [],
    sampleId: item.sampleId,
  }));
  const missingExpectedReasons = metrics.filter((item) => item.expectedCount === 0)
    .map((item) => item.reason);
  return {
    exactMatchCount: labeled.filter((item) => sameReasons(
      item.expectedReasons ?? [], item.actualReasons,
    )).length,
    labeledSampleCount: labeled.length, metrics, mismatches, missingExpectedReasons,
    reasonCoverageRate: ratio(
      RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.length - missingExpectedReasons.length,
      RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES.length,
    ),
    unlabeledLegacySampleCount: observations.length - labeled.length,
  };
}
