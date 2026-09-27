import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  compareGroupMemoryReadinessReviewHistoryExports,
  MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_EXPORT_BATCH_BYTES,
  MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_EXPORT_BYTES,
  MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES,
  MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES,
  parseGroupMemoryReadinessReviewHistoryExportJson,
  type GroupMemoryReadinessReviewTrend,
} from '../../group-memory';

export type GroupMemoryReadinessReviewTrendIssue =
  | 'batch-too-large' | 'file-too-large' | 'invalid-report'
  | 'too-few-files' | 'too-many-files';

const EMPTY = { fileCount: 0, issues: [] as GroupMemoryReadinessReviewTrendIssue[],
  status: 'idle' as 'idle' | 'reading' | 'invalid' | 'ready' | 'read-failed',
  trend: null as GroupMemoryReadinessReviewTrend | null };
type Preview = typeof EMPTY;

function validateFiles(files: File[]): GroupMemoryReadinessReviewTrendIssue | null {
  if (files.length < MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES) return 'too-few-files';
  if (files.length > MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES) return 'too-many-files';
  if (files.some((file) => file.size > MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_EXPORT_BYTES)) {
    return 'file-too-large';
  }
  return files.reduce((sum, file) => sum + file.size, 0)
    > MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_EXPORT_BATCH_BYTES ? 'batch-too-large' : null;
}

function useDiscardTrendOnHide(
  requestRef: { current: number }, setPreview: Dispatch<SetStateAction<Preview>>,
) {
  useEffect(() => {
    const discard = () => { requestRef.current += 1; setPreview(EMPTY); };
    const hidden = () => { if (document.visibilityState === 'hidden') discard(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', discard);
    return () => {
      requestRef.current += 1;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', discard);
    };
  }, [requestRef, setPreview]);
}

export function useSettingsGroupMemoryReadinessReviewTrend() {
  const [preview, setPreview] = useState(EMPTY);
  const requestRef = useRef(0);
  const clear = () => { requestRef.current += 1; setPreview(EMPTY); };
  useDiscardTrendOnHide(requestRef, setPreview);
  const loadFiles = async (files: File[]) => {
    const issue = validateFiles(files);
    if (issue) return setPreview({
      ...EMPTY, fileCount: files.length, issues: [issue], status: 'invalid',
    });
    const requestId = requestRef.current + 1; requestRef.current = requestId;
    setPreview({ ...EMPTY, fileCount: files.length, status: 'reading' });
    try {
      const reports = await Promise.all(files.map(async (file) => (
        parseGroupMemoryReadinessReviewHistoryExportJson(await file.text())
      )));
      if (requestRef.current !== requestId) return;
      if (reports.some((item) => !item)) return setPreview({
        ...EMPTY, fileCount: files.length, issues: ['invalid-report'], status: 'invalid',
      });
      setPreview({ fileCount: files.length, issues: [], status: 'ready',
        trend: compareGroupMemoryReadinessReviewHistoryExports(
          reports.filter((item) => item !== null),
        ) });
    } catch {
      if (requestRef.current === requestId) setPreview({
        ...EMPTY, fileCount: files.length, status: 'read-failed',
      });
    }
  };
  return { clear, loadFiles, preview };
}
