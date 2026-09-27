import assert from 'node:assert/strict';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';

const runtime = new GroupChatRuntime({
  activeRoleIds: ['role-a', 'role-b'],
  groupSessionId: 'group-audit',
  mode: 'single-round',
});

runtime.controller.updateTopic(
  { hasNewUserInput: true, topicId: 'topic-1' },
  { reason: 'new-user-input', source: 'user-input' },
);
runtime.controller.updateTopic(
  { hasNewInformation: true },
  { reason: 'role-turn-progress', source: 'role-signal' },
);
runtime.controller.updateTopic(
  { hasNewInformation: true },
  { reason: 'duplicate-no-change', source: 'role-signal' },
);
runtime.controller.updateTopic(
  { waitingForInformation: true },
  { reason: 'waiting-for-task-information', source: 'task' },
);

const snapshot = runtime.controller.getSnapshot();
assert.equal(snapshot.topicAuditTrail.length, 3);
assert.deepEqual(snapshot.topicAuditTrail.map((entry) => entry.source), [
  'user-input', 'role-signal', 'task',
]);
assert.deepEqual(snapshot.topicAuditTrail.map((entry) => entry.fromStatus), [
  null, 'starting', 'active',
]);
assert.deepEqual(snapshot.topicAuditTrail.map((entry) => entry.toStatus), [
  'starting', 'active', 'waiting-information',
]);

runtime.controller.suggestTopicDerivation({ roleId: 'role-a', turnId: 'turn-a' }, 100);
runtime.controller.suggestTopicDerivation({ roleId: 'role-b', turnId: 'turn-b' }, 101);
const derived = runtime.controller.getSnapshot();
assert.equal(derived.topicAuditTrail.at(-1)?.source, 'derivation');
assert.equal(derived.topicAuditTrail.at(-1)?.fromStatus, null);
assert.equal(derived.topicAuditTrail.at(-1)?.toStatus, 'starting');
console.log('group topic transition audit smoke ok');
