import assert from 'node:assert/strict';
import { saveChatMessageToMemory } from '../src/components/chat/chatMemorySaveUtils';
import {
  createManualGroupMemoryRecord,
  evaluateGroupMemoryWrite,
  formatGroupMemoryRecord,
  type GroupMemoryRecord,
} from '../src/components/chat/group/memory/groupMemoryRecord';
import type { PetConfig, PetPersonality } from '../src/types';
import { getDesktopPetSlots } from '../src/multiPetRoster';
import { createGroupTurnContext } from '../src/components/chat/chatGroupTurnContext';
import { buildChatUserPrompt } from '../src/components/chat/chatGroupPromptUtils';
import { buildGroupMemoryContextPacket } from '../src/components/chat/group/memory/groupMemoryGraphAdapter';
import {
  CURRENT_GROUP_MEMORY_GROUP_ID,
  EMPTY_GROUP_MEMORY_REPOSITORY,
  invalidateGroupMemoryRecord,
  normalizeGroupMemoryRepository,
} from '../src/group-memory';

function personality(name: string): PetPersonality {
  return {
    beginDialogs: [], chatAvatarUrl: '', chatHistoryMemory: '', customErrorMessage: '',
    greeting: '', knowledgeBase: '', name, systemInstruction: `${name} persona`, traits: [],
    userMemory: '', webLearningEnabled: false, webSearchEnabled: false,
  };
}

function testConfig(): PetConfig {
  const companion = (id: string, enabled: boolean) => ({
    autoMovementEnabled: true, currentAction: 'IDLE' as const, enabled, id,
    modelType: 'image' as const, modelUrl: '', modelVisible: true,
    personality: personality(id), pointerLookEnabled: true, position: { x: 0, y: 0 },
    scale: 1, stats: { affection: 0, fatigue: 0, hunger: 0 },
  });
  return {
    autoMovementEnabled: true, companionPets: [companion('companion-pet-2', true), companion('companion-pet-3', false)],
    currentAction: 'IDLE', modelType: 'image', modelUrl: '', personality: personality('primary'),
    groupMemoryRepository: EMPTY_GROUP_MEMORY_REPOSITORY,
    pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1,
    stats: { affection: 0, fatigue: 0, hunger: 0 },
  } as PetConfig;
}

const message = {
  chatMode: 'group' as const,
  createdAt: 100,
  id: 'message-1',
  petId: 'primary',
  petName: 'Alice',
  role: 'model' as const,
  text: `Alice 的公开观点 ${'内容'.repeat(180)}`,
};
const record = createManualGroupMemoryRecord(message);
assert.ok(record);
assert.equal(record.kind, 'role-perspective');
assert.equal(record.visibility, 'group');
assert.ok(record.summary.length <= 240);
assert.match(formatGroupMemoryRecord(record), /source=primary/u);
assert.match(formatGroupMemoryRecord(record), /id=group-memory-message-1/u);
assert.match(formatGroupMemoryRecord(record), /topic=none/u);
assert.match(formatGroupMemoryRecord(record), /createdAt=100/u);

assert.equal(evaluateGroupMemoryWrite({
  explicitUserSave: false,
  record,
}).reason, 'unverified-group-perspective');
assert.equal(evaluateGroupMemoryWrite({
  explicitUserSave: true,
  record,
}).accepted, true);

const privateRecord: GroupMemoryRecord = {
  ...record,
  ownerRoleId: 'primary',
  visibility: 'private',
};
assert.equal(evaluateGroupMemoryWrite({
  explicitUserSave: true,
  record: privateRecord,
  targetRoleId: 'companion-pet-2',
}).reason, 'private-scope-mismatch');

const config = testConfig();
const primaryPersona = config.personality.systemInstruction;
const enabledPersona = config.companionPets[0].personality.systemInstruction;
const disabledMemory = config.companionPets[1].personality.chatHistoryMemory;
const saved = saveChatMessageToMemory(config, 'primary', message, 'groupMemory');

