import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaEdge,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';

export type NeuralPersonaHierarchyMutation =
  | { graph: NeuralPersonaGraphSnapshot; status: 'ok' }
  | { reason: string; status: 'invalid' | 'missing' };

function containsChildren(graph: NeuralPersonaGraphSnapshot, nodeId: string) {
  return graph.edges.filter((edge) => edge.relationType === 'contains'
    && edge.sourceNodeId === nodeId).map((edge) => edge.targetNodeId);
}

function reachesNode(graph: NeuralPersonaGraphSnapshot, startId: string, targetId: string) {
  const pending = [startId];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === targetId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...containsChildren(graph, current));
  }
  return false;
}

function containsEdge(parentNodeId: string, nodeId: string, roleId: string,
  timestamp: number): NeuralPersonaEdge {
  return {
    confidence: 1, createdAt: timestamp,
    edgeId: `${parentNodeId}:contains:${nodeId}`,
    ownerRoleId: roleId, relationType: 'contains',
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId: parentNodeId, targetNodeId: nodeId,
    updatedAt: timestamp, weight: 1,
  };
}

function validateParent(graph: NeuralPersonaGraphSnapshot, nodeId: string,
  parentNodeId?: string) {
  if (!parentNodeId) return null;
  if (!graph.nodes.some((node) => node.nodeId === parentNodeId)) return 'parent-node-missing';
  if (parentNodeId === nodeId) return 'hierarchy-self-parent';
  if (reachesNode(graph, nodeId, parentNodeId)) return 'hierarchy-cycle';
  return null;
}

export function attachCreatedNeuralPersonaNode(
  graph: NeuralPersonaGraphSnapshot,
  node: NeuralPersonaNode,
  timestamp: number,
): NeuralPersonaHierarchyMutation {
  const issue = validateParent(graph, node.nodeId, node.parentNodeId);
  if (issue) return { reason: issue, status: issue === 'parent-node-missing' ? 'missing' : 'invalid' };
  const edges = node.parentNodeId
    ? [...graph.edges, containsEdge(node.parentNodeId, node.nodeId, graph.roleId, timestamp)]
    : graph.edges;
  return { graph: { ...graph, edges, nodes: [...graph.nodes, node] }, status: 'ok' };
}

export function reparentNeuralPersonaNode(
  graph: NeuralPersonaGraphSnapshot,
  nodeId: string,
  parentNodeId: string | undefined,
  timestamp: number,
): NeuralPersonaHierarchyMutation {
  const node = graph.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) return { reason: 'node-missing', status: 'missing' };
  if (node.type === 'persona-anchor') return { reason: 'persona-anchor-cannot-move', status: 'invalid' };
  const issue = validateParent(graph, nodeId, parentNodeId);
  if (issue) return { reason: issue, status: issue === 'parent-node-missing' ? 'missing' : 'invalid' };
  const retained = graph.edges.filter((edge) => !(edge.relationType === 'contains'
    && edge.targetNodeId === nodeId));
  const edges = parentNodeId
    ? [...retained, containsEdge(parentNodeId, nodeId, graph.roleId, timestamp)] : retained;
  return {
    graph: {
      ...graph, edges,
      nodes: graph.nodes.map((candidate) => candidate.nodeId === nodeId
        ? { ...candidate, parentNodeId, updatedAt: timestamp } : candidate),
    },
    status: 'ok',
  };
}
