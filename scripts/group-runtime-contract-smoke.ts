import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import assert from 'node:assert/strict';

const runtime = new GroupChatRuntime({
  activeRoleIds: ['alice', 'bob'],
  groupSessionId: 'contract-session',
  mode: 'single-round',
});

runtime.beginPlanning();
runtime.controller.updateTopic({ hasNewUserInput: true, topicId: 'topic-1' });
assert.equal(runtime.controller.getSnapshot().currentTopicId, 'topic-1');
assert.equal(runtime.controller.getSnapshot().topicStatus, 'starting');
runtime.controller.updateTopic({ hasDisagreement: true });
assert.equal(runtime.controller.getSnapshot().topicStatus, 'disputed');
runtime.controller.deriveTopic('topic-2', 200);
assert.equal(runtime.controller.getSnapshot().currentTopicId, 'topic-2');
assert.equal(runtime.controller.getSnapshot().currentTopicParentId, 'topic-1');
assert.equal(runtime.controller.getSnapshot().topicStatus, 'starting');
assert.equal(runtime.controller.getSnapshot().topicHistory[0]?.id, 'topic-1');
runtime.controller.archiveTopic(300);
assert.equal(runtime.controller.getSnapshot().topicStatus, 'archived');
assert.equal(runtime.controller.getSnapshot().topicHistory[1]?.id, 'topic-2');
runtime.controller.deriveTopic('topic-3', 400);
assert.equal(runtime.controller.getSnapshot().currentTopicParentId, 'topic-2');
runtime.controller.decayTopic(100, 450);
assert.equal(runtime.controller.getSnapshot().topicStatus, 'starting');
runtime.controller.decayTopic(100, 500);
assert.equal(runtime.controller.getSnapshot().topicStatus, 'decaying');
const result = await runtime.runTurn({
  speakerId: 'alice',
  turnId: 'turn-1',
  replyTargetIds: ['bob'],
  execute: async () => 'ok',
});

if (result !== 'ok' || runtime.controller.getSnapshot().currentSpeakerId !== 'alice') {
  throw new Error('group runtime turn contract failed');
}

runtime.waitForNextSpeaker(['bob']);
runtime.beginPlanning();
await runtime.runTurn({
  speakerId: 'bob',
  turnId: 'turn-2',
  execute: async () => 'ok',
});
runtime.complete();

if (runtime.controller.getSnapshot().status !== 'completed') {
  throw new Error('group runtime completion contract failed');
}

const taskRuntime = new GroupChatRuntime({
  activeRoleIds: ['alice'], groupSessionId: 'task-session', mode: 'single-round',
});
taskRuntime.beginPlanning();
await taskRuntime.runTurn({ speakerId: 'alice', turnId: 'task-turn', execute: async () => 'proposal' });
taskRuntime.controller.waitForTask('task-1');
assert.equal(taskRuntime.controller.getSnapshot().pendingTaskId, 'task-1');
taskRuntime.controller.resumeAfterTask('task-1');
assert.equal(taskRuntime.controller.getSnapshot().status, 'planning');
assert.equal(taskRuntime.controller.getSnapshot().pendingTaskId, null);

const failedRuntime = new GroupChatRuntime({
  activeRoleIds: ['alice'],
  groupSessionId: 'failed-session',
  mode: 'single-round',
});
failedRuntime.beginPlanning();
try {
  await failedRuntime.runTurn({
    speakerId: 'alice',
    turnId: 'failed-turn',
    execute: async () => {
      throw new Error('expected failure');
    },
  });
} catch {
  // The controller must retain the failed terminal state.
}

if (failedRuntime.controller.getSnapshot().status !== 'failed') {
  throw new Error('group runtime failure contract failed');
}

const tolerantRuntime = new GroupChatRuntime({
  activeRoleIds: ['alice', 'bob'], groupSessionId: 'tolerant-session', mode: 'infinite',
});
tolerantRuntime.beginPlanning();
const tolerantResult = await tolerantRuntime.runTurn({
  continueOnError: true, speakerId: 'alice', turnId: 'tolerant-turn',
  execute: async () => { throw new Error('isolated role failure'); },
});
assert.equal(tolerantResult, undefined);
assert.notEqual(tolerantRuntime.controller.getSnapshot().status, 'failed');

console.log('group runtime contract smoke ok');
