import assert from 'node:assert/strict';
import { createGroupTaskResultReceipt } from '../src/components/chat/group/task/groupTaskResultReceipt';

const receipt = createGroupTaskResultReceipt({
  candidate: { taskId: 'task-1', groupSessionId: 'group-1', topicId: 'topic-1', sourceRoleIds: ['alice'], summary: 'Observe desktop', requestedCapability: 'observe_desktop', status: 'pending-arbitration' },
  implementation: 'stable', outcome: 'completed', summary: 'Desktop observed',
});
assert.equal(receipt.groupSessionId, 'group-1');
assert.equal(receipt.topicId, 'topic-1');
assert.equal(receipt.taskId, 'task-1');
assert.equal(receipt.candidateRequestedCapability, 'observe_desktop');
console.log('group task result receipt smoke ok');
