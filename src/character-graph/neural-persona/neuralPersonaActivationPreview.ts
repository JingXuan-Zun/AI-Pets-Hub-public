import { retrieveNeuralPersonaCandidates } from './neuralPersonaCandidateRetriever';
import type { NeuralPersonaCandidate } from './neuralPersonaCandidateTypes';
import { buildNeuralContextContribution } from './neuralPersonaContextAdapter';
import type { NeuralPersonaConfig } from './neuralPersonaConfig';
import type { ReadonlyNeuralPersonaGraphStore } from './neuralPersonaGraphStore';
import { propagateNeuralPersonaCandidates } from './neuralPersonaPropagation';
import { createNeuralPersonaTagIndex } from './neuralPersonaTagIndex';
import type { NeuralPersonaContextInput } from './neuralPersonaTypes';

export type NeuralPersonaActivationPreviewStatus = 'filtered' | 'selected' | 'suppressed';

export interface NeuralPersonaActivationPreviewNode {
  depth: number;
  label: string;
  nodeId: string;
  path: string[];
  reason: string[];
  score: number;
  status: NeuralPersonaActivationPreviewStatus;
}

export interface NeuralPersonaActivationPreview {
  candidateCount: number;
  nodes: NeuralPersonaActivationPreviewNode[];
  selectedCount: number;
  tokenBudgetUsed: number;
  traceId: string;
}

function previewNode(
  candidate: NeuralPersonaCandidate,
  selectedIds: ReadonlySet<string>,
): NeuralPersonaActivationPreviewNode {
  return {
    depth: candidate.depth, label: candidate.node.influenceSummary,
    nodeId: candidate.node.nodeId, path: candidate.path,
    reason: candidate.reason, score: candidate.score.total,
    status: selectedIds.has(candidate.node.nodeId) ? 'selected' : 'filtered',
  };
}

export function inspectNeuralPersonaActivation(options: {
  config: NeuralPersonaConfig;
  input: NeuralPersonaContextInput;
  store: ReadonlyNeuralPersonaGraphStore;
}): NeuralPersonaActivationPreview {
  const seeds = retrieveNeuralPersonaCandidates({
    ...options, tagIndex: createNeuralPersonaTagIndex(options.store),
  });
  const propagated = propagateNeuralPersonaCandidates({ ...options, seeds });
  const result = buildNeuralContextContribution({ ...options, seedCandidates: seeds });
  const selectedIds = new Set(result.trace.selectedNodeIds);
  const nodes = propagated.candidates.map((candidate) => previewNode(candidate, selectedIds));
  const represented = new Set(nodes.map((node) => node.nodeId));
  propagated.suppressedNodeIds.forEach((nodeId) => {
    if (represented.has(nodeId)) return;
    const node = options.store.getNode(nodeId);
    if (node) nodes.push({
      depth: 0, label: node.influenceSummary, nodeId, path: [nodeId], reason: ['suppressed'],
      score: 0, status: 'suppressed',
    });
  });
  return {
    candidateCount: seeds.length,
    nodes,
    selectedCount: result.trace.selectedNodeIds.length,
    tokenBudgetUsed: result.contribution.tokenBudgetUsed,
    traceId: result.trace.traceId,
  };
}
