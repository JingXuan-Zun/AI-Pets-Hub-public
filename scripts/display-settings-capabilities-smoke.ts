import assert from 'node:assert/strict';
import { getPlatformCapability, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

let config = {
  autoMovementEnabled: true,
  companionPets: [{
    autoMovementEnabled: true, currentAction: 'IDLE', enabled: true, id: 'companion-pet-2', modelType: 'live2d', modelUrl: 'D:/m/a.model3.json',
    modelVisible: true, personality: { name: '高冷小桃' }, pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1, stats: {},
  }],
  modelType: '3d',
  personality: { name: '甜心小桃' },
  pointerLookEnabled: true,
  scale: 1,
  settings: {
    autoSpeakResponses: true, chatAvatarSize: 36, chatAvatarsEnabled: true, chatBubbleTransparency: 0, chatFontSize: 14, chatFontWeight: 400,
    chatStreamingEnabled: true, chatUserDisplayName: '', speechPlaybackRate: 1, speechSkipBracketContent: false, uiGlassTransparency: 30,
  },
} as unknown as PetConfig;
const configRef = { current: config };
const context = { configRef, onUpdateConfig: (next: PetConfig) => { config = next; configRef.current = next; }, petId: 'primary' };
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

check(['chat.read_display', 'chat.set_display', 'pets.set_behavior', 'voice.set_reading'].map((id) => getPlatformCapability(id)?.risk), ['read', 'personal', 'personal', 'personal'], 'look-and-sound changes run without a card');
assert.match((await run('chat.read_display')).text, /聊天字号 14/u);
cases++;

await run('chat.set_display', { avatars: false, fontSize: 18, userName: '主人' });
check([config.settings.chatFontSize, config.settings.chatAvatarsEnabled, config.settings.chatUserDisplayName], [18, false, '主人'], 'only the named fields change');
check(config.settings.chatFontWeight, 400, 'others untouched');
await run('chat.set_display', { bubbleTransparency: 140, fontSize: 99 });
check([config.settings.chatFontSize, config.settings.chatBubbleTransparency], [50, 100], 'values clamped to the allowed range');
check((await run('chat.set_display', {})).ok, false, 'nothing to change is refused');

await run('pets.set_behavior', { size: 1.4, wander: false });
check([config.scale, config.autoMovementEnabled, config.pointerLookEnabled], [1.4, false, true], 'the current character');
await run('pets.set_behavior', { followMouse: '关', pet: '高冷小桃', size: 9 });
check([config.companionPets[0].scale, config.companionPets[0].pointerLookEnabled], [4, false], 'Live2D size capped at 4; words like 关 understood');
assert.match((await run('pets.list')).text, /甜心小桃：已启用，大小 1\.4，自由走动关/u);
cases++;

await run('voice.set_reading', { skipBrackets: true, speed: 3 });
check([config.settings.speechPlaybackRate, config.settings.speechSkipBracketContent, config.settings.autoSpeakResponses], [1.6, true, true], 'speed capped, brackets skipped');

console.log(`display settings capabilities smoke ok: ${cases} checks`);
