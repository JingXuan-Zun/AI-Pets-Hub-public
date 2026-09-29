import assert from 'node:assert/strict';
import {
  createGroupChatInteractionPlan,
  createGroupChatSpeakerQueue,
  createSingleRoundGroupChatSpeakerQueue,
  selectSingleRoundGroupChatParticipants,
} from '../src/components/chat/chatGroupInteractionPlanner';
import { buildAutonomousGroupChatPrompt } from '../src/components/chat/chatGroupPromptUtils';
import {
  createUserAddressedGroupInteractionPlan,
  resolveTemporaryGroupPetAliases,
  resolveUnansweredGroupUserTopicSlots,
  resolveUserAddressedGroupChatSlot,
} from '../src/components/chat/chatGroupUserAddressing';
import { resolveConversationMessageLabel } from '../src/components/chat/petChatConversationMessageUtils';
import type { ChatMessage, PetConfig } from '../src/types';
import { readProjectFile } from './smokeTestHarness.ts';

type DesktopPetSlotForTest = Parameters<typeof createGroupChatSpeakerQueue>[0]['targetSlots'][number];

function createSlot(id: string, name: string): DesktopPetSlotForTest {
  return {
    id,
    slotNumber: Number(id.replace('pet-', '')) || 1,
    label: name,
    isPrimary: id === 'pet-1',
    enabled: true,
    autoMovementEnabled: true,
    modelType: '2d',
    modelUrl: '',
    personality: {
      name,
      traits: [],
      greeting: '',
      systemInstruction: '',
      chatAvatarUrl: '',
      beginDialogs: [],
      customErrorMessage: '',
      userMemory: '',
      chatHistoryMemory: '',
      knowledgeBase: '',
      webSearchEnabled: false,
      webLearningEnabled: false,
    },
    scale: 1,
    position: { x: 0, y: 0 },
    stats: {
      affection: 50,
      fatigue: 0,
      hunger: 50,
    },
    currentAction: 'IDLE',
  };
}

const targetSlots = [
  createSlot('pet-1', 'Alice'),
  createSlot('pet-2', 'Berry'),
  createSlot('pet-3', 'Cora'),
  createSlot('pet-4', 'Dina'),
];
const userTopicMessages: ChatMessage[] = [
  { id: 'new-user', role: 'user', text: '我们讨论周末旅行。', chatMode: 'group', petId: null },
  { id: 'answered-a', role: 'model', text: 'Alice responds.', chatMode: 'group', petId: 'pet-1' },
];
assert.deepEqual(
  resolveUnansweredGroupUserTopicSlots(userTopicMessages, 'new-user', targetSlots)
    .map((slot) => slot.id),
  ['pet-2', 'pet-3', 'pet-4'],
  'new user topic should prioritize roles that have not answered it yet',
);
const chineseNameTargetSlots = [
  createSlot('pet-1', '\u8299\u5b81\u5a1c'),
  createSlot('pet-2', '\u73ca\u745a\u5bab\u5fc3\u6d77'),
  createSlot('pet-3', '可莉'),
];
const messages: ChatMessage[] = [
  {
    id: 'user-topic',
    role: 'user',
    text: 'What should we do today?',
    chatMode: 'group',
    petId: null,
    petName: '群聊',
  },
  {
    id: 'alice-1',
    role: 'model',
    text: 'Maybe we can play a quiet game.',
    chatMode: 'group',
    petId: 'pet-1',
    petName: 'Alice',
  },
  {
    id: 'berry-1',
    role: 'model',
    text: 'Alice, that sounds good.',
    chatMode: 'group',
    petId: 'pet-2',
    petName: 'Berry',
    replyToPetId: 'pet-1',
    replyToPetName: 'Alice',
    replyToPetIds: ['pet-1'],
    replyToPetNames: ['Alice'],
    groupInteractionKind: 'direct',
  },
  {
    id: 'berry-2',
    role: 'model',
    text: 'Alice, maybe Cora should choose too.',
    chatMode: 'group',
    petId: 'pet-2',
    petName: 'Berry',
    replyToPetId: 'pet-1',
    replyToPetName: 'Alice',
    replyToPetIds: ['pet-1'],
    replyToPetNames: ['Alice'],
    groupInteractionKind: 'direct',
  },
];

const unaddressedMessages: ChatMessage[] = [
  messages[0],
  {
    id: 'alice-unaddressed',
    role: 'model',
    text: 'Maybe we can play a quiet game.',
    chatMode: 'group',
    petId: 'pet-1',
    petName: 'Alice',
  },
  {
    id: 'berry-unaddressed',
    role: 'model',
    text: 'That sounds good.',
    chatMode: 'group',
    petId: 'pet-2',
    petName: 'Berry',
  },
];
const speakerQueue = createGroupChatSpeakerQueue({ messages: unaddressedMessages, targetSlots });
assert.equal(
  speakerQueue[0]?.targetSlot.id,
  'pet-3',
  'least engaged pet should be pulled to the front when nobody is waiting for a direct answer',
);
assert.notEqual(
  speakerQueue[0]?.targetSlot.id,
  'pet-2',
  'the latest speaker should not be selected again first',
);
assert.equal(speakerQueue[0]?.conversationTurnPlan.speakerId, 'pet-3');
assert.equal(speakerQueue[0]?.conversationTurnPlan.turnBudget, 1);
assert.equal(speakerQueue[0]?.conversationTurnPlan.interruptionPolicy, 'user-priority');
assert.ok(speakerQueue[0]?.conversationTurnPlan.attentionReasons.includes('silent-role'));

