import type { GroupMemoryReadinessComparison } from './groupMemoryAutoWriteReadinessComparison';

export const GROUP_MEMORY_READINESS_COMPARISON_EXPORT_SCHEMA_VERSION = 1;

export interface GroupMemoryReadinessComparisonExport {
  attestation: {
    independentBatchesConfirmedByTester: boolean;
    programmaticallyVerified: false;
    source: 'manual-tester-attestation';
  };
  comparison: GroupMemoryReadinessComparison;
  exportedAt: number;
  kind: 'group-memory-readiness-comparison';
  privacy: {
    containsChatContent: false;
    containsFileNamesOrLocalPaths: false;
    containsMemorySummaries: false;
    containsMessageOrRoleIds: false;
  };
  schemaVersion: 1;
}

export function createGroupMemoryReadinessComparisonExport(
  comparison: GroupMemoryReadinessComparison,
  independentBatchesConfirmedByTester: boolean,
  exportedAt = Date.now(),
): GroupMemoryReadinessComparisonExport {
  return {
    attestation: {
      independentBatchesConfirmedByTester,
      programmaticallyVerified: false,
      source: 'manual-tester-attestation',
    },
    comparison: {
      ...comparison,
      unstableGateIds: [...comparison.unstableGateIds],
    },
    exportedAt: Number.isFinite(exportedAt) ? exportedAt : Date.now(),
    kind: 'group-memory-readiness-comparison',
    privacy: {
      containsChatContent: false,
      containsFileNamesOrLocalPaths: false,
      containsMemorySummaries: false,
      containsMessageOrRoleIds: false,
    },
    schemaVersion: GROUP_MEMORY_READINESS_COMPARISON_EXPORT_SCHEMA_VERSION,
  };
}

export function serializeGroupMemoryReadinessComparisonExport(
  comparison: GroupMemoryReadinessComparison,
  independentBatchesConfirmedByTester: boolean,
  exportedAt = Date.now(),
) {
  const artifact = createGroupMemoryReadinessComparisonExport(
    comparison, independentBatchesConfirmedByTester, exportedAt,
  );
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
