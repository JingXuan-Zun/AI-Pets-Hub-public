import { compactMemoryText, createCharacterMemoryItemId, type CharacterMemoryState } from './characterMemoryTypes';

// When the user corrects how a character frames "us" ("什么你家 这是我们家"), the correction is
// kept as a pinned memory of that character, so it lasts beyond the next few messages
// (2026-11-19). Only a message that contrasts the two ("你家 / 你的 / 不是…" together with
// "我们 / 咱们…") counts; "我们家的猫饿了" alone does not. One such memory per character: a
// later correction refreshes it. Editable in the character's memory list like any other.

export const PERSPECTIVE_MEMORY_PREFIX = '用户纠正过说法：';
const MAX_CORRECTION_CHARS = 60;
const OURS = /(我们|咱们|咱)(家|的|一家)/u;
const CONTRAST = /你家|你的|你们家|不是你|别说你|不要说你|什么你|不是外人/u;

/** The memory to keep for this user message, or null when it is not such a correction. */
export function detectPerspectiveCorrection(userText: string) {
  const text = userText.replace(/\s+/gu, ' ').trim();
  if (!text || text.length > MAX_CORRECTION_CHARS || !OURS.test(text) || !CONTRAST.test(text)) return null;
  return compactMemoryText(`${PERSPECTIVE_MEMORY_PREFIX}家里的东西和一起的事要说“我们家”“我们的”，不要说“你家”“你的”（原话：“${text}”）`);
}

/**
 * Corrections made before this existed (the 11-17 "什么你家 这是我们家") are found in the
 * history once: the newest one becomes the memory, unless she already has one.
 */
export function withEarlierPerspectiveCorrection(state: CharacterMemoryState, userTexts: string[], now: number): CharacterMemoryState {
  if (state.items.some((item) => item.text.startsWith(PERSPECTIVE_MEMORY_PREFIX))) return state;
  const latest = [...userTexts].reverse().find((text) => detectPerspectiveCorrection(text));
  return latest ? withPerspectiveCorrection(state, latest, now) : state;
}

export function withPerspectiveCorrection(state: CharacterMemoryState, userText: string, now: number): CharacterMemoryState {
  const text = detectPerspectiveCorrection(userText);
  if (!text) return state;
  const existing = state.items.find((item) => item.text.startsWith(PERSPECTIVE_MEMORY_PREFIX));
  if (existing?.text === text) return state;
  const items = existing
    ? state.items.map((item) => (item === existing ? { ...item, pinned: true, text, updatedAt: now } : item))
    : [...state.items, { createdAt: now, id: createCharacterMemoryItemId(), kind: 'preference' as const, pinned: true, source: 'auto' as const, text, updatedAt: now }];
  return { ...state, items };
}
