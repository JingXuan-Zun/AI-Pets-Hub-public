import type { GroupSessionRecord } from '../state/groupSessionRecord';
import type { GroupTopicHistoryEntry } from './topicLifecycle';

function appendTopicHistory(
  history: GroupTopicHistoryEntry[],
  entry: GroupTopicHistoryEntry,
) {
  return [...history.filter((item) => item.id !== entry.id), entry];
}

export function createArchiveTopicPatch(record: GroupSessionRecord, now = Date.now()) {
  if (!record.currentTopicId) return null;
  return {
    topicHistory: appendTopicHistory(record.topicHistory, {
      id: record.currentTopicId,
      parentTopicId: record.currentTopicParentId,
      recordedAt: now,
      status: 'archived',
    }),
    topicStatus: 'archived' as const,
    topicUpdatedAt: now,
  };
}

export function createDerivedTopicPatch(
  record: GroupSessionRecord,
  derivedTopicId: string,
  now = Date.now(),
) {
  const topicId = derivedTopicId.trim();
  if (!topicId || topicId === record.currentTopicId) return null;
  const parentTopicId = record.currentTopicId;
  const topicHistory = parentTopicId
    ? appendTopicHistory(record.topicHistory, {
        id: parentTopicId,
        parentTopicId: record.currentTopicParentId,
        recordedAt: now,
        status: record.topicStatus ?? 'closed',
      })
    : record.topicHistory;
  return {
    currentTopicId: topicId,
    currentTopicParentId: parentTopicId,
    topicHistory,
    topicStatus: 'starting' as const,
    topicUpdatedAt: now,
  };
}

export function createDecayTopicPatch(
  record: GroupSessionRecord,
  inactivityMs: number,
  now = Date.now(),
) {
  if (!record.currentTopicId || record.topicUpdatedAt === null || inactivityMs <= 0) return null;
  if (now - record.topicUpdatedAt < inactivityMs) return null;
  if (record.topicStatus === 'archived' || record.topicStatus === 'closed') return null;
  return { topicStatus: 'decaying' as const, topicUpdatedAt: now };
}
