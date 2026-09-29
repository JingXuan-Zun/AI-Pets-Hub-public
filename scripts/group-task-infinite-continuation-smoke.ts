import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import type { PetConfig } from '../src/types';
import type { PreparedChatSendRequest } from '../src/components/chat/chatMessageSendFlowTypes';
import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import {
  beginGroupTaskExplanation,
  completeGroupTaskExplanation,
  resumeGroupRuntimeFromTaskEvent,
  startGroupTaskRuntime,
} from '../src/components/chat/group/task/groupTaskRuntimeLifecycle';
import { continueActiveGroupTaskConversation } from '../src/components/chat/group/task/groupTaskSenderLifecycle';

const activeRef = new ActiveGroupRuntimeRef();
const runtime = startGroupTaskRuntime({
  activeGroupRuntimeRef: activeRef,
  activeRoleIds: ['alice'],
  candidate: {
    taskId: 'task-1',
    groupSessionId: 'session-1',
    topicId: 'topic-1',
    sourceRoleIds: ['alice'],
    summary: 'Task',
    requestedCapability: 'agent-runtime-routing',
    status: 'pending-arbitration',
  },
  mode: 'infinite',
});
const event = {
  type: 'task-completed' as const,
  groupSessionId: 'session-1',
  topicId: 'topic-1',
  taskId: 'task-1',
  factualSummary: 'Done',
};
assert.equal(resumeGroupRuntimeFromTaskEvent(activeRef, event), 'resumed');
assert.equal(beginGroupTaskExplanation(activeRef, event, 'alice'), true);
assert.equal(completeGroupTaskExplanation(activeRef, event, 'alice'), true);
runtime.controller.updateTopic({ hasNewInformation: false, repeatedReplyCount: 2 });

const continuationEnabledRef = { current: false };
const continued = await continueActiveGroupTaskConversation({
  activeChatRequestTokenRef: { current: 7 },
  activeGroupRuntimeRef: activeRef,
  configRef: { current: {} as PetConfig },
  getPlaybackToken: () => 1,
  groupChatContinuationEnabledRef: continuationEnabledRef,
  runPetResponseTurn: async () => ({ cancelled: false, finalResponse: '' }),
}, {
  playbackToken: 1,
  requestToken: 7,
  targetSlots: [],
} as unknown as PreparedChatSendRequest);

assert.equal(continued, true);
assert.equal(runtime.controller.getSnapshot().status, 'completed');
assert.equal(activeRef.get(), null);
assert.equal(continuationEnabledRef.current, false);
assert.equal(desktopPetChatStore.getState().isGroupChatRunning, false);

console.log('group task infinite continuation smoke ok');
