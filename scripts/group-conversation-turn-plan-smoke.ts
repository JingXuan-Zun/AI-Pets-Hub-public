import assert from 'node:assert/strict';
import {
  buildConversationTurnPromptLines,
  createConversationTurnPlan,
} from '../src/components/chat/group/orchestration/conversationTurnPlan';

const direct = createConversationTurnPlan({
  attentionReasons: ['pending-reply'],
  attentionScore: 100,
  interaction: {
    groupInteractionKind: 'direct',
    pullInPetId: null,
    replyToPetIds: ['berry'],
  },
  speakerId: 'alice',
});
assert.equal(direct.speakerId, 'alice');
assert.deepEqual(direct.addressedCharacterIds, ['berry']);
assert.equal(direct.intent, 'respond-to-character');
assert.equal(direct.turnBudget, 1);
assert.equal(direct.interruptionPolicy, 'user-priority');
assert.deepEqual(direct.attentionReasons, ['pending-reply']);

const userAddressed = createConversationTurnPlan({
  interaction: {
    groupInteractionKind: 'direct',
    pullInPetId: null,
    replyToPetIds: [],
    userAddressedPetIds: ['alice'],
  },
  speakerId: 'alice',
});
assert.equal(userAddressed.intent, 'answer-user');

const bridge = createConversationTurnPlan({
  interaction: {
    groupInteractionKind: 'bridge',
    pullInPetId: 'cora',
    replyToPetIds: ['berry'],
  },
  speakerId: 'alice',
  usedAttentionFallback: true,
});
assert.equal(bridge.intent, 'bridge-participants');
assert.deepEqual(bridge.addressedCharacterIds, ['berry', 'cora']);
assert.equal(bridge.usedAttentionFallback, true);

const disputed = createConversationTurnPlan({
  interaction: {
    groupInteractionKind: 'group',
    pullInPetId: null,
    replyToPetIds: [],
  },
  speakerId: 'alice',
  topicStatus: 'disputed',
});
assert.equal(disputed.intent, 'resolve-disagreement');
const waiting = createConversationTurnPlan({
  interaction: {
    groupInteractionKind: 'group',
    pullInPetId: null,
    replyToPetIds: [],
  },
  speakerId: 'alice',
  topicStatus: 'waiting-information',
});
assert.equal(waiting.intent, 'request-information');
assert.ok(buildConversationTurnPromptLines(waiting).some((line) => line.includes('缺少的关键信息')));

const promptLines = buildConversationTurnPromptLines(userAddressed);
assert.ok(promptLines.some((line) => line.includes('直接回答用户')));
assert.ok(promptLines.some((line) => line.includes('最多输出 1 次')));
assert.ok(promptLines.some((line) => line.includes('用户输入为最高优先级')));

console.log('group conversation turn plan smoke ok');
