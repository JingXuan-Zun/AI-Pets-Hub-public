import type { NeuralPersonaCandidate } from './neuralPersonaCandidateTypes';

export interface NeuralPersonaConflictResolution {
  filteredNodeIds: string[];
  selected: NeuralPersonaCandidate[];
}

function sourceKey(candidate: NeuralPersonaCandidate) {
  return candidate.node.sourceRef?.trim() || `node:${candidate.node.nodeId}`;
}

export function resolveNeuralPersonaCandidateConflicts(
  candidates: NeuralPersonaCandidate[],
  maxSelectedNodes: number,
): NeuralPersonaConflictResolution {
  const selected: NeuralPersonaCandidate[] = [];
  const filteredNodeIds: string[] = [];
  const selectedSources = new Set<string>();
  for (const candidate of candidates) {
    if (selected.length >= maxSelectedNodes) {
      filteredNodeIds.push(candidate.node.nodeId);
      continue;
    }
    const key = sourceKey(candidate);
    if (selectedSources.has(key)) {
      filteredNodeIds.push(candidate.node.nodeId);
      continue;
    }
    selectedSources.add(key);
    selected.push(candidate);
  }
  return { filteredNodeIds, selected };
}
