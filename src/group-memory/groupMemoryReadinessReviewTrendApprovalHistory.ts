import type {
  GroupMemoryReadinessReviewTrendApprovalDecision,
  GroupMemoryReadinessReviewTrendApprovalReceipt,
} from './groupMemoryReadinessReviewTrendApproval';
import { MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_AGE_MS } from './groupMemoryReadinessReviewTrendApprovalImport';

export const MIN_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_FILES = 2;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_FILES = 10;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_BATCH_BYTES = 512 * 1024;

export type GroupMemoryReadinessReviewTrendApprovalHistoryStatus =
  | 'consistent-history' | 'decision-oscillation' | 'decision-regression'
  | 'duplicate-reviewed-at' | 'duplicate-source-report' | 'expired-receipts'
  | 'future-reviewed-at' | 'source-report-regression';

export interface GroupMemoryReadinessReviewTrendApprovalHistoryAudit {
  decisionOscillationCount: number;
  decisionRegressionCount: number;
  duplicateReviewedAtCount: number;
  duplicateSourceReportCount: number;
  expiredCount: number;
  futureCount: number;
  latestDecision: GroupMemoryReadinessReviewTrendApprovalDecision | null;
  receiptCount: number;
  sourceReportRegressionCount: number;
  status: GroupMemoryReadinessReviewTrendApprovalHistoryStatus;
}

const RANK: Record<GroupMemoryReadinessReviewTrendApprovalDecision, number> = {
  'accept-evidence-for-manual-review': 2, 'needs-more-evidence': 1, 'reject-for-now': 0,
};

function transitions(receipts: GroupMemoryReadinessReviewTrendApprovalReceipt[]) {
  let decisionOscillationCount = 0;
  let decisionRegressionCount = 0;
  let sourceReportRegressionCount = 0;
  for (let index = 1; index < receipts.length; index += 1) {
    const current = receipts[index]!; const previous = receipts[index - 1]!;
    if (RANK[current.decision] < RANK[previous.decision]) decisionRegressionCount += 1;
    if (current.sourceReference.generatedAt < previous.sourceReference.generatedAt) {
      sourceReportRegressionCount += 1;
    }
    if (index >= 2 && current.decision === receipts[index - 2]!.decision
      && current.decision !== previous.decision) decisionOscillationCount += 1;
  }
  return { decisionOscillationCount, decisionRegressionCount, sourceReportRegressionCount };
}

function resolveStatus(input: Omit<GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
  'latestDecision' | 'receiptCount' | 'status'>
): GroupMemoryReadinessReviewTrendApprovalHistoryStatus {
  if (input.futureCount) return 'future-reviewed-at';
  if (input.duplicateReviewedAtCount) return 'duplicate-reviewed-at';
  if (input.sourceReportRegressionCount) return 'source-report-regression';
  if (input.duplicateSourceReportCount) return 'duplicate-source-report';
  if (input.decisionOscillationCount) return 'decision-oscillation';
  if (input.decisionRegressionCount) return 'decision-regression';
  if (input.expiredCount) return 'expired-receipts';
  return 'consistent-history';
}

export function auditGroupMemoryReadinessReviewTrendApprovalHistory(
  input: GroupMemoryReadinessReviewTrendApprovalReceipt[],
  now = Date.now(),
): GroupMemoryReadinessReviewTrendApprovalHistoryAudit {
  const receipts = [...input].sort((left, right) => left.reviewedAt - right.reviewedAt);
  const base = {
    ...transitions(receipts),
    duplicateReviewedAtCount: receipts.length
      - new Set(receipts.map((item) => item.reviewedAt)).size,
    duplicateSourceReportCount: receipts.length
      - new Set(receipts.map((item) => item.sourceReference.generatedAt)).size,
    expiredCount: receipts.filter((item) => (
      now - item.reviewedAt > MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_AGE_MS
    )).length,
    futureCount: receipts.filter((item) => item.reviewedAt > now).length,
  };
  return { ...base, latestDecision: receipts.at(-1)?.decision ?? null,
    receiptCount: receipts.length, status: resolveStatus(base) };
}
