import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';
import { NEURAL_PERSONA_FEEDBACK_STORAGE_PREFIX } from './neuralPersonaStorageNamespaces';

export function neuralPersonaFeedbackStorageKey(roleId: string) {
  return `${NEURAL_PERSONA_FEEDBACK_STORAGE_PREFIX}${roleId}`;
}

export function createNeuralPersonaFeedbackStorage(
  storage: NeuralPersonaAtomicStorage,
): NeuralPersonaAtomicStorage {
  return {
    compareAndSwap: (roleId, expectedValue, nextValue) => storage.compareAndSwap(
      neuralPersonaFeedbackStorageKey(roleId), expectedValue, nextValue,
    ),
    read: (roleId) => storage.read(neuralPersonaFeedbackStorageKey(roleId)),
  };
}
