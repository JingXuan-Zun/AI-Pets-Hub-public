import {
  serializeGroupMemoryReadinessReviewTrendApprovalReceipt,
  type GroupMemoryReadinessReviewTrendApprovalInput,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessReviewTrendApproval(
  input: GroupMemoryReadinessReviewTrendApprovalInput,
) {
  const reviewedAt = Date.now();
  const text = serializeGroupMemoryReadinessReviewTrendApprovalReceipt(input, reviewedAt);
  if (!text) return false;
  downloadJsonTextFile(`group-memory-readiness-trend-approval-${reviewedAt}.json`, text);
  return true;
}
