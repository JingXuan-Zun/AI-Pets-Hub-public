import assert from 'node:assert/strict';
import { addDesktopPetSlot, getDesktopPetSlots } from '../src/multiPetRoster';
import { type PetConfig } from '../src/types';
import { resolvePetVoiceSettings } from '../src/voice/petVoiceSettings';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// Minimal config: only the fields the slot roster and the voice resolver read.
const personality = (name: string, voicePackId?: string) => ({
  name, traits: [], greeting: '', systemInstruction: '', chatAvatarUrl: '', beginDialogs: [], customErrorMessage: '',
  userMemory: '', chatHistoryMemory: '', knowledgeBase: '', webSearchEnabled: false, webLearningEnabled: false, voicePackId,
});
const base = {
  personality: personality('主角色'),
  companionPets: [],
  settings: { ttsProvider: 'gpt-sovits', gptSovitsModelId: 'xiaoling' },
} as unknown as PetConfig;

const withSlot = addDesktopPetSlot(base);
const companionId = getDesktopPetSlots(withSlot)[1]?.id ?? '';
check(Boolean(companionId), true, 'companion slot added');
check(getDesktopPetSlots(withSlot)[1]?.personality.voicePackId, '', 'a new slot starts on the global voice');

const config = {
  ...withSlot,
  personality: personality('主角色', ' yunxi-lite '),
  companionPets: withSlot.companionPets.map((pet) => ({ ...pet, personality: { ...pet.personality, voicePackId: 'xiaoxiao-lite' } })),
} as PetConfig;
check(resolvePetVoiceSettings(config, 'primary').gptSovitsModelId, 'yunxi-lite', 'primary uses its own pack (trimmed)');
check(resolvePetVoiceSettings(config, companionId).gptSovitsModelId, 'xiaoxiao-lite', 'companion uses its own pack');
check(resolvePetVoiceSettings(config, 'missing-slot').gptSovitsModelId, 'xiaoling', 'unknown slot falls back to global');
check(resolvePetVoiceSettings(config, null).gptSovitsModelId, 'xiaoling', 'no pet falls back to global');
check(config.settings.gptSovitsModelId, 'xiaoling', 'global settings are not mutated');

const followGlobal = { ...config, personality: personality('主角色', '') } as PetConfig;
check(resolvePetVoiceSettings(followGlobal, 'primary'), followGlobal.settings, 'empty pack returns the global settings object');

const edge = { ...config, settings: { ...config.settings, ttsProvider: 'edge' } } as PetConfig;
check(resolvePetVoiceSettings(edge, 'primary'), edge.settings, 'packs only apply to the character voice provider');

console.log(`pet voice settings passed: ${cases} cases`);
