import { useEffect, useState } from 'react';
import type {
  NeuralPersonaEdge,
  NeuralPersonaEdgeCommandResult,
  NeuralPersonaEdgeDraft,
  NeuralPersonaEdgePatch,
  NeuralPersonaNode,
} from '../../character-graph/neural-persona';
import { NeuralPersonaEdgeEditorFields } from './NeuralPersonaEdgeEditorFields';
import { NeuralPersonaEdgeExistingSelector } from './NeuralPersonaEdgeExistingSelector';
import { createNeuralPersonaEditorId } from './neuralPersonaEditorIds';
import {
  buildNeuralPersonaEdgeDraft,
  buildNeuralPersonaEdgePatch,
  createEmptyNeuralPersonaEdgeEditorDraft,
  createNeuralPersonaEdgeEditorDraft,
} from './neuralPersonaEdgeEditorDraft';

function resultMessage(result: NeuralPersonaEdgeCommandResult) {
  if (result.status === 'ok') return `已保存 revision ${result.record.revision}`;
  if (result.status === 'conflict') return `版本冲突，已重新加载 revision ${result.actualRevision ?? 'unknown'}；草稿仍保留。`;
  return `操作失败：${result.reason}`;
}

function newEdgeDraft(nodeIds: string[]) {
  return createEmptyNeuralPersonaEdgeEditorDraft(nodeIds, createNeuralPersonaEditorId('edge'));
}

interface NeuralPersonaEdgeEditorProps {
  edge: NeuralPersonaEdge | null;
  edges: NeuralPersonaEdge[];
  managedPersonaRelationship: boolean;
  nodes: NeuralPersonaNode[];
  onSelectEdge: (edgeId: string | undefined) => void;
  protectedRelationship: boolean;
  onCreate: (draft: NeuralPersonaEdgeDraft) => Promise<NeuralPersonaEdgeCommandResult>;
  onDelete: (edgeId: string, confirmProtected: boolean) => Promise<NeuralPersonaEdgeCommandResult>;
  onUpdate: (edgeId: string, patch: NeuralPersonaEdgePatch, confirmProtected: boolean) => Promise<NeuralPersonaEdgeCommandResult>;
}

export function NeuralPersonaEdgeEditor(props: NeuralPersonaEdgeEditorProps) {
  const nodeIds = props.nodes.map((node) => node.nodeId);
  const [createMode, setCreateMode] = useState(false);
  const [draft, setDraft] = useState(() => createEmptyNeuralPersonaEdgeEditorDraft(nodeIds));
  const [feedback, setFeedback] = useState('');
  const [confirmProtected, setConfirmProtected] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const canCreate = nodeIds.length >= 2;
  useEffect(() => {
    if (!createMode && props.edge) setDraft(createNeuralPersonaEdgeEditorDraft(props.edge));
    setConfirmProtected(false);
    setConfirmDelete(false);
  }, [createMode, props.edge?.edgeId]);
  const beginCreate = () => {
    if (!canCreate) return;
    setCreateMode(true);
    setDraft(newEdgeDraft(nodeIds));
    setFeedback('');
  };
  const selectExisting = (edgeId: string | undefined) => {
    setCreateMode(false);
    props.onSelectEdge(edgeId);
  };
  const save = async () => {
    const result = createMode
      ? await props.onCreate(buildNeuralPersonaEdgeDraft(draft))
      : await props.onUpdate(draft.edgeId, buildNeuralPersonaEdgePatch(draft), confirmProtected);
    setFeedback(resultMessage(result));
    if (result.status === 'ok') setCreateMode(false);
  };
  const remove = async () => {
    if (!confirmDelete) { setFeedback('请先确认解除当前关系。'); return; }
    const result = await props.onDelete(draft.edgeId, confirmProtected);
    setFeedback(resultMessage(result));
  };
  return (
    <section className="space-y-3 rounded-sm border border-border bg-secondary/10 p-4">
      <div className="flex items-center justify-between gap-2"><div><div className="text-xs font-semibold">关系编辑器</div><div className="text-3xs text-muted-foreground">选择两个节点和关系类型即可创建；至少需要两个节点。</div></div><button type="button" disabled={!canCreate || createMode} onClick={beginCreate} className="rounded-sm border border-primary px-3 py-1 text-2xs text-primary disabled:opacity-50">快速新建关系</button></div>
      <NeuralPersonaEdgeExistingSelector edges={props.edges} nodes={props.nodes} selectedEdgeId={createMode ? undefined : props.edge?.edgeId} onSelect={selectExisting} />
      {!(createMode || props.edge) ? <div className="text-2xs text-muted-foreground">选择关系边进行编辑，或新建关系边。</div> : <>
        <NeuralPersonaEdgeEditorFields createMode={createMode} draft={draft} nodes={props.nodes} setDraft={setDraft} />
        {!createMode && props.protectedRelationship ? <label className="flex items-center gap-2 text-2xs text-amber-500"><input type="checkbox" checked={confirmProtected} onChange={(event) => setConfirmProtected(event.target.checked)} />确认修改或解除受保护身份节点的关系</label> : null}
        {!createMode && props.managedPersonaRelationship ? <div className="text-3xs leading-4 text-amber-500">这是自动管理的主体连接；解除后，再次导入节点时会自动恢复。</div> : null}
        {!createMode ? <label className="flex items-center gap-2 text-2xs text-muted-foreground"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />确认解除当前关系（节点会保留）</label> : null}
        <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => void save()} className="rounded-sm bg-primary px-3 py-1.5 text-2xs text-primary-foreground">{createMode ? '创建关系' : '保存修改'}</button>{!createMode ? <button type="button" onClick={() => void remove()} className="rounded-sm border border-destructive px-3 py-1.5 text-2xs text-destructive">解除关系</button> : <button type="button" onClick={() => setCreateMode(false)} className="rounded-sm border border-border px-3 py-1.5 text-2xs">取消</button>}<span className="text-3xs text-muted-foreground">{feedback}</span></div>
      </>}
    </section>
  );
}
