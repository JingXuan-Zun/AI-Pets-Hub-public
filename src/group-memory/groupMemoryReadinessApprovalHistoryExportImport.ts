import {
  buildGroupMemoryReadinessApprovalReleaseChecklist,
  type GroupMemoryReadinessApprovalHistoryExport,
} from './groupMemoryReadinessReviewTrendApprovalHistoryExport';
import { isObject } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_BYTES = 64 * 1024;
export const MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_AGE_MS =
  30 * 24 * 60 * 60 * 1000;
export type GroupMemoryReadinessApprovalHistoryImportIssue =
  | 'expired-report' | 'future-generated-at' | 'invalid-report';

const STATUSES = [
  'consistent-history', 'decision-oscillation', 'decision-regression',
  'duplicate-reviewed-at', 'duplicate-source-report', 'expired-receipts',
  'future-reviewed-at', 'source-report-regression',
];
const DECISIONS = [
  'accept-evidence-for-manual-review', 'needs-more-evidence', 'reject-for-now',
];

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function validCount(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10;
}

function validReport(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'decisionOscillationCount', 'decisionRegressionCount', 'duplicateReviewedAtCount',
    'duplicateSourceReportCount', 'expiredCount', 'futureCount', 'latestDecision',
    'receiptCount', 'sourceReportRegressionCount', 'status',
  ])) return false;
  const countKeys = Object.keys(value).filter((key) => key.endsWith('Count'));
  return countKeys.every((key) => validCount(value[key]))
    && STATUSES.includes(String(value.status))
    && (value.latestDecision === null || DECISIONS.includes(String(value.latestDecision)));
}

function validPrivacy(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'containsChatContent', 'containsFileNamesOrLocalPaths', 'containsMemorySummaries',
    'containsRawApprovalReceipts', 'containsReceiptTimestamps', 'containsReviewerRationale',
  ]) && Object.values(value).every((item) => item === false);
}

function validBoundary(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'automaticWriteEnabled', 'executable', 'productionPolicyChanged', 'releaseReviewOnly',
  ]) && value.automaticWriteEnabled === false && value.executable === false
    && value.productionPolicyChanged === false && value.releaseReviewOnly === true;
}

function validAttestation(value: unknown) {
  return isObject(value) && exactKeys(value, ['manualReleaseReviewOnlyAcknowledged'])
    && typeof value.manualReleaseReviewOnlyAcknowledged === 'boolean';
}

function internallyConsistent(value: GroupMemoryReadinessApprovalHistoryExport) {
  const expected = buildGroupMemoryReadinessApprovalReleaseChecklist(
    value.report, value.attestation.manualReleaseReviewOnlyAcknowledged,
  );
  return JSON.stringify(value.checklist) === JSON.stringify(expected);
}

export function parseGroupMemoryReadinessApprovalHistoryExportJson(
  text: string,
): GroupMemoryReadinessApprovalHistoryExport | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'attestation', 'checklist', 'generatedAt', 'kind', 'privacy', 'report',
    'schemaVersion', 'validationBoundary',
  ]) || value.kind !== 'group-memory-readiness-approval-history-audit'
    || value.schemaVersion !== 1 || typeof value.generatedAt !== 'number'
    || !Number.isFinite(value.generatedAt) || value.generatedAt < 0
    || !validAttestation(value.attestation) || !validReport(value.report)
    || !validPrivacy(value.privacy) || !validBoundary(value.validationBoundary)) return null;
  const parsed = value as unknown as GroupMemoryReadinessApprovalHistoryExport;
  return internallyConsistent(parsed) ? parsed : null;
}

export function validateGroupMemoryReadinessApprovalHistoryExport(
  report: GroupMemoryReadinessApprovalHistoryExport,
  now = Date.now(),
): GroupMemoryReadinessApprovalHistoryImportIssue[] {
  if (report.generatedAt > now) return ['future-generated-at'];
  if (now - report.generatedAt > MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_AGE_MS) {
    return ['expired-report'];
  }
  return [];
}
