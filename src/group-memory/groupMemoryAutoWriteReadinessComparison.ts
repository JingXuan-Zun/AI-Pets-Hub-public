import {
  GROUP_MEMORY_AUTO_WRITE_GATE_IDS,
  type GroupMemoryAutoWriteGateId,
  type GroupMemoryAutoWriteReadinessReport,
} from './groupMemoryAutoWriteReadiness';
import type { GroupMemoryAutoWriteReadinessExport } from './groupMemoryAutoWriteReadinessExport';
import { isObject } from './groupMemoryNormalizationUtils';

export const MIN_GROUP_MEMORY_READINESS_REPORTS = 3;
export const MAX_GROUP_MEMORY_READINESS_REPORT_FILES = 10;
export const MAX_GROUP_MEMORY_READINESS_REPORT_FILE_BYTES = 256 * 1024;
export const MAX_GROUP_MEMORY_READINESS_REPORT_BATCH_BYTES = 1024 * 1024;
const MAX_ACCURACY_DROP = 0.05;
const MAX_ELIGIBLE_PRECISION_DROP = 0.02;

export type GroupMemoryReadinessComparisonStatus =
  | 'accuracy-drift'
  | 'duplicate-report-time'
  | 'eligible-precision-drift'
  | 'insufficient-reports'
  | 'not-all-shadow-ready'
  | 'stable-shadow-evidence'
  | 'unsafe-false-eligible'
  | 'unstable-gates';

export interface GroupMemoryReadinessComparison {
  accuracyDrop: number;
  eligiblePrecisionDrop: number;
  independence: 'user-attested-not-verifiable';
  latestGeneratedAt: number | null;
  minimumAccuracy: number;
  minimumEligiblePrecision: number;
  reportCount: number;
  status: GroupMemoryReadinessComparisonStatus;
  unstableGateIds: GroupMemoryAutoWriteGateId[];
}

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function parseGate(value: unknown) {
  if (!isObject(value) || !exactKeys(value, ['count', 'id', 'status'])) return null;
  if (!GROUP_MEMORY_AUTO_WRITE_GATE_IDS.includes(value.id as GroupMemoryAutoWriteGateId)) return null;
  if (!['pass', 'block', 'needs-evidence'].includes(String(value.status))) return null;
  const count = Number(value.count);
  if (!Number.isInteger(count) || count < 0) return null;
  return { count, id: value.id, status: value.status } as GroupMemoryAutoWriteReadinessReport['gates'][number];
}

function parseMetrics(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'accuracy', 'eligiblePrecision', 'expectedEligibleCount', 'falseEligibleCount',
    'readiness', 'sampleCount',
  ])) return null;
  const numbers = ['accuracy', 'eligiblePrecision', 'expectedEligibleCount',
    'falseEligibleCount', 'sampleCount'] as const;
  if (numbers.some((key) => !Number.isFinite(Number(value[key])) || Number(value[key]) < 0)) return null;
  if (Number(value.accuracy) > 1 || Number(value.eligiblePrecision) > 1
    || !Number.isInteger(Number(value.expectedEligibleCount))
    || !Number.isInteger(Number(value.falseEligibleCount))
    || !Number.isInteger(Number(value.sampleCount))) return null;
  if (!['ready', 'insufficient-samples', 'insufficient-eligible-samples', 'unsafe-false-eligible',
    'below-eligible-precision', 'below-overall-accuracy'].includes(String(value.readiness))) return null;
  return Object.fromEntries([...numbers.map((key) => [key, Number(value[key])]),
    ['readiness', value.readiness]]) as unknown as NonNullable<GroupMemoryAutoWriteReadinessReport['shadowMetrics']>;
}

function parseReport(value: unknown): GroupMemoryAutoWriteReadinessReport | null {
  if (!isObject(value) || !exactKeys(value, [
    'automaticWriteEnabled', 'decision', 'gates', 'shadowMetrics',
  ])) return null;
  const decision = String(value.decision) as GroupMemoryAutoWriteReadinessReport['decision'];
  if (value.automaticWriteEnabled !== false
    || !['blocked', 'needs-drill', 'shadow-ready'].includes(decision)
    || !Array.isArray(value.gates)) return null;
  const gates = value.gates.map(parseGate);
  if (gates.some((item) => !item) || new Set(gates.map((item) => item?.id)).size !== 10) return null;
  const shadowMetrics = value.shadowMetrics === null ? null : parseMetrics(value.shadowMetrics);
  if (value.shadowMetrics !== null && !shadowMetrics) return null;
  if (decision === 'shadow-ready' && shadowMetrics?.readiness !== 'ready') return null;
  return { automaticWriteEnabled: false, decision,
    gates: gates as GroupMemoryAutoWriteReadinessReport['gates'], shadowMetrics };
}

