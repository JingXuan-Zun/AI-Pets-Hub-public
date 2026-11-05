import assert from 'node:assert/strict';
import { activeDialogueCompletionPreset } from '../src/services/dialogueCompletionPresetText';
import { resolvePersonaRulePolicy } from '../src/services/personaRulePolicy';

// A persona that sets its own reply rules replaces the app's default format (which shows
// bracketed actions); both word orders of "no action descriptions" count.
const mode = (systemInstruction: string) => resolvePersonaRulePolicy({ dialogueCompletionPreset: undefined, systemInstruction } as never).mode;
assert.equal(mode('说话简短，不要有任何的动作描写'), 'user-defined');
assert.equal(mode('动作描写不要写'), 'user-defined');
assert.equal(mode('禁止括号内容'), 'user-defined');
assert.equal(mode('别写旁白'), 'user-defined');
assert.equal(mode('温柔的大姐姐，喜欢花。'), 'default', 'no rules: the default format still helps');
// The preset switch: off keeps the preset text but sends (and counts) only the persona prompt.
const withPreset = { dialogueCompletionPreset: '回复必须只用纯文本，禁止括号内容。', systemInstruction: '温柔的大姐姐，喜欢花。' };
assert.equal(resolvePersonaRulePolicy(withPreset).mode, 'user-defined', 'the preset counts while it is on');
assert.equal(resolvePersonaRulePolicy({ ...withPreset, dialogueCompletionPresetEnabled: false }).mode, 'default', 'switched off, only the persona prompt counts');
assert.equal(activeDialogueCompletionPreset({ ...withPreset, dialogueCompletionPresetEnabled: false }), '', 'nothing is sent when off');
assert.equal(activeDialogueCompletionPreset(withPreset), withPreset.dialogueCompletionPreset, 'missing switch = on (older characters keep their preset)');
console.log('persona rule policy smoke ok');
