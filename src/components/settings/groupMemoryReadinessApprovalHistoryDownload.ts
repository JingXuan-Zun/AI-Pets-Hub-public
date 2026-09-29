import {
  serializeGroupMemoryReadinessApprovalHistoryExport,
  type GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessApprovalHistory(
  audit: GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
  manualReleaseReviewOnlyAcknowledged: boolean,
) {
  const generatedAt = Date.now();
  downloadJsonTextFile(
    `group-memory-readiness-approval-history-${generatedAt}.json`,
    serializeGroupMemoryReadinessApprovalHistoryExport(
      audit, manualReleaseReviewOnlyAcknowledged, generatedAt,
    ),
  );
}
