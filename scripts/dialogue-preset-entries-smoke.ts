import assert from 'node:assert/strict';
import { listPresetEntries, setPresetEntryEnabled } from '../src/services/dialogueCompletionPresetEntries';
import { resolveDialogueCompletionPresetText } from '../src/services/dialogueCompletionPresetText';

// Entry switches for a pasted SillyTavern preset: listed in the preset's order, markers left
// out, and switching one off removes its text from what the model gets.
const preset = JSON.stringify({
  prompt_order: [
    { character_id: 100000, order: [{ enabled: true, identifier: 'style' }] },
    { character_id: 100001, order: [
      { enabled: true, identifier: 'style' },
      { enabled: true, identifier: 'chatHistory' },
      { enabled: true, identifier: 'options' },
      { enabled: false, identifier: 'nsfw' },
    ] },
  ],
  prompts: [
    { content: '文风：短句。', identifier: 'style', name: '文风' },
    { identifier: 'chatHistory', marker: true, name: 'Chat History' },
    { content: '回复末尾输出 <SUOT> 选项。', identifier: 'options', name: '📘选项' },
    { content: '关掉的条目', identifier: 'nsfw', name: '其他' },
  ],
});
assert.deepEqual(listPresetEntries(preset), [
  { enabled: true, identifier: 'style', name: '文风' },
  { enabled: true, identifier: 'options', name: '📘选项' },
  { enabled: false, identifier: 'nsfw', name: '其他' },
]);
const withoutOptions = setPresetEntryEnabled(preset, 'options', false);
assert.equal(listPresetEntries(withoutOptions)?.find((entry) => entry.identifier === 'options')?.enabled, false);
assert.doesNotMatch(resolveDialogueCompletionPresetText(withoutOptions, '铃音'), /SUOT/u);
assert.match(resolveDialogueCompletionPresetText(withoutOptions, '铃音'), /文风/u);
assert.equal(listPresetEntries('只用纯文本回复'), null, 'plain-text presets get no switches');
assert.equal(setPresetEntryEnabled('不是 JSON', 'x', false), '不是 JSON');
console.log('dialogue preset entries smoke ok');
