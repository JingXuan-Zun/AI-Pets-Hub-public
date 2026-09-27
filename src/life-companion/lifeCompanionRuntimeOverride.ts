import { useSyncExternalStore } from 'react';

export interface LifeCompanionRuntimeOverrideState {
  manualSuspended: boolean;
  manualSuspendedAt: number | null;
  updatedAt: number;
}

type Listener = () => void;

export const DEFAULT_LIFE_COMPANION_RUNTIME_OVERRIDE: LifeCompanionRuntimeOverrideState = {
  manualSuspended: false,
  manualSuspendedAt: null,
  updatedAt: 0,
};

function createLifeCompanionRuntimeOverrideStore() {
  let state = DEFAULT_LIFE_COMPANION_RUNTIME_OVERRIDE;
  const listeners = new Set<Listener>();

  function setState(nextState: LifeCompanionRuntimeOverrideState) {
    state = nextState;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot() {
      return state;
    },
    setManualSuspended(manualSuspended: boolean, now = Date.now()) {
      setState({
        manualSuspended,
        manualSuspendedAt: manualSuspended ? now : null,
        updatedAt: now,
      });
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const lifeCompanionRuntimeOverrideStore = createLifeCompanionRuntimeOverrideStore();

export function useLifeCompanionRuntimeOverride() {
  return useSyncExternalStore(
    lifeCompanionRuntimeOverrideStore.subscribe,
    lifeCompanionRuntimeOverrideStore.getSnapshot,
    lifeCompanionRuntimeOverrideStore.getSnapshot,
  );
}
