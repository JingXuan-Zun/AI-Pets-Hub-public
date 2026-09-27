import {
  buildGeneratedNeuralPersonaHierarchy,
  isNeuralPersonaStructuralNode,
} from './neuralPersonaGeneratedHierarchy';
import {
  createNeuralPersonaAnchorNode,
  isNeuralPersonaAnchorNode,
} from './neuralPersonaAnchor';
import type {
  NeuralPersonaNodeGenerationBatch,
  NeuralPersonaNodeGenerationCandidate,
} from './neuralPersonaNodeGenerationTypes';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

export function generatedCandidateNodeId(batchId: string, candidateId: string) {
  return `generated:${batchId}:${candidateId}`;
}

function previewNode(
  batch: NeuralPersonaNodeGenerationBatch,
  candidate: NeuralPersonaNodeGenerationCandidate,
): NeuralPersonaNode {
  return {
    activationCount: 0, baseWeight: candidate.baseWeight,
    confidence: candidate.confidence, createdAt: batch.generatedAt,
    currentActivation: 0, decayRate: 0.02,
    influenceSummary: candidate.influenceSummary.trim(),
    nodeId: generatedCandidateNodeId(batch.batchId, candidate.candidateId),
    ownerRoleId: batch.roleId, plasticity: 0.2, protected: false,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION, scope: 'private', stability: 0.8,
    status: 'active', tags: candidate.tags.map((label) => ({
      canonicalId: `preview:${normalized(label)}`, label, source: 'system', status: 'active',
    })),
    type: candidate.type, updatedAt: batch.generatedAt,
  };
}

export function createGeneratedCandidatePreviewNodes(
  batch: NeuralPersonaNodeGenerationBatch,
  existingNodes: NeuralPersonaNode[],
) {
  const contentNodes = existingNodes.filter((node) => !node.protected
    && !isNeuralPersonaStructuralNode(node) && node.type !== 'persona-anchor');
  const existingBySummary = new Map(contentNodes.map(
    (node) => [normalized(node.influenceSummary), node],
  ));
  const generated = batch.candidates.filter((candidate) => candidate.enabled).map(
    (candidate) => existingBySummary.get(normalized(candidate.influenceSummary))
      ?? previewNode(batch, candidate),
  );
  return [...new Map([...contentNodes, ...generated].map(
    (node) => [node.nodeId, node],
  )).values()];
}

export function createGeneratedRelationshipPreviewGraph(
  batch: NeuralPersonaNodeGenerationBatch,
  current?: { edges: import('./neuralPersonaTypes').NeuralPersonaEdge[]; nodes: NeuralPersonaNode[] },
) {
  const existingNodes = current?.nodes ?? [];
  const contentNodes = createGeneratedCandidatePreviewNodes(batch, existingNodes);
  const anchor = existingNodes.find(isNeuralPersonaAnchorNode)
    ?? createNeuralPersonaAnchorNode({
      personaName: batch.personaName, roleId: batch.roleId, timestamp: batch.generatedAt,
    });
  const allNodes = [...existingNodes, ...(existingNodes.includes(anchor) ? [] : [anchor]),
    ...contentNodes];
  const bySummary = new Map(contentNodes.map(
    (node) => [normalized(node.influenceSummary), node],
  ));
  const targets = batch.candidates.filter((candidate) => candidate.enabled).map((candidate) => ({
    candidate, node: bySummary.get(normalized(candidate.influenceSummary))!,
  }));
  const hierarchy = buildGeneratedNeuralPersonaHierarchy({
    anchorNodeId: anchor.nodeId, existingEdges: current?.edges ?? [],
    existingNodes: allNodes, roleId: batch.roleId, targets, timestamp: batch.generatedAt,
  });
  const nodes = new Map([...allNodes, ...hierarchy.branchNodes].map((node) => [node.nodeId, node]));
  hierarchy.parentByNodeId.forEach((parentNodeId, nodeId) => {
    const node = nodes.get(nodeId);
    if (node) nodes.set(nodeId, { ...node, parentNodeId });
  });
  const removed = new Set(hierarchy.removedEdgeIds);
  return {
    edges: [...(current?.edges ?? []).filter((edge) => !removed.has(edge.edgeId)),
      ...hierarchy.generatedEdges],
    nodes: [...nodes.values()],
  };
}
