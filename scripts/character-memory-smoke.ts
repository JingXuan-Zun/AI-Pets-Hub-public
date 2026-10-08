import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  applyAutoMemoryOperations,
  buildAutoMemoryExtractionPrompt,
  createAutoMemoryExtractionTrigger,
  parseAutoMemoryOperations,
} from '../src/character-memory/autoMemoryExtraction';
import {
  EMPTY_CHARACTER_MEMORY_STATE,
  formatCharacterMemoryItemsForPrompt,
  normalizeCharacterMemoryState,
  type CharacterMemoryItem,
} from '../src/character-memory/characterMemoryTypes';
import { selectArchivableChatMessages } from '../src/character-memory/chatHistoryArchive';
import {
  CONVERSATION_SUMMARY_MIN_BATCH,
  selectMessagesPendingSummary,
} from '../src/character-memory/conversationSummary';
import { parseManualMemoryTidy } from '../src/character-memory/manualMemoryTidy';
import { buildCharacterReplySystemInstruction } from '../src/services/geminiPromptService';
import type { ChatMessage, PetConfig, PetPersonality } from '../src/types';

function chat(index: number, petId = 'primary', chatMode: ChatMessage['chatMode'] = 'single'): ChatMessage {
  return {
    chatMode,
    createdAt: 1_000 + index,
    id: `m-${petId}-${chatMode}-${index}`,
    petId,
    role: index % 2 === 0 ? 'user' : 'model',
    text: `第 ${index} 条：${'聊天内容'.repeat(20)}`,
  };
}

// --- Conversation summary batching ---
const longHistory = Array.from({ length: 200 }, (_entry, index) => chat(index));
const firstBatch = selectMessagesPendingSummary(longHistory, 8192, null);
assert.ok(firstBatch.length >= CONVERSATION_SUMMARY_MIN_BATCH, 'messages pushed out of the window are summarized');
assert.equal(firstBatch[0]?.id, 'm-primary-single-0', 'summary starts from the oldest message');
const coveredUntil = Math.max(...firstBatch.map((message) => message.createdAt ?? 0));
const secondBatch = selectMessagesPendingSummary(longHistory, 8192, { coveredUntil, text: '摘要', updatedAt: 1 });
assert.ok(secondBatch.every((message) => (message.createdAt ?? 0) > coveredUntil), 'covered messages are not summarized twice');
assert.deepEqual(
  selectMessagesPendingSummary(longHistory.slice(0, 40), 8192, null),
  [],
  'nothing is summarized while the whole chat still fits the window',
);
const shortOverflow = Array.from({ length: 105 }, (_entry, index) => chat(index));
assert.deepEqual(selectMessagesPendingSummary(shortOverflow, 8192, null), [], 'small overflows wait for a full batch');

// --- Automatic memory extraction ---
const trigger = createAutoMemoryExtractionTrigger(3);
assert.equal(trigger.recordTurn('a', '你好'), false);
assert.equal(trigger.recordTurn('a', '今天好累'), false);
assert.equal(trigger.recordTurn('a', '晚安'), true, 'checks every third turn');
assert.equal(trigger.recordTurn('a', '帮我记住我对芒果过敏'), true, 'an explicit remember request checks right away');
assert.equal(trigger.recordTurn('a', '把那件事忘掉吧'), true, 'an explicit forget request checks right away');

const existing: CharacterMemoryItem[] = [
  { createdAt: 1, id: 'job', kind: 'profile', source: 'auto', text: '用户在银行工作', updatedAt: 1 },
  { createdAt: 2, id: 'food', kind: 'preference', source: 'auto', text: '用户喜欢吃辣', updatedAt: 2 },
];
const prompt = buildAutoMemoryExtractionPrompt({ items: existing, messages: [chat(1), chat(2)], roleName: '铃音' });
assert.equal(prompt.tidy, false);
assert.ok(prompt.payload.includes('"id":"job"'), 'existing memories are sent with ids so they can be updated');

const operations = parseAutoMemoryOperations(
  '```json\n{"add":[{"text":"用户叫小明，在准备考研","kind":"profile"},{"text":"用户喜欢吃辣","kind":"preference"}],'
  + '"update":[{"id":"job","text":"用户换了工作，现在做设计"},{"id":"ghost","text":"x"}],"remove":["food","ghost"]}\n```',
  existing,
  { tidy: false },
);
assert.ok(operations, 'fenced JSON is parsed');
assert.deepEqual(operations?.remove, ['food'], 'unknown ids are ignored');
assert.equal(operations?.update.length, 1);
const state = applyAutoMemoryOperations({ ...EMPTY_CHARACTER_MEMORY_STATE, items: existing }, operations!, 5_000);
assert.deepEqual(state.items.map((item) => item.text), ['用户换了工作，现在做设计', '用户叫小明，在准备考研', '用户喜欢吃辣']);
assert.equal(state.items[0].updatedAt, 5_000, 'updated items get a new timestamp');
assert.deepEqual(state.itemsBackup?.items, existing, 'removing items keeps a backup');
assert.equal(
  applyAutoMemoryOperations(state, { add: [{ kind: 'other', text: '用户叫小明，在准备考研。' }], remove: [], update: [] }),
  state,
  'a duplicate addition changes nothing',
);
assert.equal(parseAutoMemoryOperations('不是 JSON', existing, { tidy: false }), null);

