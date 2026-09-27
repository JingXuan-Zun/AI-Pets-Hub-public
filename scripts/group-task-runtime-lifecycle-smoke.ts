import assert from 'node:assert/strict';
import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import {
  beginGroupTaskExplanation,
  completeGroupTaskExplanation,
  resumeGroupRuntimeFromTaskEvent,
  startGroupTaskRuntime,
} from '../src/components/chat/group/task/groupTaskRuntimeLifecycle';

const activeRef = new ActiveGroupRuntimeRef();
const candidate = {
  taskId: 'task-1',
  groupSessionId: 'session-1',
  topicId: 'topic-1',
  sourceRoleIds: ['alice'],
  summary: 'Do the task',
  requestedCapability: 'agent-runtime-routing',
  status: 'pending-arbitration' as const,
};
const runtime = startGroupTaskRuntime({
  activeGroupRuntimeRef: activeRef,
  activeRoleIds: ['alice', 'bob'],
  candidate,
  mode: 'single-round',
});
assert.equal(runtime.controller.getSnapshot().status, 'waiting-task');
assert.equal(runtime.controller.getSnapshot().currentTopicId, 'topic-1');
assert.equal(runtime.controller.getSnapshot().topicStatus, 'waiting-information');

const pendingEvent = {
  type: 'task-pending-approval' as const,
  groupSessionId: 'session-1',
  topicId: 'topic-1',
  taskId: 'task-1',
  factualSummary: 'Approval required',
};
assert.equal(resumeGroupRuntimeFromTaskEvent(activeRef, pendingEvent), 'waiting');
assert.equal(runtime.controller.getSnapshot().status, 'waiting-task');

assert.equal(resumeGroupRuntimeFromTaskEvent(activeRef, {
  ...pendingEvent,
  taskId: 'wrong-task',
  type: 'task-completed',
}), 'task-mismatch');
assert.equal(runtime.controller.getSnapshot().status, 'waiting-task');
assert.equal(resumeGroupRuntimeFromTaskEvent(activeRef, {
  ...pendingEvent,
  groupSessionId: 'wrong-session',
  type: 'task-failed',
}), 'session-mismatch');
assert.equal(resumeGroupRuntimeFromTaskEvent(activeRef, {
  ...pendingEvent,
  topicId: 'wrong-topic',
  type: 'task-failed',
}), 'topic-mismatch');

const completedEvent = { ...pendingEvent, type: 'task-completed' as const, factualSummary: 'Done' };
assert.equal(resumeGroupRuntimeFromTaskEvent(activeRef, completedEvent), 'resumed');
assert.equal(runtime.controller.getSnapshot().status, 'planning');
assert.equal(runtime.controller.getSnapshot().currentTopicId, 'topic-1');
assert.equal(runtime.controller.getSnapshot().topicStatus, 'active');
assert.equal(beginGroupTaskExplanation(activeRef, completedEvent, 'alice'), true);
assert.equal(runtime.controller.getSnapshot().status, 'speaking');
assert.equal(completeGroupTaskExplanation(activeRef, completedEvent, 'alice'), true);
assert.equal(runtime.controller.getSnapshot().status, 'completed');
assert.equal(activeRef.get(), null);

const infiniteRef = new ActiveGroupRuntimeRef();
const infiniteRuntime = startGroupTaskRuntime({
  activeGroupRuntimeRef: infiniteRef,
  activeRoleIds: ['alice', 'bob'],
  candidate: { ...candidate, groupSessionId: 'infinite-session', taskId: 'infinite-task' },
  mode: 'infinite',
});
const infiniteEvent = {
  ...completedEvent,
  groupSessionId: 'infinite-session',
  taskId: 'infinite-task',
};
assert.equal(resumeGroupRuntimeFromTaskEvent(infiniteRef, infiniteEvent), 'resumed');
assert.equal(beginGroupTaskExplanation(infiniteRef, infiniteEvent, 'alice'), true);
assert.equal(completeGroupTaskExplanation(infiniteRef, infiniteEvent, 'alice'), true);
assert.equal(infiniteRuntime.controller.getSnapshot().status, 'waiting-next-speaker');
assert.equal(infiniteRef.get(), infiniteRuntime);
infiniteRef.cancel();
assert.equal(infiniteRuntime.controller.getSnapshot().status, 'cancelled');
assert.equal(infiniteRef.get(), null);

console.log('group task runtime lifecycle smoke ok');
