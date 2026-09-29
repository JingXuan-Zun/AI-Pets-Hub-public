import type { GroupTopicHistoryEntry } from '../components/chat/group/topic/topicLifecycle';
import type { GroupTopicSnapshot } from './groupTopicRepository';

export type GroupTopicTimelineRow = GroupTopicHistoryEntry & {
  depth: number;
  isCurrent: boolean;
  parentMissing: boolean;
  relationCycle: boolean;
  transitions: GroupTopicSnapshot['topicAuditTrail'];
};

function collectTimelineEntries(snapshot: GroupTopicSnapshot) {
  const entries = snapshot.topicHistory.map((entry) => ({ ...entry, isCurrent: false }));
  if (snapshot.currentTopicId && snapshot.topicStatus) {
    entries.push({
      id: snapshot.currentTopicId,
      isCurrent: true,
      parentTopicId: snapshot.currentTopicParentId,
      recordedAt: snapshot.topicUpdatedAt ?? 0,
      status: snapshot.topicStatus,
    });
  }
  return entries.reduce<typeof entries>((result, entry) => (
    [...result.filter((item) => item.id !== entry.id), entry]
  ), []);
}

function resolveTopicDepth(
  entry: ReturnType<typeof collectTimelineEntries>[number],
  entriesById: Map<string, ReturnType<typeof collectTimelineEntries>[number]>,
) {
  let depth = 0;
  let parentId = entry.parentTopicId;
  const visited = new Set([entry.id]);
  while (parentId && entriesById.has(parentId) && !visited.has(parentId) && depth < 12) {
    visited.add(parentId);
    depth += 1;
    parentId = entriesById.get(parentId)?.parentTopicId ?? null;
  }
  return { depth, relationCycle: Boolean(parentId && visited.has(parentId)) };
}

export function buildGroupTopicTimeline(snapshot: GroupTopicSnapshot): GroupTopicTimelineRow[] {
  const entries = collectTimelineEntries(snapshot);
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return entries
    .sort((left, right) => left.recordedAt - right.recordedAt)
    .map((entry) => {
      const relation = resolveTopicDepth(entry, entriesById);
      return {
        ...entry,
        ...relation,
        parentMissing: Boolean(entry.parentTopicId && !entriesById.has(entry.parentTopicId)),
        transitions: snapshot.topicAuditTrail.filter((audit) => audit.topicId === entry.id),
      };
    });
}

export function formatGroupTopicMembers(
  groupKey: string,
  roleNames: Record<string, string>,
) {
  return groupKey.split('|').filter(Boolean).map((id) => roleNames[id] || id).join('、');
}
