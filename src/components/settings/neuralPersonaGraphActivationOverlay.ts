import type { NeuralPersonaActivationPreview } from '../../character-graph/neural-persona';

type ActivationGraphEdge = Pick<
  import('../../character-graph/neural-persona').NeuralPersonaGraphViewEdge,
  'relationType' | 'sourceNodeId' | 'targetNodeId'
>;

export interface NeuralPersonaGraphActivationOverlay {
  activeNodeIds: string[];
  candidateNodeIds: string[];
  pathEdgeKeys: string[];
  suppressedNodeIds: string[];
}

export function neuralPersonaGraphPathEdgeKey(sourceNodeId: string, targetNodeId: string) {
  return `${sourceNodeId}\u0000${targetNodeId}`;
}

export function createNeuralPersonaGraphActivationOverlay(
  preview?: NeuralPersonaActivationPreview | null,
  graphEdges: readonly ActivationGraphEdge[] = [],
): NeuralPersonaGraphActivationOverlay | undefined {
  if (!preview) return undefined;
  const activeNodeIds = new Set(preview.nodes.filter((node) => node.status === 'selected')
    .map((node) => node.nodeId));
  const pathEdgeKeys = new Set<string>();
  const incomingContains = new Map<string, string[]>();
  graphEdges.forEach((edge) => {
    if (edge.relationType !== 'contains') return;
    const parents = incomingContains.get(edge.targetNodeId) ?? [];
    parents.push(edge.sourceNodeId);
    incomingContains.set(edge.targetNodeId, parents);
  });
  preview.nodes.forEach((node) => {
    if (node.status !== 'selected') return;
    node.path.forEach((nodeId) => activeNodeIds.add(nodeId));
    for (let index = 1; index < node.path.length; index += 1) {
      pathEdgeKeys.add(neuralPersonaGraphPathEdgeKey(
        node.path[index - 1], node.path[index],
      ));
    }
    const queue = [node.nodeId];
    const visited = new Set<string>();
    while (queue.length) {
      const childNodeId = queue.shift()!;
      if (visited.has(childNodeId)) continue;
      visited.add(childNodeId);
      for (const parentNodeId of incomingContains.get(childNodeId) ?? []) {
        activeNodeIds.add(parentNodeId);
        pathEdgeKeys.add(neuralPersonaGraphPathEdgeKey(parentNodeId, childNodeId));
        queue.push(parentNodeId);
      }
    }
  });
  return {
    activeNodeIds: [...activeNodeIds],
    candidateNodeIds: preview.nodes.filter((node) => node.status === 'filtered')
      .map((node) => node.nodeId),
    pathEdgeKeys: [...pathEdgeKeys],
    suppressedNodeIds: preview.nodes.filter((node) => node.status === 'suppressed')
      .map((node) => node.nodeId),
  };
}

export function hasNeuralPersonaGraphPropagationPath(
  overlay?: NeuralPersonaGraphActivationOverlay,
) {
  return Boolean(overlay?.pathEdgeKeys.length);
}
