import assert from 'node:assert/strict';
import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import {
  completeGroupTaskMessageLifecycle,
  runGroupTaskExplanationLifecycle,
  updatePreparedGroupTaskEvent,
} from '../src/components/chat/group/task/groupTaskApprovalLifecycle';
import { createGroupTaskLifecycleCallbacks } from '../src/components/chat/group/task/groupTaskSenderLifecycle';
import { startGroupTaskRuntime } from '../src/components/chat/group/task/groupTaskRuntimeLifecycle';

function createFlow(taskId: string) {
  const activeRef = new ActiveGroupRuntimeRef();
  const candidate = {
    taskId,
    groupSessionId: `session-${taskId}`,
    topicId: `topic-${taskId}`,
    sourceRoleIds: ['alice'],
    summary: 'Run task',
    requestedCapability: 'agent-runtime-routing',
    status: 'pending-arbitration' as const,
  };
  const runtime = startGroupTaskRuntime({
    activeGroupRuntimeRef: activeRef,
    activeRoleIds: ['alice', 'bob'],
    candidate,
    mode: 'single-round',
  });
  const preparedRequest = {
    groupTaskConversationEvent: {
      type: 'task-pending-approval' as const,
      groupSessionId: candidate.groupSessionId,
      topicId: candidate.topicId,
      taskId,
      factualSummary: 'Waiting for approval',
    },
  } as Parameters<typeof updatePreparedGroupTaskEvent>[0]['preparedRequest'];
  return {
    activeRef,
    callbacks: createGroupTaskLifecycleCallbacks(activeRef),
    preparedRequest,
    runtime,
  };
}

const completedFlow = createFlow('complete');
const completedEvent = updatePreparedGroupTaskEvent({
  callbacks: completedFlow.callbacks,
  event: completedFlow.preparedRequest.groupTaskConversationEvent,
  outcome: 'completed',
  preparedRequest: completedFlow.preparedRequest,
  summary: 'Verified complete',
});
assert.equal(completedFlow.runtime.controller.getSnapshot().status, 'planning');
await runGroupTaskExplanationLifecycle({
  callbacks: completedFlow.callbacks,
  event: completedEvent,
  execute: async () => {
    assert.equal(completedFlow.runtime.controller.getSnapshot().status, 'speaking');
  },
  roleId: 'alice',
});
assert.equal(completedFlow.runtime.controller.getSnapshot().status, 'completed');
assert.equal(completedFlow.activeRef.get(), null);

const deniedFlow = createFlow('deny');
const deniedEvent = updatePreparedGroupTaskEvent({
  callbacks: deniedFlow.callbacks,
  event: deniedFlow.preparedRequest.groupTaskConversationEvent,
  outcome: 'failed',
  preparedRequest: deniedFlow.preparedRequest,
  summary: 'User denied execution.',
});
assert.equal(deniedFlow.runtime.controller.getSnapshot().status, 'planning');
completeGroupTaskMessageLifecycle(deniedFlow.callbacks, deniedEvent, 'alice');
assert.equal(deniedFlow.runtime.controller.getSnapshot().status, 'completed');
assert.equal(deniedFlow.activeRef.get(), null);

console.log('group task approval resume flow smoke ok');
