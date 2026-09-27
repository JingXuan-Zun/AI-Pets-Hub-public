import type {
  NeuralPersonaEdge,
  NeuralPersonaNode,
} from '../../character-graph/neural-persona';

export interface NeuralPersonaNodeResourceTreeItem {
  children: NeuralPersonaNodeResourceTreeItem[];
  node: NeuralPersonaNode;
  parentNodeId?: string;
}

function parentMap(nodes: NeuralPersonaNode[], edges: NeuralPersonaEdge[]) {
  const ids = new Set(nodes.map((node) => node.nodeId));
  const edgeParents = new Map<string, string>();
  edges.filter((edge) => edge.relationType === 'contains').forEach((edge) => {
    if (ids.has(edge.sourceNodeId) && ids.has(edge.targetNodeId)) {
      edgeParents.set(edge.targetNodeId, edge.sourceNodeId);
    }
  });
  return new Map(nodes.map((node) => {
    const declared = node.parentNodeId && ids.has(node.parentNodeId)
      ? node.parentNodeId : undefined;
    return [node.nodeId, declared ?? edgeParents.get(node.nodeId)] as const;
  }));
}

function compareNodes(left: NeuralPersonaNode, right: NeuralPersonaNode) {
  if (left.type === 'persona-anchor') return -1;
  if (right.type === 'persona-anchor') return 1;
  return left.influenceSummary.localeCompare(right.influenceSummary, 'zh-CN');
}

export function buildNeuralPersonaNodeResourceTree(
  nodes: NeuralPersonaNode[],
  edges: NeuralPersonaEdge[],
) {
  const parents = parentMap(nodes, edges);
  const children = new Map<string, NeuralPersonaNode[]>();
  nodes.forEach((node) => {
    const parentId = parents.get(node.nodeId);
    if (!parentId || parentId === node.nodeId) return;
    const entries = children.get(parentId) ?? [];
    entries.push(node); children.set(parentId, entries);
  });
  const visited = new Set<string>();
  const item = (node: NeuralPersonaNode): NeuralPersonaNodeResourceTreeItem => {
    if (visited.has(node.nodeId)) return { children: [], node, parentNodeId: parents.get(node.nodeId) };
    visited.add(node.nodeId);
    return {
      children: (children.get(node.nodeId) ?? []).sort(compareNodes).map(item),
      node, parentNodeId: parents.get(node.nodeId),
    };
  };
  const roots = nodes.filter((node) => !parents.get(node.nodeId)).sort(compareNodes).map(item);
  nodes.filter((node) => !visited.has(node.nodeId)).sort(compareNodes).forEach((node) => roots.push(item(node)));
  return { parents, roots };
}

export function neuralPersonaNodeResourceMatches(
  item: NeuralPersonaNodeResourceTreeItem,
  query: string,
): NeuralPersonaNodeResourceTreeItem | null {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return item;
  const children = item.children.map((child) => neuralPersonaNodeResourceMatches(child, query))
    .filter((child): child is NeuralPersonaNodeResourceTreeItem => Boolean(child));
  const searchable = [item.node.influenceSummary, item.node.nodeId, item.node.sourceRef,
    ...item.node.tags.map((tag) => tag.label)].filter(Boolean).join(' ').toLocaleLowerCase();
  return searchable.includes(normalized) || children.length ? { ...item, children } : null;
}

export function canReparentNeuralPersonaResourceNode(
  nodeId: string,
  parentNodeId: string,
  parents: ReadonlyMap<string, string | undefined>,
) {
  if (nodeId === parentNodeId) return false;
  let current: string | undefined = parentNodeId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    if (current === nodeId) return false;
    visited.add(current); current = parents.get(current);
  }
  return true;
}