const addressedQueue = createGroupChatSpeakerQueue({ messages, targetSlots });
assert.equal(
  addressedQueue[0]?.targetSlot.id,
  'pet-1',
  'a directly addressed pet should get the next turn before the queue rotates toward quieter pets',
);
assert.deepEqual(addressedQueue[0]?.conversationTurnPlan.addressedCharacterIds, ['pet-2', 'pet-3']);
assert.equal(addressedQueue[0]?.conversationTurnPlan.intent, 'bridge-participants');
const disputedQueue = createGroupChatSpeakerQueue({
  messages: unaddressedMessages,
  targetSlots,
  topicStatus: 'disputed',
});
assert.equal(
  disputedQueue[0]?.conversationTurnPlan.intent,
  'resolve-disagreement',
  'topic disagreement state should override the generic advance-topic intent',
);

const pendingMentionMessages: ChatMessage[] = [
  ...messages,
  {
    id: 'cora-mentions-dina',
    role: 'model',
    text: 'Dina, what do you think about this plan?',
    chatMode: 'group',
    petId: 'pet-3',
    petName: 'Cora',
    replyToPetId: 'pet-4',
    replyToPetName: 'Dina',
    replyToPetIds: ['pet-4'],
    replyToPetNames: ['Dina'],
    groupInteractionKind: 'direct',
  },
];
const pendingMentionQueue = createGroupChatSpeakerQueue({
  messages: pendingMentionMessages,
  targetSlots,
});
assert.equal(
  pendingMentionQueue[0]?.targetSlot.id,
  'pet-4',
  'a pet explicitly addressed by the latest turn should be selected first before the group rotates away',
);

const singleRoundAfterAliceSpoke = createSingleRoundGroupChatSpeakerQueue({
  messages,
  spokenPetIds: new Set(['pet-1']),
  targetSlots,
});
assert.notEqual(
  singleRoundAfterAliceSpoke[0]?.targetSlot.id,
  'pet-1',
  'single-round group chat should not repeat a pet that has already spoken in the current round',
);
assert.equal(
  singleRoundAfterAliceSpoke.length,
  3,
  'single-round group chat should keep all eligible unspoken pets in the turn queue',
);

const selectedFreshParticipants = selectSingleRoundGroupChatParticipants({
  addressedTargetSlots: [],
  messages: [],
  targetSlots,
});
assert.deepEqual(
  selectedFreshParticipants.map((slot) => slot.id),
  ['pet-1', 'pet-2', 'pet-3', 'pet-4'],
  'a fresh group topic should keep all active roles in the turn queue',
);
const selectedAddressedParticipants = selectSingleRoundGroupChatParticipants({
  addressedTargetSlots: [targetSlots[3]],
  messages,
  targetSlots,
});
assert.ok(
  selectedAddressedParticipants.some((slot) => slot.id === 'pet-4'),
  'an explicitly addressed role must remain selected even when its recent attention score is lower',
);

const singleRoundAfterThreeSpoke = createSingleRoundGroupChatSpeakerQueue({
  messages: pendingMentionMessages,
  spokenPetIds: new Set(['pet-1', 'pet-2', 'pet-3']),
  targetSlots,
});
assert.equal(
  singleRoundAfterThreeSpoke[0]?.targetSlot.id,
  'pet-4',
  'single-round group chat should still let the remaining unspoken pet answer even when the latest mention points at it',
);

const userAddressedSlot = resolveUserAddressedGroupChatSlot('Alice what do you think about that?', targetSlots);
assert.equal(
  userAddressedSlot?.id,
  'pet-1',
  'group chat should detect when the user explicitly addresses a pet by name',
);
const userAddressedPlan = userAddressedSlot
  ? createUserAddressedGroupInteractionPlan(userAddressedSlot)
  : null;
assert.equal(userAddressedPlan?.userAddressedPetId, 'pet-1');
assert.equal(userAddressedPlan?.replyToPetId, null);
assert.equal(
  resolveUserAddressedGroupChatSlot('\u5b81\u5a1c\u4f60\u5148\u8bf4\u8bf4?', chineseNameTargetSlots)?.id,
  'pet-1',
  'group chat should allow any two consecutive characters from a pet name to address that pet',
);
assert.equal(
  resolveUserAddressedGroupChatSlot('宫心你怎么看？', chineseNameTargetSlots)?.id,
  'pet-2',
  'group chat should allow middle two-character fragments from longer pet names',
);
assert.equal(
  resolveUserAddressedGroupChatSlot('莉你怎么看？', chineseNameTargetSlots),
  null,
  'group chat should not treat a single character as an explicit pet mention',
);
const temporaryAliases = resolveTemporaryGroupPetAliases(
  'Alice，以后叫你小爱。',
  targetSlots,
);
assert.deepEqual(temporaryAliases, { 'pet-1': ['小爱'] },
  'a user should be able to assign a temporary group-chat address to an existing pet');
