import assert from 'node:assert/strict';
import { type PetConfig } from '../src/types';
import { buildVoiceWakeTargets, matchVoiceWakeTarget } from '../src/voice/voiceWakeTargets';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

const personality = (name: string, wakeWords = '') => ({
  name, wakeWords, traits: [], greeting: '', systemInstruction: '', chatAvatarUrl: '', beginDialogs: [], customErrorMessage: '',
  userMemory: '', chatHistoryMemory: '', knowledgeBase: '', webSearchEnabled: false, webLearningEnabled: false,
});
const companion = (id: string, name: string, wakeWords = '', enabled = true) => ({ id, enabled, personality: personality(name, wakeWords) });
const config = (generalWords = '', companions = [
  companion('companion-pet-2', '高冷小桃', '高冷'),
  companion('companion-pet-3', '温柔小桃'),
  companion('companion-pet-4', '害羞小桃', '害羞', false),
]) => ({
  personality: personality('甜心小桃', '小桃子，小苗子'),
  companionPets: companions,
  settings: { voiceWakeWords: generalWords },
} as unknown as PetConfig);

const targets = buildVoiceWakeTargets(config('你好'));
check(targets, [
  { phrase: '小桃子', petId: 'primary' },
  { phrase: '小苗子', petId: 'primary' },
  { phrase: '高冷', petId: 'companion-pet-2' },
  { phrase: '温柔小桃', petId: 'companion-pet-3' },
  { phrase: '你好', petId: null },
], 'own phrases, name as default, hidden slot excluded, general phrases last');

const match = (text: string, active: string | null = 'primary', list = targets) => {
  const result = matchVoiceWakeTarget(text, list, active);
  return result && [result.petId, result.remainder];
};
check(match('高冷，现在几点了？'), ['companion-pet-2', '现在几点了？'], 'wakes the named character with remainder');
check(match('小苗子。'), ['primary', ''], 'misheard variant listed as a phrase');
check(match('温柔小桃你好呀', 'companion-pet-2'), ['companion-pet-3', '你好呀'], 'default name phrase');
check(match('你好，在吗', 'companion-pet-2'), [null, '在吗'], 'general phrase wakes the selected character');
check(match('害羞小桃'), null, 'hidden slot does not wake');
check(match('今天天气不错'), null, 'no phrase, no wake');

// Longer phrase wins over a shorter one it contains; on a shared phrase the selected character wins.
const overlapping = buildVoiceWakeTargets(config('小桃', [companion('companion-pet-2', '高冷小桃'), companion('companion-pet-3', '温柔', '小桃子')]));
check(match('高冷小桃在吗', 'primary', overlapping), ['companion-pet-2', '在吗'], 'longer phrase beats general substring');
check(match('小桃子', 'companion-pet-3', overlapping), ['companion-pet-3', ''], 'shared phrase goes to the selected character');
check(match('小桃子', 'companion-pet-2', overlapping), ['primary', ''], 'shared phrase otherwise goes to the first slot');

console.log(`voice wake targets passed: ${cases} cases`);
