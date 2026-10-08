import assert from 'node:assert/strict';
import {
  buildCharacterReplySystemInstruction,
  selectMemoryEntriesWithinBudget,
} from '../src/services/geminiPromptService';
import type { PetConfig, PetPersonality } from '../src/types';

const shortMemory = '用户喜欢安静的陪伴。';
assert.equal(selectMemoryEntriesWithinBudget(shortMemory, [], 3000), shortMemory, 'memory within budget stays verbatim');

const manualEntries = Array.from({ length: 40 }, (_entry, index) => [
  `【手动保存｜2026/10/${String((index % 28) + 1).padStart(2, '0')} 10:00｜用户】`,
  `第 ${index + 1} 条记忆：${'日常琐事'.repeat(12)}`,
].join('\n'));
manualEntries[3] = '【手动保存｜2026/10/04 10:00｜用户】\n蓝钥协议的启动口令是月白-77。';
manualEntries.push('【手动保存｜2026/10/28 10:00｜用户】\n用户叫小明，正在准备考研。\n\n考试在十二月。');
const longMemory = manualEntries.join('\n\n');

const selected = selectMemoryEntriesWithinBudget(longMemory, ['蓝钥', '协议', '口令'], 1200);
assert.ok(selected.length <= 1300, 'selection should stay near the budget');
assert.ok(selected.includes('用户叫小明，正在准备考研。'), 'the newest saved memory must be kept');
assert.ok(selected.includes('考试在十二月。'), 'a manual entry with an inner blank line stays whole');
assert.ok(selected.includes('月白-77'), 'an old entry relevant to the topic must be kept');
assert.ok(!selected.includes('第 1 条记忆'), 'the oldest unrelated entries are dropped first');
assert.match(selected, /另有 \d+ 条较早的记忆因篇幅未列出/u);
assert.ok(
  selected.indexOf('月白-77') < selected.indexOf('用户叫小明'),
  'selected entries keep their original order',
);

const lineMemory = Array.from({ length: 200 }, (_entry, index) => `- 设定 ${index + 1}：${'细节'.repeat(10)}`).join('\n');
const lineSelected = selectMemoryEntriesWithinBudget(lineMemory, [], 600);
assert.ok(lineSelected.includes('设定 200：'), 'line-based memory keeps the newest line');
assert.ok(!lineSelected.includes('设定 1：'), 'line-based memory drops the oldest line');

const personality = {
  name: '铃音',
  traits: [],
  greeting: '',
  systemInstruction: '',
  chatAvatarUrl: '',
  beginDialogs: [],
  customErrorMessage: '',
  userMemory: longMemory,
  chatHistoryMemory: '',
  knowledgeBase: '',
} as PetPersonality;
const settings = {
  globalKnowledgeBase: '',
  webSearchEnabled: false,
  webLearningEnabled: false,
  llmProvider: 'gemini',
  webSearchProvider: 'browser',
  timeAwarenessEnabled: false,
} as PetConfig['settings'];
const prompt = buildCharacterReplySystemInstruction(personality, settings, [], '晚安');
assert.ok(prompt.includes('【角色记忆库】'), 'role memory attaches even for a plain good-night');
assert.ok(prompt.includes('用户叫小明，正在准备考研。'), 'the newest memory reaches the prompt once memory is long');

console.log('chat memory selection smoke passed');
