import type {
  NeuralPersonaGraphCluster,
  NeuralPersonaLayoutNode,
} from './neuralPersonaGraphLayout';
import type {
  NeuralPersonaGraphViewEdge,
  NeuralPersonaGraphViewNode,
} from './neuralPersonaGraphProjection';

type Hierarchy = {
  children: Map<string, string[]>;
  depth: Map<string, number>;
  parent: Map<string, string>;
  rootId: string;
};

const RADIAL_BANDS = [
  { base: 0, lanes: 1, step: 0 },
  { base: 120, lanes: 1, step: 0 },
  { base: 210, lanes: 3, step: 24 },
  { base: 320, lanes: 4, step: 30 },
];

function sortedNodeIds(nodes: NeuralPersonaGraphViewNode[]) {
  return [...nodes].map((node) => node.nodeId).sort((left, right) => left.localeCompare(right));
}

function structuralAdjacency(nodes: NeuralPersonaGraphViewNode[], edges: NeuralPersonaGraphViewEdge[]) {
  const ids = new Set(nodes.map((node) => node.nodeId));
  const adjacency = new Map<string, string[]>();
  edges.filter((edge) => edge.relationType === 'contains'
    && ids.has(edge.sourceNodeId) && ids.has(edge.targetNodeId))
    .sort((left, right) => left.edgeId.localeCompare(right.edgeId))
    .forEach((edge) => adjacency.set(edge.sourceNodeId, [
      ...(adjacency.get(edge.sourceNodeId) ?? []), edge.targetNodeId,
    ]));
  adjacency.forEach((targets, source) => adjacency.set(
    source, [...new Set(targets)].sort((left, right) => left.localeCompare(right)),
  ));
  return adjacency;
}

function assignBranch(
  branchId: string,
  parentId: string,
  startDepth: number,
  adjacency: Map<string, string[]>,
  hierarchy: Hierarchy,
) {
  const queue = [{ depth: startDepth, nodeId: branchId, parentId }];
  while (queue.length) {
    const current = queue.shift()!;
    if (hierarchy.depth.has(current.nodeId)) continue;
    hierarchy.depth.set(current.nodeId, current.depth);
    hierarchy.parent.set(current.nodeId, current.parentId);
    hierarchy.children.set(current.parentId, [
      ...(hierarchy.children.get(current.parentId) ?? []), current.nodeId,
    ]);
    (adjacency.get(current.nodeId) ?? []).forEach((nodeId) => queue.push({
      depth: current.depth + 1, nodeId, parentId: current.nodeId,
    }));
  }
}

function buildHierarchy(nodes: NeuralPersonaGraphViewNode[], edges: NeuralPersonaGraphViewEdge[]) {
  const orderedIds = sortedNodeIds(nodes);
  const rootId = [...nodes].filter((node) => node.type === 'persona-anchor')
    .map((node) => node.nodeId).sort((left, right) => left.localeCompare(right))[0]
    ?? orderedIds[0];
  const hierarchy: Hierarchy = {
    children: new Map(), depth: new Map([[rootId, 0]]), parent: new Map(), rootId,
  };
  const adjacency = structuralAdjacency(nodes, edges);
  (adjacency.get(rootId) ?? []).forEach((nodeId) => assignBranch(
    nodeId, rootId, 1, adjacency, hierarchy,
  ));
  orderedIds.forEach((nodeId) => {
    if (!hierarchy.depth.has(nodeId)) assignBranch(nodeId, rootId, 1, adjacency, hierarchy);
  });
  hierarchy.children.forEach((children, parentId) => hierarchy.children.set(
    parentId, [...new Set(children)].sort((left, right) => left.localeCompare(right)),
  ));
  return hierarchy;
}

function subtreeWeight(nodeId: string, children: Map<string, string[]>, cache: Map<string, number>) {
  const cached = cache.get(nodeId);
  if (cached !== undefined) return cached;
  const descendants = children.get(nodeId) ?? [];
  const weight = Math.max(1, descendants.reduce(
    (sum, childId) => sum + subtreeWeight(childId, children, cache), 0,
  ));
  cache.set(nodeId, weight);
  return weight;
}

