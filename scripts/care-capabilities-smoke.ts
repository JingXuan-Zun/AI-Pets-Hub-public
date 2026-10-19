import assert from 'node:assert/strict';
import { getPlatformCapability, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

const slot = (id: string, name: string, stats: Record<string, number>, enabled = true) => ({
  autoMovementEnabled: true, currentAction: 'IDLE', enabled, id, modelType: '2d', modelUrl: '', modelVisible: enabled,
  personality: { name }, pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1, stats,
});
let config = {
  ...slot('primary', '甜心小桃', { affection: 50, fatigue: 30, hunger: 85 }),
  companionPets: [slot('companion-pet-2', '高冷小桃', { affection: 60, fatigue: 80, hunger: 10 }), slot('companion-pet-3', '睡着的小桃', { affection: 0, fatigue: 0, hunger: 0 }, false)],
  settings: {},
} as unknown as PetConfig;
const configRef = { current: config };
const context = { configRef, onUpdateConfig: (next: PetConfig) => { config = next; configRef.current = next; }, petId: 'primary' };
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

check([getPlatformCapability('pets.status')?.risk, getPlatformCapability('pets.feed')?.risk], ['read', 'personal'], 'status reads, feeding needs no card');
const status = (await run('pets.status')).text;
assert.match(status, /甜心小桃：饥饿 85.*（饿了）/u);
assert.match(status, /高冷小桃：.*很饱.*有点累/u);
assert.doesNotMatch(status, /睡着的小桃/u);
cases += 3;

const fed = await run('pets.feed', { food: '蛋糕' });
check(fed.ok, true, 'the current pet is fed');
assert.match(fed.text, /甜心小桃 吃了蛋糕：饥饿 85 → 80/u);
cases++;
check(config.stats.hunger < 85 && config.stats.affection > 50, true, 'hunger down, affection up');
const full = await run('pets.feed', { pet: '高冷小桃' });
check([full.ok, /很饱/u.test(full.text)], [false, true], 'a full pet turns it down');
check((await run('pets.feed', { pet: '不存在' })).ok, false, 'unknown pet refused');

console.log(`care capabilities smoke ok: ${cases} checks`);
