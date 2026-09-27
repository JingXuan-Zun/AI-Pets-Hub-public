import { useEffect, useRef, useState } from 'react';
import {
  MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_BYTES,
  parseGroupMemoryReadinessApprovalHistoryExportJson,
  validateGroupMemoryReadinessApprovalHistoryExport,
  type GroupMemoryReadinessApprovalHistoryExport,
  type GroupMemoryReadinessApprovalHistoryImportIssue,
} from '../../group-memory';

const EMPTY = {
  issues: [] as GroupMemoryReadinessApprovalHistoryImportIssue[],
  report: null as GroupMemoryReadinessApprovalHistoryExport | null,
  status: 'idle' as 'idle' | 'reading' | 'invalid' | 'valid' | 'warning' | 'read-failed',
};

export function useSettingsGroupMemoryReadinessManualReleaseReview() {
  const [preview, setPreview] = useState(EMPTY);
  const requestRef = useRef(0);
  const clear = () => { requestRef.current += 1; setPreview(EMPTY); };
  useEffect(() => {
    const discard = () => { requestRef.current += 1; setPreview(EMPTY); };
    const hidden = () => { if (document.visibilityState === 'hidden') discard(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', discard);
    return () => {
      requestRef.current += 1;
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', discard);
    };
  }, []);
  const loadFile = async (file: File) => {
    const requestId = requestRef.current + 1; requestRef.current = requestId;
    if (file.size > MAX_GROUP_MEMORY_READINESS_APPROVAL_HISTORY_EXPORT_BYTES) return setPreview({
      issues: ['invalid-report'], report: null, status: 'invalid',
    });
    setPreview({ ...EMPTY, status: 'reading' });
    try {
      const report = parseGroupMemoryReadinessApprovalHistoryExportJson(await file.text());
      if (requestRef.current !== requestId) return;
      if (!report) return setPreview({ issues: ['invalid-report'], report: null, status: 'invalid' });
      const issues = validateGroupMemoryReadinessApprovalHistoryExport(report);
      setPreview({ issues, report, status: issues.length ? 'warning' : 'valid' });
    } catch {
      if (requestRef.current === requestId) setPreview({ ...EMPTY, status: 'read-failed' });
    }
  };
  return { clear, loadFile, preview };
}
