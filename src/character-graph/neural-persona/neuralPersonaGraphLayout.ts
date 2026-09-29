import type { NeuralPersonaGraphViewNode } from './neuralPersonaGraphProjection';

export interface NeuralPersonaGraphCluster {
  clusterId: string;
  label: string;
  nodeIds: string[];
  x: number;
  y: number;
}

export interface NeuralPersonaLayoutNode extends NeuralPersonaGraphViewNode {
  anchorX?: number;
  anchorY?: number;
  x: number;
  y: number;
}

function clusterCenter(index: number, count: number, width: number, height: number) {
  if (count === 1) return { x: width / 2, y: height / 2 };
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  return {
    x: width / 2 + Math.cos(angle) * width * 0.3,
    y: height / 2 + Math.sin(angle) * height * 0.3,
  };
}

export function layoutNeuralPersonaGraphByType(
  nodes: NeuralPersonaGraphViewNode[],
  viewport: { height: number; width: number },
) {
  const grouped = new Map<string, NeuralPersonaGraphViewNode[]>();
  nodes.forEach((node) => grouped.set(node.type, [...(grouped.get(node.type) ?? []), node]));
  const groups = [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  const positioned: NeuralPersonaLayoutNode[] = [];
  const clusters: NeuralPersonaGraphCluster[] = [];
  groups.forEach(([type, entries], groupIndex) => {
    const center = clusterCenter(groupIndex, groups.length, viewport.width, viewport.height);
    const ordered = [...entries].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
    ordered.forEach((node, nodeIndex) => {
      const angle = (Math.PI * 2 * nodeIndex) / ordered.length - Math.PI / 2;
      const radius = ordered.length === 1 ? 0 : 24 + ordered.length * 4;
      positioned.push({
        ...node,
        x: Math.round(center.x + Math.cos(angle) * radius),
        y: Math.round(center.y + Math.sin(angle) * radius),
      });
    });
    clusters.push({
      clusterId: `type:${type}`,
      label: type,
      nodeIds: ordered.map((node) => node.nodeId),
      x: Math.round(center.x),
      y: Math.round(center.y),
    });
  });
  return { clusters, nodes: positioned };
}
