import { isNeuralPersonaAnchorNode } from './neuralPersonaAnchor';
import { isNeuralPersonaStructuralEdge, isNeuralPersonaStructuralNode } from './neuralPersonaGeneratedHierarchy';
import { neuralPersonaRelationshipKey } from './neuralPersonaRelationshipKeys';
import type { NeuralPersonaGraphSnapshot } from './neuralPersonaTypes';

const COGNITIVE_RELATIONS = new Set([
  'associated-with', 'supports', 'triggers', 'inhibits', 'opposes',
]);

function contentNodes(graph: NeuralPersonaGraphSnapshot) {
  return graph.nodes.filter((node) => node.status === 'active'
    && !isNeuralPersonaAnchorNode(node) && !isNeuralPersonaStructuralNode(node));
}

function semanticEdges(graph: NeuralPersonaGraphSnapshot) {
  return graph.edges.filter((edge) => !isNeuralPersonaStructuralEdge(edge)
    && COGNITIVE_RELATIONS.has(edge.relationType));
}

export interface NeuralPersonaRelationshipCoverage {
  contentNodeCount: number;
  connectedContentNodeCount: number;
  semanticEdgeCount: number;
  coverageRatio: number;
  unconnectedContentNodeIds: string[];
  incomingOnlyContentNodeIds: string[];
}

export function inspectNeuralPersonaRelationshipCoverage(
  graph: NeuralPersonaGraphSnapshot,
): NeuralPersonaRelationshipCoverage {
  const nodes = contentNodes(graph);
  const nodeIds = new Set(nodes.map((node) => node.nodeId));
  const edges = semanticEdges(graph).filter((edge) => nodeIds.has(edge.sourceNodeId)
    && nodeIds.has(edge.targetNodeId));
  const connected = new Set<string>();
  const outgoing = new Set<string>();
  edges.forEach((edge) => {
    connected.add(edge.sourceNodeId); connected.add(edge.targetNodeId);
    outgoing.add(edge.sourceNodeId);
    if (edge.relationType === 'associated-with') outgoing.add(edge.targetNodeId);
  });
  const unconnected = nodes.filter((node) => !connected.has(node.nodeId)).map((node) => node.nodeId);
  const incomingOnly = nodes.filter((node) => connected.has(node.nodeId) && !outgoing.has(node.nodeId))
    .map((node) => node.nodeId);
  return {
    contentNodeCount: nodes.length,
    connectedContentNodeCount: connected.size,
    semanticEdgeCount: new Set(edges.map((edge) => neuralPersonaRelationshipKey(edge))).size,
    coverageRatio: nodes.length ? connected.size / nodes.length : 1,
    unconnectedContentNodeIds: unconnected,
    incomingOnlyContentNodeIds: incomingOnly,
  };
}
