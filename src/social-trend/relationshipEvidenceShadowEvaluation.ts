import { buildRelationshipEvidenceWindows } from './relationshipEvidenceWindowProjection';
import type { RelationshipEvidenceWindowReadiness } from './relationshipEvidenceWindowTypes';
import type {
  RelationshipEvidenceShadowConfusionMatrix,
  RelationshipEvidenceShadowObservation,
  RelationshipEvidenceShadowReport,
  RelationshipEvidenceShadowSample,
} from './relationshipEvidenceShadowCorpusTypes';
import {
  DEFAULT_RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILE,
  evaluateRelationshipEvidenceShadowCalibration,
} from './relationshipEvidenceShadowReadiness';
import { evaluateRelationshipEvidenceShadowReasons } from './relationshipEvidenceShadowReasonEvaluation';

const MAX_REPORTED_MISMATCHES = 50;

function emptyMatrix(): RelationshipEvidenceShadowConfusionMatrix {
  const row = () => ({
    'insufficient-evidence': 0, 'sustained-shadow': 0, 'volatile-shadow': 0,
  });
  return {
    'insufficient-evidence': row(), 'sustained-shadow': row(), 'volatile-shadow': row(),
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator ? numerator / denominator : 0;
}

export function evaluateRelationshipEvidenceShadowSamples(
  samples: RelationshipEvidenceShadowSample[],
): RelationshipEvidenceShadowObservation[] {
  return samples.map((sample) => {
    const window = buildRelationshipEvidenceWindows({
      now: sample.now, repository: sample.repository,
    })[0];
    return {
      actualReadiness: window?.readiness ?? 'insufficient-evidence',
      actualReasons: window?.reasons ?? [], expectedReadiness: sample.expectedReadiness,
      ...(sample.expectedReasons ? { expectedReasons: sample.expectedReasons } : {}),
      sampleId: sample.id,
    };
  });
}

function buildMetrics(evaluations: RelationshipEvidenceShadowObservation[]) {
  const confusionMatrix = emptyMatrix();
  evaluations.forEach((item) => {
    confusionMatrix[item.expectedReadiness][item.actualReadiness] += 1;
  });
  const count = (expected: RelationshipEvidenceWindowReadiness) =>
    evaluations.filter((item) => item.expectedReadiness === expected).length;
  const expectedNonSustained = evaluations.filter(
    (item) => item.expectedReadiness !== 'sustained-shadow',
  );
  return {
    classCounts: {
      'insufficient-evidence': count('insufficient-evidence'),
      'sustained-shadow': count('sustained-shadow'),
      'volatile-shadow': count('volatile-shadow'),
    },
    confusionMatrix,
    insufficientMisclassificationRate: ratio(
      count('insufficient-evidence') - confusionMatrix['insufficient-evidence']['insufficient-evidence'],
      count('insufficient-evidence'),
    ),
    matchedCount: evaluations.filter(
      (item) => item.actualReadiness === item.expectedReadiness,
    ).length,
    sampleCount: evaluations.length,
    sustainedFalsePositiveRate: ratio(
      expectedNonSustained.filter((item) => item.actualReadiness === 'sustained-shadow').length,
      expectedNonSustained.length,
    ),
    sustainedRecall: ratio(
      confusionMatrix['sustained-shadow']['sustained-shadow'], count('sustained-shadow'),
    ),
    volatileMissRate: ratio(
      count('volatile-shadow') - confusionMatrix['volatile-shadow']['volatile-shadow'],
      count('volatile-shadow'),
    ),
  };
}

export function evaluateRelationshipEvidenceShadowCorpus(
  samples: RelationshipEvidenceShadowSample[],
): RelationshipEvidenceShadowReport {
  const evaluations = evaluateRelationshipEvidenceShadowSamples(samples);
  const metrics = buildMetrics(evaluations);
  const mismatches = evaluations.filter((item) => item.actualReadiness !== item.expectedReadiness)
    .slice(0, MAX_REPORTED_MISMATCHES).map((item) => ({
      actualReadiness: item.actualReadiness, expectedReadiness: item.expectedReadiness,
      reasons: item.actualReasons, sampleId: item.sampleId,
    }));
  const calibration = evaluateRelationshipEvidenceShadowCalibration(metrics);
  return {
    ...metrics, calibrationIssues: calibration.issues,
    calibrationProfileId: DEFAULT_RELATIONSHIP_EVIDENCE_SHADOW_CALIBRATION_PROFILE.id,
    calibrationStatus: calibration.status,
    claimLevel: 'offline-calibration-only',
    mismatches, reasonReport: evaluateRelationshipEvidenceShadowReasons(evaluations),
  };
}
