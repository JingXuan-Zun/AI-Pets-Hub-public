import assert from 'node:assert/strict';
import {
  rankGroupAttention,
  selectGroupAttentionParticipants,
} from '../src/components/chat/group/attention/attentionPolicy';

const slots = ['alice', 'berry', 'cora'].map((id, index) => ({
  id,
  slotNumber: index + 1,
  personality: { name: id },
}));

const ranked = rankGroupAttention({
  candidateSlots: slots as never,
  messages: [
    { id: 'a', role: 'model', text: 'hi', chatMode: 'group', petId: 'alice', petName: 'alice' },
    {
      id: 'b', role: 'model', text: 'cora?', chatMode: 'group', petId: 'berry', petName: 'berry',
      replyToPetIds: ['cora'],
    },
  ],
});

assert.equal(ranked[0]?.roleId, 'cora');
assert.ok(ranked[0]?.reasons.includes('pending-reply'));
assert.ok(ranked.find((item) => item.roleId === 'berry')!.score < 0);

const freshSelection = selectGroupAttentionParticipants({
  candidateSlots: slots as never,
  messages: [],
});
assert.deepEqual(freshSelection.selected.map((item) => item.roleId), ['alice', 'berry', 'cora']);
assert.deepEqual(freshSelection.silentRoleIds, []);
assert.equal(freshSelection.budget, 3);

const addressedSelection = selectGroupAttentionParticipants({
  candidateSlots: slots as never,
  messages: ranked.length ? [{
    id: 'latest', role: 'model', text: 'latest', chatMode: 'group', petId: 'alice', petName: 'alice',
  }] : [],
  requiredRoleIds: ['cora'],
});
assert.equal(addressedSelection.selected[0]?.roleId, 'cora');
assert.ok(addressedSelection.selected.some((item) => item.roleId === 'cora'));

const fallbackSelection = selectGroupAttentionParticipants({
  candidateSlots: slots as never,
  messages: slots.map((slot, index) => ({
    id: `recent-${index}`,
    role: 'model' as const,
    text: 'recent',
    chatMode: 'group' as const,
    petId: slot.id,
    petName: slot.id,
  })),
});
assert.equal(fallbackSelection.selected.length, 3);
assert.equal(fallbackSelection.usedFallback, false);
assert.ok(fallbackSelection.selected.some((item) => item.reasons.includes('recent-speaker')));

const relevanceSlots = [
  { ...slots[0], personality: { name: 'alice', traits: ['安静'], knowledgeBase: '天文 星星 观测' },
    stats: { fatigue: 10 }, currentAction: 'IDLE' },
  { ...slots[1], personality: { name: 'berry', traits: ['活泼'], knowledgeBase: '烹饪 甜点' },
    stats: { fatigue: 90 }, currentAction: 'SLEEPING' },
] as never;
const relevant = rankGroupAttention({
  candidateSlots: relevanceSlots,
  messages: [{ id: 'topic', role: 'user', text: '今晚一起观测星星', chatMode: 'group' }],
});
assert.equal(relevant[0]?.roleId, 'alice');
assert.ok(relevant[0]?.reasons.includes('topic-relevance'));
assert.ok(relevant[1]?.reasons.includes('fatigue-penalty'));
console.log('group attention policy smoke ok');
