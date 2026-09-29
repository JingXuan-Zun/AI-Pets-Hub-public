import type { NeuralPersonaGraphExplorerView } from '../../character-graph/neural-persona';

export const NEURAL_PERSONA_DISTANT_NODE_ALPHA = 0.35;

function connectStructuralNeighbors(
  neighbors: Map<string, string[]>,
  sourceNodeId: string,
  targetNodeId: string,
) {
  neighbors.set(sourceNodeId, [...(neighbors.get(sourceNodeId) ?? []), targetNodeId]);
  neighbors.set(targetNodeId, [...(neighbors.get(targetNodeId) ?? []), sourceNodeId]);
}

export function resolveNeuralPersonaGraphFocusAlphas(
  view: NeuralPersonaGraphExplorerView,
  focusNodeId?: string,
) {
  const alphas = new Map(view.nodes.map((node) => [node.nodeId, 1]));
  if (!focusNodeId || !alphas.has(focusNodeId)) return alphas;
  const neighbors = new Map<string, string[]>();
  view.edges.filter((edge) => edge.relationType === 'contains').forEach((edge) => {
    connectStructuralNeighbors(neighbors, edge.sourceNodeId, edge.targetNodeId);
  });
  alphas.forEach((_, nodeId) => alphas.set(nodeId, NEURAL_PERSONA_DISTANT_NODE_ALPHA));
  const pending = [{ depth: 0, nodeId: focusNodeId }];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.shift()!;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);
    if (current.depth <= 2) alphas.set(current.nodeId, 1);
    (neighbors.get(current.nodeId) ?? []).forEach((nodeId) => {
      if (!visited.has(nodeId)) pending.push({ depth: current.depth + 1, nodeId });
    });
  }
  return alphas;
}

export function neuralPersonaGraphEdgeFocusAlpha(
  alphas: ReadonlyMap<string, number>,
  sourceNodeId: string,
  targetNodeId: string,
) {
  return Math.min(alphas.get(sourceNodeId) ?? 1, alphas.get(targetNodeId) ?? 1);
}
