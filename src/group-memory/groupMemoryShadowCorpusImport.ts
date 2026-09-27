import { normalizeGroupMemoryCandidates } from './groupMemoryCandidateNormalization';
import type {
  GroupMemoryCandidateScreeningDecision,
} from './groupMemoryCandidateScreening';
import type { GroupMemoryCandidateShadowSample } from './groupMemoryCandidateShadowEvaluation';
import { isObject, normalizeTimestamp } from './groupMemoryNormalizationUtils';

export const GROUP_MEMORY_SHADOW_CORPUS_SCHEMA_VERSION = 1;
const MAX_CORPUS_SAMPLES = 500;
export const MAX_GROUP_MEMORY_SHADOW_CORPUS_FILE_BYTES = 1_000_000;
const VALID_DECISIONS = new Set<GroupMemoryCandidateScreeningDecision>([
  'eligible', 'manual-review', 'blocked',
]);
const FORBIDDEN_FIELDS = new Set([
  'apikey', 'attachments', 'authorization', 'chathistory', 'password',
  'rawmessage', 'repository', 'token',
]);
const SENSITIVE_PATTERNS = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/iu,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/iu,
  /\bsk-[A-Za-z0-9_-]{12,}/u,
  /\b(?:password|passwd|api[_-]?key|token)\s*[:=]\s*\S+/iu,
  /\bAIza[0-9A-Za-z_-]{20,}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /(?:\+?86[- ]?)?1[3-9]\d{9}\b/u,
  /\b[A-Za-z]:\\(?:[^\\\s]+\\)*[^\\\s]*/u,
  /\/(?:Users|home)\/[^\s]+/u,
];

export type GroupMemoryShadowCorpusImportIssueCode =
  | 'invalid-root'
  | 'invalid-json'
  | 'corpus-too-large'
  | 'unsupported-schema'
  | 'redaction-not-confirmed'
  | 'invalid-corpus-id'
  | 'invalid-samples'
  | 'too-many-samples'
  | 'invalid-sample'
  | 'duplicate-sample-id'
  | 'duplicate-candidate-id'
  | 'forbidden-field'
  | 'sensitive-content';

export interface GroupMemoryShadowCorpusImportIssue {
  code: GroupMemoryShadowCorpusImportIssueCode;
  path: string;
}

export interface GroupMemoryShadowCorpus {
  corpusId: string;
  createdAt: number;
  redactionConfirmed: true;
  samples: GroupMemoryCandidateShadowSample[];
  schemaVersion: 1;
}

export interface GroupMemoryShadowCorpusImportResult {
  corpus: GroupMemoryShadowCorpus | null;
  issues: GroupMemoryShadowCorpusImportIssue[];
}

function collectForbiddenFields(value: unknown, path: string, issues: GroupMemoryShadowCorpusImportIssue[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenFields(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isObject(value)) return;
  Object.entries(value).forEach(([key, child]) => {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_FIELDS.has(key.toLocaleLowerCase())) {
      issues.push({ code: 'forbidden-field', path: childPath });
    }
    collectForbiddenFields(child, childPath, issues);
  });
}

function collectSensitiveContent(value: unknown, path: string, issues: GroupMemoryShadowCorpusImportIssue[]) {
  if (typeof value === 'string' && SENSITIVE_PATTERNS.some((pattern) => pattern.test(value))) {
    issues.push({ code: 'sensitive-content', path });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveContent(item, `${path}[${index}]`, issues));
  } else if (isObject(value)) {
    Object.entries(value).forEach(([key, child]) => (
      collectSensitiveContent(child, `${path}.${key}`, issues)
    ));
  }
}

function normalizeSample(value: unknown, index: number, now: number) {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const expectedDecision = VALID_DECISIONS.has(
    value.expectedDecision as GroupMemoryCandidateScreeningDecision,
  ) ? value.expectedDecision as GroupMemoryCandidateScreeningDecision : null;
  const candidate = normalizeGroupMemoryCandidates([value.candidate], now)[0];
  if (!id || !expectedDecision || !candidate) return null;
  return { candidate, expectedDecision, id, sourceIndex: index };
}

function duplicateIssues(
  samples: Array<GroupMemoryCandidateShadowSample & { sourceIndex: number }>,
) {
  const issues: GroupMemoryShadowCorpusImportIssue[] = [];
  const sampleIds = new Set<string>();
  const candidateIds = new Set<string>();
  samples.forEach((sample) => {
    if (sampleIds.has(sample.id)) {
      issues.push({ code: 'duplicate-sample-id', path: `$.samples[${sample.sourceIndex}].id` });
    }
    if (candidateIds.has(sample.candidate.id)) {
      issues.push({
        code: 'duplicate-candidate-id', path: `$.samples[${sample.sourceIndex}].candidate.id`,
      });
    }
    sampleIds.add(sample.id);
    candidateIds.add(sample.candidate.id);
  });
  return issues;
}

export function importGroupMemoryShadowCorpus(
  value: unknown,
  now = Date.now(),
): GroupMemoryShadowCorpusImportResult {
  if (!isObject(value)) return { corpus: null, issues: [{ code: 'invalid-root', path: '$' }] };
  const issues: GroupMemoryShadowCorpusImportIssue[] = [];
  if (value.schemaVersion !== GROUP_MEMORY_SHADOW_CORPUS_SCHEMA_VERSION) {
    issues.push({ code: 'unsupported-schema', path: '$.schemaVersion' });
  }
  if (value.redactionConfirmed !== true) {
    issues.push({ code: 'redaction-not-confirmed', path: '$.redactionConfirmed' });
  }
  const corpusId = typeof value.corpusId === 'string' ? value.corpusId.trim() : '';
  if (!corpusId) issues.push({ code: 'invalid-corpus-id', path: '$.corpusId' });
  if (!Array.isArray(value.samples)) issues.push({ code: 'invalid-samples', path: '$.samples' });
  const rawSamples = Array.isArray(value.samples) ? value.samples : [];
  if (rawSamples.length > MAX_CORPUS_SAMPLES) {
    issues.push({ code: 'too-many-samples', path: '$.samples' });
  }
  collectForbiddenFields(value, '$', issues);
  collectSensitiveContent(value, '$', issues);
  const normalized = rawSamples.slice(0, MAX_CORPUS_SAMPLES)
    .map((sample, index) => normalizeSample(sample, index, now));
  normalized.forEach((sample, index) => {
    if (!sample) issues.push({ code: 'invalid-sample', path: `$.samples[${index}]` });
  });
  const samples = normalized.filter((sample): sample is NonNullable<typeof sample> => Boolean(sample));
  issues.push(...duplicateIssues(samples));
  if (issues.length) return { corpus: null, issues };
  return {
    corpus: {
      corpusId, createdAt: normalizeTimestamp(value.createdAt, now), redactionConfirmed: true,
      samples: samples.map(({ sourceIndex: _sourceIndex, ...sample }) => sample), schemaVersion: 1,
    },
    issues,
  };
}

export function parseGroupMemoryShadowCorpusJson(
  source: string,
  now = Date.now(),
): GroupMemoryShadowCorpusImportResult {
  if (source.length > MAX_GROUP_MEMORY_SHADOW_CORPUS_FILE_BYTES) {
    return { corpus: null, issues: [{ code: 'corpus-too-large', path: '$' }] };
  }
  try {
    return importGroupMemoryShadowCorpus(JSON.parse(source) as unknown, now);
  } catch {
    return { corpus: null, issues: [{ code: 'invalid-json', path: '$' }] };
  }
}
