import assert from 'node:assert/strict';
import { arbitrateGroupTask } from '../src/components/chat/group/task/groupTaskArbiter';

const decision = arbitrateGroupTask({
  taskId: 'task-1', groupSessionId: 'group-1', topicId: 'topic-1', sourceRoleIds: ['alice'],
  summary: 'Organize icons', requestedCapability: 'organize_desktop_icons', status: 'pending-arbitration',
});
assert.equal(decision.action, 'submit-to-agent-runtime');
assert.equal(decision.reason, 'single-group-task-candidate');
console.log('group task arbiter smoke ok');
