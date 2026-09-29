import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStoryEntry } from '../src/components/chat/story/storyDefaults';
import {
  isStoryDefinitionStartable,
  mergeStoryCompletion,
  normalizeStoryDefinition,
} from '../src/components/chat/story/storyDraftNormalization';

const participants = [
  { id: 'primary', name: '阿澈' },
  { id: 'companion-1', name: '小满' },
];
const normalized = normalizeStoryDefinition({
  goals: ['找到失踪的信使'],
  participantIds: ['primary', 'missing', 'primary'],
  rules: [{ enabled: false, text: '午夜后不能说真名' }],
  tasks: ['取得车票', '查明列车终点'],
  title: '  雾中列车  ',
}, participants, 'random');

assert.equal(normalized.title, '雾中列车');
assert.deepEqual(normalized.participantIds, ['primary']);
assert.equal(normalized.goals[0]?.text, '找到失踪的信使');
assert.equal(normalized.rules[0]?.enabled, false);
assert.equal(normalized.source, 'random');

const userDraft = createEmptyStoryDefinition(['primary'], 'imported');
userDraft.title = '用户标题';
userDraft.customScript = '用户导入的完整剧本';
userDraft.goals = [createStoryEntry('用户目标')];
userDraft.tasks = [createStoryEntry('用户任务')];
userDraft.rules = [createStoryEntry('用户规则')];
const generated = normalizeStoryDefinition({
  customScript: '模型剧本',
  goals: ['模型补充目标'],
  participantIds: ['companion-1'],
  premise: '模型补充梗概',
  rules: ['模型补充规则'],
  tasks: ['模型补充任务'],
  title: '模型标题',
}, participants, 'hybrid');
const merged = mergeStoryCompletion(userDraft, generated);

assert.equal(merged.title, '用户标题');
assert.equal(merged.customScript, '用户导入的完整剧本');
assert.equal(merged.premise, '模型补充梗概');
assert.deepEqual(merged.participantIds, ['primary']);
assert.deepEqual(merged.goals.map((entry) => entry.text), ['用户目标', '模型补充目标']);
assert.equal(isStoryDefinitionStartable(merged), true);
merged.sections.tasks = true;
merged.tasks = [];
assert.equal(isStoryDefinitionStartable(merged), false);

console.log('story definition normalization smoke: PASS');
