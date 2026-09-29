import type { RelationshipEvidenceShadowCalibrationStatus } from './relationshipEvidenceShadowCorpusTypes';

export type RelationshipEvidenceShadowManualReviewIssue =
  | 'aggregate-calibration-not-ready'
  | 'aggregate-denominators-insufficient'
  | 'duplicate-corpus-ids'
  | 'reason-denominators-insufficient'
  | 'reason-stability-insufficient';

export type RelationshipEvidenceShadowManualReviewReadinessInput = {
  aggregateCalibrationStatus: RelationshipEvidenceShadowCalibrationStatus;
  aggregateDenominatorsReady: boolean;
  duplicateCorpusCount: number;
  reasonConfidenceReady: boolean;
  reasonStabilityReady: boolean;
};

export function buildRelationshipEvidenceShadowManualReviewReadiness(
  input: RelationshipEvidenceShadowManualReviewReadinessInput,
) {
  const issues: RelationshipEvidenceShadowManualReviewIssue[] = [];
  if (input.aggregateCalibrationStatus !== 'calibration-ready') {
    issues.push('aggregate-calibration-not-ready');
  }
  if (!input.aggregateDenominatorsReady) {
    issues.push('aggregate-denominators-insufficient');
  }
  if (!input.reasonConfidenceReady) issues.push('reason-denominators-insufficient');
  if (!input.reasonStabilityReady) issues.push('reason-stability-insufficient');
  if (input.duplicateCorpusCount > 0) issues.push('duplicate-corpus-ids');
  return {
    claimLevel: 'manual-calibration-review-readiness-only' as const,
    duplicateCorpusCount: input.duplicateCorpusCount,
    eligibleForManualReview: issues.length === 0,
    issues,
    status: issues.length
      ? 'not-eligible-for-manual-review' as const
      : 'eligible-for-manual-review' as const,
  };
}
