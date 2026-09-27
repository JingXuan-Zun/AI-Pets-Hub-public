import assert from 'node:assert/strict';
import {
  buildDirectedRelationshipContextPacket,
  EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
  type DirectedRelationshipRepositoryData,
  upsertDirectedRelationship,
} from '../src/character-relationship';
import { EMPTY_GROUP_MEMORY_REPOSITORY } from '../src/group-memory';
import { createGroupTurnContext } from '../src/components/chat/chatGroupTurnContext';
import { buildChatUserPrompt } from '../src/components/chat/chatGroupPromptUtils';
import type { DesktopPetSlot } from '../src/multiPetRoster';

function addRelationship(repository: DirectedRelationshipRepositoryData, source: string, target: string, trust: number) {
  return upsertDirectedRelationship(repository, {
    dimensions: { intimacy: trust, trust, vigilance: 100 - trust }, evidenceSummary: '',
    sourceRoleId: source, targetRoleId: target, targetRoleName: target === 'berry' ? 'Berry' : 'Alice',
  }, { now: trust, reason: 'manual test', source: 'manual' });
}

let repository = addRelationship(EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY, 'alice', 'berry', 80);
repository = addRelationship(repository, 'berry', 'alice', 20);
repository = addRelationship(repository, 'alice', 'charlie', 60);

const alicePacket = buildDirectedRelationshipContextPacket({
  repository, roleId: 'alice', targetRoleIds: ['berry'], now: 100,
});
assert.equal(alicePacket.items.length, 1);
assert.match(alicePacket.items[0]?.summary ?? '', /Berry.*信任 80/u);
assert.doesNotMatch(JSON.stringify(alicePacket), /信任 20/u);

const aliceSlot = {
  id: 'alice', personality: {
    name: 'Alice', systemInstruction: 'Stay Alice.', userMemory: '',
  },
} as DesktopPetSlot;
const messages = [{
  id: 'user-1', role: 'user' as const, text: 'Berry 的方案怎么样？', chatMode: 'group' as const,
  createdAt: 100, petId: null, petName: '群聊',
}];
const context = createGroupTurnContext({
  activeRoleIds: ['alice', 'berry'],
  currentUserInput: messages[0].text,
  directedRelationshipRepository: repository,
  groupMemoryRepository: EMPTY_GROUP_MEMORY_REPOSITORY,
  messages, participantNames: ['Alice', 'Berry'], targetSlot: aliceSlot,
  userMessageId: messages[0].id,
});
const prompt = buildChatUserPrompt(
  messages[0].text, 'group', aliceSlot, ['Alice', 'Berry'], messages, undefined, context,
);
assert.match(prompt, /定向关系参考/u);
assert.match(prompt, /信任 80/u);
assert.match(prompt, /不得覆盖人格、篡改事实、替代发言调度或直接触发工具/u);
assert.match(prompt, /已批准正式关系对应的表达策略/u);
assert.match(prompt, /已经被调度为本轮发言者后/u);
assert.match(prompt, /不得降低工具审批、权限、证据或用户隐私边界/u);
assert.equal(context.roleRuntimeSnapshot.relationshipBehaviorPolicies.length, 1);
assert.equal(context.roleRuntimeSnapshot.personaAnchor, 'Stay Alice.');

const directContext = createGroupTurnContext({
  activeRoleIds: ['alice', 'berry', 'charlie'], currentUserInput: messages[0].text,
  directedRelationshipRepository: repository,
  groupInteractionPlan: {
    groupInteractionKind: 'direct', pullInPetId: null, pullInPetName: null,
    replyToPetId: 'berry', replyToPetName: 'Berry', replyToPetIds: ['berry'],
    replyToPetNames: ['Berry'],
  },
  groupMemoryRepository: EMPTY_GROUP_MEMORY_REPOSITORY, messages,
  participantNames: ['Alice', 'Berry', 'Charlie'], targetSlot: aliceSlot,
});
assert.deepEqual(
  directContext.roleRuntimeSnapshot.relationshipBehaviorPolicies.map((policy) => policy.targetRoleId),
  ['berry'],
  'direct replies must only apply behavior for the actual reply target',
);

const userAddressedPlan = {
  groupInteractionKind: 'direct' as const, pullInPetId: null, pullInPetName: null,
  replyToPetId: null, replyToPetName: null, replyToPetIds: [], replyToPetNames: [],
  userAddressedPetId: 'alice', userAddressedPetName: 'Alice',
};
const userAddressedContext = createGroupTurnContext({
  activeRoleIds: ['alice', 'berry'], currentUserInput: messages[0].text,
  directedRelationshipRepository: repository,
  groupInteractionPlan: userAddressedPlan,
  groupMemoryRepository: EMPTY_GROUP_MEMORY_REPOSITORY, messages,
  participantNames: ['Alice', 'Berry'], targetSlot: aliceSlot,
});
assert.equal(userAddressedContext.roleRuntimeSnapshot.relationshipBehaviorPolicies.length, 0,
  'answering the user must not apply unrelated pet-to-pet behavior');
const userAddressedPrompt = buildChatUserPrompt(
  messages[0].text, 'group', aliceSlot, ['Alice', 'Berry'], messages,
  userAddressedPlan, userAddressedContext,
);
assert.doesNotMatch(userAddressedPrompt, /已批准正式关系对应的表达策略/u);

console.log('directed relationship context smoke ok');
