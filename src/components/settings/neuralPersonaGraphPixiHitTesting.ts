import type {
  NeuralPersonaGraphExplorerView,
  NeuralPersonaGraphPhysics,
} from '../../character-graph/neural-persona';
import { neuralPersonaGraphNodeHitRadius } from './neuralPersonaGraphNodeVisualStyle';

export type NeuralPersonaGraphPoint = { x: number; y: number };

function pointDistance(left: NeuralPersonaGraphPoint, right: NeuralPersonaGraphPoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function segmentDistance(
  point: NeuralPersonaGraphPoint,
  source: NeuralPersonaGraphPoint,
  target: NeuralPersonaGraphPoint,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return pointDistance(point, source);
  const ratio = Math.max(0, Math.min(1,
    ((point.x - source.x) * dx + (point.y - source.y) * dy) / lengthSquared));
  return pointDistance(point, { x: source.x + dx * ratio, y: source.y + dy * ratio });
}

export function hitNeuralPersonaGraphNode(
  view: NeuralPersonaGraphExplorerView,
  getPosition: NeuralPersonaGraphPhysics['getPosition'],
  point: NeuralPersonaGraphPoint,
  minimumRadius = 0,
) {
  return view.nodes.reduce<{ distance: number; nodeId: string } | undefined>((best, node) => {
    const position = getPosition(node.nodeId);
    if (!position) return best;
    const distance = pointDistance(position, point);
    const radius = Math.max(minimumRadius, neuralPersonaGraphNodeHitRadius(node));
    return distance <= radius && (!best || distance < best.distance)
      ? { distance, nodeId: node.nodeId } : best;
  }, undefined)?.nodeId;
}

export function hitNeuralPersonaGraphEdge(
  view: NeuralPersonaGraphExplorerView,
  getPosition: NeuralPersonaGraphPhysics['getPosition'],
  point: NeuralPersonaGraphPoint,
) {
  return view.edges.find((edge) => {
    const source = getPosition(edge.sourceNodeId);
    const target = getPosition(edge.targetNodeId);
    return source && target && segmentDistance(point, source, target) <= 8;
  })?.edgeId;
}

export function neuralPersonaGraphPointDistance(
  left: NeuralPersonaGraphPoint,
  right: NeuralPersonaGraphPoint,
) {
  return pointDistance(left, right);
}

export function selectNeuralPersonaGraphNodesInMarquee(
  nodes: ReadonlyArray<{ nodeId: string }>,
  getPosition: (nodeId: string) => NeuralPersonaGraphPoint | null,
  start: NeuralPersonaGraphPoint,
  end: NeuralPersonaGraphPoint,
) {
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y);
  return nodes.flatMap((node) => {
    const position = getPosition(node.nodeId);
    return position && position.x >= left && position.x <= right
      && position.y >= top && position.y <= bottom ? [node.nodeId] : [];
  });
}
