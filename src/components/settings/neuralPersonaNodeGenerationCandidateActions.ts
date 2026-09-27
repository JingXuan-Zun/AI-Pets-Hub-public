import type {
  NeuralPersonaNodeGenerationBatch,
  NeuralPersonaNodeGenerationCandidate,
  NeuralPersonaRelationshipCandidate,
} from '../../character-graph/neural-persona';
import { createManualNodeCandidate } from './neuralPersonaNodeGenerationUi';

function withoutRelationships(batch: NeuralPersonaNodeGenerationBatch) {
  return {
    ...batch,
    relationshipAnalysis: {
      candidates: [], providerId: 'stale-candidate-batch',
      reason: 'relationship-analysis-stale', status: 'failed' as const,
    },
  };
}

export function updateGeneratedNodeCandidate(
  batch: NeuralPersonaNodeGenerationBatch,
  candidateId: string,
  patch: Partial<NeuralPersonaNodeGenerationCandidate>,
) {
  return withoutRelationships({
    ...batch,
    candidates: batch.candidates.map((candidate) => candidate.candidateId === candidateId
      ? { ...candidate, ...patch } : candidate),
  });
}

export function removeGeneratedNodeCandidate(
  batch: NeuralPersonaNodeGenerationBatch, candidateId: string,
) {
  return withoutRelationships({
    ...batch,
    candidates: batch.candidates.filter((candidate) => candidate.candidateId !== candidateId),
  });
}

export function addGeneratedNodeCandidate(batch: NeuralPersonaNodeGenerationBatch) {
  return withoutRelationships({
    ...batch, candidates: [...batch.candidates, createManualNodeCandidate()],
  });
}

export function updateGeneratedRelationshipCandidate(
  batch: NeuralPersonaNodeGenerationBatch,
  candidateId: string,
  patch: Partial<NeuralPersonaRelationshipCandidate>,
) {
  if (!batch.relationshipAnalysis) return batch;
  return {
    ...batch, relationshipAnalysis: {
      ...batch.relationshipAnalysis,
      candidates: batch.relationshipAnalysis.candidates.map((candidate) => (
        candidate.candidateId === candidateId ? { ...candidate, ...patch } : candidate
      )),
    },
  };
}

export function removeGeneratedRelationshipCandidate(
  batch: NeuralPersonaNodeGenerationBatch, candidateId: string,
) {
  if (!batch.relationshipAnalysis) return batch;
  return {
    ...batch, relationshipAnalysis: {
      ...batch.relationshipAnalysis,
      candidates: batch.relationshipAnalysis.candidates.filter(
        (candidate) => candidate.candidateId !== candidateId,
      ),
    },
  };
}
