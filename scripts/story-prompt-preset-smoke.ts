import assert from 'node:assert/strict';
import { createEmptyStoryDefinition, createStoryEntry } from '../src/components/chat/story/storyDefaults';
import { normalizeStoryDefinition } from '../src/components/chat/story/storyDraftNormalization';
import { shouldShowStoryPromptJsonSource } from '../src/components/chat/story/storyPromptJsonEditorState';
import { compileStoryCustomPrompt } from '../src/components/chat/story/storyPromptPresetCompiler';
import { moveStoryPromptOrderEntry, setStoryPromptOrderEnabled } from '../src/components/chat/story/storyPromptPresetOrderActions';
import { getStoryPromptOrderList, parseStoryPromptPreset } from '../src/components/chat/story/storyPromptPresetSchema';

const fullPreset = parseStoryPromptPreset({
  chat_completion_source: 'custom',
  custom_url: 'https://ignored.invalid',
  openai_model: 'ignored-model',
  prompts: [
    { identifier: 'style', name: '文风', role: 'system', content: '围绕 {{story.title}} 使用克制的悬疑笔法。', injection_trigger: ['narrator'] },
    { identifier: 'rules', name: '规则插槽', role: 'user', marker: true, injection_trigger: ['director'] },
    { identifier: 'disabled', name: '禁用模块', role: 'system', content: '不应出现' },
  ],
  prompt_order: [{
    character_id: 100001,
    order: [
      { identifier: 'style', enabled: true },
      { identifier: 'rules', enabled: true },
      { identifier: 'disabled', enabled: false },
    ],
  }],
});

assert.equal('custom_url' in fullPreset, false);
assert.equal(fullPreset.prompts.length, 3);

const unrestrictedContent = '任意题材和字段名都原样保留。'.repeat(4_000);
const unrestrictedTrigger = '任意阶段名称'.repeat(20);
const unrestrictedPreset = parseStoryPromptPreset({
  api_key: 'extra-field-is-ignored-without-warning',
  prompts: Array.from({ length: 101 }, (_, index) => ({
    content: index === 100 ? unrestrictedContent : `模块 ${index}`,
    identifier: `unrestricted-${index}`,
    injection_trigger: index === 100 ? [unrestrictedTrigger] : undefined,
    name: index === 100 ? '任意名称'.repeat(100) : `模块 ${index}`,
    role: 'system',
  })),
  prompt_order: [],
  reverse_proxy: 'extra-field-is-ignored-without-warning',
});
assert.equal(unrestrictedPreset.prompts.length, 101);
assert.equal(unrestrictedPreset.prompts[100].content, unrestrictedContent);
assert.equal(unrestrictedPreset.prompts[100].name, '任意名称'.repeat(100));
assert.equal(unrestrictedPreset.prompts[100].injection_trigger?.[0], unrestrictedTrigger);

const definition = createEmptyStoryDefinition(['primary']);
definition.title = '雾港来信';
definition.rules = [createStoryEntry('线索必须能够从前文推出。')];
definition.customPromptEnabled = true;
definition.customPromptMode = 'json';
definition.customPromptPreset = fullPreset;

const narrator = compileStoryCustomPrompt(definition, 'narrator');
assert.match(narrator.system, /雾港来信/);
assert.doesNotMatch(narrator.system, /不应出现/);
assert.equal(narrator.user, '');

const director = compileStoryCustomPrompt(definition, 'director');
assert.match(director.user, /线索必须能够从前文推出/);
assert.equal(director.system, '');

const disabled = setStoryPromptOrderEnabled(fullPreset, 'style', false);
assert.equal(getStoryPromptOrderList(disabled)?.order[0].enabled, false);
assert.equal(getStoryPromptOrderList(fullPreset)?.order[0].enabled, true);
const moved = moveStoryPromptOrderEntry(fullPreset, 0, 1);
assert.equal(getStoryPromptOrderList(moved)?.order[0].identifier, 'rules');

const promptManagerExport = parseStoryPromptPreset({
  version: 1,
  type: 'full',
  data: {
    prompts: [{ identifier: 'manual', name: '导入模块', role: 'user', content: '保留用户选择。' }],
    prompt_order: [{ identifier: 'manual', enabled: true }],
  },
});
assert.equal(getStoryPromptOrderList(promptManagerExport)?.order[0].identifier, 'manual');

const legacy = normalizeStoryDefinition({
  customPrompt: '旧版自定义提示词',
  customPromptEnabled: true,
  participantIds: ['primary'],
  title: '旧故事',
}, [{ id: 'primary', name: '角色' }]);
assert.equal(legacy.customPromptMode, 'manual');
assert.equal(legacy.customPromptManualRole, 'user');
assert.match(compileStoryCustomPrompt(legacy, 'draft').user, /旧版自定义提示词/);

const jsonModeWithoutPreset = normalizeStoryDefinition({
  customPromptMode: 'json',
  participantIds: ['primary'],
  title: '待导入预设的故事',
}, [{ id: 'primary', name: '角色' }]);
assert.equal(jsonModeWithoutPreset.customPromptMode, 'json');
assert.equal(shouldShowStoryPromptJsonSource(jsonModeWithoutPreset.customPromptPreset), true);

const importedPreset = normalizeStoryDefinition({
  customPromptMode: 'json',
  customPromptPreset: fullPreset,
  participantIds: ['primary'],
  title: '导入预设的故事',
}, [{ id: 'primary', name: '角色' }]);
assert.equal(importedPreset.customPromptMode, 'json');
assert.equal(shouldShowStoryPromptJsonSource(importedPreset.customPromptPreset), false);

const longManualPrompt = '手动提示词内容。'.repeat(2_000);
const unrestrictedManual = normalizeStoryDefinition({
  customPrompt: longManualPrompt,
  participantIds: ['primary'],
  title: '长提示词故事',
}, [{ id: 'primary', name: '角色' }]);
assert.equal(unrestrictedManual.customPrompt, longManualPrompt);

console.log('story prompt preset smoke: PASS');
