import type { GroupMemoryRepositoryData, StoredGroupMemoryRecord } from './groupMemoryTypes';

const MAX_REVIEW_RECORDS = 200;

export type GroupMemoryConflictReason = 'duplicate-summary' | 'same-topic-kind';

export interface GroupMemoryConflictCandidate {
  firstRecordId: string;
  id: string;
  reasons: GroupMemoryConflictReason[];
  score: number;
  secondRecordId: string;
}

function normalizedSummary(record: StoredGroupMemoryRecord) {
  return record.summary.normalize('NFKC').replace(/\s+/gu, '').toLocaleLowerCase();
}

function candidateReasons(
  first: StoredGroupMemoryRecord,
  second: StoredGroupMemoryRecord,
) {
  const reasons: GroupMemoryConflictReason[] = [];
  if (normalizedSummary(first) === normalizedSummary(second)) reasons.push('duplicate-summary');
  if (first.topicId && first.topicId === second.topicId && first.kind === second.kind) {
    reasons.push('same-topic-kind');
  }
  return reasons;
}

function createCandidate(
  first: StoredGroupMemoryRecord,
  second: StoredGroupMemoryRecord,
): GroupMemoryConflictCandidate | null {
  if (first.groupId !== second.groupId || first.invalidatedAt !== undefined
    || second.invalidatedAt !== undefined || first.supersedesId === second.id
    || second.supersedesId === first.id) return null;
  const reasons = candidateReasons(first, second);
  if (!reasons.length) return null;
  const ids = [first.id, second.id].sort();
  const score = reasons.includes('duplicate-summary') ? 100 : 60;
  return {
    firstRecordId: ids[0]!, id: `group-memory-conflict-${ids.join('-')}`,
    reasons, score, secondRecordId: ids[1]!,
  };
}

export function detectGroupMemoryConflictCandidates(
  repository: GroupMemoryRepositoryData,
  limit = 8,
) {
  const candidates: GroupMemoryConflictCandidate[] = [];
  const reviewRecords = repository.records
    .filter((record) => record.invalidatedAt === undefined)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, MAX_REVIEW_RECORDS);
  reviewRecords.forEach((first, firstIndex) => {
    reviewRecords.slice(firstIndex + 1).forEach((second) => {
      const candidate = createCandidate(first, second);
      if (candidate) candidates.push(candidate);
    });
  });
  return candidates.sort((left, right) => right.score - left.score).slice(0, limit);
}
