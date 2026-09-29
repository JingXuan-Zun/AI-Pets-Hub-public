import { useEffect, useMemo, useState } from 'react';
import type {
  NeuralPersonaEdge,
  NeuralPersonaNode,
  NeuralPersonaNodeBatchDeleteResult,
} from '../../character-graph/neural-persona';

function resultMessage(result: NeuralPersonaNodeBatchDeleteResult) {
  if (result.status === 'ok') {
    return `已删除 ${result.receipt.deletedNodeIds.length} 个节点和 ${result.receipt.deletedEdgeIds.length} 条关系。`;
  }
  if (result.status === 'conflict') return '图谱已变化，请重新选择后再删除。';
  return `批量删除失败：${result.reason}`;
}

export function NeuralPersonaNodeBatchDeletePanel(props: {
  edges: NeuralPersonaEdge[];
  enabled: boolean;
  nodes: NeuralPersonaNode[];
  onDelete: (
    nodeIds: string[], confirmProtectedNodes: boolean,
  ) => Promise<NeuralPersonaNodeBatchDeleteResult>;
  onSelectionChange: (nodeIds: string[]) => void;
  selectedNodeIds: string[];
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmProtected, setConfirmProtected] = useState(false);
  const [feedback, setFeedback] = useState('');
  const selected = useMemo(() => new Set(props.selectedNodeIds), [props.selectedNodeIds]);
  const selectedNodes = props.nodes.filter((node) => selected.has(node.nodeId));
  const ordinaryNodeIds = useMemo(
    () => props.nodes.filter((node) => !node.protected).map((node) => node.nodeId),
    [props.nodes],
  );
  const protectedCount = selectedNodes.filter((node) => node.protected).length;
  const linkedEdgeCount = props.edges.filter((edge) => selected.has(edge.sourceNodeId)
    || selected.has(edge.targetNodeId)).length;
  useEffect(() => {
    setConfirmDelete(false); setConfirmProtected(false); setFeedback('');
  }, [props.enabled, props.selectedNodeIds.join('|')]);
  const removeSelected = async () => {
    if (!confirmDelete || !selected.size || (protectedCount && !confirmProtected)) return;
    setFeedback(resultMessage(await props.onDelete(props.selectedNodeIds, confirmProtected)));
  };
  const removeAllOrdinary = async () => {
    if (!confirmDelete || !ordinaryNodeIds.length) return;
    setFeedback(resultMessage(await props.onDelete(ordinaryNodeIds, false)));
  };
  return (
    <div className="space-y-2 border-t border-border/70 pt-3">
      <div className="text-2xs font-medium text-foreground">批量删除节点</div>
      {props.enabled ? <>
        <div className="flex flex-wrap items-center gap-2 text-3xs text-muted-foreground">
          <span>已选 {selected.size} 个节点，将同步删除 {linkedEdgeCount} 条关系</span>
          <button type="button" onClick={() => props.onSelectionChange(props.nodes.filter((node) => !node.protected).map((node) => node.nodeId))} className="text-primary">全选普通节点</button>
          <button type="button" onClick={() => props.onSelectionChange([])} className="text-muted-foreground">清空</button>
        </div>
        <div className="text-3xs leading-4 text-muted-foreground">可点击节点逐个选择，也可从图谱空白处拖动框选；按住 Ctrl 或 Shift 可追加框选。</div>
        {protectedCount ? <label className="flex items-center gap-1 text-3xs text-amber-500"><input type="checkbox" checked={confirmProtected} onChange={(event) => setConfirmProtected(event.target.checked)} />确认删除其中 {protectedCount} 个受保护节点</label> : null}
        <label className="flex items-center gap-1 text-3xs text-muted-foreground"><input type="checkbox" checked={confirmDelete} onChange={(event) => setConfirmDelete(event.target.checked)} />确认批量删除所选节点及关联关系</label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!selected.size || !confirmDelete || Boolean(protectedCount && !confirmProtected)} onClick={() => void removeSelected()} className="rounded-sm border border-destructive px-3 py-1.5 text-2xs text-destructive disabled:opacity-50">删除已选节点</button>
          <button type="button" disabled={!ordinaryNodeIds.length || !confirmDelete} onClick={() => void removeAllOrdinary()} className="rounded-sm border border-destructive px-3 py-1.5 text-2xs text-destructive disabled:opacity-50">一键删除所有普通节点</button>
          <span className="text-3xs text-muted-foreground">{feedback}</span>
        </div>
        <div className="text-3xs leading-4 text-muted-foreground">一键删除会删除全部普通节点及关联关系，并保留主要人格主体。</div>
      </> : <div className="text-3xs leading-4 text-muted-foreground">请使用图谱顶部的“框选节点”进入多选模式。</div>}
    </div>
  );
}
