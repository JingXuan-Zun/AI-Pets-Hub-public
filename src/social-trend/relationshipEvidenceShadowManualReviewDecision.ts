import type { RelationshipEvidenceShadowBatchReport } from './relationshipEvidenceShadowBatchEvaluation';

export const MAX_RELATIONSHIP_EVIDENCE_SHADOW_REVIEW_DECISION_BYTES = 20_000;
export const MAX_RELATIONSHIP_EVIDENCE_SHADOW_REVIEW_RATIONALE_LENGTH = 2_000;

export type RelationshipEvidenceShadowManualReviewDecisionValue =
  | 'accept-for-further-manual-work'
  | 'needs-more-evidence'
  | 'reject-for-now';

export type RelationshipEvidenceShadowValidatedManualReviewDecision = {
  acknowledgements: {
    evidenceReviewed: true;
    noAutomaticApplicationAcknowledged: true;
  };
  decision: RelationshipEvidenceShadowManualReviewDecisionValue;
  evidenceReference: RelationshipEvidenceShadowManualReviewEvidenceReference;
  rationale: string;
  reviewedAt: number;
};

export type RelationshipEvidenceShadowManualReviewDecisionIssueCode =
  | 'acknowledgements-required'
  | 'accept-not-eligible'
  | 'decision-file-too-large'
  | 'invalid-decision'
  | 'invalid-evidence-reference'
  | 'invalid-json'
  | 'invalid-kind'
  | 'invalid-rationale'
  | 'invalid-reviewed-at'
  | 'invalid-root'
  | 'stale-evidence-reference'
  | 'unexpected-field'
  | 'unsupported-schema';

export type RelationshipEvidenceShadowManualReviewEvidenceReference = {
  aggregateCalibrationStatus: string;
  calibrationProfileId: string;
  corpusCount: number;
  evidenceRevision: string;
  matchedCount: number;
  reasonConfidenceStatus: string;
  reasonLabeledSampleCount: number;
  reasonStabilityStatus: string;
  reviewReadinessStatus: string;
  sampleCount: number;
};

