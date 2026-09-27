import type {
  RelationshipEvidenceShadowCalibrationStatus,
  RelationshipEvidenceShadowMetrics,
} from './relationshipEvidenceShadowCorpusTypes';

export type RelationshipEvidenceShadowCalibrationThresholds = {
  maximumInsufficientMisclassificationRate: number;
  maximumSustainedFalsePositiveRate: number;
  maximumVolatileMissRate: number;
  minimumSamples: number;
  minimumSamplesPerClass: number;
  minimumSustainedRecall: number;
};

export type RelationshipEvidenceShadowCalibrationProfile = {
  id: 'calibration-strict-v1' | 'calibration-v1';
  thresholds: RelationshipEvidenceShadowCalibrationThresholds;
};

export const RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_THRESHOLDS = {
  maximumInsufficientMisclassificationRate: 0.1,
  maximumSustainedFalsePositiveRate: 0,
  maximumVolatileMissRate: 0.1,
  minimumSamples: 30,
  minimumSamplesPerClass: 5,
  minimumSustainedRecall: 0.9,
} as const;

export const RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILES = [
  { id: 'calibration-v1', thresholds: RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_THRESHOLDS },
  { id: 'calibration-strict-v1', thresholds: {
    maximumInsufficientMisclassificationRate: 0.05,
    maximumSustainedFalsePositiveRate: 0,
    maximumVolatileMissRate: 0.05,
    minimumSamples: 90,
    minimumSamplesPerClass: 20,
    minimumSustainedRecall: 0.95,
  } },
] as const satisfies readonly RelationshipEvidenceShadowCalibrationProfile[];

export const DEFAULT_RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILE =
  RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILES[0];

type CalibrationIssue = Exclude<
  RelationshipEvidenceShadowCalibrationStatus,
  'calibration-ready'
>;

export function evaluateRelationshipEvidenceShadowCalibration(
  metrics: RelationshipEvidenceShadowMetrics,
  profile: RelationshipEvidenceShadowCalibrationProfile =
  DEFAULT_RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILE,
) {
  const thresholds = profile.thresholds;
  if (metrics.sampleCount < thresholds.minimumSamples) {
    return { issues: ['insufficient-samples'] as CalibrationIssue[],
      status: 'insufficient-samples' as const };
  }
  if (Object.values(metrics.classCounts).some((count) => (
    count < thresholds.minimumSamplesPerClass
  ))) {
    return { issues: ['insufficient-class-coverage'] as CalibrationIssue[],
      status: 'insufficient-class-coverage' as const };
  }
  const issues: CalibrationIssue[] = [];
  if (metrics.sustainedFalsePositiveRate
    > thresholds.maximumSustainedFalsePositiveRate) {
    issues.push('unsafe-sustained-false-positive');
  }
  if (metrics.sustainedRecall < thresholds.minimumSustainedRecall) {
    issues.push('below-sustained-recall');
  }
  if (metrics.volatileMissRate > thresholds.maximumVolatileMissRate) {
    issues.push('above-volatile-miss-rate');
  }
  if (metrics.insufficientMisclassificationRate
    > thresholds.maximumInsufficientMisclassificationRate) {
    issues.push('above-insufficient-misclassification');
  }
  return {
    issues,
    status: issues[0] ?? 'calibration-ready',
  } satisfies {
    issues: CalibrationIssue[];
    status: RelationshipEvidenceShadowCalibrationStatus;
  };
}

export function compareRelationshipEvidenceShadowCalibrationProfiles(
  metrics: RelationshipEvidenceShadowMetrics,
  profiles: readonly RelationshipEvidenceShadowCalibrationProfile[] =
  RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILES,
) {
  return profiles.map((profile) => {
    const evaluation = evaluateRelationshipEvidenceShadowCalibration(metrics, profile);
    return { ...evaluation, profileId: profile.id, thresholds: profile.thresholds };
  });
}
