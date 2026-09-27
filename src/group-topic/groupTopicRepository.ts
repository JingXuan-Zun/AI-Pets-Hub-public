import type { GroupSessionRecord } from '../components/chat/group/state/groupSessionRecord';
import type {
  GroupTopicHistoryEntry,
  GroupTopicStatus,
  GroupTopicTransitionAuditEntry,
  GroupTopicTransitionSource,
} from '../components/chat/group/topic/topicLifecycle';
import { normalizeGroupUserTopicState, type GroupUserTopicState } from '../components/chat/group/topic/groupUserTopicState';

export const GROUP_TOPIC_REPOSITORY_SCHEMA_VERSION = 3 as const;
export const EMPTY_GROUP_TOPIC_REPOSITORY: GroupTopicRepositoryData = {
  schemaVersion: GROUP_TOPIC_REPOSITORY_SCHEMA_VERSION,
  snapshots: [],
};

const MAX_GROUP_SNAPSHOTS = 20;
const MAX_TOPIC_HISTORY = 100;
const MAX_TOPIC_AUDIT_ENTRIES = 200;
const TOPIC_STATUSES = new Set<GroupTopicStatus>([
  'starting', 'active', 'disputed', 'waiting-information', 'resolving',
  'concluded', 'decaying', 'closed', 'archived',
]);
const TRANSITION_SOURCES = new Set<GroupTopicTransitionSource>([
  'role-signal', 'task', 'inactivity', 'user-input', 'derivation',
]);

export type GroupTopicSnapshot = {
  currentTopicId: string | null;
  groupUserTopicState: GroupUserTopicState | null;
  currentTopicParentId: string | null;
  groupKey: string;
  groupSessionId: string;
  topicDerivationSequence: number;
  topicAuditTrail: GroupTopicTransitionAuditEntry[];
  topicHistory: GroupTopicHistoryEntry[];
  topicStatus: GroupTopicStatus | null;
  topicUpdatedAt: number | null;
};

export type GroupTopicRepositoryData = {
  schemaVersion: typeof GROUP_TOPIC_REPOSITORY_SCHEMA_VERSION;
  snapshots: GroupTopicSnapshot[];
};

function normalizeText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null;
}

function normalizeStatus(value: unknown): GroupTopicStatus | null {
  return typeof value === 'string' && TOPIC_STATUSES.has(value as GroupTopicStatus)
    ? value as GroupTopicStatus
    : null;
}

function keepLatestByKey<T>(items: T[], resolveKey: (item: T) => string) {
  return items.reduce<T[]>((result, item) => (
    [...result.filter((entry) => resolveKey(entry) !== resolveKey(item)), item]
  ), []);
}

function normalizeHistory(value: unknown): GroupTopicHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const entries = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const id = normalizeText(record.id);
    const status = normalizeStatus(record.status);
    if (!id || !status || !Number.isFinite(record.recordedAt)) return [];
    return [{
      id,
      parentTopicId: normalizeText(record.parentTopicId),
      recordedAt: Number(record.recordedAt),
      status,
    }];
  });
  return keepLatestByKey(entries, (entry) => entry.id).slice(-MAX_TOPIC_HISTORY);
}

function normalizeAuditTrail(value: unknown): GroupTopicTransitionAuditEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const topicId = normalizeText(record.topicId);
    const toStatus = normalizeStatus(record.toStatus);
    const source = normalizeText(record.source) as GroupTopicTransitionSource | null;
    const reason = normalizeText(record.reason);
    if (!topicId || !toStatus || !source || !reason || !TRANSITION_SOURCES.has(source)) return [];
    if (!Number.isFinite(record.recordedAt)) return [];
    const fromStatus = record.fromStatus === null ? null : normalizeStatus(record.fromStatus);
    if (record.fromStatus !== null && !fromStatus) return [];
    return [{
      fromStatus,
      reason, recordedAt: Number(record.recordedAt), source, toStatus, topicId,
    }];
  }).slice(-MAX_TOPIC_AUDIT_ENTRIES);
}

