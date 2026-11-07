import { useSyncExternalStore } from 'react';
import type { ProactiveSpeechEntry } from './proactiveSpeechRules';

// When each character last spoke first (kept two days, for the limits and the settings panel),
// plus the latest heartbeat's answer to "why not now?".

const STORAGE_KEY = 'desktop-pet.proactive-speech-log.v1';
const KEEP_MS = 2 * 24 * 60 * 60 * 1000;

export interface ProactiveSpeechSnapshot {
  log: ProactiveSpeechEntry[];
  /** Why nobody spoke at the last heartbeat (null right after someone spoke). */
  waitingReason: string | null;
  checkedAt: number | null;
}

function readLog(): ProactiveSpeechEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.at === 'number' && typeof entry.roleId === 'string') : [];
  } catch {
    return [];
  }
}

let snapshot: ProactiveSpeechSnapshot = { checkedAt: null, log: readLog(), waitingReason: null };
const listeners = new Set<() => void>();

function publish(next: ProactiveSpeechSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function readProactiveSpeechLog(now = Date.now()) {
  return snapshot.log.filter((entry) => now - entry.at < KEEP_MS);
}

export function recordProactiveSpeech(entry: ProactiveSpeechEntry) {
  const log = [...readProactiveSpeechLog(entry.at), entry];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch {
    // The limits still hold for this session from memory.
  }
  publish({ checkedAt: entry.at, log, waitingReason: null });
}

export function setProactiveWaitingReason(reason: string, now = Date.now()) {
  if (snapshot.waitingReason === reason) {
    snapshot = { ...snapshot, checkedAt: now };
    return;
  }
  publish({ ...snapshot, checkedAt: now, waitingReason: reason });
}

export function useProactiveSpeechSnapshot() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => snapshot,
    () => snapshot,
  );
}
