import { useEffect, useState } from 'react';
import type {
  NeuralPersonaNode,
  NeuralPersonaNodeCommandResult,
} from '../../character-graph/neural-persona';

function resultMessage(result: NeuralPersonaNodeCommandResult) {
  if (result.status === 'ok') return '节点与关联关系已删除。';
  if (result.status === 'conflict') return '图谱已变化，请重新选择节点后再删除。';
  return `删除失败：${result.reason}`;
}

export function NeuralPersonaNodeEditorDeleteAction(props: {
  linkedEdgeCount: number;
  node: NeuralPersonaNode;
  onDelete: (nodeId: string, confirmProtectedNode: boolean) => Promise<NeuralPersonaNodeCommandResult>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmProtectedNode, setConfirmProtectedNode] = useState(false);
  const [feedback, setFeedback] = useState('');
  useEffect(() => {
    setConfirmDelete(false); setConfirmProtectedNode(false); setFeedback('');
  }, [props.node.nodeId]);
  const remove = async () => {
    if (!confirmDelete || (props.node.protected && !confirmProtectedNode)) return;
    const result = await props.onDelete(props.node.nodeId, confirmProtectedNode);
    setFeedback(resultMessage(result));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.node.protected ? <label className="flex items-center gap-1 text-3xs text-amber-500"><input type="checkbox" checked={confirmProtectedNode} onChange={(event) => setConfirmProtectedNode(event.target.checked)} />确认删除受保护身份节点</label> : null}
      <label className="flex items-center gap-1 text-3xs text-muted-foreground"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />确认删除节点及 {props.linkedEdgeCount} 条关联关系</label>
      <button type="button" disabled={!confirmDelete || (props.node.protected && !confirmProtectedNode)} onClick={() => void remove()} className="rounded-sm border border-destructive px-3 py-1.5 text-2xs text-destructive disabled:opacity-50">删除节点</button>
      <span className="text-3xs text-muted-foreground">{feedback}</span>
    </div>
  );
}
