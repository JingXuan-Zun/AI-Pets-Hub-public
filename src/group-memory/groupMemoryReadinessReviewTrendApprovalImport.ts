import type { GroupMemoryReadinessReviewTrendStatus } from './groupMemoryReadinessReviewHistoryExportImport';
import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP,
} from './groupMemoryReadinessReviewHistoryExportImport';
import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RATIONALE_LENGTH,
  type GroupMemoryReadinessReviewTrendApprovalDecision,
  type GroupMemoryReadinessReviewTrendApprovalReceipt,
} from './groupMemoryReadinessReviewTrendApproval';
import { isObject } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_BYTES = 64 * 1024;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_AGE_MS =
  30 * 24 * 60 * 60 * 1000;

const DECISIONS: GroupMemoryReadinessReviewTrendApprovalDecision[] = [
  'accept-evidence-for-manual-review', 'needs-more-evidence', 'reject-for-now',
];
const TREND_STATUSES: GroupMemoryReadinessReviewTrendStatus[] = [
  'duplicate-generated-at', 'insufficient-reports', 'latest-evidence-mismatch',
  'match-coverage-drift', 'not-all-consistent', 'regressed-audit-metrics',
  'stable-audit-trend',
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
    || value.length < 0 || value.length > MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RATIONALE_LENGTH
    || value.present !== (value.length > 0)) return null;
  return value as GroupMemoryReadinessReviewTrendApprovalReceipt['rationaleSummary'];
}

function parseSource(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'checklistDecision', 'generatedAt', 'matchCoverageDrop', 'regressedMetricCount',
    'reportCount', 'trendStatus',
  ]) || !['blocked', 'needs-attestation', 'ready-for-manual-version-review'].includes(
    String(value.checklistDecision),
  ) || typeof value.generatedAt !== 'number' || !Number.isFinite(value.generatedAt)
    || value.generatedAt < 0 || typeof value.matchCoverageDrop !== 'number'
    || !Number.isFinite(value.matchCoverageDrop) || value.matchCoverageDrop < 0
    || value.matchCoverageDrop > 1 || typeof value.regressedMetricCount !== 'number'
    || !Number.isInteger(value.regressedMetricCount) || value.regressedMetricCount < 0
    || value.regressedMetricCount > 6 || typeof value.reportCount !== 'number'
    || !Number.isInteger(value.reportCount) || value.reportCount < 0 || value.reportCount > 10
    || !TREND_STATUSES.includes(value.trendStatus as GroupMemoryReadinessReviewTrendStatus)) return null;
  return value as GroupMemoryReadinessReviewTrendApprovalReceipt['sourceReference'];
}

function hasSafeBoundary(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'automaticWriteEnabled', 'executable', 'persistedByApplication', 'productionPolicyChanged',
  ]) && Object.values(value).every((item) => item === false);
}

function acceptedSourceIsReady(
  decision: GroupMemoryReadinessReviewTrendApprovalDecision,
  source: GroupMemoryReadinessReviewTrendApprovalReceipt['sourceReference'],
) {
  return decision !== 'accept-evidence-for-manual-review'
    || (source.checklistDecision === 'ready-for-manual-version-review'
      && source.trendStatus === 'stable-audit-trend' && source.regressedMetricCount === 0
      && source.matchCoverageDrop <= MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP);
}

export function parseGroupMemoryReadinessReviewTrendApprovalReceiptJson(
  text: string,
): GroupMemoryReadinessReviewTrendApprovalReceipt | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'decision', 'kind', 'rationaleSummary', 'reviewedAt', 'schemaVersion',
    'sourceReference', 'validationBoundary',
  ])) return null;
  const decision = value.decision as GroupMemoryReadinessReviewTrendApprovalDecision;
  const rationaleSummary = parseRationale(value.rationaleSummary);
  const sourceReference = parseSource(value.sourceReference);
  if (!DECISIONS.includes(decision)
    || value.kind !== 'group-memory-readiness-review-trend-approval-receipt'
    || value.schemaVersion !== 1 || typeof value.reviewedAt !== 'number'
    || !Number.isFinite(value.reviewedAt) || value.reviewedAt < 0
    || !rationaleSummary || !sourceReference || !hasSafeBoundary(value.validationBoundary)
    || !acceptedSourceIsReady(decision, sourceReference)) return null;
  const parsed = { ...value, decision, rationaleSummary, sourceReference } as unknown;
  return parsed as GroupMemoryReadinessReviewTrendApprovalReceipt;
}
