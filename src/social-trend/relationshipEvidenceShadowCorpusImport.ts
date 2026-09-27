import {
  DIRECTED_RELATIONSHIP_SCHEMA_VERSION,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipCandidate,
  type DirectedRelationshipCandidateReviewReceipt,
} from '../character-relationship';
import type {
  RelationshipEvidenceWindowReadiness,
  RelationshipEvidenceWindowReason,
} from './relationshipEvidenceWindowTypes';
import { RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES } from './relationshipEvidenceShadowReasonEvaluation';
import type {
  RelationshipEvidenceShadowCorpus,
  RelationshipEvidenceShadowImportIssue,
  RelationshipEvidenceShadowSample,
} from './relationshipEvidenceShadowCorpusTypes';

export const RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_SCHEMA_VERSION = 2;
export const MAX_RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_FILE_BYTES = 1_000_000;
const MAX_SAMPLES = 500;
const READINESS = new Set<RelationshipEvidenceWindowReadiness>([
  'insufficient-evidence', 'sustained-shadow', 'volatile-shadow',
]);
const DECISIONS = new Set(['blocked', 'manual-review']);
const REVIEWS = new Set(['approve', 'reject', 'rollback']);
const REASONS = new Set<RelationshipEvidenceWindowReason>(
  RELATIONSHIP_EVIDENCE_WINDOW_REASON_VALUES,
);
const ALLOWED_FIELDS: Record<string, Set<string>> = {
  root: new Set(['corpusId', 'createdAt', 'redactionConfirmed', 'samples', 'schemaVersion']),
  sample: new Set([
    'candidates', 'corrections', 'expectedReadiness', 'expectedReasons', 'id', 'now', 'reviews',
  ]),
  candidate: new Set(['createdAt', 'deltas', 'id', 'screeningDecision', 'sourceMessageId', 'sourceRoleId', 'targetRoleId']),
  deltas: new Set(['intimacy', 'trust', 'vigilance']),
  review: new Set(['candidateId', 'decision', 'occurredAt']),
  correction: new Set(['occurredAt', 'relationshipId']),
};
const FORBIDDEN_FIELDS = /(?:api.?key|authorization|chat.?history|content|evidence.?excerpt|password|prompt|raw.?message|repository|token)/iu;
const SENSITIVE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/iu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/iu,
  /\bsk-[A-Za-z0-9_-]{12,}/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?:\+?86[- ]?)?1[3-9]\d{9}\b/u,
  /\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*/u,
  /\/(?:Users|home)\/[^\s]+/u,
];

function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function inspectValue(value: unknown, path: string, issues: RelationshipEvidenceShadowImportIssue[]) {
  if (typeof value === 'string' && SENSITIVE_PATTERNS.some((pattern) => pattern.test(value))) {
    issues.push({ code: 'sensitive-content', path });
  } else if (Array.isArray(value)) {
    value.forEach((child, index) => inspectValue(child, `${path}[${index}]`, issues));
  } else if (object(value)) {
    Object.entries(value).forEach(([key, child]) => {
      if (FORBIDDEN_FIELDS.test(key)) issues.push({ code: 'forbidden-field', path: `${path}.${key}` });
      inspectValue(child, `${path}.${key}`, issues);
    });
  }
}

function inspectFields(value: Record<string, unknown>, kind: keyof typeof ALLOWED_FIELDS, path: string,
  issues: RelationshipEvidenceShadowImportIssue[]) {
  Object.keys(value).filter((key) => !ALLOWED_FIELDS[kind].has(key)).forEach((key) => {
    issues.push({ code: 'unexpected-field', path: `${path}.${key}` });
  });
}

function dimensions(value: unknown) {
  if (!object(value)) return null;
  const values = ['intimacy', 'trust', 'vigilance'].map((key) => Number(value[key]));
  if (values.some((item) => !Number.isFinite(item) || item < -10 || item > 10)) return null;
  return { intimacy: values[0]!, trust: values[1]!, vigilance: values[2]! };
}

