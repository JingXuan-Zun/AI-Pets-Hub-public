import {
  serializeGroupMemoryReadinessReviewTrendExport,
  type GroupMemoryReadinessReviewTrend,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessReviewTrend(
  trend: GroupMemoryReadinessReviewTrend,
  distinctVersionSnapshotsConfirmedByTester: boolean,
) {
  const generatedAt = Date.now();
  downloadJsonTextFile(
    `group-memory-readiness-review-trend-${generatedAt}.json`,
    serializeGroupMemoryReadinessReviewTrendExport(
      trend, distinctVersionSnapshotsConfirmedByTester, generatedAt,
    ),
  );
}