function normalizeSnapshot(value: unknown): GroupTopicSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const groupKey = normalizeText(record.groupKey);
  const groupSessionId = normalizeText(record.groupSessionId);
  if (!groupKey || !groupSessionId) return null;
  return {
    currentTopicId: normalizeText(record.currentTopicId),
    groupUserTopicState: normalizeGroupUserTopicState(record.groupUserTopicState),
    currentTopicParentId: normalizeText(record.currentTopicParentId),
    groupKey,
    groupSessionId,
    topicDerivationSequence: Number.isInteger(record.topicDerivationSequence)
      ? Math.max(0, Number(record.topicDerivationSequence)) : 0,
    topicAuditTrail: normalizeAuditTrail(record.topicAuditTrail),
    topicHistory: normalizeHistory(record.topicHistory),
    topicStatus: normalizeStatus(record.topicStatus),
    topicUpdatedAt: Number.isFinite(record.topicUpdatedAt) ? Number(record.topicUpdatedAt) : null,
  };
}

export function normalizeGroupTopicRepository(value: unknown): GroupTopicRepositoryData {
  if (!value || typeof value !== 'object') return EMPTY_GROUP_TOPIC_REPOSITORY;
  const snapshots = (value as { snapshots?: unknown }).snapshots;
  if (!Array.isArray(snapshots)) return EMPTY_GROUP_TOPIC_REPOSITORY;
  const normalized = snapshots.map(normalizeSnapshot).filter((item): item is GroupTopicSnapshot => Boolean(item));
  return {
    schemaVersion: GROUP_TOPIC_REPOSITORY_SCHEMA_VERSION,
    snapshots: keepLatestByKey(normalized, (snapshot) => snapshot.groupKey).slice(-MAX_GROUP_SNAPSHOTS),
  };
}

export function buildGroupTopicKey(roleIds: string[]) {
  return [...new Set(roleIds.map((id) => id.trim()).filter(Boolean))].sort().join('|');
}

export function createGroupTopicSnapshot(groupKey: string, record: GroupSessionRecord): GroupTopicSnapshot {
  return {
    currentTopicId: record.currentTopicId,
    groupUserTopicState: record.groupUserTopicState ? { ...record.groupUserTopicState } : null,
    currentTopicParentId: record.currentTopicParentId,
    groupKey,
    groupSessionId: record.groupSessionId,
    topicDerivationSequence: record.topicDerivationSequence,
    topicAuditTrail: record.topicAuditTrail.slice(-MAX_TOPIC_AUDIT_ENTRIES).map((entry) => ({ ...entry })),
    topicHistory: record.topicHistory.slice(-MAX_TOPIC_HISTORY).map((entry) => ({ ...entry })),
    topicStatus: record.topicStatus,
    topicUpdatedAt: record.topicUpdatedAt,
  };
}

export function findGroupTopicSnapshot(repository: GroupTopicRepositoryData, groupKey: string) {
  return repository.snapshots.find((snapshot) => snapshot.groupKey === groupKey) ?? null;
}

export function buildRestoredTopicHistory(snapshot: GroupTopicSnapshot) {
  if (!snapshot.currentTopicId || !snapshot.topicStatus) {
    return snapshot.topicHistory.map((entry) => ({ ...entry }));
  }
  return [
    ...snapshot.topicHistory.filter((entry) => entry.id !== snapshot.currentTopicId),
    {
      id: snapshot.currentTopicId,
      parentTopicId: snapshot.currentTopicParentId,
      recordedAt: snapshot.topicUpdatedAt ?? 0,
      status: snapshot.topicStatus,
    },
  ].slice(-MAX_TOPIC_HISTORY);
}

export function upsertGroupTopicSnapshot(
  repository: GroupTopicRepositoryData,
  snapshot: GroupTopicSnapshot,
) {
  const previous = findGroupTopicSnapshot(repository, snapshot.groupKey);
  if (previous && JSON.stringify(previous) === JSON.stringify(snapshot)) return repository;
  return {
    schemaVersion: GROUP_TOPIC_REPOSITORY_SCHEMA_VERSION,
    snapshots: [
      ...repository.snapshots.filter((item) => item.groupKey !== snapshot.groupKey),
      snapshot,
    ].slice(-MAX_GROUP_SNAPSHOTS),
  };
}
