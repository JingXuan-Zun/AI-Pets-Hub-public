import type { NeuralPersonaGraphViewEdge } from './neuralPersonaGraphProjection';

export type NeuralPersonaGraphPoint = { x: number; y: number };
export type NeuralPersonaGraphOffsets = Record<string, NeuralPersonaGraphPoint>;
export type NeuralPersonaGraphDragInfluences = Record<string, number>;

const MAX_FOLLOW_DEPTH = 2;

export function dedupeNeuralPersonaGraphPhysicsEdges(
  edges: NeuralPersonaGraphViewEdge[],
) {
  const pairs = new Map<string, NeuralPersonaGraphViewEdge>();
  edges.forEach((edge) => {
    const key = [edge.sourceNodeId, edge.targetNodeId].sort().join(':');
    const existing = pairs.get(key);
    if (!existing || edge.weight > existing.weight) pairs.set(key, edge);
  });
  return [...pairs.values()];
}

function linkedNodeId(edge: NeuralPersonaGraphViewEdge, nodeId: string) {
  if (edge.sourceNodeId === nodeId) return edge.targetNodeId;
  if (edge.targetNodeId === nodeId) return edge.sourceNodeId;
  return null;
}

function followInfluence(parentInfluence: number, edgeWeight: number, depth: number) {
  const weight = Math.min(1, Math.max(0, edgeWeight));
  return depth === 1
    ? 0.3 + weight * 0.15
    : parentInfluence * (0.24 + weight * 0.08);
}

export function buildNeuralPersonaGraphDragInfluences(
  rootNodeId: string,
  edges: NeuralPersonaGraphViewEdge[],
): NeuralPersonaGraphDragInfluences {
  const influences = new Map<string, number>([[rootNodeId, 1]]);
  let frontier = [{ influence: 1, nodeId: rootNodeId }];
  for (let depth = 1; depth <= MAX_FOLLOW_DEPTH; depth += 1) {
    const next = new Map<string, number>();
    frontier.forEach((entry) => edges.forEach((edge) => {
      const linkedId = linkedNodeId(edge, entry.nodeId);
      if (!linkedId || linkedId === rootNodeId) return;
      const influence = followInfluence(entry.influence, edge.weight, depth);
      if ((influences.get(linkedId) ?? 0) >= influence) return;
      influences.set(linkedId, influence);
      next.set(linkedId, Math.max(next.get(linkedId) ?? 0, influence));
    }));
    frontier = [...next.entries()].map(([nodeId, influence]) => ({ influence, nodeId }));
  }
  return Object.fromEntries(influences);
}

export function moveNeuralPersonaGraphOffsets(
  originOffsets: NeuralPersonaGraphOffsets,
  influences: NeuralPersonaGraphDragInfluences,
  delta: NeuralPersonaGraphPoint,
): NeuralPersonaGraphOffsets {
  const next = { ...originOffsets };
  Object.entries(influences).forEach(([nodeId, influence]) => {
    const origin = originOffsets[nodeId] ?? { x: 0, y: 0 };
    next[nodeId] = {
      x: origin.x + delta.x * influence,
      y: origin.y + delta.y * influence,
    };
  });
  return next;
}

export function translateNeuralPersonaGraphFollowers(
  positions: Map<string, NeuralPersonaGraphPoint>,
  influences: NeuralPersonaGraphDragInfluences,
  rootNodeId: string,
  delta: NeuralPersonaGraphPoint,
  strength = 1,
) {
  Object.entries(influences).forEach(([nodeId, influence]) => {
    if (nodeId === rootNodeId) return;
    const position = positions.get(nodeId);
    if (!position) return;
    position.x += delta.x * influence * strength;
    position.y += delta.y * influence * strength;
  });
}