const ROOT_FIELDS = new Set([
  'acknowledgements', 'decision', 'evidenceReference', 'kind', 'rationale',
  'reviewedAt', 'schemaVersion',
]);
const REFERENCE_FIELDS = new Set([
  'aggregateCalibrationStatus', 'calibrationProfileId', 'corpusCount', 'evidenceRevision',
  'matchedCount',
  'reasonConfidenceStatus', 'reasonLabeledSampleCount', 'reasonStabilityStatus',
  'reviewReadinessStatus', 'sampleCount',
]);
const ACKNOWLEDGEMENT_FIELDS = new Set([
  'evidenceReviewed', 'noAutomaticApplicationAcknowledged',
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function unexpectedFields(value: Record<string, unknown>, allowed: Set<string>, path: string) {
  return Object.keys(value).filter((key) => !allowed.has(key)).map((key) => ({
    code: 'unexpected-field' as const, path: `${path}.${key}`,
  }));
}

function nonnegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function normalizeReference(value: unknown) {
  const source = record(value);
  if (!source || unexpectedFields(source, REFERENCE_FIELDS, '$.evidenceReference').length) {
    return null;
  }
  const stringFields = [
    'aggregateCalibrationStatus', 'calibrationProfileId', 'evidenceRevision',
    'reasonConfidenceStatus',
    'reasonStabilityStatus', 'reviewReadinessStatus',
  ] as const;
  const numberFields = [
    'corpusCount', 'matchedCount', 'reasonLabeledSampleCount', 'sampleCount',
  ] as const;
  if (stringFields.some((key) => typeof source[key] !== 'string' || !source[key])) return null;
  if (numberFields.some((key) => !nonnegativeNumber(source[key]))) return null;
  return Object.fromEntries([...stringFields, ...numberFields].map((key) => (
    [key, source[key]]
  ))) as RelationshipEvidenceShadowManualReviewEvidenceReference;
}

export function createRelationshipEvidenceShadowReviewRevision(
  prefix: string,
  value: unknown,
) {
  const evidence = JSON.stringify(value);
  let hash = 0xcbf29ce484222325n;
  for (let index = 0; index < evidence.length; index += 1) {
    hash ^= BigInt(evidence.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return `${prefix}-${hash.toString(16).padStart(16, '0')}`;
}

function evidenceRevision(batchReport: RelationshipEvidenceShadowBatchReport) {
  return createRelationshipEvidenceShadowReviewRevision('evidence-v1', {
    aggregateReport: batchReport.aggregateReport,
    confidenceReport: batchReport.confidenceReport,
    manualReviewReadiness: batchReport.manualReviewReadiness,
    profileComparisons: batchReport.profileComparisons,
    reasonConfidenceReport: batchReport.reasonConfidenceReport,
    reasonStabilityReport: batchReport.reasonStabilityReport,
  });
}

function sameReference(
  actual: RelationshipEvidenceShadowManualReviewEvidenceReference,
  expected: RelationshipEvidenceShadowManualReviewEvidenceReference,
) {
  return (Object.keys(expected) as Array<
    keyof RelationshipEvidenceShadowManualReviewEvidenceReference
  >).every((key) => actual[key] === expected[key]);
}

export function createRelationshipEvidenceShadowManualReviewEvidenceReference(
  batchReport: RelationshipEvidenceShadowBatchReport,
): RelationshipEvidenceShadowManualReviewEvidenceReference {
  return {
    aggregateCalibrationStatus: batchReport.aggregateReport.calibrationStatus,
    calibrationProfileId: batchReport.aggregateReport.calibrationProfileId,
    corpusCount: batchReport.corpusCount,
    evidenceRevision: evidenceRevision(batchReport),
    matchedCount: batchReport.aggregateReport.matchedCount,
    reasonConfidenceStatus: batchReport.reasonConfidenceReport.status,
    reasonLabeledSampleCount: batchReport.aggregateReport.reasonReport.labeledSampleCount,
    reasonStabilityStatus: batchReport.reasonStabilityReport.status,
    reviewReadinessStatus: batchReport.manualReviewReadiness.status,
    sampleCount: batchReport.sampleCount,
  };
}

export function createRelationshipEvidenceShadowManualReviewDecisionTemplate(
  batchReport: RelationshipEvidenceShadowBatchReport,
) {
  return {
    acknowledgements: {
      evidenceReviewed: false,
      noAutomaticApplicationAcknowledged: true,
    },
    decision: 'needs-more-evidence' as const,
    evidenceReference: createRelationshipEvidenceShadowManualReviewEvidenceReference(batchReport),
    kind: 'relationship-evidence-shadow-manual-review-decision',
    rationale: '', reviewedAt: null,
    schemaVersion: 1,
  } as const;
}

export function serializeRelationshipEvidenceShadowManualReviewDecisionTemplate(
  batchReport: RelationshipEvidenceShadowBatchReport,
) {
  return `${JSON.stringify(
    createRelationshipEvidenceShadowManualReviewDecisionTemplate(batchReport), null, 2,
  )}\n`;
}

function validateDecisionBody(source: Record<string, unknown>) {
  const issues: Array<{ code: RelationshipEvidenceShadowManualReviewDecisionIssueCode;
    path: string }> = [];
  const decisions = new Set<RelationshipEvidenceShadowManualReviewDecisionValue>([
    'accept-for-further-manual-work', 'needs-more-evidence', 'reject-for-now',
  ]);
  if (!decisions.has(source.decision as RelationshipEvidenceShadowManualReviewDecisionValue)) {
    issues.push({ code: 'invalid-decision', path: '$.decision' });
  }
  if (typeof source.rationale !== 'string' || !source.rationale.trim()
    || source.rationale.length > MAX_RELATIONSHIP_EVIDENCE_SHADOW_REVIEW_RATIONALE_LENGTH) {
    issues.push({ code: 'invalid-rationale', path: '$.rationale' });
  }
  if (typeof source.reviewedAt !== 'number' || !Number.isFinite(source.reviewedAt)
    || source.reviewedAt <= 0) {
    issues.push({ code: 'invalid-reviewed-at', path: '$.reviewedAt' });
  }
  const acknowledgements = record(source.acknowledgements);
  if (!acknowledgements || unexpectedFields(
    acknowledgements, ACKNOWLEDGEMENT_FIELDS, '$.acknowledgements',
  ).length || acknowledgements.evidenceReviewed !== true
    || acknowledgements.noAutomaticApplicationAcknowledged !== true) {
    issues.push({ code: 'acknowledgements-required', path: '$.acknowledgements' });
  }
  return issues;
}

export function validateRelationshipEvidenceShadowManualReviewDecision(
  value: unknown,
  expectedReference: RelationshipEvidenceShadowManualReviewEvidenceReference,
) {
  const source = record(value);
  if (!source) return { decision: null, issues: [
    { code: 'invalid-root' as const, path: '$' },
  ] };
  const issues: Array<{
    code: RelationshipEvidenceShadowManualReviewDecisionIssueCode;
    path: string;
  }> = unexpectedFields(source, ROOT_FIELDS, '$');
  if (source.kind !== 'relationship-evidence-shadow-manual-review-decision') {
    issues.push({ code: 'invalid-kind', path: '$.kind' });
  }
  if (source.schemaVersion !== 1) {
    issues.push({ code: 'unsupported-schema', path: '$.schemaVersion' });
  }
  const evidenceReference = normalizeReference(source.evidenceReference);
  if (!evidenceReference) {
    issues.push({ code: 'invalid-evidence-reference', path: '$.evidenceReference' });
  } else if (!sameReference(evidenceReference, expectedReference)) {
    issues.push({ code: 'stale-evidence-reference', path: '$.evidenceReference' });
  }
  if (source.decision === 'accept-for-further-manual-work'
    && expectedReference.reviewReadinessStatus !== 'eligible-for-manual-review') {
    issues.push({ code: 'accept-not-eligible', path: '$.decision' });
  }
  issues.push(...validateDecisionBody(source));
  if (issues.length) return { decision: null, issues };
  return {
    decision: {
      acknowledgements: {
        evidenceReviewed: true,
        noAutomaticApplicationAcknowledged: true,
      },
      decision: source.decision as RelationshipEvidenceShadowManualReviewDecisionValue,
      evidenceReference,
      rationale: (source.rationale as string).trim(), reviewedAt: source.reviewedAt as number,
    } satisfies RelationshipEvidenceShadowValidatedManualReviewDecision,
    issues,
  };
}

export function parseRelationshipEvidenceShadowManualReviewDecisionJson(
  source: string,
  expectedReference: RelationshipEvidenceShadowManualReviewEvidenceReference,
) {
  if (new TextEncoder().encode(source).byteLength
    > MAX_RELATIONSHIP_EVIDENCE_SHADOW_REVIEW_DECISION_BYTES) {
    return { decision: null, issues: [
      { code: 'decision-file-too-large' as const, path: '$' },
    ] };
  }
  try {
    return validateRelationshipEvidenceShadowManualReviewDecision(
      JSON.parse(source) as unknown, expectedReference,
    );
  } catch {
    return { decision: null, issues: [{ code: 'invalid-json' as const, path: '$' }] };
  }
}
