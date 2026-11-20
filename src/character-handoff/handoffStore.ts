import { desktopPetChatStore } from '../chatStore';
import { HANDOFF_MEMORY_MS, type HandoffReason, type HandoffRecord } from './handoffRules';

// Switch requests (from the three places a switch really happens: a character switching on the
// user's request, the chat window's character list, calling a character by her wake phrase) and
// what each character was told when she took over, kept for her next replies.

const STORAGE_KEY = 'desktop-pet.character-handoff.v1';

export interface HandoffRequest {
  fromPetId: string;
  reason: HandoffReason;
  requestedAt: number;
  toPetId: string;
}

type Listener = (request: HandoffRequest) => void;
const listeners = new Set<Listener>();

/** Called right before the switch, while the previous character is still the active one. */
export function requestCharacterHandoff(toPetId: string, reason: HandoffReason) {
  const { activePetId, chatMode } = desktopPetChatStore.getState();
  // Only a switch from one private chat to another hands over.
  if (chatMode !== 'single' || !activePetId || activePetId === toPetId) return;
  const request = { fromPetId: activePetId, reason, requestedAt: Date.now(), toPetId };
  listeners.forEach((listener) => listener(request));
}

export function onCharacterHandoffRequest(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function readAll(): Record<string, HandoffRecord> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readHandoffRecord(toPetId: string): HandoffRecord | null {
  const record = readAll()[toPetId];
  return record && typeof record.note === 'string' && typeof record.at === 'number' ? record : null;
}

export function saveHandoffRecord(record: HandoffRecord) {
  const now = Date.now();
  const kept = Object.fromEntries(Object.entries(readAll()).filter(([, item]) => item && now - item.at < HANDOFF_MEMORY_MS));
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...kept, [record.toPetId]: record }));
  } catch {
    // Without storage she still got her entrance; only the later replies miss the note.
  }
}
