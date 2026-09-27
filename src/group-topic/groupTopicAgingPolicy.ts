import type { GroupTopicStatus } from '../components/chat/group/topic/topicLifecycle';
import type { GroupTopicRepositoryData, GroupTopicSnapshot } from './groupTopicRepository';
import { appendGroupTopicTransitionAudit } from '../components/chat/group/topic/topicTransitionAudit';

export const GROUP_TOPIC_DECAY_AFTER_MS = 6 * 60 * 60 * 1000;
export const GROUP_TOPIC_WAITING_DECAY_AFTER_MS = 24 * 60 * 60 * 1000;
export const GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS = 24 * 60 * 60 * 1000;
export const GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

const DISCUSSION_STATUSES = new Set<GroupTopicStatus>([
  'starting', 'active', 'disputed', 'resolving',
]);

export function resolveGroupTopicAgingStatus(
  snapshot: GroupTopicSnapshot,
  now: number,
): GroupTopicStatus | null {
  if (!snapshot.currentTopicId || !snapshot.topicStatus || snapshot.topicUpdatedAt === null) return null;
  return resolveAgedStatus(snapshot.topicStatus, snapshot.topicUpdatedAt, now);
}

function resolveAgedStatus(
  status: GroupTopicStatus,
  updatedAt: number,
  now: number,
): GroupTopicStatus | null {
  const elapsedMs = now - updatedAt;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  if (DISCUSSION_STATUSES.has(status) && elapsedMs >= GROUP_TOPIC_DECAY_AFTER_MS) {
    return 'decaying';
  }
  if (status === 'waiting-information' && elapsedMs >= GROUP_TOPIC_WAITING_DECAY_AFTER_MS) {
    return 'decaying';
  }
  if (
    (status === 'concluded' || status === 'closed')
    && elapsedMs >= GROUP_TOPIC_CONCLUDED_ARCHIVE_AFTER_MS
  ) {
    return 'archived';
  }
  if (status === 'decaying' && elapsedMs >= GROUP_TOPIC_DECAYED_ARCHIVE_AFTER_MS) {
    return 'archived';
  }
  return null;
}

function advanceSnapshot(snapshot: GroupTopicSnapshot, now: number): GroupTopicSnapshot {
  const topicStatus = resolveGroupTopicAgingStatus(snapshot, now);
  let changed = Boolean(topicStatus && topicStatus !== snapshot.topicStatus);
  let topicAuditTrail = snapshot.topicAuditTrail;
  const topicHistory = snapshot.topicHistory.map((entry) => {
    if (entry.id === snapshot.currentTopicId) return entry;
    const status = resolveAgedStatus(entry.status, entry.recordedAt, now);
    if (!status || status === entry.status) return entry;
    changed = true;
    topicAuditTrail = appendGroupTopicTransitionAudit({
      auditTrail: topicAuditTrail,
      context: { reason: resolveAgingReason(entry.status), source: 'inactivity' },
      fromStatus: entry.status, now, toStatus: status, topicId: entry.id,
    });
    return { ...entry, recordedAt: now, status };
  });
  if (!changed) return snapshot;
  if (topicStatus && snapshot.topicStatus && snapshot.currentTopicId) {
    topicAuditTrail = appendGroupTopicTransitionAudit({
      auditTrail: topicAuditTrail,
      context: { reason: resolveAgingReason(snapshot.topicStatus), source: 'inactivity' },
      fromStatus: snapshot.topicStatus, now, toStatus: topicStatus,
      topicId: snapshot.currentTopicId,
    });
  }
  return {
    ...snapshot,
    topicAuditTrail,
    topicHistory,
    ...(topicStatus ? { topicStatus, topicUpdatedAt: now } : {}),
  };
}

function resolveAgingReason(status: GroupTopicStatus) {
  if (status === 'waiting-information') return 'waiting-information-timeout';
  if (status === 'concluded' || status === 'closed') return 'conclusion-retention-expired';
  if (status === 'decaying') return 'decay-retention-expired';
  return 'discussion-inactive';
}

export function advanceGroupTopicRepositoryTime(options: {
  excludedGroupSessionId?: string | null;
  now: number;
  repository: GroupTopicRepositoryData;
}): GroupTopicRepositoryData {
  let changed = false;
  const snapshots = options.repository.snapshots.map((snapshot) => {
    if (snapshot.groupSessionId === options.excludedGroupSessionId) return snapshot;
    const advanced = advanceSnapshot(snapshot, options.now);
    if (advanced !== snapshot) changed = true;
    return advanced;
  });
  return changed ? { ...options.repository, snapshots } : options.repository;
}
