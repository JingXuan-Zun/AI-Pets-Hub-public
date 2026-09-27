import type {
  DirectedRelationshipDimensions,
  DirectedRelationshipRepositoryData,
} from '../character-relationship';
import type {
  RelationshipEvidenceWindowReadiness,
  RelationshipEvidenceWindowReason,
} from './relationshipEvidenceWindowTypes';

export type RelationshipEvidenceShadowCandidateInput = {
  createdAt: number;
  deltas: DirectedRelationshipDimensions;
  id: string;
  screeningDecision: 'blocked' | 'manual-review';
  sourceMessageId: string;
  sourceRoleId: string;
  targetRoleId: string;
};

export type RelationshipEvidenceShadowReviewInput = {
  candidateId: string;
  decision: 'approve' | 'reject' | 'rollback';
  occurredAt: number;
};

export type RelationshipEvidenceShadowCorrectionInput = {
  occurredAt: number;
  relationshipId: string;
};

export type RelationshipEvidenceShadowSample = {
  expectedReadiness: RelationshipEvidenceWindowReadiness;
  expectedReasons?: RelationshipEvidenceWindowReason[];
  id: string;
  now: number;
  repository: DirectedRelationshipRepositoryData;
};

export type RelationshipEvidenceShadowCorpus = {
  corpusId: string;
  createdAt: number;
  redactionConfirmed: true;
  samples: RelationshipEvidenceShadowSample[];
  schemaVersion: 1 | 2;
};

export type RelationshipEvidenceShadowImportIssueCode =
  | 'corpus-too-large'
  | 'duplicate-candidate-id'
  | 'duplicate-sample-id'
  | 'forbidden-field'
  | 'invalid-corpus-id'
  | 'invalid-json'
  | 'invalid-root'
  | 'invalid-sample'
  | 'invalid-samples'
  | 'redaction-not-confirmed'
  | 'sensitive-content'
  | 'too-many-samples'
  | 'unexpected-field'
  | 'unsupported-schema';

export type RelationshipEvidenceShadowImportIssue = {
  code: RelationshipEvidenceShadowImportIssueCode;
  path: string;
};

export type RelationshipEvidenceShadowMismatch = {
  actualReadiness: RelationshipEvidenceWindowReadiness;
  expectedReadiness: RelationshipEvidenceWindowReadiness;
  reasons: RelationshipEvidenceWindowReason[];
  sampleId: string;
};

export type RelationshipEvidenceShadowObservation = {
  actualReadiness: RelationshipEvidenceWindowReadiness;
  actualReasons: RelationshipEvidenceWindowReason[];
  expectedReadiness: RelationshipEvidenceWindowReadiness;
  expectedReasons?: RelationshipEvidenceWindowReason[];
  sampleId: string;
};

export type RelationshipEvidenceShadowReasonMetric = {
  actualCount: number;
  expectedCount: number;
  precision: number;
  reason: RelationshipEvidenceWindowReason;
  recall: number;
  truePositiveCount: number;
};

export type RelationshipEvidenceShadowReasonMismatch = {
  actualReasons: RelationshipEvidenceWindowReason[];
  expectedReasons: RelationshipEvidenceWindowReason[];
  sampleId: string;
};

export type RelationshipEvidenceShadowReasonReport = {
  exactMatchCount: number;
  labeledSampleCount: number;
  metrics: RelationshipEvidenceShadowReasonMetric[];
  mismatches: RelationshipEvidenceShadowReasonMismatch[];
  missingExpectedReasons: RelationshipEvidenceWindowReason[];
  reasonCoverageRate: number;
  unlabeledLegacySampleCount: number;
};

export type RelationshipEvidenceShadowConfusionMatrix = Record<
  RelationshipEvidenceWindowReadiness,
  Record<RelationshipEvidenceWindowReadiness, number>
>;

export type RelationshipEvidenceShadowCalibrationStatus =
  | 'above-insufficient-misclassification'
  | 'above-volatile-miss-rate'
  | 'below-sustained-recall'
  | 'calibration-ready'
  | 'insufficient-class-coverage'
  | 'insufficient-samples'
  | 'unsafe-sustained-false-positive';

export type RelationshipEvidenceShadowMetrics = {
  classCounts: Record<RelationshipEvidenceWindowReadiness, number>;
  confusionMatrix: RelationshipEvidenceShadowConfusionMatrix;
  insufficientMisclassificationRate: number;
  matchedCount: number;
  sampleCount: number;
  sustainedFalsePositiveRate: number;
  sustainedRecall: number;
  volatileMissRate: number;
};

export type RelationshipEvidenceShadowReport = RelationshipEvidenceShadowMetrics & {
  calibrationIssues: Exclude<
    RelationshipEvidenceShadowCalibrationStatus,
    'calibration-ready'
  >[];
  calibrationStatus: RelationshipEvidenceShadowCalibrationStatus;
  calibrationProfileId: string;
  claimLevel: 'offline-calibration-only';
  mismatches: RelationshipEvidenceShadowMismatch[];
  reasonReport: RelationshipEvidenceShadowReasonReport;
};