function expectedReasons(value: unknown, schemaVersion: 1 | 2) {
  if (schemaVersion === 1) return value === undefined ? undefined : null;
  if (!Array.isArray(value) || !value.length) return null;
  const reasons = value.map((item) => text(item)) as RelationshipEvidenceWindowReason[];
  if (reasons.some((reason) => !REASONS.has(reason))
    || new Set(reasons).size !== reasons.length) return null;
  return reasons;
}

function candidate(value: unknown, path: string, issues: RelationshipEvidenceShadowImportIssue[]) {
  if (!object(value)) return null;
  inspectFields(value, 'candidate', path, issues);
  if (object(value.deltas)) inspectFields(value.deltas, 'deltas', `${path}.deltas`, issues);
  const id = text(value.id); const sourceRoleId = text(value.sourceRoleId);
  const targetRoleId = text(value.targetRoleId); const sourceMessageId = text(value.sourceMessageId);
  const createdAt = finite(value.createdAt); const deltas = dimensions(value.deltas);
  const screeningDecision = text(value.screeningDecision);
  if (!id || !sourceRoleId || !targetRoleId || sourceRoleId === targetRoleId || !sourceMessageId
    || createdAt === null || !deltas || !DECISIONS.has(screeningDecision)) return null;
  const base = { intimacy: 50, trust: 50, vigilance: 50 };
  return {
    baseDimensions: base, baseUpdatedAt: null, createdAt, deltas,
    evidenceExcerpt: 'redacted structural signal', id,
    proposedDimensions: {
      intimacy: 50 + deltas.intimacy, trust: 50 + deltas.trust,
      vigilance: 50 + deltas.vigilance,
    },
    reason: 'redacted offline shadow sample', screeningDecision,
    screeningReasons: screeningDecision === 'blocked'
      ? ['target-not-active'] : ['valid-change-requires-review'],
    sourceMessageId, sourceRoleId, sourceRoleName: sourceRoleId, status: 'pending',
    targetRoleId, targetRoleName: targetRoleId,
  } as DirectedRelationshipCandidate;
}

function review(value: unknown, index: number, path: string, candidateIds: Set<string>,
  issues: RelationshipEvidenceShadowImportIssue[]) {
  if (!object(value)) return null;
  inspectFields(value, 'review', path, issues);
  const candidateId = text(value.candidateId); const decision = text(value.decision);
  const occurredAt = finite(value.occurredAt);
  if (!candidateIds.has(candidateId) || !REVIEWS.has(decision) || occurredAt === null) return null;
  return {
    candidateId, decision, id: `shadow-review-${index}-${candidateId}`,
    nextStatus: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'pending',
    occurredAt, previousStatus: decision === 'rollback' ? 'approved' : 'pending',
    recordAfter: null, recordBefore: null,
  } as DirectedRelationshipCandidateReviewReceipt;
}

