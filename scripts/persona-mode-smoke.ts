// 人格提示词 or 知识记忆人格 (11-19): one or the other per character, switched on the slot or by
// the character herself — which needs the user's approval (risk 'change') and says what changed.
import assert from 'node:assert/strict';
import { PERSONA_MODE_LABELS, readPersonaMode, withPersonaMode } from '../src/personaMode';
import { PET_ROSTER_CAPABILITIES } from '../src/platform-capabilities/petRosterCapabilities';
import type { PetConfig } from '../src/types';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };
const personality = (name: string, neural = false) => ({ beginDialogs: [], chatAvatarUrl: '', chatHistoryMemory: '', customErrorMessage: '', greeting: '', knowledgeBase: '', name, neuralPersonaChatEnabled: neural, systemInstruction: `你是${name}。`, traits: [], userMemory: '', webLearningEnabled: false, webSearchEnabled: false });
let config = {
  companionPets: [{ autoMovementEnabled: true, currentAction: 'IDLE', enabled: true, id: 'pet-2', modelType: '2d', modelUrl: '', modelVisible: true, personality: personality('乙'), pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1, stats: { affection: 50, fatigue: 0, hunger: 0 } }],
  personality: personality('甲'),
  primaryPetEnabled: true,
  settings: {},
} as unknown as PetConfig;

check(readPersonaMode(config.personality) === 'prompt', 'default: 人格提示词');
const switched = withPersonaMode(config, 'pet-2', 'memory');
check(readPersonaMode(switched.companionPets[0].personality) === 'memory' && readPersonaMode(switched.personality) === 'prompt', 'one character switches, the others stay');
check(switched.companionPets[0].personality.systemInstruction === '你是乙。', 'the persona prompt itself is unchanged');
check(withPersonaMode(switched, 'pet-2', 'memory') === switched, 'switching to the current mode changes nothing');

const capability = PET_ROSTER_CAPABILITIES.find((item) => item.id === 'pets.set_persona_mode')!;
check(capability.risk === 'change', 'she has to ask the user first');
check(capability.describe({ mode: 'memory', pet: '乙' }).includes(PERSONA_MODE_LABELS.memory) && capability.describe({ mode: 'memory', pet: '乙' }).includes('切回来'), 'the approval card says what she will do and how to undo it');
let saved: PetConfig | null = null;
const context = { configRef: { current: config }, onUpdateConfig: (next: PetConfig) => { saved = next; }, petId: 'pet-2' } as never;
const result = await capability.run(context, { mode: 'memory' });
check(result.ok && /已把乙切换到「知识记忆人格」/u.test(result.text), 'without a name: the speaking character, and the result says what changed');
check(saved !== null && readPersonaMode((saved as PetConfig).companionPets[0].personality) === 'memory', 'saved');
check(!(await capability.run(context, { mode: 'other' })).ok, 'unknown mode refused');
config = saved!;

console.log(`persona mode smoke ok: ${checks} checks`);
