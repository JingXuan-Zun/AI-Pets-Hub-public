import { isNeuralPersonaStructuralNode } from './neuralPersonaGeneratedHierarchy';
import type { NeuralPersonaNodeGenerationBatch } from './neuralPersonaNodeGenerationTypes';
import type { NeuralPersonaRelationshipCandidate } from './neuralPersonaRelationshipCandidateTypes';
import type { NeuralPersonaNode } from './neuralPersonaTypes';

const MAX_RELATIONSHIP_CANDIDATES = 30;

function normalized(value: string) {
  return value.trim().replace(/\s+/gu, ' ').toLocaleLowerCase();
}

function pairKey(sourceNodeId: string, targetNodeId: string) {
  return [sourceNodeId, targetNodeId].sort().join('\u0000');
}

function generatedNodes(batch: NeuralPersonaNodeGenerationBatch, nodes: NeuralPersonaNode[]) {
  const bySummary = new Map(nodes.filter((node) => node.status === 'active'
    && !node.protected && !isNeuralPersonaStructuralNode(node) && node.type !== 'persona-anchor')
    .map((node) => [normalized(node.influenceSummary), node]));
  return batch.candidates.filter((candidate) => candidate.enabled).map((candidate) => (
    bySummary.get(normalized(candidate.influenceSummary))
  )).filter((node): node is NeuralPersonaNode => Boolean(node));
}

export function supplementGeneratedRelationshipCandidates(options: {
  batch: NeuralPersonaNodeGenerationBatch;
  candidates: NeuralPersonaRelationshipCandidate[];
  nodes: NeuralPersonaNode[];
}) {
  const candidates = [...options.candidates];
  const pairs = new Set(candidates.map((candidate) => (
    pairKey(candidate.sourceNodeId, candidate.targetNodeId)
  )));
  const connected = new Set(candidates.flatMap((candidate) => (
    [candidate.sourceNodeId, candidate.targetNodeId]
  )));
  const nodes = generatedNodes(options.batch, options.nodes);
  for (let index = 0; index < nodes.length - 1
    && candidates.length < MAX_RELATIONSHIP_CANDIDATES; index += 1) {
    const source = nodes[index]; const target = nodes[index + 1];
    const key = pairKey(source.nodeId, target.nodeId);
    if (source.nodeId === target.nodeId || pairs.has(key)
      || (connected.has(source.nodeId) && connected.has(target.nodeId))) continue;
    candidates.push({
      candidateId: `local-source-continuity-${index + 1}`,
      confidence: source.type === target.type ? 0.72 : 0.62,
      enabled: true, origin: 'local',
      reason: '来自同一人格原文中相邻的语义片段，建议保留上下文连续关系。',
      relationType: 'associated-with', sourceNodeId: source.nodeId,
      targetNodeId: target.nodeId, weight: source.type === target.type ? 0.68 : 0.58,
    });
    pairs.add(key); connected.add(source.nodeId); connected.add(target.nodeId);
  }
  return candidates;
}
