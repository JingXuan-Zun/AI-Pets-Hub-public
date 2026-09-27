import type {
  RelationshipEvidenceShadowCorpus,
  RelationshipEvidenceShadowReport,
  RelationshipEvidenceShadowSample,
} from './relationshipEvidenceShadowCorpusTypes';
import { evaluateRelationshipEvidenceShadowCorpus } from './relationshipEvidenceShadowEvaluation';
import {
  compareRelationshipEvidenceShadowCalibrationProfiles,
  type RelationshipEvidenceShadowCalibrationProfile,
} from './relationshipEvidenceShadowReadiness';
import {
  buildRelationshipEvidenceShadowDriftComparisons,
  type RelationshipEvidenceShadowDriftComparison,
} from './relationshipEvidenceShadowDrift';
import { buildRelationshipEvidenceShadowConfidenceReport } from './relationshipEvidenceShadowConfidence';
import { buildRelationshipEvidenceShadowReasonConfidenceReport } from './relationshipEvidenceShadowReasonConfidence';
import {
  buildRelationshipEvidenceShadowReasonDriftComparisons,
  type RelationshipEvidenceShadowReasonDriftComparison,
} from './relationshipEvidenceShadowReasonDrift';
import { buildRelationshipEvidenceShadowReasonStabilityReport } from './relationshipEvidenceShadowReasonStability';
import { buildRelationshipEvidenceShadowManualReviewReadiness } from './relationshipEvidenceShadowManualReviewReadiness';

export type RelationshipEvidenceShadowCorpusReport = {
  confidenceReport: ReturnType<typeof buildRelationshipEvidenceShadowConfidenceReport>;
  corpusId: string;
  createdAt: number;
  report: RelationshipEvidenceShadowReport;
  reasonConfidenceReport: ReturnType<typeof buildRelationshipEvidenceShadowReasonConfidenceReport>;
};

export type RelationshipEvidenceShadowBatchReport = {
  aggregateReport: RelationshipEvidenceShadowReport;
  confidenceReport: ReturnType<typeof buildRelationshipEvidenceShadowConfidenceReport>;
  claimLevel: 'offline-batch-calibration-only';
  corpusCount: number;
  corpusReports: RelationshipEvidenceShadowCorpusReport[];
  duplicateCorpusIds: string[];
  driftComparisons: RelationshipEvidenceShadowDriftComparison[];
  manualReviewReadiness: ReturnType<typeof buildRelationshipEvidenceShadowManualReviewReadiness>;
  profileComparisons: ReturnType<typeof compareRelationshipEvidenceShadowCalibrationProfiles>;
  reasonConfidenceReport: ReturnType<typeof buildRelationshipEvidenceShadowReasonConfidenceReport>;
  reasonDriftComparisons: RelationshipEvidenceShadowReasonDriftComparison[];
  reasonStabilityReport: ReturnType<typeof buildRelationshipEvidenceShadowReasonStabilityReport>;
  sampleCount: number;
};

function uniqueCorpora(corpora: RelationshipEvidenceShadowCorpus[]) {
  const seen = new Set<string>();
  const duplicateCorpusIds = new Set<string>();
  const unique = corpora.filter((corpus) => {
    if (seen.has(corpus.corpusId)) {
      duplicateCorpusIds.add(corpus.corpusId);
      return false;
    }
    seen.add(corpus.corpusId);
    return true;
  });
  return { duplicateCorpusIds: [...duplicateCorpusIds].sort(), unique };
}

function aggregateSamples(corpora: RelationshipEvidenceShadowCorpus[]) {
  return corpora.flatMap((corpus) => corpus.samples.map((sample) => ({
    ...sample, id: `${corpus.corpusId}:${sample.id}`,
  } satisfies RelationshipEvidenceShadowSample)));
}

export function evaluateRelationshipEvidenceShadowCorpusBatch(
  corpora: RelationshipEvidenceShadowCorpus[],
  profiles?: readonly RelationshipEvidenceShadowCalibrationProfile[],
): RelationshipEvidenceShadowBatchReport {
  const deduplicated = uniqueCorpora(corpora);
  const samples = aggregateSamples(deduplicated.unique);
  const aggregateReport = evaluateRelationshipEvidenceShadowCorpus(samples);
  const corpusReports = deduplicated.unique.map((corpus) => ({
    corpusId: corpus.corpusId, createdAt: corpus.createdAt,
    report: evaluateRelationshipEvidenceShadowCorpus(corpus.samples),
  })).map((item) => ({
    ...item, confidenceReport: buildRelationshipEvidenceShadowConfidenceReport(item.report),
    reasonConfidenceReport: buildRelationshipEvidenceShadowReasonConfidenceReport(
      item.report.reasonReport,
    ),
  }));
  const reasonDriftComparisons = buildRelationshipEvidenceShadowReasonDriftComparisons(
    corpusReports,
  );
  const confidenceReport = buildRelationshipEvidenceShadowConfidenceReport(aggregateReport);
  const reasonConfidenceReport = buildRelationshipEvidenceShadowReasonConfidenceReport(
    aggregateReport.reasonReport,
  );
  const reasonStabilityReport = buildRelationshipEvidenceShadowReasonStabilityReport(
    reasonDriftComparisons,
  );
  const manualReviewReadiness = buildRelationshipEvidenceShadowManualReviewReadiness({
    aggregateCalibrationStatus: aggregateReport.calibrationStatus,
    aggregateDenominatorsReady: !confidenceReport.insufficientDenominatorMetrics.length,
    duplicateCorpusCount: deduplicated.duplicateCorpusIds.length,
    reasonConfidenceReady: reasonConfidenceReport.status === 'reason-confidence-ready',
    reasonStabilityReady: reasonStabilityReport.status === 'reason-stability-ready',
  });
  return {
    aggregateReport, claimLevel: 'offline-batch-calibration-only',
    confidenceReport,
    corpusCount: deduplicated.unique.length,
    corpusReports,
    duplicateCorpusIds: deduplicated.duplicateCorpusIds,
    driftComparisons: buildRelationshipEvidenceShadowDriftComparisons(corpusReports),
    manualReviewReadiness,
    profileComparisons: compareRelationshipEvidenceShadowCalibrationProfiles(
      aggregateReport, profiles,
    ),
    reasonConfidenceReport,
    reasonDriftComparisons,
    reasonStabilityReport,
    sampleCount: samples.length,
  };
}