const manyItems = Array.from({ length: 70 }, (_entry, index): CharacterMemoryItem => ({
  createdAt: index, id: `i${index}`, kind: 'other', source: 'auto', text: `记忆 ${index}`, updatedAt: index,
}));
assert.equal(buildAutoMemoryExtractionPrompt({ items: manyItems, messages: [chat(1)], roleName: '铃音' }).tidy, true, 'a long list asks for a tidy-up');

const pinnedState = { ...EMPTY_CHARACTER_MEMORY_STATE, items: [{ ...existing[0], pinned: true, updatedAt: 0 }, existing[1]] };
assert.ok(formatCharacterMemoryItemsForPrompt(pinnedState).endsWith('- 用户在银行工作'), 'pinned items are listed last so the budget keeps them');

// --- Normalization ---
const normalized = normalizeCharacterMemoryState({
  items: [{ id: 'a', text: '  有效  ', kind: 'nope' }, { id: 'a', text: '重复 id' }, { text: '没有 id' }],
  summary: { coveredUntil: 9, text: '  ', updatedAt: 1 },
});
assert.deepEqual(normalized.items.map((item) => [item.id, item.text, item.kind]), [['a', '有效', 'other']]);
assert.equal(normalized.summary, null, 'an empty summary is dropped');
assert.equal(normalizeCharacterMemoryState(undefined), EMPTY_CHARACTER_MEMORY_STATE);

// --- Prompt injection ---
const personality = {
  beginDialogs: [], chatAvatarUrl: '', chatHistoryMemory: '', customErrorMessage: '', greeting: '',
  knowledgeBase: '', name: '铃音', systemInstruction: '', traits: [], userMemory: '',
  webLearningEnabled: false, webSearchEnabled: false,
  memoryState: { ...state, summary: { coveredUntil: 1, text: '上个月用户搬了家，两人约好一起看海。', updatedAt: 1 } },
} as PetPersonality;
const settings = {
  globalKnowledgeBase: '', llmProvider: 'gemini', timeAwarenessEnabled: false,
  webLearningEnabled: false, webSearchEnabled: false, webSearchProvider: 'browser',
} as PetConfig['settings'];
const replyPrompt = buildCharacterReplySystemInstruction(personality, settings, [
  { role: 'user', text: '叫我阿星' },
], '晚安');
assert.ok(replyPrompt.includes('【自动记忆】') && replyPrompt.includes('用户叫小明，在准备考研'));
assert.ok(replyPrompt.includes('【过往对话摘要】') && replyPrompt.includes('约好一起看海'));
assert.ok(!replyPrompt.includes('称呼用户为阿星'), 'regex notes step aside once automatic memory has items');

// --- Archive selection ---
const mixed = [
  ...Array.from({ length: 30 }, (_entry, index) => chat(index, 'primary')),
  ...Array.from({ length: 30 }, (_entry, index) => chat(index, 'second')),
  ...Array.from({ length: 30 }, (_entry, index) => chat(index, 'group-pet', 'group')),
];
const archivable = selectArchivableChatMessages(mixed, (petId) => (petId === 'primary' ? 1_000 + 5 : null), 20);
assert.deepEqual(
  archivable.filter((message) => message.chatMode === 'single').map((message) => message.id),
  Array.from({ length: 6 }, (_entry, index) => `m-primary-single-${index}`),
  'private chats only archive what the summary already covers',
);
assert.equal(archivable.filter((message) => message.chatMode === 'group').length, 10, 'group chat keeps its newest messages');

// --- Manual memory tidy ---
assert.equal(parseManualMemoryTidy('- 用户喜欢猫\n- 用户在准备考研', '【手动保存】用户喜欢猫'), '- 用户喜欢猫\n- 用户在准备考研');
assert.equal(parseManualMemoryTidy('好', '很长的记忆'.repeat(100)), null, 'a reply that drops most of the memory is rejected');

// --- Main-process archive store ---
const require = createRequire(import.meta.url);
const { createPersistedChatHistoryStore } = require('../electron/persistedChatHistoryStore.cjs');
const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-archive-smoke-'));
try {
  const store = createPersistedChatHistoryStore({ userDataPath });
  const october = new Date(2026, 9, 5).getTime();
  const november = new Date(2026, 10, 2).getTime();
  const first = store.archive([
    { createdAt: october, id: 'a', role: 'user', text: '十月' },
    { createdAt: november, id: 'b', role: 'model', text: '十一月' },
  ]);
  assert.equal(first.archivedCount, 2);
  const again = store.archive([{ createdAt: october, id: 'a', role: 'user', text: '十月' }]);
  assert.equal(again.archivedCount, 0, 'archiving the same message twice is a no-op');
  const octoberFile = JSON.parse(fs.readFileSync(path.join(userDataPath, 'chat-archive', '2026-10.json'), 'utf8'));
  assert.deepEqual(octoberFile.messages.map((message: ChatMessage) => message.id), ['a']);
  assert.ok(fs.existsSync(path.join(userDataPath, 'chat-archive', '2026-11.json')), 'messages are split by month');
} finally {
  fs.rmSync(userDataPath, { force: true, recursive: true });
}

console.log('character memory smoke passed');
