import {
  serializeGroupMemoryReadinessReviewHistoryExport,
  type GroupMemoryReadinessReviewHistoryAudit,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessReviewHistoryAudit(
  audit: GroupMemoryReadinessReviewHistoryAudit,
) {
  const generatedAt = Date.now();
  downloadJsonTextFile(
    `group-memory-readiness-review-history-${generatedAt}.json`,
    serializeGroupMemoryReadinessReviewHistoryExport(audit, generatedAt),
  );
}
