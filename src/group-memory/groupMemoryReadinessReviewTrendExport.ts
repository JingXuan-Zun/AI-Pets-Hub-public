import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP,
  type GroupMemoryReadinessReviewTrend,
} from './groupMemoryReadinessReviewHistoryExportImport';

export type GroupMemoryReadinessReviewTrendGateId =
  | 'latest-evidence' | 'match-coverage' | 'regressed-metrics'
  | 'report-count' | 'trend-status' | 'version-identity-attestation';
export type GroupMemoryReadinessReviewTrendGateStatus = 'block' | 'needs-attestation' | 'pass';

export interface GroupMemoryReadinessReviewTrendChecklist {
  decision: 'blocked' | 'needs-attestation' | 'ready-for-manual-version-review';
  gates: Array<{
    id: GroupMemoryReadinessReviewTrendGateId;
    status: GroupMemoryReadinessReviewTrendGateStatus;
  }>;
}

export function buildGroupMemoryReadinessReviewTrendChecklist(
  trend: GroupMemoryReadinessReviewTrend,
  distinctVersionSnapshotsConfirmedByTester: boolean,
): GroupMemoryReadinessReviewTrendChecklist {
  const gates: GroupMemoryReadinessReviewTrendChecklist['gates'] = [
    { id: 'report-count', status: trend.reportCount >= 2 ? 'pass' : 'block' },
    { id: 'version-identity-attestation', status: distinctVersionSnapshotsConfirmedByTester
      ? 'pass' : 'needs-attestation' },
    { id: 'trend-status', status: trend.status === 'stable-audit-trend' ? 'pass' : 'block' },
    { id: 'regressed-metrics', status: trend.regressedMetricIds.length ? 'block' : 'pass' },
    { id: 'match-coverage', status: trend.matchCoverageDrop
      > MAX_GROUP_MEMORY_READINESS_REVIEW_MATCH_COVERAGE_DROP ? 'block' : 'pass' },
    { id: 'latest-evidence', status: trend.latestMatchesCurrentComparison ? 'pass' : 'block' },
  ];
  const decision = gates.some((item) => item.status === 'block') ? 'blocked'
    : gates.some((item) => item.status === 'needs-attestation') ? 'needs-attestation'
      : 'ready-for-manual-version-review';
  return { decision, gates };
}

export function createGroupMemoryReadinessReviewTrendExport(
  trend: GroupMemoryReadinessReviewTrend,
  distinctVersionSnapshotsConfirmedByTester: boolean,
  generatedAt = Date.now(),
) {
  return {
    attestation: {
      distinctVersionSnapshotsConfirmedByTester,
      programmaticallyVerifiedVersionIdentity: false,
    },
    checklist: buildGroupMemoryReadinessReviewTrendChecklist(
      trend, distinctVersionSnapshotsConfirmedByTester,
    ),
    generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(),
    kind: 'group-memory-readiness-review-trend',
    privacy: {
      containsChatContent: false, containsFileNamesOrLocalPaths: false,
      containsMemorySummaries: false, containsRawAuditReports: false,
      containsRawReceipts: false, containsReviewerRationale: false,
    },
    schemaVersion: 1,
    trend: { ...trend, regressedMetricIds: [...trend.regressedMetricIds] },
    validationBoundary: {
      automaticWriteEnabled: false, executable: false,
      productionPolicyChanged: false, reviewOnly: true,
    },
  } as const;
}

export type GroupMemoryReadinessReviewTrendExport = ReturnType<
  typeof createGroupMemoryReadinessReviewTrendExport
>;

export function serializeGroupMemoryReadinessReviewTrendExport(
  trend: GroupMemoryReadinessReviewTrend,
  distinctVersionSnapshotsConfirmedByTester: boolean,
  generatedAt = Date.now(),
) {
  return `${JSON.stringify(createGroupMemoryReadinessReviewTrendExport(
    trend, distinctVersionSnapshotsConfirmedByTester, generatedAt,
  ), null, 2)}\n`;
}
