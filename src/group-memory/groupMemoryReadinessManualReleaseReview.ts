import type {
  GroupMemoryReadinessApprovalHistoryExport,
} from './groupMemoryReadinessReviewTrendApprovalHistoryExport';
import type {
  GroupMemoryReadinessApprovalHistoryImportIssue,
} from './groupMemoryReadinessApprovalHistoryExportImport';

export const MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RATIONALE_LENGTH = 1_000;
export type GroupMemoryReadinessManualReleaseDecision =
  | 'accept-for-manual-configuration-review' | 'needs-more-evidence' | 'reject-for-now';

export interface GroupMemoryReadinessManualReleaseReviewInput {
  configurationReviewOnlyAcknowledged: boolean;
  decision: GroupMemoryReadinessManualReleaseDecision;
  issues: GroupMemoryReadinessApprovalHistoryImportIssue[];
  rationale: string;
  report: GroupMemoryReadinessApprovalHistoryExport;
}

export function canRecordGroupMemoryReadinessManualReleaseReview(
  input: GroupMemoryReadinessManualReleaseReviewInput,
) {
  if (!input.configurationReviewOnlyAcknowledged) return false;
  if (input.decision !== 'accept-for-manual-configuration-review') return true;
  return !input.issues.length
    && input.report.checklist.decision === 'ready-for-manual-release-review';
}

export function createGroupMemoryReadinessManualReleaseReviewReceipt(
  input: GroupMemoryReadinessManualReleaseReviewInput,
  reviewedAt = Date.now(),
) {
  if (!canRecordGroupMemoryReadinessManualReleaseReview(input)) return null;
  const rationaleLength = input.rationale.trim().slice(
    0, MAX_GROUP_MEMORY_READINESS_MANUAL_RELEASE_RATIONALE_LENGTH,
  ).length;
  return {
    decision: input.decision,
    kind: 'group-memory-readiness-manual-release-review-receipt',
    rationaleSummary: { included: false, length: rationaleLength, present: rationaleLength > 0 },
    reviewedAt: Number.isFinite(reviewedAt) ? reviewedAt : Date.now(),
    schemaVersion: 1,
    sourceReference: {
      checklistDecision: input.report.checklist.decision,
      generatedAt: input.report.generatedAt,
      historyStatus: input.report.report.status,
      latestDecision: input.report.report.latestDecision,
      receiptCount: input.report.report.receiptCount,
    },
    validationBoundary: {
      automaticWriteEnabled: false, configurationApplied: false,
      configurationReviewOnly: true, executable: false, productionPolicyChanged: false,
    },
  } as const;
}

export type GroupMemoryReadinessManualReleaseReviewReceipt = NonNullable<
  ReturnType<typeof createGroupMemoryReadinessManualReleaseReviewReceipt>
>;

export function serializeGroupMemoryReadinessManualReleaseReviewReceipt(
  input: GroupMemoryReadinessManualReleaseReviewInput,
  reviewedAt = Date.now(),
) {
  const receipt = createGroupMemoryReadinessManualReleaseReviewReceipt(input, reviewedAt);
  return receipt ? `${JSON.stringify(receipt, null, 2)}\n` : null;
}
