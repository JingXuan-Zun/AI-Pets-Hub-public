import type {
  NeuralPersonaEdge,
  NeuralPersonaNode,
} from '../../character-graph/neural-persona';

function nodeLabel(node: NeuralPersonaNode | undefined) {
  return node?.influenceSummary.trim() || node?.nodeId || '未知节点';
}

export function NeuralPersonaEdgeExistingSelector(props: {
  edges: NeuralPersonaEdge[];
  nodes: NeuralPersonaNode[];
  onSelect: (edgeId: string | undefined) => void;
  selectedEdgeId?: string;
}) {
  const nodes = new Map(props.nodes.map((node) => [node.nodeId, node]));
  return (
    <label className="grid gap-1 text-3xs text-muted-foreground">
      <span>现有关系</span>
      <select
        value={props.selectedEdgeId ?? ''}
        onChange={(event) => props.onSelect(event.target.value || undefined)}
        className="h-8 rounded-sm border border-border bg-background px-2 text-2xs outline-none focus:border-primary"
      >
        <option value="">选择后可编辑或解除</option>
        {props.edges.map((edge) => (
          <option key={edge.edgeId} value={edge.edgeId}>
            {nodeLabel(nodes.get(edge.sourceNodeId))} → {edge.relationType} → {nodeLabel(nodes.get(edge.targetNodeId))}
          </option>
        ))}
      </select>
    </label>
  );
}
