import type { GroupMemoryReadinessReviewHistoryAudit } from './groupMemoryReadinessReviewHistory';

export interface GroupMemoryReadinessReviewHistoryExport {
  generatedAt: number;
  kind: 'group-memory-readiness-review-history-audit';
  privacy: {
    containsChatContent: false;
    containsFileNamesOrLocalPaths: false;
    containsMemorySummaries: false;
    containsRawReceipts: false;
    containsReceiptTimestamps: false;
    containsReviewerRationale: false;
  };
  report: Omit<GroupMemoryReadinessReviewHistoryAudit, 'latestReviewedAt'>;
  schemaVersion: 1;
  validationBoundary: {
    automaticWriteEnabled: false;
    executable: false;
    productionPolicyChanged: false;
  };
}

export function createGroupMemoryReadinessReviewHistoryExport(
  audit: GroupMemoryReadinessReviewHistoryAudit,
  generatedAt = Date.now(),
): GroupMemoryReadinessReviewHistoryExport {
  return {
    generatedAt: Number.isFinite(generatedAt) ? generatedAt : Date.now(),
    kind: 'group-memory-readiness-review-history-audit',
    privacy: {
      containsChatContent: false, containsFileNamesOrLocalPaths: false,
      containsMemorySummaries: false, containsRawReceipts: false,
      containsReceiptTimestamps: false, containsReviewerRationale: false,
    },
    report: {
      currentComparisonMatchCount: audit.currentComparisonMatchCount,
      decisionOscillationCount: audit.decisionOscillationCount,
      decisionRegressionCount: audit.decisionRegressionCount,
      duplicateReviewedAtCount: audit.duplicateReviewedAtCount,
      evidenceRegressionCount: audit.evidenceRegressionCount,
      expiredCount: audit.expiredCount,
      futureCount: audit.futureCount,
      latestMatchesCurrentComparison: audit.latestMatchesCurrentComparison,
      receiptCount: audit.receiptCount,
      status: audit.status,
    },
    schemaVersion: 1,
    validationBoundary: {
      automaticWriteEnabled: false, executable: false, productionPolicyChanged: false,
    },
  };
}

export function serializeGroupMemoryReadinessReviewHistoryExport(
  audit: GroupMemoryReadinessReviewHistoryAudit,
  generatedAt = Date.now(),
) {
  return `${JSON.stringify(
    createGroupMemoryReadinessReviewHistoryExport(audit, generatedAt), null, 2,
  )}\n`;
}
