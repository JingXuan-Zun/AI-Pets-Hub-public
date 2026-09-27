import {
  serializeGroupMemoryReadinessReviewReceipt,
  type GroupMemoryReadinessReviewInput,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessReviewReceipt(
  input: GroupMemoryReadinessReviewInput,
) {
  const reviewedAt = Date.now();
  const text = serializeGroupMemoryReadinessReviewReceipt(input, reviewedAt);
  if (!text) return false;
  downloadJsonTextFile(`group-memory-readiness-review-${reviewedAt}.json`, text);
  return true;
}
