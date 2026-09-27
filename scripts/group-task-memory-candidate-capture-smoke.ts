import assert from 'node:assert/strict';
import {
  approveGroupMemoryCandidate,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  rejectGroupMemoryCandidate,
} from '../src/group-memory';
import {
  createAutomaticGroupTaskMemoryCandidate,
  captureAutomaticGroupTaskMemoryCandidates,
  getCompletedGroupTaskMessageKey,
} from '../src/components/chat/group/memory/groupTaskMemoryCandidate';
import type { ChatMessage } from '../src/types';

function taskMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'message-result-1',
    role: 'model',
    text: '角色推测内容不应作为事实来源',
    petId: 'role-a',
    chatMode: 'group',
    createdAt: 1_000,
    groupTaskEvent: {
      type: 'task-completed',
      groupSessionId: 'group-1',
      topicId: 'topic-1',
      taskId: 'task-1',
      factualSummary: '已验证：文件成功保存。',
    },
    ...overrides,
  };
}

const candidate = createAutomaticGroupTaskMemoryCandidate(taskMessage());
assert.ok(candidate);
assert.equal(candidate.id, 'group-memory-candidate-message-result-1');
assert.equal(candidate.evidence.sourceMessageId, 'message-result-1');
assert.equal(candidate.evidence.excerpt, '已验证：文件成功保存。');
assert.equal(candidate.proposedRecord.kind, 'verified-fact');
assert.equal(candidate.proposedRecord.summary, '已验证：文件成功保存。');
assert.equal(EMPTY_GROUP_MEMORY_REPOSITORY.records.length, 0);

const observedKeys = new Set<string>();
const captured = captureAutomaticGroupTaskMemoryCandidates({
  messages: [taskMessage(), taskMessage()],
  observedKeys,
  repository: EMPTY_GROUP_MEMORY_REPOSITORY,
});
assert.equal(captured.repository.candidates.length, 1);
assert.equal(captured.repository.records.length, 0);
const duplicateCapture = captureAutomaticGroupTaskMemoryCandidates({
  messages: [taskMessage()],
  observedKeys,
  repository: captured.repository,
});
assert.equal(duplicateCapture.repository, captured.repository);
assert.equal(duplicateCapture.latestCandidate, null);
const reopenedCapture = captureAutomaticGroupTaskMemoryCandidates({
  messages: [taskMessage()],
  observedKeys: new Set<string>(),
  repository: captured.repository,
});
assert.equal(reopenedCapture.repository, captured.repository);
assert.equal(reopenedCapture.latestCandidate, null);

const approved = approveGroupMemoryCandidate(captured.repository, candidate.id, 2_000);
assert.equal(approved.reason, 'applied');
assert.equal(approved.repository.records.length, 1);
const ignored = rejectGroupMemoryCandidate(captured.repository, candidate.id, 2_000);
assert.equal(ignored.reason, 'applied');
assert.equal(ignored.repository.records.length, 0);

assert.equal(createAutomaticGroupTaskMemoryCandidate(taskMessage({
  groupTaskEvent: { ...taskMessage().groupTaskEvent!, type: 'task-failed' },
})), null);
assert.equal(createAutomaticGroupTaskMemoryCandidate(taskMessage({
  groupTaskEvent: { ...taskMessage().groupTaskEvent!, factualSummary: '   ' },
})), null);
assert.equal(createAutomaticGroupTaskMemoryCandidate(taskMessage({ id: undefined })), null);
assert.equal(createAutomaticGroupTaskMemoryCandidate(taskMessage({
  groupTaskEvent: { ...taskMessage().groupTaskEvent!, factualSummary: '可能已经完成？' },
})), null);

const firstKey = getCompletedGroupTaskMessageKey(taskMessage());
assert.equal(firstKey, getCompletedGroupTaskMessageKey(taskMessage()));
assert.notEqual(firstKey, getCompletedGroupTaskMessageKey(taskMessage({
  groupTaskEvent: { ...taskMessage().groupTaskEvent!, factualSummary: '更新后的事实结果' },
})));

console.log('group task memory candidate capture smoke ok');
