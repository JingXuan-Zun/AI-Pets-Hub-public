import type { GroupMemoryReadinessReviewTrendApprovalHistoryAudit } from './groupMemoryReadinessReviewTrendApprovalHistory';

export type GroupMemoryReadinessApprovalReleaseGateId =
  | 'decision-stability' | 'history-status' | 'latest-approval'
  | 'manual-release-review-boundary' | 'receipt-count' | 'source-order'
  | 'time-validity' | 'unique-reviews';
export type GroupMemoryReadinessApprovalReleaseGateStatus =
  'block' | 'needs-attestation' | 'pass';

export function buildGroupMemoryReadinessApprovalReleaseChecklist(
  audit: GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
  manualReleaseReviewOnlyAcknowledged: boolean,
) {
  const gates: Array<{
    id: GroupMemoryReadinessApprovalReleaseGateId;
    status: GroupMemoryReadinessApprovalReleaseGateStatus;
  }> = [
    { id: 'receipt-count', status: audit.receiptCount >= 2 ? 'pass' : 'block' },
    { id: 'history-status', status: audit.status === 'consistent-history' ? 'pass' : 'block' },
    { id: 'source-order', status: audit.sourceReportRegressionCount ? 'block' : 'pass' },
    { id: 'unique-reviews', status: audit.duplicateReviewedAtCount
      || audit.duplicateSourceReportCount ? 'block' : 'pass' },
    { id: 'decision-stability', status: audit.decisionRegressionCount
      || audit.decisionOscillationCount ? 'block' : 'pass' },
    { id: 'time-validity', status: audit.expiredCount || audit.futureCount ? 'block' : 'pass' },
    { id: 'latest-approval', status: audit.latestDecision === 'accept-evidence-for-manual-review'
      ? 'pass' : 'block' },
    { id: 'manual-release-review-boundary', status: manualReleaseReviewOnlyAcknowledged
      ? 'pass' : 'needs-attestation' },
  ];
  const decision = gates.some((item) => item.status === 'block') ? 'blocked'
    : gates.some((item) => item.status === 'needs-attestation') ? 'needs-attestation'
      : 'ready-for-manual-release-review';
  return { decision, gates } as const;
}

export function createGroupMemoryReadinessApprovalHistoryExport(
  audit: GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
  manualReleaseReviewOnlyAcknowledged: boolean,
  generatedAt = Date.now(),
) {
  return {
    attestation: { manualReleaseReviewOnlyAcknowledged },
    checklist: buildGroupMemoryReadinessApprovalReleaseChecklist(
      audit, manualReleaseReviewOnlyAcknowledged,
    ),
    generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(),
    kind: 'group-memory-readiness-approval-history-audit',
    privacy: {
      containsChatContent: false, containsFileNamesOrLocalPaths: false,
      containsMemorySummaries: false, containsRawApprovalReceipts: false,
      containsReceiptTimestamps: false, containsReviewerRationale: false,
    },
    report: { ...audit },
    schemaVersion: 1,
    validationBoundary: {
      automaticWriteEnabled: false, executable: false,
      productionPolicyChanged: false, releaseReviewOnly: true,
    },
  } as const;
}

export type GroupMemoryReadinessApprovalHistoryExport = ReturnType<
  typeof createGroupMemoryReadinessApprovalHistoryExport
>;

export function serializeGroupMemoryReadinessApprovalHistoryExport(
  audit: GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
  manualReleaseReviewOnlyAcknowledged: boolean,
  generatedAt = Date.now(),
) {
  return `${JSON.stringify(createGroupMemoryReadinessApprovalHistoryExport(
    audit, manualReleaseReviewOnlyAcknowledged, generatedAt,
  ), null, 2)}\n`;
}
