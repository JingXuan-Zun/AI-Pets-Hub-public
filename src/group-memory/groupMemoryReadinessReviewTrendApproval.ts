import type { GroupMemoryReadinessReviewTrendExport } from './groupMemoryReadinessReviewTrendExport';
import type { GroupMemoryReadinessReviewTrendImportIssue } from './groupMemoryReadinessReviewTrendImport';

export const MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RATIONALE_LENGTH = 1_000;
export type GroupMemoryReadinessReviewTrendApprovalDecision =
  | 'accept-evidence-for-manual-review' | 'needs-more-evidence' | 'reject-for-now';

export interface GroupMemoryReadinessReviewTrendApprovalInput {
  decision: GroupMemoryReadinessReviewTrendApprovalDecision;
  issues: GroupMemoryReadinessReviewTrendImportIssue[];
  noAutomaticApplicationAcknowledged: boolean;
  rationale: string;
  report: GroupMemoryReadinessReviewTrendExport;
}

export function canRecordGroupMemoryReadinessReviewTrendApproval(
  input: GroupMemoryReadinessReviewTrendApprovalInput,
) {
  if (!input.noAutomaticApplicationAcknowledged) return false;
  if (input.decision !== 'accept-evidence-for-manual-review') return true;
  return !input.issues.length
    && input.report.checklist.decision === 'ready-for-manual-version-review';
}

export function createGroupMemoryReadinessReviewTrendApprovalReceipt(
  input: GroupMemoryReadinessReviewTrendApprovalInput,
  reviewedAt = Date.now(),
) {
  if (!canRecordGroupMemoryReadinessReviewTrendApproval(input)) return null;
  const rationaleLength = input.rationale.trim().slice(
    0, MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RATIONALE_LENGTH,
  ).length;
  return {
    decision: input.decision,
    kind: 'group-memory-readiness-review-trend-approval-receipt',
    rationaleSummary: { included: false, length: rationaleLength, present: rationaleLength > 0 },
    reviewedAt: Number.isFinite(reviewedAt) ? reviewedAt : Date.now(),
    schemaVersion: 1,
    sourceReference: {
      checklistDecision: input.report.checklist.decision,
      generatedAt: input.report.generatedAt,
      matchCoverageDrop: input.report.trend.matchCoverageDrop,
      regressedMetricCount: input.report.trend.regressedMetricIds.length,
      reportCount: input.report.trend.reportCount,
      trendStatus: input.report.trend.status,
    },
    validationBoundary: {
      automaticWriteEnabled: false, executable: false,
      persistedByApplication: false, productionPolicyChanged: false,
    },
  } as const;
}

export type GroupMemoryReadinessReviewTrendApprovalReceipt = NonNullable<
  ReturnType<typeof createGroupMemoryReadinessReviewTrendApprovalReceipt>
>;

export function serializeGroupMemoryReadinessReviewTrendApprovalReceipt(
  input: GroupMemoryReadinessReviewTrendApprovalInput,
  reviewedAt = Date.now(),
) {
  const receipt = createGroupMemoryReadinessReviewTrendApprovalReceipt(input, reviewedAt);
  return receipt ? `${JSON.stringify(receipt, null, 2)}\n` : null;
}
