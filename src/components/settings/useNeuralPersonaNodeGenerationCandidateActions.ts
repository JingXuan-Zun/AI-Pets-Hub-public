import type { Dispatch, SetStateAction } from 'react';
import type {
  NeuralPersonaNodeGenerationBatch,
  NeuralPersonaNodeGenerationCandidate,
} from '../../character-graph/neural-persona';
import {
  addGeneratedNodeCandidate,
  removeGeneratedNodeCandidate,
  removeGeneratedRelationshipCandidate,
  updateGeneratedNodeCandidate,
  updateGeneratedRelationshipCandidate,
} from './neuralPersonaNodeGenerationCandidateActions';

interface CandidateState {
  setBatch: Dispatch<SetStateAction<NeuralPersonaNodeGenerationBatch | undefined>>;
  setCommitted: Dispatch<SetStateAction<boolean>>;
}

export function useNeuralPersonaNodeGenerationCandidateActions(state: CandidateState) {
  const updateCandidate = (
    candidateId: string,
    patch: Partial<NeuralPersonaNodeGenerationCandidate>,
  ) => {
    state.setCommitted(false);
    state.setBatch((current) => current
      ? updateGeneratedNodeCandidate(current, candidateId, patch) : current);
  };
  const removeCandidate = (candidateId: string) => {
    state.setCommitted(false);
    state.setBatch((current) => current
      ? removeGeneratedNodeCandidate(current, candidateId) : current);
  };
  const addCandidate = () => {
    state.setCommitted(false);
    state.setBatch((current) => current ? addGeneratedNodeCandidate(current) : current);
  };
  const updateRelationshipCandidate = (candidateId: string, patch: Parameters<
    typeof updateGeneratedRelationshipCandidate
  >[2]) => state.setBatch((current) => current
    ? updateGeneratedRelationshipCandidate(current, candidateId, patch) : current);
  const removeRelationshipCandidate = (candidateId: string) => state.setBatch(
    (current) => current
      ? removeGeneratedRelationshipCandidate(current, candidateId) : current,
  );
  return {
    addCandidate, removeCandidate, removeRelationshipCandidate,
    updateCandidate, updateRelationshipCandidate,
  };
}
