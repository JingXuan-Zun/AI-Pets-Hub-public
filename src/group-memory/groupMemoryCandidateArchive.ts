import type {
  GroupMemoryCandidate,
  GroupMemoryCandidateArchive,
  GroupMemoryCandidateReviewReceipt,
  GroupMemoryRepositoryData,
} from './groupMemoryTypes';
import { isObject, normalizeTimestamp } from './groupMemoryNormalizationUtils';

export const MAX_ACTIVE_REVIEWED_CANDIDATES = 100;
const MAX_ARCHIVES = 20;
const MAX_CANDIDATES_PER_ARCHIVE = 50;

export function normalizeGroupMemoryCandidateArchives(value: unknown, now: number) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeArchive(item, now))
    .filter((item): item is GroupMemoryCandidateArchive => Boolean(item))
    .slice(-MAX_ARCHIVES);
}

function normalizeArchive(value: unknown, now: number): GroupMemoryCandidateArchive | null {
  if (!isObject(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const firstCandidateId = typeof value.firstCandidateId === 'string'
    ? value.firstCandidateId.trim() : '';
  const lastCandidateId = typeof value.lastCandidateId === 'string'
    ? value.lastCandidateId.trim() : '';
  const candidateCount = count(value.candidateCount);
  if (!id || !firstCandidateId || !lastCandidateId || !candidateCount) return null;
  return {
    approvedCount: count(value.approvedCount), archivedAt: normalizeTimestamp(value.archivedAt, now),
    candidateCount, firstCandidateId, firstCreatedAt: normalizeTimestamp(value.firstCreatedAt, now),
    id, lastCandidateId, lastReviewedAt: normalizeTimestamp(value.lastReviewedAt, now),
    rejectedCount: count(value.rejectedCount), reviewReceiptCount: count(value.reviewReceiptCount),
  };
}

function count(value: unknown) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function createArchive(
  candidates: GroupMemoryCandidate[],
  receipts: GroupMemoryCandidateReviewReceipt[],
  archivedAt: number,
): GroupMemoryCandidateArchive {
  const first = candidates[0]!;
  const last = candidates.at(-1)!;
  return {
    approvedCount: candidates.filter((item) => item.status === 'approved').length,
    archivedAt, candidateCount: candidates.length, firstCandidateId: first.id,
    firstCreatedAt: first.createdAt, id: `group-memory-candidate-archive-${first.id}`,
    lastCandidateId: last.id, lastReviewedAt: last.reviewedAt ?? last.createdAt,
    rejectedCount: candidates.filter((item) => item.status === 'rejected').length,
    reviewReceiptCount: receipts.length,
  };
}

export function archiveReviewedGroupMemoryCandidates(
  repository: GroupMemoryRepositoryData,
  archivedAt = Date.now(),
): GroupMemoryRepositoryData {
  const pending = repository.candidates.filter((item) => item.status === 'pending');
  const reviewed = repository.candidates.filter((item) => item.status !== 'pending')
    .sort((left, right) => (left.reviewedAt ?? left.createdAt) - (right.reviewedAt ?? right.createdAt));
  const overflow = reviewed.slice(0, -MAX_ACTIVE_REVIEWED_CANDIDATES);
  if (!overflow.length) return repository;
  const overflowIds = new Set(overflow.map((item) => item.id));
  const overflowReceipts = repository.candidateReviewReceipts
    .filter((receipt) => overflowIds.has(receipt.candidateId));
  const archives = [...repository.candidateArchives];
  for (let offset = 0; offset < overflow.length; offset += MAX_CANDIDATES_PER_ARCHIVE) {
    const batch = overflow.slice(offset, offset + MAX_CANDIDATES_PER_ARCHIVE);
    const batchIds = new Set(batch.map((item) => item.id));
    archives.push(createArchive(
      batch, overflowReceipts.filter((receipt) => batchIds.has(receipt.candidateId)), archivedAt,
    ));
  }
  return {
    ...repository,
    candidateArchives: archives.slice(-MAX_ARCHIVES),
    candidateReviewReceipts: repository.candidateReviewReceipts
      .filter((receipt) => !overflowIds.has(receipt.candidateId)),
    candidates: [...pending, ...reviewed.slice(-MAX_ACTIVE_REVIEWED_CANDIDATES)],
  };
}
