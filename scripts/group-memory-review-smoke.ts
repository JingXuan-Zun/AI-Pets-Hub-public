import assert from 'node:assert/strict';
import {
  detectGroupMemoryConflictCandidates,
  resolveGroupMemoryConflict,
  validateGroupMemoryIntegrity,
  type GroupMemoryRepositoryData,
  type StoredGroupMemoryRecord,
} from '../src/group-memory';

function record(
  id: string,
  summary: string,
  overrides: Partial<StoredGroupMemoryRecord> = {},
): StoredGroupMemoryRecord {
  return {
    confidence: 0.8, createdAt: 100, groupId: 'current-group', id,
    kind: 'verified-fact', sourceRoleId: 'primary', summary,
    topicId: 'topic-1', updatedAt: 100, visibility: 'group', ...overrides,
  };
}

function repository(records: StoredGroupMemoryRecord[]): GroupMemoryRepositoryData {
  return {
    candidateArchives: [], candidateReviewReceipts: [], candidates: [],
    evidenceScopeCorrections: [], evidenceScopeSnapshots: [], receiptArchives: [], receipts: [],
    records, schemaVersion: 8, subgroupAuditTrail: [], subgroups: [],
  };
}

const first = record('first', '月亮基地已经建成。');
const duplicate = record('duplicate', ' 月亮基地已经建成。 ');
const related = record('related', '月亮基地仍在施工。');
const candidates = detectGroupMemoryConflictCandidates(repository([first, duplicate, related]));
assert.equal(candidates.length, 3);
assert.ok(candidates[0]?.reasons.includes('duplicate-summary'));
assert.ok(candidates.every((candidate) => candidate.reasons.includes('same-topic-kind')));

const invalidated = record('invalidated', '月亮基地已经取消。', { invalidatedAt: 200 });
assert.equal(detectGroupMemoryConflictCandidates(repository([first, invalidated])).length, 0);
const linked = record('linked', '月亮基地新版事实。', { supersedesId: first.id });
assert.equal(detectGroupMemoryConflictCandidates(repository([first, linked])).length, 0);

const resolved = resolveGroupMemoryConflict(repository([first, related]), related.id, first.id, 300);
assert.deepEqual(validateGroupMemoryIntegrity(resolved.repository), []);

const malformed = repository([
  record('self', '自引用', { supersedesId: 'self' }),
  record('missing', '断链', { supersedesId: 'absent' }),
  record('cross-source', '跨群来源', { supersedesId: 'cross-target' }),
  record('cross-target', '跨群目标', { groupId: 'other-group', invalidatedAt: 200 }),
  record('cycle-a', '循环 A', { supersedesId: 'cycle-b' }),
  record('cycle-b', '循环 B', { supersedesId: 'cycle-a' }),
]);
const issueKinds = validateGroupMemoryIntegrity(malformed).map((issue) => issue.kind);
assert.ok(issueKinds.includes('self-reference'));
assert.ok(issueKinds.includes('missing-target'));
assert.ok(issueKinds.includes('cross-group-target'));
assert.ok(issueKinds.includes('target-still-active'));
assert.ok(issueKinds.includes('cycle'));

console.log('group memory review smoke ok');
