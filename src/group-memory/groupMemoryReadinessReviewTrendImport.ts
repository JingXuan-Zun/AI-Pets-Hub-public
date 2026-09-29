import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP,
  type GroupMemoryReadinessReviewTrend,
  type GroupMemoryReadinessReviewTrendMetric,
  type GroupMemoryReadinessReviewTrendStatus,
} from './groupMemoryReadinessReviewHistoryExportImport';
import {
  buildGroupMemoryReadinessReviewTrendChecklist,
  type GroupMemoryReadinessReviewTrendExport,
} from './groupMemoryReadinessReviewTrendExport';
import { isObject } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_EXPORT_BYTES = 64 * 1024;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_EXPORT_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export type GroupMemoryReadinessReviewTrendImportIssue =
  | 'expired-report' | 'future-generated-at' | 'invalid-report';

const STATUSES: GroupMemoryReadinessReviewTrendStatus[] = [
  'duplicate-generated-at', 'insufficient-reports', 'latest-evidence-mismatch',
  'match-coverage-drift', 'not-all-consistent', 'regressed-audit-metrics',
  'stable-audit-trend',
];
const METRICS: GroupMemoryReadinessReviewTrendMetric[] = [
  'decisionOscillationCount', 'decisionRegressionCount', 'duplicateReviewedAtCount',
  'evidenceRegressionCount', 'expiredCount', 'futureCount',
];

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort(); const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function parseAttestation(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'distinctVersionSnapshotsConfirmedByTester', 'programmaticallyVerifiedVersionIdentity',
  ]) || typeof value.distinctVersionSnapshotsConfirmedByTester !== 'boolean'
    || value.programmaticallyVerifiedVersionIdentity !== false) return null;
  return value as GroupMemoryReadinessReviewTrendExport['attestation'];
}

function trendIsCoherent(trend: GroupMemoryReadinessReviewTrend) {
  if (trend.status === 'stable-audit-trend') return trend.reportCount >= 2
    && !trend.regressedMetricIds.length
    && trend.matchCoverageDrop <= MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP
    && trend.latestMatchesCurrentComparison;
  if (trend.status === 'insufficient-reports') return trend.reportCount < 2;
  if (trend.status === 'regressed-audit-metrics') return trend.regressedMetricIds.length > 0;
  if (trend.status === 'match-coverage-drift') return trend.matchCoverageDrop
    > MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP;
  if (trend.status === 'latest-evidence-mismatch') return !trend.latestMatchesCurrentComparison;
  return true;
}

function parseTrend(value: unknown): GroupMemoryReadinessReviewTrend | null {
  if (!isObject(value) || !exactKeys(value, [
    'latestMatchesCurrentComparison', 'matchCoverageDrop', 'regressedMetricIds',
    'reportCount', 'status', 'versionIdentity',
  ]) || typeof value.latestMatchesCurrentComparison !== 'boolean'
    || typeof value.matchCoverageDrop !== 'number' || !Number.isFinite(value.matchCoverageDrop)
    || value.matchCoverageDrop < 0 || value.matchCoverageDrop > 1
    || typeof value.reportCount !== 'number' || !Number.isInteger(value.reportCount)
    || value.reportCount < 0 || value.reportCount > 10 || !Array.isArray(value.regressedMetricIds)
    || !STATUSES.includes(value.status as GroupMemoryReadinessReviewTrendStatus)
    || value.versionIdentity !== 'user-attested-not-verifiable') return null;
  const metricIds = value.regressedMetricIds;
  if (metricIds.some((id) => !METRICS.includes(id as GroupMemoryReadinessReviewTrendMetric))
    || new Set(metricIds).size !== metricIds.length) return null;
  const trend = { ...value, regressedMetricIds: [...metricIds] } as GroupMemoryReadinessReviewTrend;
  return trendIsCoherent(trend) ? trend : null;
}

function allFalse(value: unknown, keys: string[]) {
  return isObject(value) && exactKeys(value, keys)
    && Object.values(value).every((item) => item === false);
}

function hasSafeBoundary(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'automaticWriteEnabled', 'executable', 'productionPolicyChanged', 'reviewOnly',
  ]) && value.automaticWriteEnabled === false && value.executable === false
    && value.productionPolicyChanged === false && value.reviewOnly === true;
}

export function parseGroupMemoryReadinessReviewTrendExportJson(
  text: string,
): GroupMemoryReadinessReviewTrendExport | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'attestation', 'checklist', 'generatedAt', 'kind', 'privacy',
    'schemaVersion', 'trend', 'validationBoundary',
  ])) return null;
  const attestation = parseAttestation(value.attestation);
  const trend = parseTrend(value.trend);
  if (!attestation || !trend || value.kind !== 'group-memory-readiness-review-trend'
    || value.schemaVersion !== 1 || typeof value.generatedAt !== 'number'
    || !Number.isFinite(value.generatedAt) || value.generatedAt < 0
    || !allFalse(value.privacy, [
      'containsChatContent', 'containsFileNamesOrLocalPaths', 'containsMemorySummaries',
      'containsRawAuditReports', 'containsRawReceipts', 'containsReviewerRationale',
    ]) || !hasSafeBoundary(value.validationBoundary)) return null;
  const expected = buildGroupMemoryReadinessReviewTrendChecklist(
    trend, attestation.distinctVersionSnapshotsConfirmedByTester,
  );
  if (JSON.stringify(value.checklist) !== JSON.stringify(expected)) return null;
  const parsed = { ...value, attestation, checklist: expected, trend } as unknown;
  return parsed as GroupMemoryReadinessReviewTrendExport;
}

export function validateGroupMemoryReadinessReviewTrendExport(
  report: GroupMemoryReadinessReviewTrendExport,
  now = Date.now(),
): GroupMemoryReadinessReviewTrendImportIssue[] {
  const issues: GroupMemoryReadinessReviewTrendImportIssue[] = [];
  if (report.generatedAt > now) issues.push('future-generated-at');
  if (now - report.generatedAt > MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_EXPORT_AGE_MS) {
    issues.push('expired-report');
  }
  return issues;
}
