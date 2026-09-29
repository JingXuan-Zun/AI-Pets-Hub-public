import {
  serializeGroupMemoryReadinessManualReleaseReviewReceipt,
  type GroupMemoryReadinessManualReleaseReviewInput,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessManualReleaseReview(
  input: GroupMemoryReadinessManualReleaseReviewInput,
) {
  const reviewedAt = Date.now();
  const text = serializeGroupMemoryReadinessManualReleaseReviewReceipt(input, reviewedAt);
  if (!text) return false;
  downloadJsonTextFile(`group-memory-manual-release-review-${reviewedAt}.json`, text);
  return true;
}