export function parseGroupMemoryAutoWriteReadinessExportJson(text: string) {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'generatedAt', 'kind', 'privacy', 'report', 'schemaVersion',
  ])) return null;
  const privacy = value.privacy;
  const generatedAt = Number(value.generatedAt);
  const report = parseReport(value.report);
  if (value.schemaVersion !== 1 || value.kind !== 'group-memory-auto-write-readiness'
    || !Number.isFinite(generatedAt) || generatedAt < 0 || !isObject(privacy) || !report
    || !exactKeys(privacy, ['containsChatContent', 'containsLocalPaths',
      'containsMemorySummaries', 'containsMessageOrRoleIds'])
    || Object.values(privacy).some((item) => item !== false)) return null;
  return { generatedAt, kind: value.kind, privacy, report,
    schemaVersion: 1 } as GroupMemoryAutoWriteReadinessExport;
}

function comparisonStatus(input: {
  accuracyDrop: number; duplicateTimes: boolean; eligiblePrecisionDrop: number;
  reports: GroupMemoryAutoWriteReadinessExport[]; unstableGateIds: string[];
}): GroupMemoryReadinessComparisonStatus {
  if (input.reports.length < MIN_GROUP_MEMORY_READINESS_REPORTS) return 'insufficient-reports';
  if (input.duplicateTimes) return 'duplicate-report-time';
  if (input.reports.some((item) => item.report.shadowMetrics?.falseEligibleCount)) return 'unsafe-false-eligible';
  if (input.unstableGateIds.length) return 'unstable-gates';
  if (input.reports.some((item) => item.report.decision !== 'shadow-ready')) return 'not-all-shadow-ready';
  if (input.accuracyDrop > MAX_ACCURACY_DROP) return 'accuracy-drift';
  if (input.eligiblePrecisionDrop > MAX_ELIGIBLE_PRECISION_DROP) return 'eligible-precision-drift';
  return 'stable-shadow-evidence';
}

export function compareGroupMemoryAutoWriteReadinessExports(
  input: GroupMemoryAutoWriteReadinessExport[],
): GroupMemoryReadinessComparison {
  const reports = [...input].sort((left, right) => left.generatedAt - right.generatedAt);
  const metrics = reports.flatMap((item) => item.report.shadowMetrics ? [item.report.shadowMetrics] : []);
  const latest = metrics.at(-1);
  const maxAccuracy = Math.max(0, ...metrics.map((item) => item.accuracy));
  const maxPrecision = Math.max(0, ...metrics.map((item) => item.eligiblePrecision));
  const accuracyDrop = Math.max(0, maxAccuracy - (latest?.accuracy ?? 0));
  const eligiblePrecisionDrop = Math.max(0, maxPrecision - (latest?.eligiblePrecision ?? 0));
  const unstableGateIds = GROUP_MEMORY_AUTO_WRITE_GATE_IDS.filter((id) => reports.some((item) => (
    item.report.gates.find((gate) => gate.id === id)?.status !== 'pass'
  )));
  const duplicateTimes = new Set(reports.map((item) => item.generatedAt)).size !== reports.length;
  return {
    accuracyDrop, eligiblePrecisionDrop, independence: 'user-attested-not-verifiable',
    latestGeneratedAt: reports.at(-1)?.generatedAt ?? null,
    minimumAccuracy: metrics.length ? Math.min(...metrics.map((item) => item.accuracy)) : 0,
    minimumEligiblePrecision: metrics.length
      ? Math.min(...metrics.map((item) => item.eligiblePrecision)) : 0,
    reportCount: reports.length,
    status: comparisonStatus({ accuracyDrop, duplicateTimes, eligiblePrecisionDrop,
      reports, unstableGateIds }),
    unstableGateIds,
  };
}
