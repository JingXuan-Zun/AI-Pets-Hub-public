export type CharacterMemoryKind = 'event' | 'other' | 'preference' | 'profile' | 'promise';

export const CHARACTER_MEMORY_KINDS: CharacterMemoryKind[] = ['profile', 'preference', 'promise', 'event', 'other'];

export const CHARACTER_MEMORY_KIND_LABELS: Record<CharacterMemoryKind, string> = {
  event: '经历',
  other: '其他',
  preference: '喜好',
  profile: '个人信息',
  promise: '约定',
};

export type CharacterMemoryItem = {
  createdAt: number;
  id: string;
  kind: CharacterMemoryKind;
  /** Pinned items are always kept when the memory outgrows its prompt budget. */
  pinned?: boolean;
  source: 'auto' | 'manual';
  text: string;
  updatedAt: number;
};

export type CharacterConversationSummary = {
  /** createdAt of the newest private-chat message folded into the summary. */
  coveredUntil: number;
  text: string;
  updatedAt: number;
};

export type CharacterManualMemoryField = 'chatHistoryMemory' | 'userMemory';

export type CharacterMemoryState = {
  items: CharacterMemoryItem[];
  /** Items as they were before the last automatic removal or tidy-up. */
  itemsBackup: { items: CharacterMemoryItem[]; savedAt: number } | null;
  /** A hand-written memory field as it was before the last tidy-up. */
  manualBackup: { field: CharacterManualMemoryField; savedAt: number; text: string } | null;
  summary: CharacterConversationSummary | null;
};

export const CHARACTER_MEMORY_ITEM_MAX_LENGTH = 200;
export const CHARACTER_MEMORY_MAX_ITEMS = 120;
export const CHARACTER_CONVERSATION_SUMMARY_MAX_LENGTH = 1200;

export const EMPTY_CHARACTER_MEMORY_STATE: CharacterMemoryState = {
  items: [],
  itemsBackup: null,
  manualBackup: null,
  summary: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function isCharacterMemoryKind(value: unknown): value is CharacterMemoryKind {
  return typeof value === 'string' && (CHARACTER_MEMORY_KINDS as string[]).includes(value);
}

export function compactMemoryText(value: string, maxLength = CHARACTER_MEMORY_ITEM_MAX_LENGTH) {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function memoryTextFingerprint(value: string) {
  return value.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function normalizeItems(value: unknown): CharacterMemoryItem[] {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set<string>();
  return value.flatMap((entry): CharacterMemoryItem[] => {
    if (!isRecord(entry) || typeof entry.text !== 'string' || typeof entry.id !== 'string') return [];
    const text = compactMemoryText(entry.text);
    if (!text || !entry.id || seenIds.has(entry.id)) return [];
    seenIds.add(entry.id);
    const createdAt = finiteNumber(entry.createdAt, 0);
    return [{
      createdAt,
      id: entry.id,
      kind: isCharacterMemoryKind(entry.kind) ? entry.kind : 'other',
      ...(entry.pinned === true ? { pinned: true } : {}),
      source: entry.source === 'manual' ? 'manual' : 'auto',
      text,
      updatedAt: finiteNumber(entry.updatedAt, createdAt),
    }];
  }).slice(-CHARACTER_MEMORY_MAX_ITEMS);
}

export function normalizeCharacterMemoryState(value: unknown): CharacterMemoryState {
  if (!isRecord(value)) return EMPTY_CHARACTER_MEMORY_STATE;
  const summary = isRecord(value.summary) && typeof value.summary.text === 'string' && value.summary.text.trim()
    ? {
      coveredUntil: finiteNumber(value.summary.coveredUntil, 0),
      text: value.summary.text.trim().slice(0, CHARACTER_CONVERSATION_SUMMARY_MAX_LENGTH),
      updatedAt: finiteNumber(value.summary.updatedAt, 0),
    }
    : null;
  const itemsBackup = isRecord(value.itemsBackup)
    ? { items: normalizeItems(value.itemsBackup.items), savedAt: finiteNumber(value.itemsBackup.savedAt, 0) }
    : null;
  const manualBackup = isRecord(value.manualBackup)
    && (value.manualBackup.field === 'userMemory' || value.manualBackup.field === 'chatHistoryMemory')
    && typeof value.manualBackup.text === 'string'
    ? {
      field: value.manualBackup.field as CharacterManualMemoryField,
      savedAt: finiteNumber(value.manualBackup.savedAt, 0),
      text: value.manualBackup.text,
    }
    : null;
  return { items: normalizeItems(value.items), itemsBackup, manualBackup, summary };
}

let memoryItemSequence = 0;
export function createCharacterMemoryItemId(now = Date.now()) {
  memoryItemSequence += 1;
  return `memory-${now.toString(36)}-${memoryItemSequence.toString(36)}`;
}

/**
 * Prompt text for the automatic memory list. Pinned items go last so the
 * newest-first budget fill always keeps them.
 */
export function formatCharacterMemoryItemsForPrompt(state: CharacterMemoryState | undefined) {
  const items = state?.items ?? [];
  const ordered = [
    ...items.filter((item) => !item.pinned).sort((left, right) => left.updatedAt - right.updatedAt),
    ...items.filter((item) => item.pinned),
  ];
  return ordered.map((item) => `- ${item.text}`).join('\n');
}
