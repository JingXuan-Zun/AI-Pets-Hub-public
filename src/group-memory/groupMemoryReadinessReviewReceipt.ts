import type { GroupMemoryReadinessComparison } from './groupMemoryAutoWriteReadinessComparison';

export const MAX_GROUP_MEMORY_READINESS_REVIEW_RATIONALE_LENGTH = 1_000;

export type GroupMemoryReadinessReviewDecision =
  | 'accept-for-version-review'
  | 'needs-more-evidence'
  | 'reject-for-now';

export interface GroupMemoryReadinessReviewInput {
  comparison: GroupMemoryReadinessComparison;
  decision: GroupMemoryReadinessReviewDecision;
  independentBatchesConfirmedByTester: boolean;
  noAutomaticApplicationAcknowledged: boolean;
  rationale: string;
}

export function canRecordGroupMemoryReadinessReview(input: GroupMemoryReadinessReviewInput) {
  if (!input.noAutomaticApplicationAcknowledged) return false;
  if (input.decision !== 'accept-for-version-review') return true;
  return input.comparison.status === 'stable-shadow-evidence'
    && input.independentBatchesConfirmedByTester;
}

export function createGroupMemoryReadinessReviewReceipt(
  input: GroupMemoryReadinessReviewInput,
  reviewedAt = Date.now(),
) {
  if (!canRecordGroupMemoryReadinessReview(input)) return null;
  const rationale = input.rationale.trim().slice(
    0, MAX_GROUP_MEMORY_READINESS_REVIEW_RATIONALE_LENGTH,
  );
  return {
    attestation: {
      independentBatchesConfirmedByTester: input.independentBatchesConfirmedByTester,
      noAutomaticApplicationAcknowledged: true,
      programmaticallyVerifiedIndependentBatches: false,
    },
    comparison: { ...input.comparison, unstableGateIds: [...input.comparison.unstableGateIds] },
    decision: input.decision,
    kind: 'group-memory-readiness-review-receipt',
    privacy: {
      containsChatContent: false, containsFileNamesOrLocalPaths: false,
      containsMemorySummaries: false, containsMessageOrRoleIds: false,
      containsReviewerRationale: false,
    },
    rationaleSummary: { included: false, length: rationale.length, present: rationale.length > 0 },
    reviewedAt: Number.isFinite(reviewedAt) ? reviewedAt : Date.now(),
    schemaVersion: 1,
    validationBoundary: {
      automaticWriteEnabled: false, executable: false,
      persistedByApplication: false, productionPolicyChanged: false,
    },
  } as const;
}

export type GroupMemoryReadinessReviewReceipt = NonNullable<
  ReturnType<typeof createGroupMemoryReadinessReviewReceipt>
>;

export function serializeGroupMemoryReadinessReviewReceipt(
  input: GroupMemoryReadinessReviewInput,
  reviewedAt = Date.now(),
) {
  const receipt = createGroupMemoryReadinessReviewReceipt(input, reviewedAt);
  return receipt ? `${JSON.stringify(receipt, null, 2)}\n` : null;
}
