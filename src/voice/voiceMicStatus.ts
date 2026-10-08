import { useSyncExternalStore } from 'react';

// What the microphone is doing right now, for the status pill under the character: waiting for a
// wake phrase in the background, or in a hands-free conversation (which can be ended from the pill).
export interface VoiceMicStatus {
  wakeListening: boolean;
  conversationActive: boolean;
}

let state: VoiceMicStatus = { wakeListening: false, conversationActive: false };
let stopConversation: (() => void) | null = null;
const listeners = new Set<() => void>();

function update(patch: Partial<VoiceMicStatus>) {
  const next = { ...state, ...patch };
  if (next.wakeListening === state.wakeListening && next.conversationActive === state.conversationActive) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export const voiceMicStatusStore = {
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  setWakeListening(wakeListening: boolean) {
    update({ wakeListening });
  },
  /** stop is how the pill ends this conversation; cleared when the conversation ends. */
  setConversation(active: boolean, stop: (() => void) | null = null) {
    stopConversation = active ? stop : null;
    update({ conversationActive: active });
  },
  stopConversation() {
    stopConversation?.();
  },
};

export function useVoiceMicStatus() {
  return useSyncExternalStore(voiceMicStatusStore.subscribe, voiceMicStatusStore.getState, voiceMicStatusStore.getState);
}
