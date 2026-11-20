import { useSyncExternalStore } from 'react';
import type { LiveWatchMode } from './liveWatchRules';

/** Shared state of a watch-along session; the runtime hook owns the behavior, the pill shows it. */
export interface LiveWatchState {
  active: boolean;
  mode: LiveWatchMode;
  /** Ears: system sound is coming in (false = sound capture failed; she only watches). */
  hearing: boolean;
  /** A look or a line is being made. */
  busy: boolean;
  /** Last thing she said, the pill's tooltip. */
  lastLine: string;
  /** Why it stopped or what failed, shown once. */
  note: string;
  startedAt: number;
  /** Counters for this session (why she is quiet, what it costs): looks, heard pieces, asks, PASS answers. */
  stats: LiveWatchStats;
}

export interface LiveWatchStats { asks: number; heard: number; lastHeard: string; lastSeen: string; looks: number; passes: number; spoken: number }
const EMPTY_STATS: LiveWatchStats = { asks: 0, heard: 0, lastHeard: '', lastSeen: '', looks: 0, passes: 0, spoken: 0 };

const listeners = new Set<() => void>();
let state: LiveWatchState = { active: false, busy: false, hearing: false, lastLine: '', mode: 'video', note: '', startedAt: 0, stats: EMPTY_STATS };

export const liveWatchStore = {
  getState: () => state,
  setState(patch: Partial<LiveWatchState>) {
    const next = { ...state, ...patch };
    if (Object.keys(patch).every((key) => next[key as keyof LiveWatchState] === state[key as keyof LiveWatchState])) return;
    state = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  start(mode: LiveWatchMode = 'video') {
    if (state.active) return false;
    liveWatchStore.setState({ active: true, busy: false, hearing: false, lastLine: '', mode, note: '', startedAt: Date.now(), stats: EMPTY_STATS });
    return true;
  },
  stop(note = '') {
    if (!state.active) return false;
    liveWatchStore.setState({ active: false, busy: false, hearing: false, note });
    return true;
  },
  count(patch: Partial<Record<Exclude<keyof LiveWatchStats, 'lastHeard' | 'lastSeen'>, number>> & { lastHeard?: string; lastSeen?: string }) {
    const stats = { ...state.stats };
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'lastHeard' || key === 'lastSeen') stats[key] = String(value);
      else (stats as unknown as Record<string, number>)[key] += Number(value);
    }
    liveWatchStore.setState({ stats });
  },
  /** Registered by the runtime hook (it can speak); the pill only calls this. */
  setPillStop(next: () => void) { pillStop = next; },
  stopFromPill: () => pillStop(),
};
let pillStop: () => void = () => { liveWatchStore.stop(); };
// Development only: tests read the instance the app really uses (hot reloads make extra module copies).
if (import.meta.env?.DEV && typeof window !== 'undefined') (window as unknown as { __desktopPetLiveWatch?: typeof liveWatchStore }).__desktopPetLiveWatch = liveWatchStore;

export function useLiveWatchState() {
  return useSyncExternalStore(liveWatchStore.subscribe, liveWatchStore.getState, liveWatchStore.getState);
}
