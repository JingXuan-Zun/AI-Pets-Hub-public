import type { RelationshipEvidenceShadowBatchReport } from './relationshipEvidenceShadowBatchEvaluation';
import type { RelationshipEvidenceShadowReport } from './relationshipEvidenceShadowCorpusTypes';
import { buildRelationshipEvidenceShadowConfidenceReport } from './relationshipEvidenceShadowConfidence';
import { buildRelationshipEvidenceShadowReasonConfidenceReport } from './relationshipEvidenceShadowReasonConfidence';

function derivedMetrics(report: RelationshipEvidenceShadowReport) {
  return {
    calibrationIssues: report.calibrationIssues,
    calibrationProfileId: report.calibrationProfileId,
    calibrationStatus: report.calibrationStatus,
    classCounts: report.classCounts,
    confidence: buildRelationshipEvidenceShadowConfidenceReport(report),
    confusionMatrix: report.confusionMatrix,
    insufficientMisclassificationRate: report.insufficientMisclassificationRate,
    matchedCount: report.matchedCount,
    reasonSummary: {
      exactMatchCount: report.reasonReport.exactMatchCount,
      labeledSampleCount: report.reasonReport.labeledSampleCount,
      metrics: report.reasonReport.metrics,
      missingExpectedReasons: report.reasonReport.missingExpectedReasons,
      reasonCoverageRate: report.reasonReport.reasonCoverageRate,
      unlabeledLegacySampleCount: report.reasonReport.unlabeledLegacySampleCount,
    },
    reasonConfidence: buildRelationshipEvidenceShadowReasonConfidenceReport(report.reasonReport),
    sampleCount: report.sampleCount,
    sustainedFalsePositiveRate: report.sustainedFalsePositiveRate,
    sustainedRecall: report.sustainedRecall,
    volatileMissRate: report.volatileMissRate,
  };
}

export function createRelationshipEvidenceShadowDerivedReport(
  batchReport: RelationshipEvidenceShadowBatchReport,
  exportedAt = Date.now(),
) {
  const ordered = [...batchReport.corpusReports].sort((left, right) => (
    left.createdAt - right.createdAt || left.corpusId.localeCompare(right.corpusId)
  ));
  const anonymousIds = new Map(ordered.map((item, index) => [item.corpusId, `batch-${index + 1}`]));
  return {
    aggregate: derivedMetrics(batchReport.aggregateReport),
    batches: ordered.map((item, index) => ({
      batchId: `batch-${index + 1}`, metrics: derivedMetrics(item.report),
    })),
    claimLevel: 'derived-offline-metrics-only', exportedAt,
    kind: 'relationship-evidence-shadow-derived-report',
    manualReviewReadiness: batchReport.manualReviewReadiness,
    profileComparisons: batchReport.profileComparisons.map((item) => ({
      issues: item.issues, profileId: item.profileId, status: item.status,
      thresholds: item.thresholds,
    })),
    redactionNotice: 'No corpus IDs, source timestamps, samples, candidates, messages, repositories, or excerpts included.',
    schemaVersion: 1,
    driftComparisons: batchReport.driftComparisons.map((item) => ({
      claimLevel: item.claimLevel,
      currentBatchId: anonymousIds.get(item.currentCorpusId), deltas: item.deltas,
      movement: item.movement,
      previousBatchId: anonymousIds.get(item.previousCorpusId),
    })),
    reasonDriftComparisons: batchReport.reasonDriftComparisons.map((item) => ({
      claimLevel: item.claimLevel,
      currentBatchId: anonymousIds.get(item.currentCorpusId), metrics: item.metrics,
      previousBatchId: anonymousIds.get(item.previousCorpusId),
    })),
    reasonStability: batchReport.reasonStabilityReport,
  } as const;
}

export function serializeRelationshipEvidenceShadowDerivedReport(
  batchReport: RelationshipEvidenceShadowBatchReport,
  exportedAt = Date.now(),
) {
  return `${JSON.stringify(
    createRelationshipEvidenceShadowDerivedReport(batchReport, exportedAt), null, 2,
  )}\n`;
}
