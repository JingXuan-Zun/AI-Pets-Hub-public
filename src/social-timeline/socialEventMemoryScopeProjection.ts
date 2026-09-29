import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  latestEvidenceScopeCorrection,
  type GroupMemoryRepositoryData,
} from '../group-memory';
import type { SocialEventMemoryScope, SocialEventTimelineEntry } from './socialEventTimelineTypes';

function currentScopeStatus(
  repository: GroupMemoryRepositoryData,
  currentGroupId: string | null,
  invalidated: boolean,
): SocialEventMemoryScope['currentScopeStatus'] {
  if (!currentGroupId) return 'record-unavailable';
  if (invalidated) return 'record-invalidated';
  if (currentGroupId === CURRENT_GROUP_MEMORY_GROUP_ID) return 'active';
  const group = repository.subgroups.find((item) => item.id === currentGroupId);
  return group && group.invalidatedAt === undefined ? 'active' : 'group-disabled';
}

export function projectMemoryEvidenceScopeEvents(
  repository: GroupMemoryRepositoryData,
): SocialEventTimelineEntry[] {
  return repository.evidenceScopeSnapshots.map((snapshot) => {
    const correction = latestEvidenceScopeCorrection(repository, snapshot.id);
    const effectiveRecordId = correction?.correctedRecordId ?? snapshot.recordId;
    const effectiveGroupId = correction?.correctedGroupId ?? snapshot.groupId;
    const record = repository.records.find((item) => item.id === effectiveRecordId);
    const currentGroupId = record?.groupId ?? null;
    const status = currentScopeStatus(
      repository, currentGroupId, record?.invalidatedAt !== undefined,
    );
    return {
      claimLevel: 'audited-operation',
      evidence: [{
        excerpt: `captured=${snapshot.groupId}; current=${currentGroupId ?? 'unavailable'}; status=${status}`,
        kind: 'evidence-scope-snapshot', referenceId: snapshot.id,
      }, {
        excerpt: '', kind: 'chat-message', referenceId: snapshot.sourceMessageId,
      }],
      groupSessionId: null,
      id: `group-memory-evidence-scope:${snapshot.id}`,
      kind: 'group-memory-evidence-scope',
      links: [],
      memoryGroupIds: [...new Set([snapshot.groupId, currentGroupId].filter(Boolean) as string[])],
      memoryScope: {
        capturedGroupId: snapshot.groupId, currentGroupId,
        currentScopeStatus: status, effectiveGroupId, effectiveRecordId,
        latestCorrectionId: correction?.id ?? null, recordId: snapshot.recordId,
        snapshotSource: snapshot.source,
      },
      occurredAt: snapshot.capturedAt,
      roleIds: [snapshot.sourceRoleId],
      source: 'group-memory',
      summary: snapshot.recordId,
      title: snapshot.source,
      topicId: snapshot.topicId,
    };
  });
}

export function projectMemoryEvidenceScopeCorrectionEvents(
  repository: GroupMemoryRepositoryData,
): SocialEventTimelineEntry[] {
  return repository.evidenceScopeCorrections.map((correction) => {
    const snapshot = repository.evidenceScopeSnapshots.find((item) => (
      item.id === correction.snapshotId
    ));
    const record = repository.records.find((item) => item.id === correction.correctedRecordId);
    return {
      claimLevel: 'audited-operation',
      evidence: [{
        excerpt: correction.reason, kind: 'evidence-scope-snapshot',
        referenceId: correction.id,
      }],
      groupSessionId: null,
      id: `group-memory-evidence-scope-correction:${correction.id}`,
      kind: 'group-memory-evidence-scope-correction',
      links: [{
        relation: 'corrects', targetEventId: `group-memory-evidence-scope:${correction.snapshotId}`,
        targetReferenceId: correction.snapshotId,
      }, ...(correction.supersedesCorrectionId ? [{
        relation: 'supersedes' as const,
        targetEventId: `group-memory-evidence-scope-correction:${correction.supersedesCorrectionId}`,
        targetReferenceId: correction.supersedesCorrectionId,
      }] : [])],
      memoryGroupIds: [...new Set([
        snapshot?.groupId, correction.correctedGroupId, record?.groupId,
      ].filter(Boolean) as string[])],
      occurredAt: correction.occurredAt,
      roleIds: snapshot ? [snapshot.sourceRoleId] : [],
      source: 'group-memory',
      summary: correction.reason,
      title: `${correction.correctedRecordId} · ${correction.correctedGroupId}`,
      topicId: snapshot?.topicId ?? record?.topicId ?? null,
    };
  });
}
