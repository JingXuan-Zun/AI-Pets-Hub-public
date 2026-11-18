import assert from 'node:assert/strict';
import { buildAgentPermissionRoute } from '../src/agent/agentPermissionRouter';
import { buildAgentExecutionPlan } from '../src/agent/agentOrchestrator';
import { executeAgentChatCommand, type AgentRuntimeExecutorContext } from '../src/agent/agentRuntimeExecutor';
import { type AgentChatCommand } from '../src/agent/agentChatCommand';
import { desktopPetChatStore } from '../src/chatStore';
import { DEFAULT_LIFE_COMPANION_SETTINGS } from '../src/life-companion/lifeCompanionSettings';
import {
  formatPlatformCapabilityCatalog,
  listPlatformCapabilities,
  registerPlatformCapability,
  runPlatformCapability,
} from '../src/platform-capabilities/platformCapabilityRegistry';
import type { PetConfig } from '../src/types';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

const personality = (name: string, extra: Record<string, unknown> = {}) => ({ name, wakeWords: '', voicePackId: '', ...extra });
const companion = (id: string, name: string, enabled: boolean) => ({
  autoMovementEnabled: true, currentAction: 'IDLE', enabled, id, modelType: '2d', modelUrl: '', modelVisible: enabled,
  personality: personality(name), pointerLookEnabled: true, position: { x: 0, y: 0 }, scale: 1, stats: {},
});
let config = {
  autoMovementEnabled: true,
  companionPets: [companion('companion-pet-2', '高冷小桃', true), companion('companion-pet-3', '温柔小桃', false)],
  currentAction: 'IDLE',
  modelType: '2d',
  modelUrl: '',
  personality: personality('甜心小桃'),
  pointerLookEnabled: true,
  position: { x: 0, y: 0 },
  scale: 1,
  settings: { lifeCompanion: { ...DEFAULT_LIFE_COMPANION_SETTINGS } },
  stats: {},
} as unknown as PetConfig;
const configRef = { current: config };
const onUpdateConfig = (next: PetConfig) => { config = next; configRef.current = next; };
const context = { configRef, onUpdateConfig, petId: 'primary' };
const run = (capability: string, args: Record<string, unknown> = {}) => runPlatformCapability(context, { args, capability });

// Registry: unique ids, every capability describes itself, catalog lines name the risk.
const ids = listPlatformCapabilities().map((capability) => capability.id);
check(new Set(ids).size, ids.length, 'capability ids are unique');
check(formatPlatformCapabilityCatalog().every((line) => /\[(read|personal|change)\]/u.test(line)), true, 'catalog marks read/personal/change');
assert.throws(() => registerPlatformCapability(listPlatformCapabilities()[0]), /already registered/u);
cases++;

// Life companion.
let result = await run('life_companion.screen_watch', { on: true });
check([result.ok, config.settings.lifeCompanion.screenWatchConsented, config.settings.lifeCompanion.desktopActivityAwarenessEnabled], [true, true, true], 'screen watch on');
result = await run('life_companion.screen_watch', { on: false });
check([result.ok, config.settings.lifeCompanion.screenWatchConsented], [true, false], 'screen watch off');
result = await run('life_companion.proactive', { enabled: true });
check([config.settings.lifeCompanion.proactiveEnabled, /惦记/u.test(result.text)], [true, true], 'proactive chat is one switch; the limits are rules');
result = await run('life_companion.quiet_hours', { end: '08:00', start: '23:30' });
check([config.settings.lifeCompanion.quietHoursEnabled, config.settings.lifeCompanion.quietHoursStart, config.settings.lifeCompanion.quietHoursEnd], [true, '23:30', '08:00'], 'quiet hours');
result = await run('life_companion.quiet_hours', { start: '25:00' });
check(result.ok, false, 'bad time rejected');
result = await run('life_companion.status');
assert.match(result.text, /安静时段：23:30–08:00/u);
cases++;

// Wake words and pets.
result = await run('voice.set_wake_words', { pet: '高冷', words: '冰冰，小冰' });
check([result.ok, config.companionPets[0].personality.wakeWords], [true, '冰冰,小冰'], 'wake words by partial name');
result = await run('voice.set_wake_words', { pet: '不存在的角色', words: 'x' });
check(result.ok, false, 'unknown pet rejected');
result = await run('pets.set_presence', { enabled: true, pet: '温柔小桃' });
check([config.companionPets[1].enabled, config.companionPets[1].modelVisible], [true, true], 'enable shows the pet');
result = await run('pets.set_presence', { pet: '甜心小桃', visible: false });
check([result.ok, config.primaryPetModelVisible], [true, false], 'slot 1 can be hidden too');
result = await run('pets.set_presence', { pet: '甜心小桃', visible: true });
check([result.ok, config.primaryPetModelVisible, config.primaryPetEnabled !== false], [true, true, true], 'slot 1 shown again');
result = await run('pets.list');
assert.match(result.text, /温柔小桃：已启用/u);
cases++;

// Chat mode.
result = await run('chat.set_mode', { mode: 'single', pet: '高冷小桃' });
check([result.ok, desktopPetChatStore.getState().chatMode, desktopPetChatStore.getState().activePetId], [true, 'single', 'companion-pet-2'], 'solo chat with a pet');
result = await run('chat.set_mode', { mode: 'group' });
check(desktopPetChatStore.getState().chatMode, 'group', 'group chat');
result = await run('nope.capability');
check(result.ok, false, 'unknown capability');

// Agent tool: read capabilities run silently, changes ask first with a plain-language step.
const command = (capability: string, args: Record<string, unknown>): AgentChatCommand => ({
  capabilityId: 'platform-capabilities',
  instruction: 'test',
  kind: 'tool-call',
  sourceText: '/agent test',
  toolCall: { goal: '', input: { argsJson: JSON.stringify(args), capability }, name: 'use_platform_capability' },
});
check(buildAgentPermissionRoute(command('pets.list', {})).requiresApproval, false, 'read capability needs no approval');
const changeRoute = buildAgentPermissionRoute(command('life_companion.quiet_hours', { end: '07:00', start: '22:00' }));
check(changeRoute.requiresApproval, true, 'change capability needs approval');
check(buildAgentExecutionPlan(command('life_companion.quiet_hours', { end: '07:00', start: '22:00' }))?.steps[0]?.summary,
  '把安静时段设为 22:00–07:00', 'approval shows the plain-language summary');

const runtimeContext = {
  configRef, desktopOrganizationRef: { current: null }, lastDesktopOrganizationPlanRef: { current: null },
  lastLocalProjectInspectionRef: { current: null }, onUpdateConfig, petId: 'primary', startDesktopIconPlacementRef: { current: null },
} as unknown as AgentRuntimeExecutorContext;
const toolResult = await executeAgentChatCommand(command('life_companion.proactive', { enabled: false }), runtimeContext);
check([toolResult.ok, config.settings.lifeCompanion.proactiveEnabled], [true, false], 'agent tool runs the capability');

console.log(`platform capabilities smoke ok: ${cases} checks`);
