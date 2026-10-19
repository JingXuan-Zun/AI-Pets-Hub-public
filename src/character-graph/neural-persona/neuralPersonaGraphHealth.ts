import { isNeuralPersonaAnchorNode } from './neuralPersonaAnchor';
import {
  isNeuralPersonaStructuralEdge,
  isNeuralPersonaStructuralNode,
} from './neuralPersonaGeneratedHierarchy';
import { neuralPersonaNodeContent } from './neuralPersonaContentLayers';
import type { NeuralPersonaGraphSnapshot, NeuralPersonaNode } from './neuralPersonaTypes';

const COGNITIVE_RELATIONS = new Set([
  'associated-with', 'supports', 'triggers', 'inhibits', 'opposes',
]);

function contentNodes(graph: NeuralPersonaGraphSnapshot) {
  return graph.nodes.filter((node) => node.status === 'active'
    && !isNeuralPersonaAnchorNode(node) && !isNeuralPersonaStructuralNode(node));
}

function normalized(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function duplicateGroups(nodes: NeuralPersonaNode[]) {
  const groups = new Map<string, string[]>();
  nodes.forEach((node) => {
    const key = normalized(neuralPersonaNodeContent(node));
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), node.nodeId]);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

export interface NeuralPersonaGraphHealth {
  directAnchorContentNodeIds: string[];
  duplicateContentNodeGroups: string[][];
  healthy: boolean;
  invalidSourceReferenceNodeIds: string[];
  missingParentNodeIds: string[];
  missingSourceNodeIds: string[];
  pendingReviewNodeIds: string[];
  semanticCoverageRatio: number;
  semanticEdgeCount: number;
  sourceDocumentCount: number;
  sourceReferenceCoverageRatio: number;
  structurallyOrphanedNodeIds: string[];
  unconnectedContentNodeIds: string[];
}

function healthContext(graph: NeuralPersonaGraphSnapshot) {
  const nodes = contentNodes(graph);
  const nodeIds = new Set(graph.nodes.map((node) => node.nodeId));
  const sourceById = new Map((graph.sources ?? []).map((source) => [source.sourceId, source]));
  const semanticEdges = graph.edges.filter((edge) => !isNeuralPersonaStructuralEdge(edge)
    && COGNITIVE_RELATIONS.has(edge.relationType));
  const semanticallyConnected = new Set(semanticEdges.flatMap((edge) => (
    [edge.sourceNodeId, edge.targetNodeId]
  )));
  const anchorIds = new Set(graph.nodes.filter(isNeuralPersonaAnchorNode)
    .map((node) => node.nodeId));
  const directAnchorContent = new Set(graph.edges.filter((edge) => (
    isNeuralPersonaStructuralEdge(edge) && anchorIds.has(edge.sourceNodeId)
  )).map((edge) => edge.targetNodeId));
  return {
    directAnchorContent, nodeIds, nodes, semanticEdges, semanticallyConnected, sourceById,
  };
}

function sourceIssues(
  nodes: NeuralPersonaNode[],
  sources: ReturnType<typeof healthContext>['sourceById'],
) {
  const missingSourceNodeIds = nodes.filter((node) => !node.sourceReferences?.length)
    .map((node) => node.nodeId);
  const invalidSourceReferenceNodeIds = nodes.filter((node) => (
    node.sourceReferences?.some((reference) => {
      const source = sources.get(reference.sourceId);
      return !source || reference.startOffset < 0
        || reference.endOffset > source.content.length
        || source.content.slice(reference.startOffset, reference.endOffset) !== reference.quote;
    })
  )).map((node) => node.nodeId);
  return { invalidSourceReferenceNodeIds, missingSourceNodeIds };
}

export function inspectNeuralPersonaGraphHealth(
  graph: NeuralPersonaGraphSnapshot,
): NeuralPersonaGraphHealth {
  const context = healthContext(graph);
  const { nodes, nodeIds, semanticEdges, semanticallyConnected, directAnchorContent } = context;
  const { invalidSourceReferenceNodeIds, missingSourceNodeIds } = sourceIssues(
    nodes, context.sourceById,
  );
  const missingParentNodeIds = nodes.filter((node) => (
    node.parentNodeId && !nodeIds.has(node.parentNodeId)
  )).map((node) => node.nodeId);
  const structurallyOrphanedNodeIds = nodes.filter((node) => (
    !node.parentNodeId && !graph.edges.some((edge) => (
      isNeuralPersonaStructuralEdge(edge) && edge.targetNodeId === node.nodeId
    ))
  )).map((node) => node.nodeId);
  const unconnectedContentNodeIds = nodes.filter((node) => (
    !semanticallyConnected.has(node.nodeId)
  )).map((node) => node.nodeId);
  const sourceCovered = nodes.length - missingSourceNodeIds.length
    - invalidSourceReferenceNodeIds.filter((nodeId) => (
      !missingSourceNodeIds.includes(nodeId)
    )).length;
  const health = {
    directAnchorContentNodeIds: nodes.filter((node) => directAnchorContent.has(node.nodeId))
      .map((node) => node.nodeId),
    duplicateContentNodeGroups: duplicateGroups(nodes),
    invalidSourceReferenceNodeIds,
    missingParentNodeIds,
    missingSourceNodeIds,
    pendingReviewNodeIds: graph.nodes.filter((node) => node.status === 'pending-review')
      .map((node) => node.nodeId),
    semanticCoverageRatio: nodes.length ? semanticallyConnected.size / nodes.length : 1,
    semanticEdgeCount: semanticEdges.length,
    sourceDocumentCount: graph.sources?.length ?? 0,
    sourceReferenceCoverageRatio: nodes.length ? Math.max(0, sourceCovered) / nodes.length : 1,
    structurallyOrphanedNodeIds,
    unconnectedContentNodeIds,
  };
  return {
    ...health,
    healthy: !health.directAnchorContentNodeIds.length
      && !health.duplicateContentNodeGroups.length
      && !health.invalidSourceReferenceNodeIds.length
      && !health.missingParentNodeIds.length
      && !health.missingSourceNodeIds.length
      && !health.structurallyOrphanedNodeIds.length
      && !health.unconnectedContentNodeIds.length,
  };
}
