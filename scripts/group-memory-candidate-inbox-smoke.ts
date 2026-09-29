import assert from 'node:assert/strict';
import {
  approveGroupMemoryCandidate,
  enqueueGroupMemoryCandidate,
  normalizeGroupMemoryRepository,
  rejectGroupMemoryCandidate,
  rollbackGroupMemoryCandidateReview,
  type GroupMemoryCandidate,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryRecord,
} from '../src/group-memory';

function record(updatedAt = 100): StoredGroupMemoryRecord {
  return {
    confidence: 1, createdAt: 100, groupId: 'current-group', id: 'proposed-record',
    kind: 'verified-fact', sourceRoleId: 'primary', summary: '任务已经完成。',
    topicId: 'topic-1', updatedAt, visibility: 'group',
  };
}

function candidate(): GroupMemoryCandidate {
  return {
    createdAt: 100,
    evidence: {
      capturedAt: 100, excerpt: '实际工具结果：任务已经完成。', kind: 'task-result',
      sourceMessageId: 'message-1', sourceRoleId: 'primary', topicId: 'topic-1',
    },
    id: 'candidate-1', proposedRecord: record(), status: 'pending',
  };
}

function repository(records: StoredGroupMemoryRecord[] = []): GroupMemoryRepositoryData {
  return {
    candidateArchives: [], candidateReviewReceipts: [], candidates: [],
    evidenceScopeCorrections: [], evidenceScopeSnapshots: [], receiptArchives: [], receipts: [],
    records, schemaVersion: 8, subgroupAuditTrail: [], subgroups: [],
  };
}

const queued = enqueueGroupMemoryCandidate(repository(), candidate());
assert.equal(queued.candidates.length, 1);
assert.equal(queued.records.length, 0);
assert.equal(enqueueGroupMemoryCandidate(queued, candidate()).candidates.length, 1);

const approved = approveGroupMemoryCandidate(queued, candidate().id, 200);
assert.equal(approved.repository.candidates[0]?.status, 'approved');
assert.equal(approved.repository.records[0]?.id, 'proposed-record');
assert.equal(approved.receipt?.decision, 'approve');
assert.equal(approved.repository.evidenceScopeSnapshots[0]?.sourceMessageId, 'message-1');
assert.equal(approved.repository.evidenceScopeSnapshots[0]?.source, 'candidate-approval');
assert.equal(approved.reason, 'applied');
assert.equal(approveGroupMemoryCandidate(repository(), 'missing').reason, 'candidate-not-found');
assert.equal(approveGroupMemoryCandidate(approved.repository, candidate().id).reason, 'candidate-not-pending');

const subgroup = {
  createdAt: 180, id: 'subgroup-1', memberRoleIds: ['primary', 'secondary'],
  name: '测试小组', updatedAt: 180,
};
const subgroupQueued = { ...queued, subgroups: [subgroup] };
const subgroupApproved = approveGroupMemoryCandidate(
  subgroupQueued, candidate().id, 220, subgroup.id,
);
assert.equal(subgroupApproved.repository.records[0]?.groupId, subgroup.id);
assert.equal(subgroupApproved.receipt?.recordAfter?.groupId, subgroup.id);
const existingPublicQueued = {
  ...enqueueGroupMemoryCandidate(repository([record()]), candidate()),
  subgroups: [subgroup],
};
assert.equal(
  approveGroupMemoryCandidate(existingPublicQueued, candidate().id, 225, subgroup.id).reason,
  'record-conflict',
);
const subgroupRollback = rollbackGroupMemoryCandidateReview(
  subgroupApproved.repository, candidate().id, 230,
);
assert.equal(subgroupRollback.repository.records.length, 0);
assert.equal(
  approveGroupMemoryCandidate(subgroupQueued, candidate().id, 240, 'missing').reason,
  'group-not-writable',
);
const disabledSubgroupQueued = {
  ...subgroupQueued,
  subgroups: [{ ...subgroup, invalidatedAt: 235 }],
};
assert.equal(
  approveGroupMemoryCandidate(disabledSubgroupQueued, candidate().id, 245, subgroup.id).reason,
  'group-not-writable',
);

const reopened = normalizeGroupMemoryRepository(
  JSON.parse(JSON.stringify(approved.repository)) as unknown, [], 250,
);
assert.equal(reopened.schemaVersion, 8);
assert.equal(reopened.candidateReviewReceipts.length, 1);
const rolledBack = rollbackGroupMemoryCandidateReview(reopened, candidate().id, 300);
assert.equal(rolledBack.repository.candidates[0]?.status, 'pending');
assert.equal(rolledBack.repository.records.length, 0);
assert.equal(rolledBack.receipt?.revertsReceiptId, approved.receipt?.id);
assert.equal(
  rollbackGroupMemoryCandidateReview(rolledBack.repository, candidate().id).reason,
  'already-reverted',
);

const existing = record(150);
const rejected = rejectGroupMemoryCandidate(
  enqueueGroupMemoryCandidate(repository([existing]), candidate()), candidate().id, 400,
);
assert.equal(rejected.repository.candidates[0]?.status, 'rejected');
assert.equal(rejected.repository.records[0], existing);
const rejectionRollback = rollbackGroupMemoryCandidateReview(
  rejected.repository, candidate().id, 500,
);
assert.equal(rejectionRollback.repository.candidates[0]?.status, 'pending');
assert.equal(rejectionRollback.repository.records[0], existing);

