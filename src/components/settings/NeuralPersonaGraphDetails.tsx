import type { NeuralPersonaGraphViewNode } from '../../character-graph/neural-persona';

export function NeuralPersonaGraphDetails(props: {
  node: NeuralPersonaGraphViewNode | null;
  onFocus: (nodeId?: string) => void;
}) {
  if (!props.node) {
    return <div className="rounded-sm border border-dashed border-border p-4 text-xs text-muted-foreground">选择节点查看详情。</div>;
  }
  const node = props.node;
  return (
    <aside className="space-y-3 rounded-sm border border-border bg-secondary/20 p-4 text-xs">
      <div className="font-medium text-foreground">{node.label}</div>
      <div className="font-mono text-2xs text-muted-foreground">{node.nodeId}</div>
      <div className="grid grid-cols-2 gap-2 text-2xs text-muted-foreground">
        <span>类型：{node.type}</span><span>范围：{node.scope}</span>
        <span>状态：{node.status}</span><span>连接：{node.incomingCount + node.outgoingCount}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {node.tagIds.map((tagId) => <span key={tagId} className="rounded bg-background px-2 py-1 font-mono text-3xs">#{tagId}</span>)}
      </div>
      {node.sourceRef ? <div className="break-all text-2xs text-muted-foreground">来源：{node.sourceRef}</div> : null}
      <button type="button" onClick={() => props.onFocus(node.nodeId)} className="rounded-sm border border-primary px-3 py-1 text-2xs text-primary">只看相邻节点</button>
      <button type="button" onClick={() => props.onFocus(undefined)} className="ml-2 rounded-sm border border-border px-3 py-1 text-2xs text-muted-foreground">取消聚焦</button>
    </aside>
  );
}
