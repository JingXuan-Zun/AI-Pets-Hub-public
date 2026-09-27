import { useEffect, useRef, useState } from 'react';
import {
  auditGroupMemoryReadinessReviewHistory,
  MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_BATCH_BYTES,
  MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES,
  MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_BYTES,
  MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES,
  parseGroupMemoryReadinessReviewReceiptJson,
  type GroupMemoryReadinessComparison,
  type GroupMemoryReadinessReviewHistoryAudit,
} from '../../group-memory';
import type { Dispatch, SetStateAction } from 'react';

export type GroupMemoryReadinessReviewHistoryIssue =
  | 'batch-too-large' | 'file-too-large' | 'invalid-receipt'
  | 'too-few-files' | 'too-many-files';

const EMPTY = { audit: null as GroupMemoryReadinessReviewHistoryAudit | null,
  fileCount: 0, issues: [] as GroupMemoryReadinessReviewHistoryIssue[],
  status: 'idle' as 'idle' | 'reading' | 'invalid' | 'ready' | 'read-failed' };

type Preview = typeof EMPTY;

function validateFiles(files: File[]): GroupMemoryReadinessReviewHistoryIssue | null {
  if (files.length < MIN_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES) return 'too-few-files';
  if (files.length > MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_FILES) return 'too-many-files';
  if (files.some((file) => file.size > MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_BYTES)) {
    return 'file-too-large';
  }
  return files.reduce((sum, file) => sum + file.size, 0)
    > MAX_GROUP_MEMORY_READINESS_REVIEW_HISTORY_BATCH_BYTES ? 'batch-too-large' : null;
}

function useDiscardHistoryOnHide(
  requestRef: { current: number },
  setPreview: Dispatch<SetStateAction<Preview>>,
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

export function useSettingsGroupMemoryReadinessReviewHistory(
  currentComparison: GroupMemoryReadinessComparison,
) {
  const [preview, setPreview] = useState(EMPTY);
  const requestRef = useRef(0);
  const clear = () => { requestRef.current += 1; setPreview(EMPTY); };
  useEffect(() => { requestRef.current += 1; setPreview(EMPTY); }, [currentComparison]);
  useDiscardHistoryOnHide(requestRef, setPreview);
  const loadFiles = async (files: File[]) => {
    const count = files.length;
    const issue = validateFiles(files);
    if (issue) return setPreview({
      ...EMPTY, fileCount: count, issues: [issue], status: 'invalid',
    });
    const requestId = requestRef.current + 1; requestRef.current = requestId;
    setPreview({ ...EMPTY, fileCount: count, status: 'reading' });
    try {
      const receipts = await Promise.all(files.map(async (file) => (
        parseGroupMemoryReadinessReviewReceiptJson(await file.text())
      )));
      if (requestRef.current !== requestId) return;
      if (receipts.some((item) => !item)) return setPreview({
        ...EMPTY, fileCount: count, issues: ['invalid-receipt'], status: 'invalid',
      });
      setPreview({ audit: auditGroupMemoryReadinessReviewHistory(
        receipts.filter((item) => item !== null), currentComparison,
      ), fileCount: count, issues: [], status: 'ready' });
    } catch {
      if (requestRef.current === requestId) setPreview({
        ...EMPTY, fileCount: count, status: 'read-failed',
      });
    }
  };
  return { clear, loadFiles, preview };
}
