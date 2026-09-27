import assert from 'node:assert/strict';
import {
  completeGroupTaskMessageLifecycle,
  runGroupTaskExplanationLifecycle,
  updatePreparedGroupTaskEvent,
} from '../src/components/chat/group/task/groupTaskApprovalLifecycle';

const calls: string[] = [];
const callbacks = {
  onEvent: () => calls.push('event'),
  onExplanationStart: () => calls.push('start'),
  onExplanationComplete: () => calls.push('complete'),
};
const preparedRequest = {
  groupTaskConversationEvent: {
    type: 'task-pending-approval' as const,
    groupSessionId: 'session-1',
    topicId: 'topic-1',
    taskId: 'task-1',
    factualSummary: 'Waiting',
  },
} as Parameters<typeof updatePreparedGroupTaskEvent>[0]['preparedRequest'];

const completedEvent = updatePreparedGroupTaskEvent({
  callbacks,
  event: preparedRequest.groupTaskConversationEvent,
  outcome: 'completed',
  preparedRequest,
  summary: 'Verified result',
});
assert.equal(completedEvent?.type, 'task-completed');
assert.equal(preparedRequest.groupTaskConversationEvent?.factualSummary, 'Verified result');
assert.deepEqual(calls, ['event']);

await runGroupTaskExplanationLifecycle({
  callbacks,
  event: completedEvent,
  execute: async () => calls.push('execute'),
  roleId: 'alice',
});
assert.deepEqual(calls, ['event', 'start', 'execute', 'complete']);

completeGroupTaskMessageLifecycle(callbacks, completedEvent, 'alice');
assert.deepEqual(calls.slice(-2), ['start', 'complete']);

console.log('group task approval lifecycle smoke ok');
