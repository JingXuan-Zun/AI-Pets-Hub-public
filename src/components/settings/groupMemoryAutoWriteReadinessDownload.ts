import {
  serializeGroupMemoryAutoWriteReadinessExport,
  type GroupMemoryAutoWriteReadinessReport,
} from '../../group-memory';

export function downloadGroupMemoryAutoWriteReadinessReport(
  report: GroupMemoryAutoWriteReadinessReport,
) {
  const generatedAt = Date.now();
  const blob = new Blob([serializeGroupMemoryAutoWriteReadinessExport(report, generatedAt)], {
    type: 'application/json;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.download = `group-memory-auto-write-readiness-${generatedAt}.json`;
  anchor.href = url;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
