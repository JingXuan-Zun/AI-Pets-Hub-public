import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  evaluateRelationshipEvidenceShadowCorpusBatch,
  MAX_RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_FILE_BYTES,
  parseRelationshipEvidenceShadowCorpusJson,
  type RelationshipEvidenceShadowBatchReport,
  type RelationshipEvidenceShadowCorpus,
  type RelationshipEvidenceShadowImportIssueCode,
  type RelationshipEvidenceShadowReport,
} from '../../social-trend';

export const MAX_RELATIONSHIP_EVIDENCE_SHADOW_BATCH_FILES = 20;
export const MAX_RELATIONSHIP_EVIDENCE_SHADOW_BATCH_BYTES = 5_000_000;

export type RelationshipEvidenceShadowPreviewIssueCode =
  | RelationshipEvidenceShadowImportIssueCode
  | 'batch-too-large'
  | 'duplicate-corpus-id'
  | 'too-many-files';

export type RelationshipEvidenceShadowPreviewIssue = {
  code: RelationshipEvidenceShadowPreviewIssueCode;
  path: string;
};

export type RelationshipEvidenceShadowPreviewState = {
  batchReport: RelationshipEvidenceShadowBatchReport | null;
  corpusId: string;
  errorMessage: string;
  fileName: string;
  issues: RelationshipEvidenceShadowPreviewIssue[];
  report: RelationshipEvidenceShadowReport | null;
  status: 'idle' | 'reading' | 'invalid' | 'ready' | 'read-failed';
};

const EMPTY: RelationshipEvidenceShadowPreviewState = {
  batchReport: null, corpusId: '', errorMessage: '', fileName: '', issues: [],
  report: null, status: 'idle',
};

function validateFiles(files: File[]) {
  const issues: RelationshipEvidenceShadowPreviewIssue[] = [];
  if (files.length > MAX_RELATIONSHIP_EVIDENCE_SHADOW_BATCH_FILES) {
    issues.push({ code: 'too-many-files', path: '$files' });
  }
  if (files.reduce((sum, file) => sum + file.size, 0)
    > MAX_RELATIONSHIP_EVIDENCE_SHADOW_BATCH_BYTES) {
    issues.push({ code: 'batch-too-large', path: '$files' });
  }
  files.filter((file) => file.size > MAX_RELATIONSHIP_EVIDENCE_SHADOW_CORPUS_FILE_BYTES)
    .forEach((file) => issues.push({ code: 'corpus-too-large', path: file.name }));
  return issues;
}

async function readCorpora(files: File[]) {
  const results = await Promise.all(files.map(async (file) => ({
    fileName: file.name,
    imported: parseRelationshipEvidenceShadowCorpusJson(await file.text()),
  })));
  const issues = results.flatMap((result) => result.imported.issues.map((issue) => ({
    ...issue, path: `${result.fileName}:${issue.path}`,
  })));
  const corpora = results.map((result) => result.imported.corpus)
    .filter((corpus): corpus is RelationshipEvidenceShadowCorpus => Boolean(corpus));
  return { corpora, issues };
}

function useDiscardOnHide(requestId: { current: number },
  setPreview: Dispatch<SetStateAction<RelationshipEvidenceShadowPreviewState>>) {
  useEffect(() => {
    const discard = () => { requestId.current += 1; setPreview(EMPTY); };
    const discardWhenHidden = () => { if (document.visibilityState === 'hidden') discard(); };
    document.addEventListener('visibilitychange', discardWhenHidden);
    window.addEventListener('pagehide', discard);
    return () => {
      requestId.current += 1;
      document.removeEventListener('visibilitychange', discardWhenHidden);
      window.removeEventListener('pagehide', discard);
    };
  }, [requestId, setPreview]);
}

export function useSettingsRelationshipEvidenceShadowCorpus() {
  const [preview, setPreview] = useState(EMPTY);
  const requestId = useRef(0);
  useDiscardOnHide(requestId, setPreview);
  const clear = () => { requestId.current += 1; setPreview(EMPTY); };
  const loadFiles = async (files: File[]) => {
    if (!files.length) return clear();
    const currentRequest = ++requestId.current;
    const fileName = files.length === 1 ? files[0]!.name : `${files.length} 个 JSON 文件`;
    const fileIssues = validateFiles(files);
    if (fileIssues.length) {
      setPreview({ ...EMPTY, fileName, issues: fileIssues, status: 'invalid' });
      return;
    }
    setPreview({ ...EMPTY, fileName, status: 'reading' });
    try {
      const imported = await readCorpora(files);
      if (requestId.current !== currentRequest) return;
      if (imported.issues.length || imported.corpora.length !== files.length) {
        setPreview({ ...EMPTY, fileName, issues: imported.issues, status: 'invalid' });
        return;
      }
      const batchReport = evaluateRelationshipEvidenceShadowCorpusBatch(imported.corpora);
      if (batchReport.duplicateCorpusIds.length) {
        setPreview({ ...EMPTY, fileName, issues: batchReport.duplicateCorpusIds.map((id) => ({
          code: 'duplicate-corpus-id', path: id,
        })), status: 'invalid' });
        return;
      }
      setPreview({ ...EMPTY, batchReport,
        corpusId: imported.corpora.length === 1 ? imported.corpora[0]!.corpusId : '多批语料聚合',
        fileName, report: batchReport.aggregateReport, status: 'ready' });
    } catch {
      if (requestId.current !== currentRequest) return;
      setPreview({ ...EMPTY, errorMessage: '文件读取失败，请重新选择。',
        fileName, status: 'read-failed' });
    }
  };
  return { clear, loadFiles, preview };
}
