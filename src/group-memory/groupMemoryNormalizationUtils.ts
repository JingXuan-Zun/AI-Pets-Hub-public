import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  type StoredGroupMemoryKind,
  type StoredGroupMemoryRecord,
} from './groupMemoryTypes';

const VALID_KINDS = new Set<StoredGroupMemoryKind>([
  'discussion-summary', 'role-perspective', 'verified-fact',
]);

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeTimestamp(value: unknown, fallback: number) {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp >= 0 ? timestamp : fallback;
}

export function normalizeStoredGroupMemoryRecord(
  value: unknown,
  now: number,
): StoredGroupMemoryRecord | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const summary = typeof value.summary === 'string' ? value.summary.replace(/\s+/gu, ' ').trim() : '';
  const kind = VALID_KINDS.has(value.kind as StoredGroupMemoryKind)
    ? value.kind as StoredGroupMemoryKind : null;
  if (!id || !summary || !kind) return null;
  const createdAt = normalizeTimestamp(value.createdAt, now);
  return {
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
    createdAt,
    groupId: typeof value.groupId === 'string' && value.groupId.trim()
      ? value.groupId.trim() : CURRENT_GROUP_MEMORY_GROUP_ID,
    id,
    ...(value.invalidatedAt !== null && value.invalidatedAt !== undefined
      && Number.isFinite(Number(value.invalidatedAt))
      ? { invalidatedAt: Number(value.invalidatedAt) } : {}),
    kind,
    sourceRoleId: typeof value.sourceRoleId === 'string' && value.sourceRoleId.trim()
      ? value.sourceRoleId.trim() : 'unknown',
    summary,
    ...(typeof value.supersedesId === 'string' && value.supersedesId.trim()
      ? { supersedesId: value.supersedesId.trim() } : {}),
    topicId: typeof value.topicId === 'string' && value.topicId !== 'none' ? value.topicId : null,
    updatedAt: normalizeTimestamp(value.updatedAt, createdAt),
    visibility: 'group',
  };
}