function sample(value: unknown, index: number, schemaVersion: 1 | 2,
  issues: RelationshipEvidenceShadowImportIssue[]): RelationshipEvidenceShadowSample | null {
  if (!object(value)) return null;
  const path = `$.samples[${index}]`; inspectFields(value, 'sample', path, issues);
  const id = text(value.id); const now = finite(value.now);
  const expectedReadiness = text(value.expectedReadiness) as RelationshipEvidenceWindowReadiness;
  const normalizedReasons = expectedReasons(value.expectedReasons, schemaVersion);
  if (!Array.isArray(value.candidates) || !Array.isArray(value.reviews)
    || !Array.isArray(value.corrections)) return null;
  const candidates = value.candidates.map((item, candidateIndex) =>
    candidate(item, `${path}.candidates[${candidateIndex}]`, issues));
  const validCandidates = candidates.filter((item): item is DirectedRelationshipCandidate => Boolean(item));
  const candidateIds = new Set(validCandidates.map((item) => item.id));
  const relationshipIds = new Set(validCandidates.map((item) => (
    `${item.sourceRoleId}->${item.targetRoleId}`
  )));
  if (candidateIds.size !== validCandidates.length) {
    issues.push({ code: 'duplicate-candidate-id', path: `${path}.candidates` });
  }
  const reviews = value.reviews.map((item, reviewIndex) =>
    review(item, reviewIndex, `${path}.reviews[${reviewIndex}]`, candidateIds, issues));
  const auditTrail = value.corrections.map((item, correctionIndex) => {
    const correctionPath = `${path}.corrections[${correctionIndex}]`;
    if (!object(item)) return null;
    inspectFields(item, 'correction', correctionPath, issues);
    const relationshipId = text(item.relationshipId); const recordedAt = finite(item.occurredAt);
    if (!relationshipId || recordedAt === null) return null;
    return { after: null, before: null, id: `shadow-correction-${correctionIndex}`,
      kind: 'rollback' as const, reason: 'redacted correction', recordedAt, relationshipId,
      source: 'correction' as const };
  });
  const invalidNested = candidates.some((item) => !item) || reviews.some((item) => !item)
    || auditTrail.some((item) => !item);
  if (!id || now === null || !READINESS.has(expectedReadiness) || !validCandidates.length
    || normalizedReasons === null
    || invalidNested || candidateIds.size !== validCandidates.length
    || relationshipIds.size !== 1) return null;
  return { expectedReadiness,
    ...(normalizedReasons ? { expectedReasons: normalizedReasons } : {}),
    id, now, repository: {
    ...EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
    auditTrail: auditTrail.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    candidateReviewReceipts: reviews.filter((item): item is NonNullable<typeof item> => Boolean(item)),
    candidates: validCandidates, schemaVersion: DIRECTED_RELATIONSHIP_SCHEMA_VERSION,
  } } satisfies RelationshipEvidenceShadowSample;
}

export function importRelationshipEvidenceShadowCorpus(value: unknown) {
  if (!object(value)) return { corpus: null, issues: [{ code: 'invalid-root', path: '$' }] } as const;
  const issues: RelationshipEvidenceShadowImportIssue[] = [];
  inspectFields(value, 'root', '$', issues); inspectValue(value, '$', issues);
  const schemaVersion = Number(value.schemaVersion);
  if (schemaVersion !== 1 && schemaVersion !== RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_SCHEMA_VERSION) {
    issues.push({ code: 'unsupported-schema', path: '$.schemaVersion' });
  }
  if (value.redactionConfirmed !== true) issues.push({ code: 'redaction-not-confirmed', path: '$.redactionConfirmed' });
  const corpusId = text(value.corpusId); const createdAt = finite(value.createdAt);
  if (!corpusId || createdAt === null) issues.push({ code: 'invalid-corpus-id', path: '$.corpusId' });
  if (!Array.isArray(value.samples)) issues.push({ code: 'invalid-samples', path: '$.samples' });
  const rawSamples = Array.isArray(value.samples) ? value.samples : [];
  if (rawSamples.length > MAX_SAMPLES) issues.push({ code: 'too-many-samples', path: '$.samples' });
  const normalizedSchema = schemaVersion === 1 ? 1 : 2;
  const normalized = rawSamples.slice(0, MAX_SAMPLES)
    .map((item, index) => sample(item, index, normalizedSchema, issues));
  normalized.forEach((item, index) => { if (!item) issues.push({ code: 'invalid-sample', path: `$.samples[${index}]` }); });
  const samples = normalized.filter((item): item is RelationshipEvidenceShadowSample => Boolean(item));
  const ids = new Set<string>();
  samples.forEach((item, index) => { if (ids.has(item.id)) issues.push({ code: 'duplicate-sample-id', path: `$.samples[${index}].id` }); ids.add(item.id); });
  if (issues.length) return { corpus: null, issues };
  return { corpus: { corpusId, createdAt: createdAt!, redactionConfirmed: true,
    samples, schemaVersion: normalizedSchema } satisfies RelationshipEvidenceShadowCorpus, issues };
}

export function parseRelationshipEvidenceShadowCorpusJson(source: string) {
  if (source.length > MAX_RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_FILE_BYTES) return { corpus: null, issues: [{ code: 'corpus-too-large', path: '$' }] } as const;
  try { return importRelationshipEvidenceShadowCorpus(JSON.parse(source) as unknown); }
  catch { return { corpus: null, issues: [{ code: 'invalid-json', path: '$' }] } as const; }
}
