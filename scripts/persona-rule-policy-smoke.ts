import assert from 'node:assert/strict';
import { resolvePersonaRulePolicy } from '../src/services/personaRulePolicy';

// A persona that sets its own reply rules replaces the app's default format (which shows
// bracketed actions); both word orders of "no action descriptions" count.
const mode = (systemInstruction: string) => resolvePersonaRulePolicy({ dialogueCompletionPreset: undefined, systemInstruction } as never).mode;
assert.equal(mode('说话简短，不要有任何的动作描写'), 'user-defined');
assert.equal(mode('动作描写不要写'), 'user-defined');
assert.equal(mode('禁止括号内容'), 'user-defined');
assert.equal(mode('别写旁白'), 'user-defined');
assert.equal(mode('温柔的大姐姐，喜欢花。'), 'default', 'no rules: the default format still helps');
console.log('persona rule policy smoke ok');
