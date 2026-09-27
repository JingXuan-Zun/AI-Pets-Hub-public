import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';
import type { PreparedChatSendRequest } from '../src/components/chat/chatMessageSendFlowTypes';
import type { PetConfig } from '../src/types';
import { runGroupTaskCollaborationPreflight } from '../src/components/chat/group/task/groupTaskCollaborationExecution';
import { createGroupTaskCollaborationPlan } from '../src/components/chat/group/task/groupTaskCollaborationPlan';

function slot(id: string, name: string) {
  return { id, personality: { name }, } as never;
}

function request() {
  return {
    currentChatState: { chatMode: 'group' },
    currentConfig: {} as PetConfig,
    groupTaskCandidate: {
      taskId: 'task-1', groupSessionId: 'session-1', topicId: 'topic-1', sourceRoleIds: ['a'],
      summary: '整理文件', requestedCapability: 'agent-runtime-routing', status: 'pending-arbitration',
      collaborationPlan: createGroupTaskCollaborationPlan(['a', 'b', 'c', 'd'], 'a'),
    },
    isGroupMode: true,
    playbackToken: 1,
    requestToken: 1,
    targetSlots: [slot('a', 'A'), slot('b', 'B'), slot('c', 'C'), slot('d', 'D')],
  } as unknown as PreparedChatSendRequest;
}

desktopPetChatStore.reset();
const calls: string[] = [];
const prepared = request();
const completed = await runGroupTaskCollaborationPreflight({
  request: prepared,
  runPetResponseTurn: async (targetSlot) => {
    calls.push(targetSlot.id);
    return { cancelled: false, finalResponse: `${targetSlot.id} done` };
  },
});
assert.equal(completed, true);
assert.deepEqual(calls, ['a', 'b']);
assert.equal(prepared.groupTaskCandidate?.collaborationPlan?.currentStage, 'execution');

const failedRequest = request();
const failed = await runGroupTaskCollaborationPreflight({
  request: failedRequest,
  runPetResponseTurn: async () => { throw new Error('review failed'); },
});
assert.equal(failed, false);
assert.equal(failedRequest.groupTaskCandidate?.collaborationPlan?.currentStage, 'failed');
console.log('group task collaboration execution smoke ok');
