import { Download, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES,
  serializeNeuralPersonaGraphExport,
  type NeuralPersonaGraphExchangeResult,
  type NeuralPersonaGraphImportPreview,
  type NeuralPersonaPersistedRecord,
} from '../../character-graph/neural-persona';
import { downloadJsonTextFile } from './settingsDownloadUtils';

type ReadyPreview = Extract<NeuralPersonaGraphImportPreview, { status: 'ready' }>;

function previewDetail(preview: NeuralPersonaGraphImportPreview) {
  if (preview.status === 'invalid') return `导入预览失败：${preview.reason}`;
  if (preview.status === 'conflict') return `预览版本冲突：当前 revision ${preview.actualRevision}，预览基于 ${preview.expectedRevision}。`;
  const { diff } = preview;
  return `新增节点 ${diff.addedNodeIds.length}，修改节点 ${diff.changedNodeIds.length}，删除节点 ${diff.removedNodeIds.length}；新增边 ${diff.addedEdgeIds.length}，修改边 ${diff.changedEdgeIds.length}，删除边 ${diff.removedEdgeIds.length}。`;
}

function resultDetail(result: NeuralPersonaGraphExchangeResult) {
  if (result.status === 'ok') return `导入已提交，revision ${result.record.revision}。`;
  if (result.status === 'conflict') return `提交冲突：当前 revision ${result.actualRevision ?? 'unknown'}；预览仍保留。`;
  return `提交失败：${result.reason}`;
}

export function NeuralPersonaGraphExchangePanel(props: {
  onCommitImport: (preview: ReadyPreview, confirmProtectedChanges: boolean) => Promise<NeuralPersonaGraphExchangeResult>;
  onPreviewImport: (serialized: string) => NeuralPersonaGraphImportPreview;
  record: NeuralPersonaPersistedRecord;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<NeuralPersonaGraphImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [feedback, setFeedback] = useState('');
  const [confirmProtectedChanges, setConfirmProtectedChanges] = useState(false);
  useEffect(() => {
    setPreview(null);
    setFileName('');
    setFeedback('');
    setConfirmProtectedChanges(false);
  }, [props.record.roleId]);
  const exportGraph = () => downloadJsonTextFile(
    `neural-persona-${props.record.roleId}-r${props.record.revision}.json`,
    serializeNeuralPersonaGraphExport(props.record),
  );
  const importFile = async (file: File) => {
    try {
      if (file.size > NEURAL_PERSONA_GRAPH_EXCHANGE_MAX_BYTES) {
        setPreview(null); setFeedback('文件超过 4 MiB 图谱交换上限。');
        return;
      }
      setFileName(file.name);
      setPreview(props.onPreviewImport(await file.text()));
      setFeedback('');
      setConfirmProtectedChanges(false);
    } catch (error) {
      setPreview(null);
      setFeedback(`文件读取失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const commit = async () => {
    if (!preview || preview.status !== 'ready') return;
    const result = await props.onCommitImport(preview, confirmProtectedChanges);
    setFeedback(resultDetail(result));
    if (result.status === 'ok') setPreview(null);
  };
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-semibold">图谱导入与导出</div><div className="text-3xs text-muted-foreground">导入只生成预览，确认后才提交；不会自动覆盖当前图谱。</div></div><div className="flex gap-2"><button type="button" onClick={exportGraph} className="flex items-center gap-1 rounded-sm border border-border px-2 py-1 text-2xs"><Download className="h-3 w-3" />导出 JSON</button><button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 rounded-sm border border-primary px-2 py-1 text-2xs text-primary"><Upload className="h-3 w-3" />导入预览</button></div></div>
      <input ref={fileInputRef} className="hidden" accept="application/json,.json" type="file" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void importFile(file); }} />
      {preview ? <div className="space-y-2 rounded-sm border border-dashed border-border p-3 text-2xs"><div className="font-mono">{fileName || '导入文件'} / {preview.status}</div><div className="text-muted-foreground">{previewDetail(preview)}</div>{preview.status === 'ready' ? <div className="space-y-2"><div className="text-muted-foreground">来源角色：{preview.sourceRoleId} / 来源 revision：{preview.sourceRevision}{preview.migrated ? ' / 已迁移' : ''}</div>{preview.diff.requiresProtectedConfirmation ? <label className="flex items-center gap-2 text-amber-500"><input type="checkbox" checked={confirmProtectedChanges} onChange={(event) => setConfirmProtectedChanges(event.target.checked)} />确认导入会修改或删除受保护节点/关系</label> : null}<button type="button" disabled={!preview.diff.hasChanges || (preview.diff.requiresProtectedConfirmation && !confirmProtectedChanges)} onClick={() => void commit()} className="rounded-sm bg-primary px-2 py-1 text-2xs text-primary-foreground disabled:opacity-50">确认提交</button></div> : null}</div> : null}
      {feedback ? <div className="text-2xs text-muted-foreground">{feedback}</div> : null}
    </section>
  );
}