assert.equal(
  resolveUserAddressedGroupChatSlot('小爱你先回答。', targetSlots, temporaryAliases)?.id,
  'pet-1',
  'the temporary address should route a later group interjection to the same pet',
);
const userAddressedPrompt = buildAutonomousGroupChatPrompt(
  targetSlots[0],
  targetSlots.map((slot) => slot.personality.name),
  pendingMentionMessages,
  userAddressedPlan ?? undefined,
);
assert.match(userAddressedPrompt, /\u7528\u6237\u8fd9\u6b21\u660e\u786e\u70b9\u540d\u4e86[\s\S]*Alice/u);
assert.match(userAddressedPrompt, /\u672c\u8f6e\u53ea\u5904\u7406\u7528\u6237\u521a\u521a\u8fd9\u53e5\u8bdd[\s\S]*\u76f4\u63a5\u56de\u7b54\u7528\u6237/u);
assert.doesNotMatch(userAddressedPrompt, /本轮不要默认回复用户/);

const executionSource = [
  readProjectFile('src/components/chat/chatPreparedTargetResponses.ts'),
  readProjectFile('src/components/chat/chatSingleRoundSpeakerPlanning.ts'),
].join('\n');
assert.match(
  executionSource,
  /resolveUserAddressedGroupChatSlots\([\s\S]*request\.outgoingText,[\s\S]*request\.targetSlots,[\s\S]*resolvedTemporaryAliasesById/u,
  'group send should resolve addressed pets from the user message and temporary session aliases',
);
assert.match(
  executionSource,
  /addressedTargetSlots[\s\S]*createUserAddressedGroupInteractionPlan\(targetSlot, addressedTargetSlots\)/u,
  'single-round group send should let the addressed pet answer before continuing the round queue',
);

const coraPlan = createGroupChatInteractionPlan({
  messages,
  targetSlot: targetSlots[2],
  targetSlots,
});
assert.equal(
  coraPlan.replyToPetId,
  'pet-2',
  'least engaged Cora should answer the latest other speaker instead of defaulting to the user',
);
assert.equal(coraPlan.replyToPetName, 'Berry');
assert.equal(coraPlan.groupInteractionKind, 'direct');
assert.deepEqual(
  coraPlan.replyToPetNames,
  ['Berry'],
  'direct plan should keep the latest other speaker as the primary reply target',
);
assert.equal(coraPlan.pullInPetId, 'pet-4');
assert.equal(coraPlan.pullInPetName, 'Dina');

const berryPlan = createGroupChatInteractionPlan({
  messages,
  targetSlot: targetSlots[1],
  targetSlots,
});
assert.equal(
  berryPlan.replyToPetId,
  'pet-3',
  'overused reply target should rotate toward a less engaged pet',
);

const prompt = buildAutonomousGroupChatPrompt(
  targetSlots[2],
  targetSlots.map((slot) => slot.personality.name),
  messages,
  coraPlan,
);
assert.match(prompt, /Berry[\s\S]*Dina/u);
assert.match(prompt, /不要默认回复用户/);
assert.match(prompt, /\u907f\u514d\u534a\u91cd/u);
assert.match(prompt, /必须给出一个新的反应点/);
const userPriorityPrompt = buildAutonomousGroupChatPrompt(
  targetSlots[2],
  targetSlots.map((slot) => slot.personality.name),
  messages,
  { ...coraPlan, userTopicPriority: true },
);
assert.match(userPriorityPrompt, /优先回应用户刚刚提出的话题/);

const label = resolveConversationMessageLabel({
  role: 'model',
  text: 'Berry and Dina, both ideas can work.',
  chatMode: 'group',
  petId: 'pet-3',
  petName: 'Cora',
  replyToPetId: coraPlan.replyToPetId,
  replyToPetName: coraPlan.replyToPetName,
  replyToPetIds: coraPlan.replyToPetIds,
  replyToPetNames: coraPlan.replyToPetNames,
  groupInteractionKind: coraPlan.groupInteractionKind,
}, {
  settings: {
    chatUserDisplayName: 'User',
  },
} as PetConfig);
assert.equal(label, 'Cora -> Berry');

const groupLabel = resolveConversationMessageLabel({
  role: 'model',
  text: 'Everyone, how about we vote?',
  chatMode: 'group',
  petId: 'pet-1',
  petName: 'Alice',
  groupInteractionKind: 'group',
}, {
  settings: {
    chatUserDisplayName: 'User',
  },
} as PetConfig);
assert.equal(label.includes('全体'), false);
assert.equal(groupLabel, 'Alice -> 全体');

console.log('chat group interaction planner smoke ok');
