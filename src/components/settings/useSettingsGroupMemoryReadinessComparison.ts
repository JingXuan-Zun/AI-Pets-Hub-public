import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  compareGroupMemoryAutoWriteReadinessExports,
  MAX_GROUP_MEMORY_READINESS_REPORT_BATCH_BYTES,
  MAX_GROUP_MEMORY_READINESS_REPORT_FILE_BYTES,
  MAX_GROUP_MEMORY_READINESS_REPORT_FILES,
  parseGroupMemoryAutoWriteReadinessExportJson,
  type GroupMemoryReadinessComparison,
} from '../../group-memory';

export type GroupMemoryReadinessComparisonIssueCode =
  | 'batch-too-large'
  | 'file-too-large'
  | 'invalid-report'
  | 'too-many-files';

export interface GroupMemoryReadinessComparisonPreview {
  comparison: GroupMemoryReadinessComparison | null;
  fileCount: number;
  issues: Array<{ code: GroupMemoryReadinessComparisonIssueCode; fileName: string }>;
  status: 'idle' | 'reading' | 'invalid' | 'ready' | 'read-failed';
}

const EMPTY: GroupMemoryReadinessComparisonPreview = {
  comparison: null, fileCount: 0, issues: [], status: 'idle',
};

function useDiscardComparisonOnHide(
  requestRef: { current: number },
  setPreview: Dispatch<SetStateAction<GroupMemoryReadinessComparisonPreview>>,
) {
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
  }, [requestRef, setPreview]);
}

export function useSettingsGroupMemoryReadinessComparison() {
  const [preview, setPreview] = useState(EMPTY);
  const requestRef = useRef(0);
  const clear = () => { requestRef.current += 1; setPreview(EMPTY); };
  useDiscardComparisonOnHide(requestRef, setPreview);
  const loadFiles = async (files: File[]) => {
    if (!files.length) return clear();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    if (files.length > MAX_GROUP_MEMORY_READINESS_REPORT_FILES) {
      return setPreview({ ...EMPTY, fileCount: files.length,
        issues: [{ code: 'too-many-files', fileName: '' }], status: 'invalid' });
    }
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBytes > MAX_GROUP_MEMORY_READINESS_REPORT_BATCH_BYTES) {
      return setPreview({ ...EMPTY, fileCount: files.length,
        issues: [{ code: 'batch-too-large', fileName: '' }], status: 'invalid' });
    }
    const oversized = files.filter((file) => file.size > MAX_GROUP_MEMORY_READINESS_REPORT_FILE_BYTES);
    if (oversized.length) return setPreview({ ...EMPTY, fileCount: files.length,
      issues: oversized.map((file) => ({ code: 'file-too-large', fileName: file.name })),
      status: 'invalid' });
    setPreview({ ...EMPTY, fileCount: files.length, status: 'reading' });
    try {
      const parsed = await Promise.all(files.map(async (file) => ({
        artifact: parseGroupMemoryAutoWriteReadinessExportJson(await file.text()), file,
      })));
      if (requestRef.current !== requestId) return;
      const invalid = parsed.filter((item) => !item.artifact);
      if (invalid.length) return setPreview({ ...EMPTY, fileCount: files.length,
        issues: invalid.map((item) => ({ code: 'invalid-report', fileName: item.file.name })),
        status: 'invalid' });
      setPreview({ comparison: compareGroupMemoryAutoWriteReadinessExports(
        parsed.map((item) => item.artifact!),
      ), fileCount: files.length, issues: [], status: 'ready' });
    } catch {
      if (requestRef.current === requestId) {
        setPreview({ ...EMPTY, fileCount: files.length, status: 'read-failed' });
      }
    }
  };
  return { clear, loadFiles, preview };
}
