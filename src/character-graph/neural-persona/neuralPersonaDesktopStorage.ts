import type { NeuralPersonaAtomicStorage } from './neuralPersonaPersistenceTypes';

function unavailable(operation: string): never {
  throw new Error(`neural-persona-desktop-storage-unavailable:${operation}`);
}

export function createNeuralPersonaDesktopStorage(): NeuralPersonaAtomicStorage {
  return {
    compareAndSwap: async (roleId, expectedValue, nextValue) => {
      const bridge = window.desktopPetShell?.compareAndSwapNeuralPersonaRecord;
      if (!bridge) return unavailable('compare-and-swap');
      const result = await bridge({ expectedValue, nextValue, roleId });
      if (!result.ok) throw new Error(result.error ?? 'neural-persona-cas-failed');
      return result.matched;
    },
    read: async (roleId) => {
      const bridge = window.desktopPetShell?.readNeuralPersonaRecord;
      if (!bridge) return unavailable('read');
      const result = await bridge({ roleId });
      if (!result.ok) throw new Error(result.error ?? 'neural-persona-read-failed');
      return result.value;
    },
  };
}
