import type {
  DirectedRelationshipRecord,
  DirectedRelationshipRepositoryData,
} from '../character-relationship';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  type GroupMemoryRepositoryData,
} from '../group-memory';
import type { SmallGroupCandidate } from './smallGroupCandidateTypes';

export const SMALL_GROUP_MIN_BIDIRECTIONAL_TRUST = 60;
export const SMALL_GROUP_MIN_BIDIRECTIONAL_INTIMACY = 60;
export const SMALL_GROUP_MAX_BIDIRECTIONAL_VIGILANCE = 40;

function strong(record: DirectedRelationshipRecord) {
  return record.invalidatedAt === undefined
    && record.dimensions.trust >= SMALL_GROUP_MIN_BIDIRECTIONAL_TRUST
    && record.dimensions.intimacy >= SMALL_GROUP_MIN_BIDIRECTIONAL_INTIMACY
    && record.dimensions.vigilance <= SMALL_GROUP_MAX_BIDIRECTIONAL_VIGILANCE;
}

function pairKey(left: string, right: string) {
  return [left, right].sort().join('|');
}

function publicTopics(repository: GroupMemoryRepositoryData) {
  const topics = new Map<string, Set<string>>();
  repository.records.filter((record) => record.invalidatedAt === undefined
    && record.visibility === 'group' && record.groupId === CURRENT_GROUP_MEMORY_GROUP_ID
    && Boolean(record.topicId)).forEach((record) => {
      topics.set(record.sourceRoleId, new Set([
        ...(topics.get(record.sourceRoleId) ?? []), record.topicId!,
      ]));
    });
  return topics;
}

function sharedTopics(topics: Map<string, Set<string>>, left: string, right: string) {
  const rightTopics = topics.get(right) ?? new Set<string>();
  return [...(topics.get(left) ?? [])].filter((topicId) => rightTopics.has(topicId));
}

function alreadyGrouped(repository: GroupMemoryRepositoryData, left: string, right: string) {
  return repository.subgroups.some((group) => group.invalidatedAt === undefined
    && group.memberRoleIds.includes(left) && group.memberRoleIds.includes(right));
}

function memoryCount(repository: GroupMemoryRepositoryData, roleIds: string[], topicIds: string[]) {
  const roles = new Set(roleIds); const topics = new Set(topicIds);
  return repository.records.filter((record) => record.invalidatedAt === undefined
    && record.groupId === CURRENT_GROUP_MEMORY_GROUP_ID && roles.has(record.sourceRoleId)
    && record.topicId !== null && topics.has(record.topicId)).length;
}

export function buildSmallGroupCandidates(options: {
  activeRoleIds?: string[];
  groupMemoryRepository: GroupMemoryRepositoryData;
  relationshipRepository: DirectedRelationshipRepositoryData;
  roleNames?: Record<string, string>;
}): SmallGroupCandidate[] {
  const active = options.activeRoleIds ? new Set(options.activeRoleIds) : null;
  const records = options.relationshipRepository.records.filter((record) => strong(record)
    && (!active || (active.has(record.sourceRoleId) && active.has(record.targetRoleId))));
  const byId = new Map(records.map((record) => [record.id, record]));
  const topics = publicTopics(options.groupMemoryRepository);
  const seen = new Set<string>(); const candidates: SmallGroupCandidate[] = [];
  records.forEach((forward) => {
    const key = pairKey(forward.sourceRoleId, forward.targetRoleId);
    const reverse = byId.get(`${forward.targetRoleId}->${forward.sourceRoleId}`);
    if (seen.has(key) || !reverse) return;
    seen.add(key);
    const members = [...key.split('|')] as [string, string];
    const shared = sharedTopics(topics, members[0], members[1]);
    if (!shared.length || alreadyGrouped(options.groupMemoryRepository, members[0], members[1])) return;
    const relationships = [forward, reverse].sort((left, right) => (
      left.sourceRoleId.localeCompare(right.sourceRoleId)
    ));
    const memberRoleNames: [string, string] = [
      options.roleNames?.[members[0]] ?? members[0],
      options.roleNames?.[members[1]] ?? members[1],
    ];
    const relationshipSnapshots = relationships.map((record) => ({
      dimensions: { ...record.dimensions }, relationshipId: record.id,
      updatedAt: record.updatedAt,
    })) as SmallGroupCandidate['relationships'];
    candidates.push({ claimLevel: 'read-only-candidate', id: `small-group:${key}`,
      memberRoleIds: members, memberRoleNames, publicMemoryRecordCount: memoryCount(
        options.groupMemoryRepository, members, shared,
      ), relationships: relationshipSnapshots,
      sharedTopicCount: shared.length });
  });
  return candidates.sort((left, right) => right.sharedTopicCount - left.sharedTopicCount
    || left.id.localeCompare(right.id));
}
