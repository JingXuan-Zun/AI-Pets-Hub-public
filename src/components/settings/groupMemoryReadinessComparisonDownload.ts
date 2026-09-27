import {
  serializeGroupMemoryReadinessComparisonExport,
  type GroupMemoryReadinessComparison,
} from '../../group-memory';
import { downloadJsonTextFile } from './settingsDownloadUtils';

export function downloadGroupMemoryReadinessComparison(
  comparison: GroupMemoryReadinessComparison,
  independentBatchesConfirmedByTester: boolean,
) {
  const exportedAt = Date.now();
  downloadJsonTextFile(
    `group-memory-readiness-comparison-${exportedAt}.json`,
    serializeGroupMemoryReadinessComparisonExport(
      comparison, independentBatchesConfirmedByTester, exportedAt,
    ),
  );
}
