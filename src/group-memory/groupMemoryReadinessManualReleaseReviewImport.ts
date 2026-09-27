import {
  MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RATIONALE_LENGTH,
  type GroupMemoryReadinessManualReleaseDecision,
  type GroupMemoryReadinessManualReleaseReviewReceipt,
} from './groupMemoryReadinessManualReleaseReview';
import { isObject } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RECEIPT_BYTES = 64 * 1024;
export const MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RECEIPT_AGE_MS =
  30 * 24 * 60 * 60 * 1000;

const DECISIONS: GroupMemoryReadinessManualReleaseDecision[] = [
  'accept-for-manual-configuration-review', 'needs-more-evidence', 'reject-for-now',
];
const HISTORY_STATUSES = [
  'consistent-history', 'decision-oscillation', 'decision-regression',
  'duplicate-reviewed-at', 'duplicate-source-report', 'expired-receipts',
  'future-reviewed-at', 'source-report-regression',
];
const APPROVAL_DECISIONS = [
  'accept-evidence-for-manual-review', 'needs-more-evidence', 'reject-for-now',
];

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function parseRationale(value: unknown) {
  if (!isObject(value) || !exactKeys(value, ['included', 'length', 'present'])
    || value.included !== false || typeof value.present !== 'boolean'
    || typeof value.length !== 'number' || !Number.isInteger(value.length)
    || value.length < 0 || value.length > MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RATIONALE_LENGTH
    || value.present !== (value.length > 0)) return null;
  return value as GroupMemoryReadinessManualReleaseReviewReceipt['rationaleSummary'];
}

function parseSource(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'checklistDecision', 'generatedAt', 'historyStatus', 'latestDecision', 'receiptCount',
  ]) || !['blocked', 'needs-attestation', 'ready-for-manual-release-review'].includes(
    String(value.checklistDecision),
  ) || typeof value.generatedAt !== 'number' || !Number.isFinite(value.generatedAt)
    || value.generatedAt < 0 || !HISTORY_STATUSES.includes(String(value.historyStatus))
    || (value.latestDecision !== null
      && !APPROVAL_DECISIONS.includes(String(value.latestDecision)))
    || typeof value.receiptCount !== 'number' || !Number.isInteger(value.receiptCount)
    || value.receiptCount < 0 || value.receiptCount > 10) return null;
  return value as GroupMemoryReadinessManualReleaseReviewReceipt['sourceReference'];
}

function safeBoundary(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'automaticWriteEnabled', 'configurationApplied', 'configurationReviewOnly',
    'executable', 'productionPolicyChanged',
  ]) && value.automaticWriteEnabled === false && value.configurationApplied === false
    && value.configurationReviewOnly === true && value.executable === false
    && value.productionPolicyChanged === false;
}

function acceptedSourceIsReady(
  decision: GroupMemoryReadinessManualReleaseDecision,
  source: GroupMemoryReadinessManualReleaseReviewReceipt['sourceReference'],
) {
  return decision !== 'accept-for-manual-configuration-review'
    || (source.checklistDecision === 'ready-for-manual-release-review'
      && source.historyStatus === 'consistent-history'
      && source.latestDecision === 'accept-evidence-for-manual-review'
      && source.receiptCount >= 2);
}

export function parseGroupMemoryReadinessManualReleaseReviewReceiptJson(
  text: string,
): GroupMemoryReadinessManualReleaseReviewReceipt | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'decision', 'kind', 'rationaleSummary', 'reviewedAt', 'schemaVersion',
    'sourceReference', 'validationBoundary',
  ])) return null;
  const decision = value.decision as GroupMemoryReadinessManualReleaseDecision;
  const rationaleSummary = parseRationale(value.rationaleSummary);
  const sourceReference = parseSource(value.sourceReference);
  if (!DECISIONS.includes(decision)
    || value.kind !== 'group-memory-readiness-manual-release-review-receipt'
    || value.schemaVersion !== 1 || typeof value.reviewedAt !== 'number'
    || !Number.isFinite(value.reviewedAt) || value.reviewedAt < 0
    || !rationaleSummary || !sourceReference || !safeBoundary(value.validationBoundary)
    || !acceptedSourceIsReady(decision, sourceReference)) return null;
  const parsed: unknown = { ...value, decision, rationaleSummary, sourceReference };
  return parsed as GroupMemoryReadinessManualReleaseReviewReceipt;
}
