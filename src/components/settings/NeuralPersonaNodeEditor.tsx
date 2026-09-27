import { useEffect, useState, type ReactNode } from 'react';
import type {
  NeuralPersonaNode,
  NeuralPersonaNodeCommandResult,
  NeuralPersonaNodePatch,
} from '../../character-graph/neural-persona';
import { NeuralPersonaNodeEditorFields } from './NeuralPersonaNodeEditorFields';
import { NeuralPersonaNodeEditorDeleteAction } from './NeuralPersonaNodeEditorDeleteAction';
import {
  buildNeuralPersonaNodeDraft,
  createEmptyNeuralPersonaNodeEditorDraft,
  createNeuralPersonaNodeEditorDraft,
  mergeNeuralPersonaEditorTags,
} from './neuralPersonaNodeEditorDraft';

function resultMessage(result: NeuralPersonaNodeCommandResult) {
  if (result.status === 'ok') return `已保存 · revision ${result.record.revision}`;
  if (result.status === 'conflict') return `版本冲突，已重新加载 revision ${result.actualRevision ?? 'unknown'}。`;
  return `保存失败：${result.reason}`;
}

export function NeuralPersonaNodeEditor(props: {
  batchDeletePanel?: ReactNode;
  linkedEdgeCount: number;
  node: NeuralPersonaNode | null;
  onBack?: () => void;
  onDelete: (nodeId: string, confirmProtectedNode: boolean) => Promise<NeuralPersonaNodeCommandResult>;
  onUpdate: (nodeId: string, patch: NeuralPersonaNodePatch) => Promise<NeuralPersonaNodeCommandResult>;
}) {
  const [draft, setDraft] = useState(createEmptyNeuralPersonaNodeEditorDraft);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    if (props.node) setDraft(createNeuralPersonaNodeEditorDraft(props.node));
    setFeedback('');
  }, [props.node?.nodeId]);
  const save = async () => {
    if (!props.node) return;
    const { nodeId, parentNodeId: _parentNodeId, ...patch } = buildNeuralPersonaNodeDraft(draft);
    const result = await props.onUpdate(nodeId, {
      ...patch, tags: mergeNeuralPersonaEditorTags(props.node, patch.tags),
    });
    setFeedback(resultMessage(result));
  };
  return <section className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {props.onBack ? <button type="button" onClick={props.onBack} className="rounded-sm border border-border px-2 py-1 text-2xs">← 返回列表</button> : null}
        <div><div className="text-xs font-semibold">节点内容</div><div className="text-3xs text-muted-foreground">内容、标签和高级参数统一在这里编辑。</div></div>
      </div>
    </div>
    {!props.node ? <div className="text-2xs text-muted-foreground">该节点已经不存在，请返回列表。</div> : <>
      <NeuralPersonaNodeEditorFields createMode={false} draft={draft} setDraft={setDraft} />
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void save()} className="rounded-sm bg-primary px-3 py-1.5 text-2xs text-primary-foreground">保存修改</button>
        <span className="text-3xs text-muted-foreground">{feedback}</span>
      </div>
      <NeuralPersonaNodeEditorDeleteAction linkedEdgeCount={props.linkedEdgeCount} node={props.node} onDelete={props.onDelete} />
    </>}
    {props.batchDeletePanel}
  </section>;
}
