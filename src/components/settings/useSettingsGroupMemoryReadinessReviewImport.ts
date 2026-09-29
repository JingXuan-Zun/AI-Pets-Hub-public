import { useEffect, useRef, useState } from 'react';
import {
  MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_BYTES,
  parseGroupMemoryReadinessReviewReceiptJson,
  validateGroupMemoryReadinessReviewReceipt,
  type GroupMemoryReadinessComparison,
  type GroupMemoryReadinessReviewReceipt,
  type GroupMemoryReadinessReviewReceiptIssue,
} from '../../group-memory';

export interface GroupMemoryReadinessReviewImportPreview {
  issues: GroupMemoryReadinessReviewReceiptIssue[];
  receipt: GroupMemoryReadinessReviewReceipt | null;
  status: 'idle' | 'reading' | 'invalid' | 'valid' | 'read-failed';
}

const EMPTY: GroupMemoryReadinessReviewImportPreview = {
  issues: [], receipt: null, status: 'idle',
};

export function useSettingsGroupMemoryReadinessReviewImport(
  currentComparison: GroupMemoryReadinessComparison,
) {
  const [preview, setPreview] = useState(EMPTY);
  const requestRef = useRef(0);
  const clear = () => { requestRef.current += 1; setPreview(EMPTY); };
  useEffect(() => {
    requestRef.current += 1; setPreview(EMPTY);
  }, [currentComparison]);
  useEffect(() => {
    const discard = () => { requestRef.current += 1; setPreview(EMPTY); };
    const hidden = () => { if (document.visibilityState === 'hidden') discard(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', discard);
    return () => {
      requestRef.current += 1;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', discard);
    };
  }, []);
  const loadFile = async (file: File) => {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (file.size > MAX_GROUP_MEMORY_READINESS_REVIEW_RECEIPT_BYTES) {
      return setPreview({ issues: ['invalid-receipt'], receipt: null, status: 'invalid' });
    }
    setPreview({ ...EMPTY, status: 'reading' });
    try {
      const receipt = parseGroupMemoryReadinessReviewReceiptJson(await file.text());
      if (requestRef.current !== requestId) return;
      if (!receipt) return setPreview({
        issues: ['invalid-receipt'], receipt: null, status: 'invalid',
      });
      const issues = validateGroupMemoryReadinessReviewReceipt(receipt, currentComparison);
      setPreview({ issues, receipt, status: issues.length ? 'invalid' : 'valid' });
    } catch {
      if (requestRef.current === requestId) setPreview({ ...EMPTY, status: 'read-failed' });
    }
  };
  return { clear, loadFile, preview };
}
