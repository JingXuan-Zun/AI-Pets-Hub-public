import { groupMemoryReadinessComparisonsMatch } from './groupMemoryReadinessReviewReceiptImport';
import type { GroupMemoryReadinessComparison } from './groupMemoryAutoWriteReadinessComparison';
import type {
  GroupMemoryReadinessReviewDecision,
  GroupMemoryReadinessReviewReceipt,
} from './groupMemoryReadinessReviewReceipt';
import { MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS } from './groupMemoryReadinessReviewReceiptImport';

export const MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES = 2;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES = 10;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_BATCH_BYTES = 512 * 1024;

export type GroupMemoryReadinessReviewHistoryStatus =
  | 'decision-oscillation'
  | 'decision-regression'
  | 'duplicate-reviewed-at'
  | 'evidence-regression'
  | 'expired-receipts'
  | 'future-reviewed-at'
  | 'consistent-history';

export interface GroupMemoryReadinessReviewHistoryAudit {
  currentComparisonMatchCount: number;
  decisionOscillationCount: number;
  decisionRegressionCount: number;
  duplicateReviewedAtCount: number;
  evidenceRegressionCount: number;
  expiredCount: number;
  futureCount: number;
  latestMatchesCurrentComparison: boolean;
  latestReviewedAt: number | null;
  receiptCount: number;
  status: GroupMemoryReadinessReviewHistoryStatus;
}

const DECISION_RANK: Record<GroupMemoryReadinessReviewDecision, number> = {
  'accept-for-version-review': 2, 'needs-more-evidence': 1, 'reject-for-now': 0,
};

function countTransitions(receipts: GroupMemoryReadinessReviewReceipt[]) {
  let decisionRegressionCount = 0;
  let decisionOscillationCount = 0;
  let evidenceRegressionCount = 0;
  for (let index = 1; index < receipts.length; index += 1) {
    const current = receipts[index]!;
    const previous = receipts[index - 1]!;
    if (DECISION_RANK[current.decision] < DECISION_RANK[previous.decision]) {
      decisionRegressionCount += 1;
    }
    const currentEvidence = current.comparison.latestGeneratedAt ?? -1;
    const previousEvidence = previous.comparison.latestGeneratedAt ?? -1;
    if (currentEvidence < previousEvidence) evidenceRegressionCount += 1;
    if (index >= 2 && current.decision === receipts[index - 2]!.decision
      && current.decision !== previous.decision) decisionOscillationCount += 1;
  }
  return { decisionOscillationCount, decisionRegressionCount, evidenceRegressionCount };
}

export function resolveGroupMemoryReadinessReviewHistoryStatus(input: Omit<GroupMemoryReadinessReviewHistoryAudit,
  'latestMatchesCurrentComparison' | 'latestReviewedAt' | 'receiptCount' | 'status'>
): GroupMemoryReadinessReviewHistoryStatus {
  if (input.futureCount) return 'future-reviewed-at';
  if (input.duplicateReviewedAtCount) return 'duplicate-reviewed-at';
  if (input.evidenceRegressionCount) return 'evidence-regression';
  if (input.decisionOscillationCount) return 'decision-oscillation';
  if (input.decisionRegressionCount) return 'decision-regression';
  if (input.expiredCount) return 'expired-receipts';
  return 'consistent-history';
}

export function auditGroupMemoryReadinessReviewHistory(
  input: GroupMemoryReadinessReviewReceipt[],
  currentComparison: GroupMemoryReadinessComparison,
  now = Date.now(),
): GroupMemoryReadinessReviewHistoryAudit {
  const receipts = [...input].sort((left, right) => left.reviewedAt - right.reviewedAt);
  const latest = receipts.at(-1) ?? null;
  const transitions = countTransitions(receipts);
  const base = {
    currentComparisonMatchCount: receipts.filter((item) => (
      groupMemoryReadinessComparisonsMatch(item.comparison, currentComparison)
    )).length,
    ...transitions,
    duplicateReviewedAtCount: receipts.length
      - new Set(receipts.map((item) => item.reviewedAt)).size,
    expiredCount: receipts.filter((item) => (
      now - item.reviewedAt > MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS
    )).length,
    futureCount: receipts.filter((item) => item.reviewedAt > now).length,
  };
  return {
    ...base,
    latestMatchesCurrentComparison: latest ? groupMemoryReadinessComparisonsMatch(
      latest.comparison, currentComparison,
    ) : false,
    latestReviewedAt: latest?.reviewedAt ?? null,
    receiptCount: receipts.length,
    status: resolveGroupMemoryReadinessReviewHistoryStatus(base),
  };
}
