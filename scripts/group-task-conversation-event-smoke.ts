import assert from 'node:assert/strict';
import { createGroupTaskConversationEvent } from '../src/components/chat/group/task/groupTaskConversationEvent';

const receipt = { groupSessionId: 'g', topicId: 'topic', taskId: 'task', sourceRoleIds: ['alice'], implementation: 'stable' as const, outcome: 'completed' as const, summary: 'Observed desktop' };
assert.equal(createGroupTaskConversationEvent({ receipt, verified: true }).type, 'task-completed');
assert.equal(createGroupTaskConversationEvent({ receipt, verified: false }).type, 'task-failed');
console.log('group task conversation event smoke ok');
