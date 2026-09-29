import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';
import { NEURAL_PERSONA_LEARNING_PROPOSAL_STORAGE_PREFIX } from './neuralPersonaStorageNamespaces';

export function neuralPersonaLearningProposalStorageKey(roleId: string) {
  return `${NEURAL_PERSONA_LEARNING_PROPOSAL_STORAGE_PREFIX}${roleId}`;
}

export function createNeuralPersonaLearningProposalStorage(
  storage: NeuralPersonaAtomicStorage,
): NeuralPersonaAtomicStorage {
  return {
    compareAndSwap: (roleId, expectedValue, nextValue) => storage.compareAndSwap(
      neuralPersonaLearningProposalStorageKey(roleId), expectedValue, nextValue,
    ),
    read: (roleId) => storage.read(neuralPersonaLearningProposalStorageKey(roleId)),
  };
}
