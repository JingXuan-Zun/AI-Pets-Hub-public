import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  auditGroupMemoryReadinessReviewTrendApprovalHistory,
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_BATCH_BYTES,
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_FILES,
  MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_BYTES,
  MIN_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_FILES,
  parseGroupMemoryReadinessReviewTrendApprovalReceiptJson,
  type GroupMemoryReadinessReviewTrendApprovalHistoryAudit,
} from '../../group-memory';

export type GroupMemoryReadinessReviewTrendApprovalHistoryIssue =
  | 'batch-too-large' | 'file-too-large' | 'invalid-receipt'
  | 'too-few-files' | 'too-many-files';
const EMPTY = { audit: null as GroupMemoryReadinessReviewTrendApprovalHistoryAudit | null,
  fileCount: 0, issues: [] as GroupMemoryReadinessReviewTrendApprovalHistoryIssue[],
  status: 'idle' as 'idle' | 'reading' | 'invalid' | 'ready' | 'read-failed' };
type Preview = typeof EMPTY;

function validateFiles(files: File[]): GroupMemoryReadinessReviewTrendApprovalHistoryIssue | null {
  if (files.length < MIN_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_FILES) {
    return 'too-few-files';
  }
  if (files.length > MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_FILES) {
    return 'too-many-files';
  }
  if (files.some((file) => file.size
    > MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_RECEIPT_BYTES)) return 'file-too-large';
  return files.reduce((sum, file) => sum + file.size, 0)
    > MAX_GROUP_MEMORY_READINESS_REVIEW_TREND_APPROVAL_HISTORY_BATCH_BYTES
    ? 'batch-too-large' : null;
}

function useDiscardOnHide(
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

export function useSettingsGroupMemoryReadinessReviewTrendApprovalHistory() {
  const [preview, setPreview] = useState(EMPTY); const requestRef = useRef(0);
  const clear = () => { requestRef.current += 1; setPreview(EMPTY); };
  useDiscardOnHide(requestRef, setPreview);
  const loadFiles = async (files: File[]) => {
    const issue = validateFiles(files);
    if (issue) return setPreview({
      ...EMPTY, fileCount: files.length, issues: [issue], status: 'invalid',
    });
    const requestId = requestRef.current + 1; requestRef.current = requestId;
    setPreview({ ...EMPTY, fileCount: files.length, status: 'reading' });
    try {
      const receipts = await Promise.all(files.map(async (file) => (
        parseGroupMemoryReadinessReviewTrendApprovalReceiptJson(await file.text())
      )));
      if (requestRef.current !== requestId) return;
      if (receipts.some((item) => !item)) return setPreview({
        ...EMPTY, fileCount: files.length, issues: ['invalid-receipt'], status: 'invalid',
      });
      setPreview({ audit: auditGroupMemoryReadinessReviewTrendApprovalHistory(
        receipts.filter((item) => item !== null),
      ), fileCount: files.length, issues: [], status: 'ready' });
    } catch {
      if (requestRef.current === requestId) setPreview({
        ...EMPTY, fileCount: files.length, status: 'read-failed',
      });
    }
  };
  return { clear, loadFiles, preview };
}
