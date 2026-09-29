import assert from 'node:assert/strict';
import { buildTriggeredSpeechPrompt } from '../src/services/triggeredSpeechPrompt';
import { type PetAutoSpeechTrigger, type PetPersonality } from '../src/types';

const personality: PetPersonality = {
  name: 'Night Voyager',
  traits: ['calm'],
  greeting: 'Hello.',
  systemInstruction: 'Speak in a restrained, low, almost bridge-comms tone. Call the user Commander. Do not act cute or clingy.',
  chatAvatarUrl: '',
  beginDialogs: [],
  customErrorMessage: '',
  userMemory: '',
  chatHistoryMemory: '',
  knowledgeBase: '',
  webSearchEnabled: false,
  webLearningEnabled: false,
};

const trigger: PetAutoSpeechTrigger = {
  kind: 'high-hunger-coax',
  hungryDurationMs: 8 * 60 * 1000,
  stats: {
    affection: 64,
    hunger: 96,
    fatigue: 41,
  },
};

const prompt = buildTriggeredSpeechPrompt(trigger, personality);

assert.ok(prompt.includes('Current speaking role: Night Voyager.'));
assert.ok(prompt.includes('Continue using the current role personality prompt'));
assert.ok(prompt.includes('highest-priority source for tone, relationship, prohibitions, worldbuilding, and reply format'));
assert.ok(prompt.includes('Status event: hunger has stayed high for a while, so the character needs to remind the user again.'));
assert.ok(prompt.includes('The character has been clearly hungry for 8 minutes.'));
assert.ok(prompt.includes('the exact wording must still come from the current role personality prompt'));

for (const legacyPhrase of [
  'cute',
  'clingy',
  'companion tone',
  '8 to 24 Chinese characters',
  'like a pet proactively speaking up',
]) {
  assert.ok(!prompt.includes(legacyPhrase), `triggered speech prompt should not force legacy voice phrase: ${legacyPhrase}`);
}

console.log('triggered speech persona prompt smoke ok');
