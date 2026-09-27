import { canReadNeuralPersonaNode } from './neuralPersonaAccessPolicy';
import type { NeuralPersonaCandidate } from './neuralPersonaCandidateTypes';
import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import type {
  NeuralPersonaContextInput,
  NeuralPersonaEdge,
  NeuralPersonaNode,
} from './neuralPersonaTypes';
import { isNeuralPersonaAnchorNode } from './neuralPersonaAnchor';
import {
  isNeuralPersonaStructuralEdge,
  isNeuralPersonaStructuralNode,
} from './neuralPersonaGeneratedHierarchy';

export interface NeuralPersonaPropagationResult {
  candidates: NeuralPersonaCandidate[];
  suppressedNodeIds: string[];
}

const INHIBITORY_RELATIONS = new Set<NeuralPersonaEdge['relationType']>([
  'inhibits',
  'opposes',
]);

function propagatedScore(sourceScore: number, edge: NeuralPersonaEdge, depth: number) {
  const depthDecay = depth === 1 ? 0.65 : 0.4;
  return sourceScore * edge.weight * edge.confidence * depthDecay;
}

function propagatedCandidate(
  node: NeuralPersonaNode,
  score: number,
  depth: number,
  path: string[],
  edge: NeuralPersonaEdge,
): NeuralPersonaCandidate {
  return {
    depth,
    node,
    path,
    reason: [`propagated:${edge.relationType}`, `depth:${depth}`],
    score: {
      baseWeight: node.baseWeight,
      confidence: node.confidence,
      cooldownPenalty: 0,
      keywordRelevance: 0,
      repeatPenalty: 0,
      tagRelevance: 0,
      total: Math.max(0, Math.min(1, score * node.confidence)),
    },
  };
}

function outgoingEdges(store: ReadonlyNeuralPersonaGraphStore) {
  const edges = new Map<string, NeuralPersonaEdge[]>();
  const add = (sourceNodeId: string, edge: NeuralPersonaEdge) => {
    const current = edges.get(sourceNodeId) ?? [];
    current.push(edge); edges.set(sourceNodeId, current);
  };
  store.listEdges().forEach((edge) => {
    if (isNeuralPersonaStructuralEdge(edge)) return;
    add(edge.sourceNodeId, edge);
    if (edge.relationType === 'associated-with') {
      add(edge.targetNodeId, { ...edge, sourceNodeId: edge.targetNodeId, targetNodeId: edge.sourceNodeId });
    }
  });
  edges.forEach((value) => value.sort((a, b) => a.edgeId.localeCompare(b.edgeId)));
  return edges;
}

export function propagateNeuralPersonaCandidates(options: {
  config: NeuralPersonaConfig;
  input: NeuralPersonaContextInput;
  seeds: NeuralPersonaCandidate[];
  store: ReadonlyNeuralPersonaGraphStore;
}): NeuralPersonaPropagationResult {
  const byId = new Map(options.seeds.map((candidate) => [candidate.node.nodeId, candidate]));
  const suppressions = new Map<string, number>();
  const queue = [...options.seeds];
  const edgesBySource = outgoingEdges(options.store);
  while (queue.length) {
    const source = queue.shift()!;
    if (source.depth >= options.config.maxPropagationDepth) continue;
    for (const edge of edgesBySource.get(source.node.nodeId) ?? []) {
      if (isNeuralPersonaStructuralEdge(edge)) continue;
      const target = options.store.getNode(edge.targetNodeId);
      if (!target || isNeuralPersonaAnchorNode(target)
        || isNeuralPersonaStructuralNode(target)
        || !canReadNeuralPersonaNode(target, options.input)) continue;
      const depth = source.depth + 1;
      const score = propagatedScore(source.score.total, edge, depth);
      if (score < options.config.propagationThreshold) continue;
      if (INHIBITORY_RELATIONS.has(edge.relationType)) {
        suppressions.set(target.nodeId, Math.max(suppressions.get(target.nodeId) ?? 0, score));
        continue;
      }
      if (source.path.includes(target.nodeId)) continue;
      const current = byId.get(target.nodeId);
      if (current && current.score.total >= score) continue;
      const candidate = propagatedCandidate(target, score, depth, [...source.path, target.nodeId], edge);
      byId.set(target.nodeId, candidate);
      queue.push(candidate);
    }
  }
  const candidates = [...byId.values()].filter((candidate) => (
    (suppressions.get(candidate.node.nodeId) ?? 0) < candidate.score.total
  )).sort((left, right) => right.score.total - left.score.total
    || left.node.nodeId.localeCompare(right.node.nodeId));
  return { candidates, suppressedNodeIds: [...suppressions.keys()].sort() };
}
