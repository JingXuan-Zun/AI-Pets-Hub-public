import { useSyncExternalStore } from 'react';
import type { CharacterCognition } from './characterCognitionTypes';

// Kept in localStorage: short-term state, shared by the pet, chat and settings windows (same
// origin), and not worth a write of the big config file after every conversation. Long-term
// memory still goes through the user's approval elsewhere.

const STORAGE_KEY = 'desktop-pet.character-cognition.v1';
const listeners = new Set<() => void>();
let cache: { raw: string | null; value: Record<string, CharacterCognition> } = { raw: null, value: {} };

function readAll(): Record<string, CharacterCognition> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cache.raw) return cache.value;
    const parsed = raw ? JSON.parse(raw) as unknown : {};
    const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, CharacterCognition> : {};
    cache = { raw, value };
    return value;
  } catch {
    return {};
  }
}

function writeAll(next: Record<string, CharacterCognition>) {
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, raw);
    cache = { raw, value: next };
  } catch {
    // Storage full or unavailable: the layer just starts over next time.
  }
  listeners.forEach((listener) => listener());
}

const PAUSED_KEY = 'desktop-pet.character-cognition.paused';

/** The switch in 生活陪伴 also lands here, so parts that cannot read settings (group-chat ranking) follow it. */
export function isCognitionPaused() {
  try {
    return window.localStorage.getItem(PAUSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setCognitionPaused(paused: boolean) {
  try {
    if (paused) window.localStorage.setItem(PAUSED_KEY, '1');
    else window.localStorage.removeItem(PAUSED_KEY);
  } catch {
    // Storage unavailable: ranking keeps using the stored states.
  }
  listeners.forEach((listener) => listener());
}

export function readCharacterCognition(roleId: string): CharacterCognition | null {
  return readAll()[roleId] ?? null;
}

export function listCharacterCognition() {
  return readAll();
}

export function saveCharacterCognition(cognition: CharacterCognition) {
  writeAll({ ...readAll(), [cognition.roleId]: cognition });
}

export function updateCharacterCognition(roleId: string, update: (current: CharacterCognition) => CharacterCognition) {
  const current = readCharacterCognition(roleId);
  if (!current) return;
  const next = update(current);
  if (next !== current) saveCharacterCognition(next);
}

/** Forget one character's state (she starts again from her persona), or everyone's. */
export function clearCharacterCognition(roleId?: string) {
  if (!roleId) {
    writeAll({});
    return;
  }
  const { [roleId]: _removed, ...rest } = readAll();
  writeAll(rest);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useCharacterCognitionMap() {
  return useSyncExternalStore(subscribe, readAll, () => ({}));
}
