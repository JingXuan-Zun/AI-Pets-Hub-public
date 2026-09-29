import type { RelationshipEvidenceShadowCorpusReport } from './relationshipEvidenceShadowBatchEvaluation';
import { hasSufficientRelationshipEvidenceShadowDenominators } from './relationshipEvidenceShadowConfidence';

const DRIFT_EPSILON = 1e-9;

export type RelationshipEvidenceShadowDriftMovement =
  | 'decreased-risk'
  | 'increased-risk'
  | 'insufficient-class-coverage'
  | 'insufficient-denominator'
  | 'mixed'
  | 'stable';

export type RelationshipEvidenceShadowDriftComparison = {
  claimLevel: 'descriptive-drift-only';
  currentCorpusId: string;
  currentCreatedAt: number;
  deltas: {
    insufficientMisclassificationRate: number;
    sampleCount: number;
    sustainedFalsePositiveRate: number;
    sustainedRecall: number;
    volatileMissRate: number;
  };
  movement: RelationshipEvidenceShadowDriftMovement;
  previousCorpusId: string;
  previousCreatedAt: number;
};

function hasClassCoverage(report: RelationshipEvidenceShadowCorpusReport['report']) {
  return Object.values(report.classCounts).every((count) => count > 0);
}

function movement(previous: RelationshipEvidenceShadowCorpusReport,
  current: RelationshipEvidenceShadowCorpusReport): RelationshipEvidenceShadowDriftMovement {
  if (!hasClassCoverage(previous.report) || !hasClassCoverage(current.report)) {
    return 'insufficient-class-coverage';
  }
  if (!hasSufficientRelationshipEvidenceShadowDenominators(previous.report)
    || !hasSufficientRelationshipEvidenceShadowDenominators(current.report)) {
    return 'insufficient-denominator';
  }
  const riskDeltas = [
    current.report.sustainedFalsePositiveRate - previous.report.sustainedFalsePositiveRate,
    current.report.volatileMissRate - previous.report.volatileMissRate,
    current.report.insufficientMisclassificationRate
      - previous.report.insufficientMisclassificationRate,
    previous.report.sustainedRecall - current.report.sustainedRecall,
  ];
  const increased = riskDeltas.some((delta) => delta > DRIFT_EPSILON);
  const decreased = riskDeltas.some((delta) => delta < -DRIFT_EPSILON);
  if (increased && decreased) return 'mixed';
  if (increased) return 'increased-risk';
  if (decreased) return 'decreased-risk';
  return 'stable';
}

function compare(previous: RelationshipEvidenceShadowCorpusReport,
  current: RelationshipEvidenceShadowCorpusReport): RelationshipEvidenceShadowDriftComparison {
  return {
    claimLevel: 'descriptive-drift-only', currentCorpusId: current.corpusId,
    currentCreatedAt: current.createdAt,
    deltas: {
      insufficientMisclassificationRate: current.report.insufficientMisclassificationRate
        - previous.report.insufficientMisclassificationRate,
      sampleCount: current.report.sampleCount - previous.report.sampleCount,
      sustainedFalsePositiveRate: current.report.sustainedFalsePositiveRate
        - previous.report.sustainedFalsePositiveRate,
      sustainedRecall: current.report.sustainedRecall - previous.report.sustainedRecall,
      volatileMissRate: current.report.volatileMissRate - previous.report.volatileMissRate,
    },
    movement: movement(previous, current), previousCorpusId: previous.corpusId,
    previousCreatedAt: previous.createdAt,
  };
}

export function buildRelationshipEvidenceShadowDriftComparisons(
  reports: RelationshipEvidenceShadowCorpusReport[],
) {
  const ordered = [...reports].sort((left, right) => left.createdAt - right.createdAt
    || left.corpusId.localeCompare(right.corpusId));
  return ordered.slice(1).map((current, index) => compare(ordered[index]!, current));
}