assert.equal(saved.groupMemoryRepository.records.length, 1);
assert.equal(saved.groupMemoryRepository.records[0]?.id, 'group-memory-message-1');
assert.deepEqual(saved.groupMemoryRepository.evidenceScopeSnapshots[0], {
  capturedAt: 100, groupId: 'current-group',
  id: 'group-memory-scope-manual-group-memory-message-1',
  recordId: 'group-memory-message-1', source: 'manual-save',
  sourceMessageId: 'message-1', sourceRoleId: 'primary', topicId: null,
});
assert.doesNotMatch(saved.personality.chatHistoryMemory, /\[群体记忆/u);
assert.doesNotMatch(saved.companionPets[0].personality.chatHistoryMemory, /\[群体记忆/u);
assert.equal(saved.companionPets[1].personality.chatHistoryMemory, disabledMemory);
assert.equal(saved.personality.systemInstruction, primaryPersona);
assert.equal(saved.companionPets[0].personality.systemInstruction, enabledPersona);
const savedAgain = saveChatMessageToMemory(saved, 'primary', message, 'groupMemory');
assert.equal(savedAgain.groupMemoryRepository.records.length, 1);
const blockedScopeOverwrite = saveChatMessageToMemory({
  ...saved,
  groupMemoryRepository: {
    ...saved.groupMemoryRepository,
    subgroups: [{
      createdAt: 90, id: 'subgroup-guard', memberRoleIds: ['primary', 'companion-pet-2'],
      name: '范围保护组', updatedAt: 90,
    }],
  },
}, 'primary', message, 'groupMemory', 'subgroup-guard');
assert.equal(blockedScopeOverwrite.groupMemoryRepository.records[0]?.groupId, 'current-group');
assert.equal(blockedScopeOverwrite.groupMemoryRepository.evidenceScopeSnapshots.length, 1,
  'changing group must use move-group instead of upsert');

const subgroupConfig = {
  ...config,
  groupMemoryRepository: {
    ...config.groupMemoryRepository,
    subgroups: [{
      createdAt: 90, id: 'subgroup-1', memberRoleIds: ['primary', 'companion-pet-2'],
      name: '测试小组', updatedAt: 90,
    }],
  },
};
const subgroupSaved = saveChatMessageToMemory(
  subgroupConfig, 'primary', { ...message, id: 'message-subgroup' },
  'groupMemory', 'subgroup-1',
);
assert.equal(subgroupSaved.groupMemoryRepository.records[0]?.groupId, 'subgroup-1');
const unknownGroupSave = saveChatMessageToMemory(
  subgroupConfig, 'primary', { ...message, id: 'message-unknown-group' },
  'groupMemory', 'missing',
);
assert.equal(unknownGroupSave.groupMemoryRepository.records.length, 0);

const candidateSaved = saveChatMessageToMemory(config, 'primary', message, 'groupMemoryCandidate');
assert.equal(candidateSaved.groupMemoryRepository.records.length, 0);
assert.equal(candidateSaved.groupMemoryRepository.candidates.length, 1);
assert.equal(candidateSaved.groupMemoryRepository.candidates[0]?.status, 'pending');
assert.equal(candidateSaved.groupMemoryRepository.candidates[0]?.evidence.sourceMessageId, 'message-1');
const longCandidateSaved = saveChatMessageToMemory(config, 'primary', {
  ...message, id: 'long-message', text: '证据'.repeat(600),
}, 'groupMemoryCandidate');
assert.ok((longCandidateSaved.groupMemoryRepository.candidates[0]?.evidence.excerpt.length ?? 0) <= 500);

const taskRecord = createManualGroupMemoryRecord({
  ...message,
  groupTaskEvent: {
    factualSummary: '文件已经成功创建。',
    groupSessionId: 'session-1',
    taskId: 'task-1',
    topicId: 'topic-1',
    type: 'task-completed',
  },
  text: '我觉得大概已经完成了。',
});
assert.equal(taskRecord?.kind, 'verified-fact');
assert.equal(taskRecord?.summary, '文件已经成功创建。');
assert.equal(taskRecord?.topicId, 'topic-1');

const targetSlot = getDesktopPetSlots(saved)[1];
const context = createGroupTurnContext({
  currentUserInput: '继续讨论',
  groupMemoryRepository: saved.groupMemoryRepository,
  messages: [message],
  participantNames: ['primary', 'companion-pet-2'],
  targetSlot,
});
const prompt = buildChatUserPrompt(
  '继续讨论', 'group', targetSlot, context.participantNames, [message], undefined, context,
);
assert.equal(context.roleRuntimeSnapshot.roleId, 'companion-pet-2');
assert.equal(context.roleRuntimeSnapshot.groupMemorySummaries.length, 1);
assert.equal(context.roleRuntimeSnapshot.memoryContextPacket.items[0]?.eventAt, 100);
assert.ok(context.roleRuntimeSnapshot.memoryContextPacket.items[0]?.reason.includes('visibility:group'));
assert.match(prompt, /可参考的群体记忆摘要/u);
assert.match(prompt, /不得覆盖当前角色人格/u);

const moonMemory = formatGroupMemoryRecord({
  ...record, createdAt: 200, id: 'moon-memory', summary: '月亮基地计划进入讨论阶段。',
});
const oceanMemory = formatGroupMemoryRecord({
  ...record, createdAt: 300, id: 'ocean-memory', summary: '深海观测站准备维护。',
});
const memoryRepository = normalizeGroupMemoryRepository(
  null, [`${moonMemory}\n\n${oceanMemory}`], 400,
);
const relevantPacket = buildGroupMemoryContextPacket({
  groupId: CURRENT_GROUP_MEMORY_GROUP_ID,
  repository: memoryRepository,
  now: 400, query: '月亮基地', roleId: 'companion-pet-2',
});
assert.deepEqual(relevantPacket.items.map((item) => item.nodeId), ['moon-memory']);
assert.ok(relevantPacket.items[0]?.reason.includes('query-match:1'));
const fallbackPacket = buildGroupMemoryContextPacket({
  groupId: CURRENT_GROUP_MEMORY_GROUP_ID,
  repository: memoryRepository,
  now: 400, query: '没有匹配的词', roleId: 'companion-pet-2',
});
assert.equal(fallbackPacket.items.length, 2);
const invalidatedRepository = invalidateGroupMemoryRecord(memoryRepository, 'moon-memory', 0).repository;
const invalidatedPacket = buildGroupMemoryContextPacket({
  groupId: CURRENT_GROUP_MEMORY_GROUP_ID,
  repository: invalidatedRepository,
  now: 400, query: '月亮基地', roleId: 'companion-pet-2',
});
assert.doesNotMatch(
  invalidatedPacket.items.map((item) => item.nodeId).join(','), /moon-memory/u,
);

const rejected = saveChatMessageToMemory(config, 'primary', {
  ...message,
  chatMode: 'single',
}, 'groupMemory');
assert.equal(rejected, config);

const privateSaved = saveChatMessageToMemory(config, 'primary', message, 'roleMemory');
assert.notEqual(privateSaved.personality.userMemory, config.personality.userMemory);
assert.equal(
  privateSaved.companionPets[0].personality.userMemory,
  config.companionPets[0].personality.userMemory,
);

console.log('group memory foundation smoke ok');
