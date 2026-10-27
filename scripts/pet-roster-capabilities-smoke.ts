import assert from 'node:assert/strict';
import { getPlatformCapability, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

const personality = (name: string) => ({ name, systemInstruction: `你现在扮演桌宠“${name}”。`, traits: [] });
let config = {
  autoMovementEnabled: true,
  companionPets: [{
    autoMovementEnabled: true, currentAction: 'IDLE', enabled: true, id: 'companion-pet-2', modelType: '3d', modelUrl: 'D:/m/a.vrm',
    modelVisible: true, personality: personality('高冷小桃'), pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1, stats: { affection: 50, fatigue: 0, hunger: 0 },
  }],
  customModelPresets: [
    { id: 'p1', name: '茉莉安-纯白恋羽', type: '3d', url: 'D:/m/a.vrm' },
    { id: 'p2', name: '康熙 Kawaii Strike', type: '3d', url: 'D:/m/k.pmx' },
    { id: 'p3', name: 'Ace.model3', type: 'live2d', url: 'D:/m/Ace.model3.json' },
  ],
  modelType: '2d',
  modelUrl: 'D:/m/v.webm',
  personality: personality('甜心小桃'),
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  settings: {},
  stats: { affection: 50, fatigue: 0, hunger: 0 },
} as unknown as PetConfig;
const configRef = { current: config };
let persisted = 0;
const context = {
  configRef,
  onUpdateConfig: (next: PetConfig, options?: { persist?: boolean }) => { config = next; configRef.current = next; if (options?.persist) persisted++; },
  petId: 'primary',
};
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

// Switching a model only changes how she looks (no asking, 2026-10-20); creating a pet still asks.
check(['models.list', 'pets.set_model', 'pets.create'].map((id) => getPlatformCapability(id)?.risk), ['read', 'personal', 'change'], 'a new pet asks first; a model switch does not');
assert.match((await run('models.list')).text, /茉莉安-纯白恋羽（3D）：高冷小桃在用[\s\S]*康熙 Kawaii Strike（3D）\n[\s\S]*Ace\.model3（Live2D）/u);
cases++;

check((await run('pets.set_model', { model: '康熙' })).ok, true, 'the current character, model by partial name');
check([config.modelType, config.modelUrl], ['3d', 'D:/m/k.pmx'], 'main character now uses the MMD model');
await run('pets.set_model', { model: 'ace', pet: '高冷小桃' });
check([config.companionPets[0].modelType, config.companionPets[0].modelUrl], ['live2d', 'D:/m/Ace.model3.json'], 'another character by name, case ignored');
assert.match((await run('pets.set_model', { model: 'Ace', pet: '高冷小桃' })).text, /已经在用/u);
cases++;
check((await run('pets.set_model', { model: '不存在' })).ok, false, 'unknown model refused');

const created = await run('pets.create', { model: '茉莉安', name: '小雪', personality: '温柔，说话轻声细语。' });
check(created.ok, true, 'created');
const snow = config.companionPets.at(-1)!;
check([snow.personality.name, snow.modelUrl, snow.enabled, snow.modelVisible], ['小雪', 'D:/m/a.vrm', true, true], 'named, modelled, on the desktop');
assert.match(snow.personality.systemInstruction, /扮演桌宠“小雪”。温柔，说话轻声细语。/u);
cases++;
await run('pets.create', { name: '小风' });
const wind = config.companionPets.at(-1)!;
check([wind.personality.name, wind.modelUrl], ['小风', 'D:/m/k.pmx'], 'no model: same as the main character');
assert.doesNotMatch(wind.personality.systemInstruction, /桌宠 \d/u);
cases++;
check((await run('pets.create', { name: '小雪' })).ok, false, 'duplicate names refused');
check((await run('pets.create', { model: '不存在', name: '小雨' })).ok, false, 'unknown model refused before creating');
check(config.companionPets.length, 3, 'refusals add nothing');
check(persisted, 4, 'every change is saved');

// Switching the private chat to another character: the one who switched only hands over.
const handover = await run('chat.set_mode', { mode: 'single', pet: '高冷小桃' });
check(handover.ok, true, 'switching to another character works');
assert.match(handover.text, /由高冷小桃和用户单聊[\s\S]*不要扮演高冷小桃/u);
check((await run('chat.set_mode', { mode: 'group' })).text, '已切换到群聊模式。', 'a plain mode switch needs no hand-over');

console.log(`pet roster capabilities smoke ok: ${cases} checks`);