const previousVersion = { ...record(50), summary: '更早的人工确认版本。' };
const mistakenApproval = approveGroupMemoryCandidate(
  enqueueGroupMemoryCandidate(repository([previousVersion]), candidate()), candidate().id, 550,
);
assert.equal(mistakenApproval.repository.records[0]?.summary, candidate().proposedRecord.summary);
const correctedMistake = rollbackGroupMemoryCandidateReview(
  mistakenApproval.repository, candidate().id, 575,
);
assert.deepEqual(correctedMistake.repository.records[0], previousVersion);
assert.equal(correctedMistake.repository.candidates[0]?.status, 'pending');

const newerRecordRepository = enqueueGroupMemoryCandidate(repository([record(999)]), candidate());
assert.equal(approveGroupMemoryCandidate(newerRecordRepository, candidate().id, 600).reason, 'record-conflict');
const sameTimestampConflict = { ...record(), summary: '同一时间戳的另一版本。' };
const conflictingRepository = enqueueGroupMemoryCandidate(repository([sameTimestampConflict]), candidate());
assert.equal(approveGroupMemoryCandidate(conflictingRepository, candidate().id, 650).reason, 'record-conflict');
const mismatchedCandidate = {
  ...candidate(),
  evidence: { ...candidate().evidence, sourceRoleId: 'different-role' },
  id: 'candidate-mismatch',
};
const mismatchedRepository = enqueueGroupMemoryCandidate(repository(), mismatchedCandidate);
assert.equal(
  approveGroupMemoryCandidate(mismatchedRepository, mismatchedCandidate.id, 675).reason,
  'evidence-mismatch',
);
assert.equal(
  rollbackGroupMemoryCandidateReview(queued, candidate().id, 680).reason,
  'review-not-found',
);

const approvedThenChanged = approveGroupMemoryCandidate(queued, candidate().id, 700);
const changedRepository = {
  ...approvedThenChanged.repository,
  records: [{ ...approvedThenChanged.repository.records[0]!, summary: '后来经过人工修改。' }],
};
assert.equal(
  rollbackGroupMemoryCandidateReview(changedRepository, candidate().id, 800).reason,
  'record-changed-after-approval',
);
const statusChangedRepository = {
  ...approvedThenChanged.repository,
  candidates: [{ ...approvedThenChanged.repository.candidates[0]!, status: 'rejected' as const }],
};
assert.equal(
  rollbackGroupMemoryCandidateReview(statusChangedRepository, candidate().id, 810).reason,
  'candidate-status-changed',
);

function numberedCandidate(index: number, status: GroupMemoryCandidate['status'] = 'pending') {
  const next = candidate();
  return {
    ...next, id: `candidate-${index}`, status,
    proposedRecord: { ...next.proposedRecord, id: `record-${index}` },
  };
}

const normalizedOverflow = normalizeGroupMemoryRepository({
  candidateReviewReceipts: [],
  candidates: Array.from({ length: 101 }, (_, index) => numberedCandidate(index, 'approved')),
  records: [],
  schemaVersion: 4,
}, [], 900);
assert.equal(normalizedOverflow.candidates.length, 100);
assert.equal(normalizedOverflow.candidateArchives[0]?.candidateCount, 1);

let archiveRepository = repository();
for (let index = 0; index < 3; index += 1) {
  archiveRepository = enqueueGroupMemoryCandidate(
    archiveRepository, numberedCandidate(1_000 + index),
  );
}
for (let index = 0; index < 101; index += 1) {
  const nextCandidate = numberedCandidate(index);
  archiveRepository = enqueueGroupMemoryCandidate(archiveRepository, nextCandidate);
  archiveRepository = approveGroupMemoryCandidate(
    archiveRepository, nextCandidate.id, 1_000 + index,
  ).repository;
}
assert.equal(archiveRepository.candidates.filter((item) => item.status === 'pending').length, 3);
assert.equal(archiveRepository.candidates.filter((item) => item.status === 'approved').length, 100);
assert.equal(archiveRepository.candidateArchives.length, 1);
assert.equal(archiveRepository.candidateArchives[0]?.candidateCount, 1);
assert.equal(archiveRepository.candidateReviewReceipts.length, 100);
assert.equal(archiveRepository.evidenceScopeSnapshots.length, 101);
assert.equal(archiveRepository.evidenceScopeSnapshots.some((snapshot) => (
  snapshot.recordId === 'record-0'
)), true, 'scope snapshot must survive candidate and receipt archival');
assert.equal(archiveRepository.records.length, 101);

const v4Migrated = normalizeGroupMemoryRepository({
  ...archiveRepository, candidateArchives: undefined, schemaVersion: 4,
}, [], 2_000);
assert.equal(v4Migrated.schemaVersion, 8);
assert.equal(v4Migrated.candidateArchives.length, 0);
const archiveReopened = normalizeGroupMemoryRepository(
  JSON.parse(JSON.stringify(archiveRepository)) as unknown, [], 2_100,
);
assert.deepEqual(archiveReopened.candidateArchives, archiveRepository.candidateArchives);
assert.deepEqual(archiveReopened.evidenceScopeSnapshots, archiveRepository.evidenceScopeSnapshots);
assert.equal(archiveReopened.records.length, 101);

console.log('group memory candidate inbox smoke ok');
