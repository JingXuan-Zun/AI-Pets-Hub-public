import assert from 'node:assert/strict';
import {
  evaluateGroupMemoryCandidateEvidence,
  type GroupMemoryCandidate,
} from '../src/group-memory';

function candidate(overrides: Partial<GroupMemoryCandidate> = {}): GroupMemoryCandidate {
  const base: GroupMemoryCandidate = {
    createdAt: 100,
    evidence: {
      capturedAt: 100, excerpt: '任务已经按照实际工具结果完成。', kind: 'task-result',
      sourceMessageId: 'message-1', sourceRoleId: 'primary', topicId: 'topic-1',
    },
    id: 'candidate-1',
    proposedRecord: {
      confidence: 1, createdAt: 100, groupId: 'current-group', id: 'record-1',
      kind: 'verified-fact', sourceRoleId: 'primary', summary: '任务已经完成。',
      topicId: 'topic-1', updatedAt: 100, visibility: 'group',
    },
    status: 'pending',
  };
  return { ...base, ...overrides };
}

function withEvidence(
  base: GroupMemoryCandidate,
  overrides: Partial<GroupMemoryCandidate['evidence']>,
) {
  return { ...base, evidence: { ...base.evidence, ...overrides } };
}

const verified = evaluateGroupMemoryCandidateEvidence(candidate());
assert.equal(verified.decision, 'eligible');
assert.deepEqual(verified.reasons, ['verified-task-result']);

const perspective = candidate({
  evidence: { ...candidate().evidence, excerpt: '我支持采用方案 A。', kind: 'chat-message' },
  proposedRecord: { ...candidate().proposedRecord, kind: 'role-perspective' },
});
assert.equal(evaluateGroupMemoryCandidateEvidence(perspective).decision, 'manual-review');
assert.deepEqual(
  evaluateGroupMemoryCandidateEvidence(perspective).reasons,
  ['role-perspective-requires-review'],
);

const discussion = candidate({
  evidence: { ...candidate().evidence, excerpt: '用户确认采用方案 A。', kind: 'chat-message' },
  proposedRecord: { ...candidate().proposedRecord, kind: 'discussion-summary' },
});
assert.deepEqual(
  evaluateGroupMemoryCandidateEvidence(discussion).reasons,
  ['discussion-requires-review'],
);

const question = withEvidence(discussion, { excerpt: '我们应该采用方案 A 吗？' });
assert.deepEqual(evaluateGroupMemoryCandidateEvidence(question).reasons, ['question-like']);
const speculative = withEvidence(discussion, { excerpt: '我觉得可能采用方案 A。' });
assert.deepEqual(evaluateGroupMemoryCandidateEvidence(speculative).reasons, ['speculative-language']);
const transient = withEvidence(discussion, { excerpt: '这只是测试消息。' });
assert.deepEqual(evaluateGroupMemoryCandidateEvidence(transient).reasons, ['transient-language']);
const sourceMismatch = withEvidence(candidate(), { sourceRoleId: 'other' });
assert.deepEqual(
  evaluateGroupMemoryCandidateEvidence(sourceMismatch).reasons,
  ['evidence-source-mismatch'],
);
const topicMismatch = withEvidence(candidate(), { topicId: 'topic-2' });
assert.deepEqual(
  evaluateGroupMemoryCandidateEvidence(topicMismatch).reasons,
  ['evidence-topic-mismatch'],
);
const invalidated = candidate({
  proposedRecord: { ...candidate().proposedRecord, invalidatedAt: 200 },
});
assert.deepEqual(
  evaluateGroupMemoryCandidateEvidence(invalidated).reasons,
  ['candidate-invalidated'],
);
const unsupportedFact = candidate({
  proposedRecord: { ...candidate().proposedRecord, confidence: 0.5 },
});
assert.deepEqual(
  evaluateGroupMemoryCandidateEvidence(unsupportedFact).reasons,
  ['unsupported-verified-fact'],
);

console.log('group memory candidate screening smoke ok');
