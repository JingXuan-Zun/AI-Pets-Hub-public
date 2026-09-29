import type { RelationshipEvidenceShadowBatchReport } from './relationshipEvidenceShadowBatchEvaluation';
import { createRelationshipEvidenceShadowManualReviewEvidenceReference } from './relationshipEvidenceShadowManualReviewDecision';

function aggregateMetrics(batchReport: RelationshipEvidenceShadowBatchReport) {
  const report = batchReport.aggregateReport;
  return {
    calibrationIssues: report.calibrationIssues,
    calibrationProfileId: report.calibrationProfileId,
    calibrationStatus: report.calibrationStatus,
    classCounts: report.classCounts,
    confusionMatrix: report.confusionMatrix,
    insufficientMisclassificationRate: report.insufficientMisclassificationRate,
    matchedCount: report.matchedCount,
    sampleCount: report.sampleCount,
    sustainedFalsePositiveRate: report.sustainedFalsePositiveRate,
    sustainedRecall: report.sustainedRecall,
    volatileMissRate: report.volatileMissRate,
  };
}

export function createRelationshipEvidenceShadowManualReviewPacket(
  batchReport: RelationshipEvidenceShadowBatchReport,
  generatedAt = Date.now(),
) {
  return {
    aggregateMetrics: aggregateMetrics(batchReport),
    claimLevel: 'anonymous-manual-calibration-review-only',
    configuredProfileComparisons: batchReport.profileComparisons.map((item) => ({
      issues: item.issues, profileId: item.profileId, status: item.status,
      thresholds: item.thresholds,
    })),
    corpusCount: batchReport.corpusCount,
    evidenceReference: createRelationshipEvidenceShadowManualReviewEvidenceReference(batchReport),
    generatedAt,
    kind: 'relationship-evidence-shadow-manual-review-packet',
    manualReviewReadiness: batchReport.manualReviewReadiness,
    overallConfidence: batchReport.confidenceReport,
    reasonConfidence: batchReport.reasonConfidenceReport,
    reasonStability: batchReport.reasonStabilityReport,
    redactionNotice: 'No corpus IDs, timestamps, samples, candidates, messages, repositories, excerpts, or drift timelines included.',
    reviewBoundary: {
      automaticThresholdApplication: false,
      automaticThresholdRecommendation: false,
      humanDecisionRequired: true,
      productionReadinessClaimed: false,
    },
    schemaVersion: 1,
  } as const;
}

export function serializeRelationshipEvidenceShadowManualReviewPacket(
  batchReport: RelationshipEvidenceShadowBatchReport,
  generatedAt = Date.now(),
) {
  return `${JSON.stringify(
    createRelationshipEvidenceShadowManualReviewPacket(batchReport, generatedAt), null, 2,
  )}\n`;
}
