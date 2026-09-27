import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  evaluateGroupMemoryCandidateShadowCorpus,
  MAX_GROUP_MEMORY_SHADOW_CORPUS_FILE_BYTES,
  parseGroupMemoryShadowCorpusJson,
  type GroupMemoryCandidateShadowReport,
  type GroupMemoryShadowCorpusImportIssue,
} from '../../group-memory';

export interface GroupMemoryShadowCorpusPreviewState {
  corpusId: string;
  errorMessage: string;
  fileName: string;
  issues: GroupMemoryShadowCorpusImportIssue[];
  report: GroupMemoryCandidateShadowReport | null;
  sampleCount: number;
  status: 'idle' | 'reading' | 'invalid' | 'ready' | 'read-failed';
}

const EMPTY_PREVIEW: GroupMemoryShadowCorpusPreviewState = {
  corpusId: '', errorMessage: '', fileName: '', issues: [], report: null,
  sampleCount: 0, status: 'idle',
};

function useDiscardPreviewOnHide(
  requestIdRef: { current: number },
  setPreview: Dispatch<SetStateAction<GroupMemoryShadowCorpusPreviewState>>,
) {
  useEffect(() => {
    const discard = () => {
      requestIdRef.current += 1;
      setPreview(EMPTY_PREVIEW);
    };
    const discardWhenHidden = () => {
      if (document.visibilityState === 'hidden') discard();
    };
    document.addEventListener('visibilitychange', discardWhenHidden);
    window.addEventListener('pagehide', discard);
    return () => {
      requestIdRef.current += 1;
      document.removeEventListener('visibilitychange', discardWhenHidden);
      window.removeEventListener('pagehide', discard);
    };
  }, [requestIdRef, setPreview]);
}

export function useSettingsGroupMemoryShadowCorpusPreview() {
  const [preview, setPreview] = useState(EMPTY_PREVIEW);
  const requestIdRef = useRef(0);
  useDiscardPreviewOnHide(requestIdRef, setPreview);

  const clear = () => {
    requestIdRef.current += 1;
    setPreview(EMPTY_PREVIEW);
  };
  const loadFile = async (file: File | null) => {
    if (!file) return clear();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (file.size > MAX_GROUP_MEMORY_SHADOW_CORPUS_FILE_BYTES) {
      setPreview({
        ...EMPTY_PREVIEW, fileName: file.name,
        issues: [{ code: 'corpus-too-large', path: '$' }], status: 'invalid',
      });
      return;
    }
    setPreview({ ...EMPTY_PREVIEW, fileName: file.name, status: 'reading' });
    try {
      const imported = parseGroupMemoryShadowCorpusJson(await file.text());
      if (requestIdRef.current !== requestId) return;
      if (!imported.corpus) {
        setPreview({ ...EMPTY_PREVIEW, fileName: file.name, issues: imported.issues, status: 'invalid' });
        return;
      }
      setPreview({
        ...EMPTY_PREVIEW, corpusId: imported.corpus.corpusId, fileName: file.name,
        report: evaluateGroupMemoryCandidateShadowCorpus(imported.corpus.samples),
        sampleCount: imported.corpus.samples.length, status: 'ready',
      });
    } catch {
      if (requestIdRef.current !== requestId) return;
      setPreview({
        ...EMPTY_PREVIEW, errorMessage: '文件读取失败，请重新选择。',
        fileName: file.name, status: 'read-failed',
      });
    }
  };
  return { clear, loadFile, preview };
}
