import assert from 'node:assert/strict';
import {
  appendGroupMemoryEvidenceScopeCorrection,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  latestEvidenceScopeCorrection,
  normalizeGroupMemoryRepository,
  type StoredGroupMemoryRecord,
} from '../src/group-memory';

function record(id: string, groupId: string): StoredGroupMemoryRecord {
  return {
    confidence: 0.8, createdAt: 1, groupId, id, kind: 'discussion-summary',
    sourceRoleId: 'alice', summary: id, topicId: 'topic-1', updatedAt: 1,
    visibility: 'group',
  };
}

const original = record('memory-1', 'current-group');
const corrected = record('memory-2', 'subgroup-1');
const repository = {
  ...EMPTY_GROUP_MEMORY_REPOSITORY,
  evidenceScopeSnapshots: [{
    capturedAt: 2, groupId: 'current-group', id: 'scope-1', recordId: original.id,
    source: 'manual-save' as const, sourceMessageId: 'message-1',
    sourceRoleId: 'alice', topicId: 'topic-1',
  }],
  records: [original, corrected],
  subgroups: [{
    createdAt: 1, id: 'subgroup-1', invalidatedAt: 3,
    memberRoleIds: ['alice', 'berry'], name: '历史小组', updatedAt: 3,
  }],
};
const beforeSnapshot = JSON.stringify(repository.evidenceScopeSnapshots[0]);
const first = appendGroupMemoryEvidenceScopeCorrection(repository, {
  correctedGroupId: 'subgroup-1', correctedRecordId: corrected.id,
  reason: '原范围关联错误', snapshotId: 'scope-1',
}, 10);
assert.equal(JSON.stringify(first.evidenceScopeSnapshots[0]), beforeSnapshot);
assert.equal(first.records, repository.records);
assert.equal(first.evidenceScopeCorrections.length, 1);
assert.equal(first.evidenceScopeCorrections[0]?.correctedGroupId, 'subgroup-1');
assert.equal(first.evidenceScopeCorrections[0]?.supersedesCorrectionId, undefined);

const duplicate = appendGroupMemoryEvidenceScopeCorrection(first, {
  correctedGroupId: 'subgroup-1', correctedRecordId: corrected.id,
  reason: '重复提交', snapshotId: 'scope-1',
}, 11);
assert.equal(duplicate, first);
const second = appendGroupMemoryEvidenceScopeCorrection(first, {
  correctedGroupId: 'current-group', correctedRecordId: original.id,
  reason: '再次核对后纠正', snapshotId: 'scope-1',
}, 12);
assert.equal(second.evidenceScopeCorrections.length, 2);
assert.equal(second.evidenceScopeCorrections[1]?.supersedesCorrectionId,
  first.evidenceScopeCorrections[0]?.id);
assert.equal(latestEvidenceScopeCorrection(second, 'scope-1')?.occurredAt, 12);

assert.equal(appendGroupMemoryEvidenceScopeCorrection(second, {
  correctedGroupId: 'missing', correctedRecordId: original.id,
  reason: '无效组', snapshotId: 'scope-1',
}, 13), second);
assert.equal(appendGroupMemoryEvidenceScopeCorrection(second, {
  correctedGroupId: 'current-group', correctedRecordId: 'missing',
  reason: '无效记录', snapshotId: 'scope-1',
}, 13), second);
const reopened = normalizeGroupMemoryRepository(JSON.parse(JSON.stringify(second)), [], 20);
assert.equal(reopened.schemaVersion, 8);
assert.equal(reopened.evidenceScopeCorrections.length, 2);
assert.equal(latestEvidenceScopeCorrection(reopened, 'scope-1')?.correctedRecordId, original.id);
const malformedChain = normalizeGroupMemoryRepository({
  ...second,
  evidenceScopeCorrections: [{
    ...second.evidenceScopeCorrections[1], supersedesCorrectionId: 'missing-correction',
  }],
}, [], 21);
assert.equal(malformedChain.evidenceScopeCorrections[0]?.supersedesCorrectionId, undefined);
const withoutActiveSnapshot = normalizeGroupMemoryRepository({
  ...second, evidenceScopeSnapshots: [],
}, [], 22);
assert.equal(withoutActiveSnapshot.evidenceScopeCorrections.length, 2,
  'correction audit must survive active snapshot retention eviction');
console.log('group memory evidence scope correction smoke ok');
