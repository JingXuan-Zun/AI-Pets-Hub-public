import {
  createNeuralPersonaAnchorNode,
  isNeuralPersonaAnchorNode,
} from './neuralPersonaAnchor';
import {
  buildGeneratedNeuralPersonaHierarchy,
  isNeuralPersonaStructuralNode,
} from './neuralPersonaGeneratedHierarchy';
import { prepareGeneratedNodeRelationships } from './neuralPersonaNodeBatchRelationships';
import type { CommitNeuralPersonaGeneratedNodesCommand } from './neuralPersonaNodeBatchCommandTypes';
import { isNeuralPersonaGeneratedNodeType } from './neuralPersonaNodeGenerationRecovery';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaGraphSnapshot,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export interface NodeBatchContentPreparation {
  anchor: NeuralPersonaNode;
  anchorCreated: boolean;
  existingNodes: NeuralPersonaNode[];
  newNodes: NeuralPersonaNode[];
  reused: NeuralPersonaNode[];
  selected: CommitNeuralPersonaGeneratedNodesCommand['batch']['candidates'];
}

export function prepareNodeBatchContent(options: {
  command: CommitNeuralPersonaGeneratedNodesCommand;
  current?: NeuralPersonaGraphSnapshot;
  createNode: (candidate: CommitNeuralPersonaGeneratedNodesCommand['batch']['candidates'][number]) => NeuralPersonaNode;
  timestamp: number;
}) {
  const existingNodes = options.current?.nodes ?? [];
  const selected = options.command.batch.candidates.filter((candidate) => candidate.enabled);
  const contentNodes = existingNodes.filter((node) => !isNeuralPersonaAnchorNode(node)
    && !isNeuralPersonaStructuralNode(node) && isNeuralPersonaGeneratedNodeType(node.type));
  const bySummary = new Map(contentNodes.map((node) => [normalized(node.influenceSummary), node]));
  const anchor = existingNodes.find(isNeuralPersonaAnchorNode)
    ?? createNeuralPersonaAnchorNode({
      personaName: options.command.batch.personaName,
      roleId: options.command.roleId, timestamp: options.timestamp,
    });
  return {
    anchor, anchorCreated: !existingNodes.some(isNeuralPersonaAnchorNode), existingNodes,
    newNodes: selected.filter((candidate) => !bySummary.has(normalized(candidate.influenceSummary)))
      .map(options.createNode),
    reused: selected.map((candidate) => bySummary.get(normalized(candidate.influenceSummary)))
      .filter((node): node is NeuralPersonaNode => Boolean(node)),
    selected,
  } satisfies NodeBatchContentPreparation;
}

export function assembleNodeBatchGraph(options: {
  command: CommitNeuralPersonaGeneratedNodesCommand;
  content: NodeBatchContentPreparation;
  current?: NeuralPersonaGraphSnapshot;
  revision: number;
  timestamp: number;
}) {
  const prepared = prepareHierarchy(options);
  const relationships = prepareGeneratedNodeRelationships({
    batchId: options.command.batch.batchId,
    candidates: options.command.batch.relationshipAnalysis?.status === 'complete'
      ? options.command.batch.relationshipAnalysis.candidates : [],
    existingEdges: prepared.retainedEdges, nodes: prepared.nodes,
    roleId: options.command.roleId, timestamp: options.timestamp,
  });
  if (relationships.issue) return { issue: relationships.issue } as const;
  const graph: NeuralPersonaGraphSnapshot = {
      createdAt: options.current?.createdAt ?? options.timestamp,
      edges: [...prepared.retainedEdges, ...prepared.hierarchy.generatedEdges,
        ...relationships.edges],
      graphVersion: `neural-graph.r${options.revision}`, nodes: prepared.nodes,
      roleId: options.command.roleId, schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
  };
  return {
    graph,
    hierarchy: prepared.hierarchy, issue: null, relationships,
    updatedExisting: prepared.updatedExisting,
  } as const;
}

function prepareHierarchy(options: {
  command: CommitNeuralPersonaGeneratedNodesCommand;
  content: NodeBatchContentPreparation;
  current?: NeuralPersonaGraphSnapshot;
  timestamp: number;
}) {
  const existingEdges = options.current?.edges ?? [];
  const bySummary = new Map([...options.content.reused, ...options.content.newNodes]
    .map((node) => [normalized(node.influenceSummary), node]));
  const targets = options.content.selected.map((candidate) => ({
    candidate, node: bySummary.get(normalized(candidate.influenceSummary))!,
  }));
  const hierarchy = buildGeneratedNeuralPersonaHierarchy({
    anchorNodeId: options.content.anchor.nodeId, existingEdges,
    existingNodes: [...options.content.existingNodes,
      ...(options.content.anchorCreated ? [options.content.anchor] : []),
      ...options.content.newNodes],
    roleId: options.command.roleId, targets, timestamp: options.timestamp,
  });
  const parent = hierarchy.parentByNodeId;
  const updatedExisting = options.content.existingNodes.map((node) => parent.has(node.nodeId)
    && node.parentNodeId !== parent.get(node.nodeId)
    ? { ...node, parentNodeId: parent.get(node.nodeId), updatedAt: options.timestamp } : node);
  const updatedNew = options.content.newNodes.map((node) => ({
    ...node, parentNodeId: parent.get(node.nodeId),
  }));
  const removed = new Set(hierarchy.removedEdgeIds);
  const retainedEdges = existingEdges.filter((edge) => !removed.has(edge.edgeId));
  const nodes = [...updatedExisting,
    ...(options.content.anchorCreated ? [options.content.anchor] : []),
    ...hierarchy.branchNodes, ...updatedNew];
  return { hierarchy, nodes, retainedEdges, updatedExisting };
}
