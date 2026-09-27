import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES,
  MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES,
  resolveGroupMemoryReadinessReviewHistoryStatus,
  type GroupMemoryReadinessReviewHistoryStatus,
} from './groupMemoryReadinessReviewHistory';
import type { GroupMemoryReadinessReviewHistoryExport } from './groupMemoryReadinessReviewHistoryExport';
import { isObject } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_EXPORT_BYTES = 64 * 1024;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_EXPORT_BATCH_BYTES = 512 * 1024;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP = 0.1;

export type GroupMemoryReadinessReviewTrendMetric =
  | 'decisionOscillationCount' | 'decisionRegressionCount' | 'duplicateReviewedAtCount'
  | 'evidenceRegressionCount' | 'expiredCount' | 'futureCount';

export type GroupMemoryReadinessReviewTrendStatus =
  | 'duplicate-generated-at' | 'insufficient-reports' | 'latest-evidence-mismatch'
  | 'match-coverage-drift' | 'not-all-consistent' | 'regressed-audit-metrics'
  | 'stable-audit-trend';

export interface GroupMemoryReadinessReviewTrend {
  latestMatchesCurrentComparison: boolean;
  matchCoverageDrop: number;
  regressedMetricIds: GroupMemoryReadinessReviewTrendMetric[];
  reportCount: number;
  status: GroupMemoryReadinessReviewTrendStatus;
  versionIdentity: 'user-attested-not-verifiable';
}

const METRICS: GroupMemoryReadinessReviewTrendMetric[] = [
  'decisionOscillationCount', 'decisionRegressionCount', 'duplicateReviewedAtCount',
  'evidenceRegressionCount', 'expiredCount', 'futureCount',
];

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const expected = [...keys].sort(); const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function nonnegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function parseReport(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'currentComparisonMatchCount', 'decisionOscillationCount', 'decisionRegressionCount',
    'duplicateReviewedAtCount', 'evidenceRegressionCount', 'expiredCount', 'futureCount',
    'latestMatchesCurrentComparison', 'receiptCount', 'status',
  ])) return null;
  const receiptCount = Number(value.receiptCount);
  if (!Number.isInteger(receiptCount)
    || receiptCount < MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES
    || receiptCount > MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES
    || typeof value.latestMatchesCurrentComparison !== 'boolean') return null;
  const counts = ['currentComparisonMatchCount', ...METRICS] as const;
  if (counts.some((key) => !nonnegativeInteger(value[key])
    || Number(value[key]) > receiptCount)) return null;
  const normalized = {
    currentComparisonMatchCount: Number(value.currentComparisonMatchCount),
    decisionOscillationCount: Number(value.decisionOscillationCount),
    decisionRegressionCount: Number(value.decisionRegressionCount),
    duplicateReviewedAtCount: Number(value.duplicateReviewedAtCount),
    evidenceRegressionCount: Number(value.evidenceRegressionCount),
    expiredCount: Number(value.expiredCount), futureCount: Number(value.futureCount),
    latestMatchesCurrentComparison: value.latestMatchesCurrentComparison,
    receiptCount, status: value.status as GroupMemoryReadinessReviewHistoryStatus,
  };
  const status = resolveGroupMemoryReadinessReviewHistoryStatus(normalized);
  if (value.status !== status) return null;
  return normalized as GroupMemoryReadinessReviewHistoryExport['report'];
}

function hasSafePrivacy(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'containsChatContent', 'containsFileNamesOrLocalPaths', 'containsMemorySummaries',
    'containsRawReceipts', 'containsReceiptTimestamps', 'containsReviewerRationale',
  ]) && Object.values(value).every((item) => item === false);
}

function hasSafeBoundary(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'automaticWriteEnabled', 'executable', 'productionPolicyChanged',
  ]) && Object.values(value).every((item) => item === false);
}

export function parseGroupMemoryReadinessReviewHistoryExportJson(
  text: string,
): GroupMemoryReadinessReviewHistoryExport | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'generatedAt', 'kind', 'privacy', 'report', 'schemaVersion', 'validationBoundary',
  ])) return null;
  const report = parseReport(value.report);
  if (value.kind !== 'group-memory-readiness-review-history-audit'
    || value.schemaVersion !== 1 || typeof value.generatedAt !== 'number'
    || !Number.isFinite(value.generatedAt) || value.generatedAt < 0
    || !report || !hasSafePrivacy(value.privacy)
    || !hasSafeBoundary(value.validationBoundary)) return null;
  const parsed = { ...value, report } as unknown;
  return parsed as GroupMemoryReadinessReviewHistoryExport;
}

function collectRegressedMetrics(reports: GroupMemoryReadinessReviewHistoryExport[]) {
  return METRICS.filter((metric) => reports.some((item, index) => (
    index > 0 && item.report[metric] > reports[index - 1]!.report[metric]
  )));
}

function coverage(item: GroupMemoryReadinessReviewHistoryExport) {
  return item.report.receiptCount
    ? item.report.currentComparisonMatchCount / item.report.receiptCount : 0;
}

function trendStatus(input: {
  duplicateTimes: boolean; latestMatches: boolean; matchDrop: number;
  regressedMetrics: string[]; reports: GroupMemoryReadinessReviewHistoryExport[];
}): GroupMemoryReadinessReviewTrendStatus {
  if (input.reports.length < MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES) {
    return 'insufficient-reports';
  }
  if (input.duplicateTimes) return 'duplicate-generated-at';
  if (input.regressedMetrics.length) return 'regressed-audit-metrics';
  if (input.matchDrop > MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP) {
    return 'match-coverage-drift';
  }
  if (!input.latestMatches) return 'latest-evidence-mismatch';
  if (input.reports.some((item) => item.report.status !== 'consistent-history')) {
    return 'not-all-consistent';
  }
  return 'stable-audit-trend';
}

export function compareGroupMemoryReadinessReviewHistoryExports(
  input: GroupMemoryReadinessReviewHistoryExport[],
): GroupMemoryReadinessReviewTrend {
  const reports = [...input].sort((left, right) => left.generatedAt - right.generatedAt);
  const latest = reports.at(-1);
  const coverages = reports.map(coverage);
  const matchCoverageDrop = Math.max(0, ...coverages) - (latest ? coverage(latest) : 0);
  const regressedMetricIds = collectRegressedMetrics(reports);
  const duplicateTimes = new Set(reports.map((item) => item.generatedAt)).size !== reports.length;
  const latestMatches = latest?.report.latestMatchesCurrentComparison ?? false;
  return {
    latestMatchesCurrentComparison: latestMatches, matchCoverageDrop,
    regressedMetricIds, reportCount: reports.length,
    status: trendStatus({ duplicateTimes, latestMatches, matchDrop: matchCoverageDrop,
      regressedMetrics: regressedMetricIds, reports }),
    versionIdentity: 'user-attested-not-verifiable',
  };
}
