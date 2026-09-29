import assert from 'node:assert/strict';
import { submitGroupTaskToAgentRuntime } from '../src/components/chat/group/task/groupTaskAgentRuntimeAdapter';

const result = await submitGroupTaskToAgentRuntime({
  candidate: { taskId: 'task-1', groupSessionId: 'group-1', topicId: null, sourceRoleIds: ['alice'], summary: 'Observe desktop', requestedCapability: 'observe_desktop', status: 'pending-arbitration' },
  adapter: { id: 'group-task-smoke', run: async () => ({ implementation: 'stable', reason: 'smoke', result: { continuation: {}, status: 'succeeded', toolResults: [] } }) },
});
assert.equal(result.implementation, 'stable');
console.log('group task agent runtime adapter smoke ok');
