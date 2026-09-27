import { GROUP_MEMORY_AUTO_WRITE_GATE_IDS } from './groupMemoryAutoWriteReadiness';
import type {
  GroupMemoryReadinessComparison,
  GroupMemoryReadinessComparisonStatus,
} from './groupMemoryAutoWriteReadinessComparison';
import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_RATIONALE_LENGTH,
  type GroupMemoryReadinessReviewDecision,
  type GroupMemoryReadinessReviewReceipt,
} from './groupMemoryReadinessReviewReceipt';
import { isObject } from './groupMemoryNormalizationUtils';

export const MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_BYTES = 64 * 1024;
export const MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type GroupMemoryReadinessReviewReceiptIssue =
  | 'comparison-mismatch'
  | 'expired-receipt'
  | 'future-reviewed-at'
  | 'invalid-receipt';

const COMPARISON_STATUSES: GroupMemoryReadinessComparisonStatus[] = [
  'accuracy-drift', 'duplicate-report-time', 'eligible-precision-drift',
  'insufficient-reports', 'not-all-shadow-ready', 'stable-shadow-evidence',
  'unsafe-false-eligible', 'unstable-gates',
];
const DECISIONS: GroupMemoryReadinessReviewDecision[] = [
  'accept-for-version-review', 'needs-more-evidence', 'reject-for-now',
];

function exactKeys(value: Record<string, unknown>, keys: string[]) {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function boundedNumber(value: unknown, maximum = 1) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
}

function parseComparison(value: unknown): GroupMemoryReadinessComparison | null {
  if (!isObject(value) || !exactKeys(value, [
    'accuracyDrop', 'eligiblePrecisionDrop', 'independence', 'latestGeneratedAt',
    'minimumAccuracy', 'minimumEligiblePrecision', 'reportCount', 'status',
    'unstableGateIds',
  ])) return null;
  if (!boundedNumber(value.accuracyDrop) || !boundedNumber(value.eligiblePrecisionDrop)
    || !boundedNumber(value.minimumAccuracy) || !boundedNumber(value.minimumEligiblePrecision)
    || value.independence !== 'user-attested-not-verifiable'
    || !Number.isInteger(Number(value.reportCount)) || Number(value.reportCount) < 0
    || Number(value.reportCount) > 10
    || !COMPARISON_STATUSES.includes(value.status as GroupMemoryReadinessComparisonStatus)
    || !Array.isArray(value.unstableGateIds)) return null;
  const gates = value.unstableGateIds;
  if (gates.some((id) => !GROUP_MEMORY_AUTO_WRITE_GATE_IDS.includes(
    id as (typeof GROUP_MEMORY_AUTO_WRITE_GATE_IDS)[number],
  ))
    || new Set(gates).size !== gates.length) return null;
  if (value.latestGeneratedAt !== null
    && (!Number.isFinite(Number(value.latestGeneratedAt))
      || Number(value.latestGeneratedAt) < 0)) return null;
  return { ...value, unstableGateIds: [...gates] } as GroupMemoryReadinessComparison;
}

function parseAttestation(value: unknown) {
  if (!isObject(value) || !exactKeys(value, [
    'independentBatchesConfirmedByTester', 'noAutomaticApplicationAcknowledged',
    'programmaticallyVerifiedIndependentBatches',
  ])) return null;
  if (typeof value.independentBatchesConfirmedByTester !== 'boolean'
    || value.noAutomaticApplicationAcknowledged !== true
    || value.programmaticallyVerifiedIndependentBatches !== false) return null;
  return value as GroupMemoryReadinessReviewReceipt['attestation'];
}

function parseRationaleSummary(value: unknown) {
  if (!isObject(value) || !exactKeys(value, ['included', 'length', 'present'])) return null;
  if (value.included !== false || typeof value.present !== 'boolean'
    || !Number.isInteger(Number(value.length)) || Number(value.length) < 0
    || Number(value.length) > MAX_GROUP_MEMORY_READINESS_REVIEW_RATIONALE_LENGTH
    || value.present !== (Number(value.length) > 0)) return null;
  return value as GroupMemoryReadinessReviewReceipt['rationaleSummary'];
}

function hasSafePrivacy(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'containsChatContent', 'containsFileNamesOrLocalPaths', 'containsMemorySummaries',
    'containsMessageOrRoleIds', 'containsReviewerRationale',
  ]) && Object.values(value).every((item) => item === false);
}

function hasNonExecutableBoundary(value: unknown) {
  return isObject(value) && exactKeys(value, [
    'automaticWriteEnabled', 'executable', 'persistedByApplication', 'productionPolicyChanged',
  ]) && Object.values(value).every((item) => item === false);
}

export function parseGroupMemoryReadinessReviewReceiptJson(
  text: string,
): GroupMemoryReadinessReviewReceipt | null {
  let value: unknown;
  try { value = JSON.parse(text); } catch { return null; }
  if (!isObject(value) || !exactKeys(value, [
    'attestation', 'comparison', 'decision', 'kind', 'privacy', 'rationaleSummary',
    'reviewedAt', 'schemaVersion', 'validationBoundary',
  ])) return null;
  const attestation = parseAttestation(value.attestation);
  const comparison = parseComparison(value.comparison);
  const rationaleSummary = parseRationaleSummary(value.rationaleSummary);
  if (value.kind !== 'group-memory-readiness-review-receipt' || value.schemaVersion !== 1
    || !DECISIONS.includes(value.decision as GroupMemoryReadinessReviewDecision)
    || !Number.isFinite(Number(value.reviewedAt)) || Number(value.reviewedAt) < 0
    || !attestation || !comparison || !rationaleSummary
    || !hasSafePrivacy(value.privacy) || !hasNonExecutableBoundary(value.validationBoundary)) return null;
  if (value.decision === 'accept-for-version-review'
    && (comparison.status !== 'stable-shadow-evidence'
      || !attestation.independentBatchesConfirmedByTester)) return null;
  const parsed = { ...value, attestation, comparison, rationaleSummary } as unknown;
  return parsed as GroupMemoryReadinessReviewReceipt;
}

type ComparableReadiness = Omit<GroupMemoryReadinessComparison, 'unstableGateIds'> & {
  readonly unstableGateIds: readonly string[];
};

export function groupMemoryReadinessComparisonsMatch(
  left: ComparableReadiness,
  right: ComparableReadiness,
) {
  return left.accuracyDrop === right.accuracyDrop
    && left.eligiblePrecisionDrop === right.eligiblePrecisionDrop
    && left.independence === right.independence
    && left.latestGeneratedAt === right.latestGeneratedAt
    && left.minimumAccuracy === right.minimumAccuracy
    && left.minimumEligiblePrecision === right.minimumEligiblePrecision
    && left.reportCount === right.reportCount && left.status === right.status
    && left.unstableGateIds.join('|') === right.unstableGateIds.join('|');
}

export function validateGroupMemoryReadinessReviewReceipt(
  receipt: GroupMemoryReadinessReviewReceipt,
  currentComparison: GroupMemoryReadinessComparison,
  now = Date.now(),
): GroupMemoryReadinessReviewReceiptIssue[] {
  const issues: GroupMemoryReadinessReviewReceiptIssue[] = [];
  if (!groupMemoryReadinessComparisonsMatch(receipt.comparison, currentComparison)) {
    issues.push('comparison-mismatch');
  }
  if (receipt.reviewedAt > now) issues.push('future-reviewed-at');
  if (now - receipt.reviewedAt > MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_AGE_MS) {
    issues.push('expired-receipt');
  }
  return issues;
}
