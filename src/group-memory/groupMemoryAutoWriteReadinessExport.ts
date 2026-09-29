import type { GroupMemoryAutoWriteReadinessReport } from './groupMemoryAutoWriteReadiness';

export const GROUP_MEMORY_AUTO_WRITE_READINESS_EXPORT_SCHEMA_VERSION = 1;

export interface GroupMemoryAutoWriteReadinessExport {
  generatedAt: number;
  kind: 'group-memory-auto-write-readiness';
  privacy: {
    containsChatContent: false;
    containsLocalPaths: false;
    containsMemorySummaries: false;
    containsMessageOrRoleIds: false;
  };
  report: GroupMemoryAutoWriteReadinessReport;
  schemaVersion: 1;
}

export function createGroupMemoryAutoWriteReadinessExport(
  report: GroupMemoryAutoWriteReadinessReport,
  generatedAt = Date.now(),
): GroupMemoryAutoWriteReadinessExport {
  return {
    generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(),
    kind: 'group-memory-auto-write-readiness',
    privacy: {
      containsChatContent: false, containsLocalPaths: false,
      containsMemorySummaries: false, containsMessageOrRoleIds: false,
    },
    report: {
      automaticWriteEnabled: false, decision: report.decision,
      gates: report.gates.map((item) => ({ ...item })),
      shadowMetrics: report.shadowMetrics ? { ...report.shadowMetrics } : null,
    },
    schemaVersion: GROUP_MEMORY_AUTO_WRITE_READINESS_EXPORT_SCHEMA_VERSION,
  };
}

export function serializeGroupMemoryAutoWriteReadinessExport(
  report: GroupMemoryAutoWriteReadinessReport,
  generatedAt = Date.now(),
) {
  return `${JSON.stringify(createGroupMemoryAutoWriteReadinessExport(report, generatedAt), null, 2)}\n`;
}
