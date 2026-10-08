import { useSyncExternalStore } from 'react';

/** Shared state for the pill under the model; the runtime hook owns the behavior. */
export interface ScreenWatchState {
  /** The character asked to watch and is waiting for 同意 / 不用了. */
  asking: boolean;
  /** When the user last said no to being watched; the character waits before asking again. */
  declinedAt: number;
  /** A look (capture + recognition) is in progress. */
  looking: boolean;
  /** Short summary of the last look, shown as the pill's tooltip. */
  lastSummary: string;
  watching: boolean;
}

interface ScreenWatchActions {
  answer: (accepted: boolean) => void;
  disconnect: () => void;
}

const listeners = new Set<() => void>();
let state: ScreenWatchState = { asking: false, declinedAt: 0, lastSummary: '', looking: false, watching: false };
let actions: ScreenWatchActions = { answer: () => undefined, disconnect: () => undefined };

export const screenWatchStore = {
  getState: () => state,
  setState(patch: Partial<ScreenWatchState>) {
    const next = { ...state, ...patch };
    if (Object.keys(patch).every((key) => next[key as keyof ScreenWatchState] === state[key as keyof ScreenWatchState])) return;
    state = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  /** Registered by the runtime hook; the pill only calls these. */
  setActions(next: ScreenWatchActions) { actions = next; },
  answer: (accepted: boolean) => actions.answer(accepted),
  disconnect: () => actions.disconnect(),
};

export function useScreenWatchState() {
  return useSyncExternalStore(screenWatchStore.subscribe, screenWatchStore.getState, screenWatchStore.getState);
}
