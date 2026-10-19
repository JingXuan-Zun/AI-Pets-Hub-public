import assert from 'node:assert/strict';
import { resolveDialogueCompletionPresetText } from '../src/services/dialogueCompletionPresetText';
import { resolvePersonaRulePolicy } from '../src/services/personaRulePolicy';

// A pasted SillyTavern preset sends only its enabled entries, in its own order; plain text and
// broken JSON are used as written.
const preset = JSON.stringify({
  prompt_order: [
    { character_id: 100000, order: [{ enabled: true, identifier: 'off' }] },
    { character_id: 100001, order: [
      { enabled: true, identifier: 'style' },
      { enabled: false, identifier: 'off' },
      { enabled: true, identifier: 'chatHistory' },
      { enabled: true, identifier: 'rules' },
    ] },
  ],
  prompts: [
    { content: '规则：{{char}}称呼{{user}}为主人。{{// 作者注释}}', identifier: 'rules' },
    { content: '这条是关闭的，不能出现。', identifier: 'off' },
    { identifier: 'chatHistory', marker: true },
    { content: '文风：短句。', identifier: 'style' },
  ],
  temperature: 1,
});
assert.equal(resolveDialogueCompletionPresetText(preset, '铃音'), '文风：短句。\n\n规则：铃音称呼用户为主人。');
assert.equal(resolveDialogueCompletionPresetText('  只用纯文本回复。 ', '铃音'), '只用纯文本回复。');
assert.equal(resolveDialogueCompletionPresetText('{不是 JSON', '铃音'), '{不是 JSON');
assert.equal(resolveDialogueCompletionPresetText('', '铃音'), '');

const policy = resolvePersonaRulePolicy({ dialogueCompletionPreset: preset, name: '铃音', systemInstruction: '你是铃音。' });
assert.ok(!policy.sourceText.includes('这条是关闭的'), 'the rule contract does not repeat disabled entries');
assert.ok(!policy.sourceText.includes('temperature'), 'the rule contract does not repeat sampler settings');
console.log('dialogue preset text smoke ok');