function assignAngles(
  nodeIds: string[], start: number, end: number,
  hierarchy: Hierarchy, angles: Map<string, number>, weights: Map<string, number>,
) {
  const total = nodeIds.reduce(
    (sum, nodeId) => sum + subtreeWeight(nodeId, hierarchy.children, weights), 0,
  );
  let cursor = start;
  nodeIds.forEach((nodeId) => {
    const span = (end - start) * subtreeWeight(nodeId, hierarchy.children, weights) / total;
    angles.set(nodeId, cursor + span / 2);
    const children = hierarchy.children.get(nodeId) ?? [];
    if (children.length) assignAngles(children, cursor, cursor + span, hierarchy, angles, weights);
    cursor += span;
  });
}

function assignTopLevelAngles(hierarchy: Hierarchy, angles: Map<string, number>) {
  const branches = hierarchy.children.get(hierarchy.rootId) ?? [];
  const weights = new Map<string, number>();
  const branchWeights = branches.map((nodeId) => Math.sqrt(
    subtreeWeight(nodeId, hierarchy.children, weights),
  ));
  const total = branchWeights.reduce((sum, value) => sum + value, 0) || 1;
  let start = -Math.PI / 2;
  branches.forEach((nodeId, index) => {
    const span = Math.PI * 2 * branchWeights[index] / total;
    const end = start + span;
    angles.set(nodeId, start + span / 2);
    const children = hierarchy.children.get(nodeId) ?? [];
    if (children.length) assignAngles(
      children, start + span * 0.08, end - span * 0.08,
      hierarchy, angles, weights,
    );
    start = end;
  });
}

function visualDepth(node: NeuralPersonaGraphViewNode, hierarchy: Hierarchy) {
  const depth = hierarchy.depth.get(node.nodeId) ?? 1;
  if (node.type === 'persona-anchor') return 0;
  if (node.type === 'cognitive-domain') return Math.max(1, depth);
  if (node.type === 'cognitive-topic') return Math.max(2, depth);
  return Math.max(3, depth);
}

function radialBand(depth: number) {
  return RADIAL_BANDS[depth] ?? {
    base: RADIAL_BANDS[3].base + (depth - 3) * 120, lanes: 4, step: 30,
  };
}

function nodeRadius(
  node: NeuralPersonaGraphViewNode, hierarchy: Hierarchy,
  nodeById: Map<string, NeuralPersonaGraphViewNode>,
) {
  const depth = visualDepth(node, hierarchy);
  const band = radialBand(depth);
  const parentId = hierarchy.parent.get(node.nodeId);
  const siblings = (parentId ? hierarchy.children.get(parentId) : undefined) ?? [node.nodeId];
  const peers = siblings.filter((nodeId) => {
    const sibling = nodeById.get(nodeId);
    return sibling && visualDepth(sibling, hierarchy) === depth;
  });
  const index = Math.max(0, peers.indexOf(node.nodeId));
  return band.base + (index % band.lanes) * band.step;
}

function positionNodes(
  nodes: NeuralPersonaGraphViewNode[], hierarchy: Hierarchy,
  viewport: { height: number; width: number },
) {
  const center = { x: viewport.width / 2, y: viewport.height / 2 };
  const angles = new Map<string, number>([[hierarchy.rootId, -Math.PI / 2]]);
  assignTopLevelAngles(hierarchy, angles);
  const nodeById = new Map(nodes.map((node) => [node.nodeId, node]));
  return [...nodes].sort((left, right) => left.nodeId.localeCompare(right.nodeId)).map((node) => {
    const radius = nodeRadius(node, hierarchy, nodeById);
    const angle = angles.get(node.nodeId) ?? 0;
    const x = Math.round(center.x + Math.cos(angle) * radius);
    const y = Math.round(center.y + Math.sin(angle) * radius);
    return { ...node, anchorX: x, anchorY: y, x, y } satisfies NeuralPersonaLayoutNode;
  });
}

export function layoutNeuralPersonaGraphHierarchy(
  nodes: NeuralPersonaGraphViewNode[],
  edges: NeuralPersonaGraphViewEdge[],
  viewport: { height: number; width: number },
): { clusters: NeuralPersonaGraphCluster[]; nodes: NeuralPersonaLayoutNode[] } {
  if (!nodes.length) return { clusters: [], nodes: [] };
  return { clusters: [], nodes: positionNodes(nodes, buildHierarchy(nodes, edges), viewport) };
}
