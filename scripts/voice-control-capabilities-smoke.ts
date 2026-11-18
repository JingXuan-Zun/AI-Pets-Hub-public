import assert from 'node:assert/strict';
import { capabilityToolName, listConversationToolDefinitions } from '../src/agent/conversation/conversationTools';
import { listPlatformCapabilities, runPlatformCapability } from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PlatformCapabilityContext } from '../src/platform-capabilities/platformCapabilityTypes';
import type { PetConfig } from '../src/types';
import { getVoiceInputSessionController, registerVoiceInputSessionController } from '../src/voice/voiceInputSessionControl';

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };

let config = {
  companionPets: [], personality: { name: '小桃' },
  settings: { autoSpeakResponses: true, sttProvider: 'browser', ttsProvider: 'gpt-sovits', voiceEnabled: true, voiceInputEnabled: true },
} as unknown as PetConfig;
let saves = 0;
const context: PlatformCapabilityContext = {
  configRef: { get current() { return config; }, set current(next) { config = next; } },
  onUpdateConfig: (next, options) => { config = next; if (options?.persist) saves += 1; },
  petId: 'primary',
};
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

// The five switches exist, and reach the model as tools of the conversation loop.
const ids = ['voice.status', 'voice.set_input', 'voice.listen', 'voice.set_source', 'voice.warmup'];
const registered = new Map(listPlatformCapabilities().map((capability) => [capability.id, capability]));
check(ids.filter((id) => !registered.has(id)), [], 'all five are registered');
const tools = listConversationToolDefinitions({ configRef: context.configRef, petId: 'primary' } as never).map((tool) => tool.function.name);
check(ids.filter((id) => !tools.includes(capabilityToolName(id))), [], 'the model is offered all five');
check(ids.map((id) => registered.get(id)?.risk), ['read', 'personal', 'personal', 'personal', 'read'], 'none of them asks for a confirmation card');

// Status says what is on and where the voice comes from.
const status = await run('voice.status');
check(status.ok, true, 'status reads');
assert.match(status.text, /朗读总开关：开/u);
assert.match(status.text, /GPT-SoVITS 角色音色/u);
assert.match(status.text, /语音输入：开/u);
checks += 3;

// Listening goes through the chat layer's controller.
const calls: string[] = [];
check((await run('voice.listen', { action: 'start' })).ok, false, 'no controller yet: says so instead of pretending');
const unregister = registerVoiceInputSessionController({
  start: () => { calls.push('start'); return { ok: true, responseText: '在听了。' }; },
  stop: () => { calls.push('stop'); return { ok: true, responseText: '不听了。' }; },
});
check((await run('voice.listen', { action: 'start' })).text, '在听了。', 'start listening');
check((await run('voice.listen', { action: 'stop' })).text, '不听了。', 'stop listening');
check((await run('voice.listen', { action: 'pause' })).ok, false, 'an unknown action is refused');
check(calls, ['start', 'stop'], 'the controller was called once each');

// The switch: off also stops listening, is saved, and blocks a new start.
saves = 0;
check((await run('voice.set_input', { enabled: false })).ok, true, 'switch off');
check([config.settings.voiceInputEnabled, saves, calls.at(-1)], [false, 1, 'stop'], 'off is saved and the microphone is released');
const blocked = await run('voice.listen', { action: 'start' });
check([blocked.ok, calls.filter((call) => call === 'start').length], [false, 1], 'cannot start listening while the switch is off');
check((await run('voice.set_input', { enabled: true })).ok, true, 'switch on');
check(config.settings.voiceInputEnabled, true, 'on is applied');
check((await run('voice.set_input', {})).ok, false, 'on or off must be said');

// Where the reading voice comes from.
saves = 0;
const switched = await run('voice.set_source', { source: 'browser' });
check([switched.ok, config.settings.ttsProvider, config.settings.voiceEnabled, saves], [true, 'browser', true, 1], 'source switched and saved, reading left on');
assert.match(switched.text, /Edge-TTS/u);
checks += 1;
await run('voice.set_source', { source: 'gpt-sovits', voiceEnabled: false });
check([config.settings.ttsProvider, config.settings.voiceEnabled], ['gpt-sovits', false], 'can turn reading off in the same call');
check((await run('voice.set_source', { source: 'robot' })).ok, false, 'an unknown source is refused');
check(config.settings.ttsProvider, 'gpt-sovits', 'and changes nothing');

unregister();
check(getVoiceInputSessionController(), null, 'the controller is taken away with the window');

console.log(`voice control capabilities smoke ok: ${checks} checks`);
