import { isNeuralPersonaStructuralEdge } from './neuralPersonaGeneratedHierarchy';
import type { NeuralPersonaRelationshipCandidate } from './neuralPersonaRelationshipCandidateTypes';
import { validateNeuralPersonaRelationshipCandidate } from './neuralPersonaRelationshipCandidates';
import { neuralPersonaRelationshipKey } from './neuralPersonaRelationshipKeys';
import {
  NEURAL_PERSONA_SCHEMA_VERSION,
  type NeuralPersonaEdge,
  type NeuralPersonaNode,
} from './neuralPersonaTypes';

export function prepareGeneratedNodeRelationships(options: {
  batchId: string;
  candidates: NeuralPersonaRelationshipCandidate[];
  existingEdges: NeuralPersonaEdge[];
  nodes: NeuralPersonaNode[];
  roleId: string;
  timestamp: number;
}) {
  const selected = options.candidates.filter((candidate) => candidate.enabled);
  if (selected.length > 30) return { issue: 'relationship-candidate-selection-invalid' } as const;
  const issue = selected.map((candidate) => (
    validateNeuralPersonaRelationshipCandidate(candidate, options.nodes)
  )).find(Boolean);
  if (issue) return { issue } as const;
  const keys = selected.map(neuralPersonaRelationshipKey);
  if (new Set(keys).size !== keys.length) {
    return { issue: 'relationship-candidate-duplicate' } as const;
  }
  const existing = new Set(options.existingEdges.filter(
    (edge) => !isNeuralPersonaStructuralEdge(edge),
  ).map(neuralPersonaRelationshipKey));
  if (keys.some((key) => existing.has(key))) {
    return { issue: 'relationship-edge-already-exists' } as const;
  }
  const edges = selected.map((candidate, index): NeuralPersonaEdge => ({
    confidence: candidate.confidence, createdAt: options.timestamp,
    edgeId: `cognitive:${options.batchId}:${candidate.candidateId || index + 1}`,
    ownerRoleId: options.roleId, relationType: candidate.relationType,
    schemaVersion: NEURAL_PERSONA_SCHEMA_VERSION,
    sourceNodeId: candidate.sourceNodeId, targetNodeId: candidate.targetNodeId,
    updatedAt: options.timestamp, weight: candidate.weight,
  }));
  return { edges, issue: null } as const;
}
