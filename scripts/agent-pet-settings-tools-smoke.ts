import assert from 'node:assert/strict';
import {
  cloneAgentPetSettingsValue,
  collectAgentPetSettingsPaths,
  doesAgentPetSettingsValueTypeMatch,
  formatAgentPetSettingsValue,
  getAgentPetSettingsValueAtPath,
  parseAgentPetSettingsPath,
  setAgentPetSettingsValueAtPath,
} from '../src/agent/agentPetSettingsValueTree.ts';
import { buildAgentPermissionRoute } from '../src/agent/agentPermissionRouter.ts';
import { executeGetPetSettings } from '../src/agent/agentRuntimePetSettingsTools.ts';
import type { AgentRuntimeExecutorContext } from '../src/agent/agentRuntimeExecutor.ts';
import type { AgentToolCallCommand } from '../src/agent/agentChatCommand.ts';
import { prepareAgentToolInput } from '../src/agent/agentToolInputSchema.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const config = {
  autoMovementEnabled: true,
  companionPets: [{ autoMovementEnabled: true, scale: 1 }],
  scale: 1,
  settings: {
    geminiApiKey: 'do-not-show-this-secret',
    memoryDepth: 16384,
  },
};

const paths = collectAgentPetSettingsPaths(config);
assert.deepEqual(paths.sort(), [
  'autoMovementEnabled',
  'companionPets.0.autoMovementEnabled',
  'companionPets.0.scale',
  'scale',
  'settings.geminiApiKey',
  'settings.memoryDepth',
].sort());
assert.deepEqual(parseAgentPetSettingsPath('companionPets.0.scale'), ['companionPets', 0, 'scale']);
assert.equal(parseAgentPetSettingsPath('settings.__proto__.value'), null);
assert.equal(getAgentPetSettingsValueAtPath(config, ['settings', 'memoryDepth']).value, 16384);
assert.equal(formatAgentPetSettingsValue(config.settings.geminiApiKey, 'settings.geminiApiKey'), '已设置（已隐藏）');
const nestedSensitiveValue = formatAgentPetSettingsValue({
  settings: config.settings,
  customModelRequestParams: [{ key: 'api_key', value: 'another-secret', valueType: 'api_key' }],
}, '');
assert.doesNotMatch(nestedSensitiveValue, /do-not-show-this-secret|another-secret/u);
assert.match(nestedSensitiveValue, /已设置（已隐藏）/u);
assert.equal(doesAgentPetSettingsValueTypeMatch(config.scale, 1.25), true);
assert.equal(doesAgentPetSettingsValueTypeMatch(config.scale, 'large'), false);

const draft = cloneAgentPetSettingsValue(config);
assert.equal(setAgentPetSettingsValueAtPath(draft, ['settings', 'memoryDepth'], 4096), true);
assert.equal(setAgentPetSettingsValueAtPath(draft, ['companionPets', 0, 'autoMovementEnabled'], false), true);
assert.equal(draft.settings.memoryDepth, 4096);
assert.equal(draft.companionPets[0].autoMovementEnabled, false);
assert.equal(config.settings.memoryDepth, 16384);
assert.equal(setAgentPetSettingsValueAtPath(draft, ['settings', 'missing'], true), false);

const preparedUpdate = prepareAgentToolInput('update_pet_settings', {
  changes: {
    autoMovementEnabled: false,
    'settings.memoryDepth': 8192,
  },
});
assert.equal(preparedUpdate.ok, true);
if (preparedUpdate.ok) {
  assert.equal(preparedUpdate.input.changesJson, '{"autoMovementEnabled":false,"settings.memoryDepth":8192}');
}

const updateCommand = {
  capabilityId: 'pet-settings',
  instruction: '关闭自动移动',
  kind: 'tool-call' as const,
  sourceText: '关闭自动移动',
  toolCall: {
    input: { changesJson: '{"autoMovementEnabled":false}' },
    name: 'update_pet_settings' as const,
  },
};
const updateRoute = buildAgentPermissionRoute(updateCommand);
assert.equal(updateRoute.status, 'needs-approval');
assert.equal(updateRoute.maxRisk, 'reversible-write');

const readCommand = {
  capabilityId: 'pet-settings',
  instruction: '读取桌宠配置',
  kind: 'tool-call' as const,
  sourceText: '读取桌宠配置',
  toolCall: {
    input: { path: 'scale' },
    name: 'get_pet_settings' as const,
  },
};
const readRoute = buildAgentPermissionRoute(readCommand);
assert.equal(readRoute.status, 'silent');
assert.equal(readRoute.maxRisk, 'read');

const historyHeavyConfig = {
  directedRelationshipRepository: Object.fromEntries(
    Array.from({ length: 220 }, (_, index) => [`trace${index}`, index]),
  ),
  settings: {
    chatBracketOuterTextColor: '#0f766e',
  },
};
const chatColorLookup = executeGetPetSettings(
  { configRef: { current: historyHeavyConfig } } as unknown as AgentRuntimeExecutorContext,
  {
    input: { query: '聊天文字颜色' },
    name: 'get_pet_settings',
  } as AgentToolCallCommand,
);
assert.match(chatColorLookup.responseText, /settings\.chatBracketOuterTextColor = "#0f766e"/u);
assert.match(chatColorLookup.verification ?? '', /读取 1 个路径/u);

const { runtimeSource } = readProjectSources({
  runtimeSource: 'src/agent/agentRuntimePetSettingsTools.ts',
});
assert.match(runtimeSource, /normalizePetConfig\(draft\)/u);
assert.match(runtimeSource, /runtime\.onUpdateConfig\(normalizedConfig\)/u);
assert.match(runtimeSource, /已规范化、保存并回读/u);

console.log('agent pet settings tools smoke ok');