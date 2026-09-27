import { strict as assert } from 'node:assert';
import {
  createEmptyAgentSkillExternalLoaderIpcContractRegistry,
  getAgentSkillExternalLoaderIpcContractCodes,
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  parseAgentSkillExternalLoaderIpcContractRegistryJson,
  serializeAgentSkillExternalLoaderIpcContractRegistry,
  setAgentSkillExternalLoaderIpcContractCode,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const required = getAgentSkillExternalLoaderRequiredIpcContractCodes();
let registry = createEmptyAgentSkillExternalLoaderIpcContractRegistry();
assert.deepEqual(getAgentSkillExternalLoaderIpcContractCodes(registry), []);

registry = setAgentSkillExternalLoaderIpcContractCode(registry, required[0]!, true, '2026-06-29T23:00:00.000Z');
assert.deepEqual(getAgentSkillExternalLoaderIpcContractCodes(registry), [required[0]]);

registry = setAgentSkillExternalLoaderIpcContractCode(registry, required[0]!, false);
assert.deepEqual(getAgentSkillExternalLoaderIpcContractCodes(registry), []);

const fullRegistry = required.reduce(
  (current, code) => setAgentSkillExternalLoaderIpcContractCode(current, code, true, '2026-06-29T23:01:00.000Z'),
  createEmptyAgentSkillExternalLoaderIpcContractRegistry(),
);
const parsed = parseAgentSkillExternalLoaderIpcContractRegistryJson(serializeAgentSkillExternalLoaderIpcContractRegistry(fullRegistry));
assert.deepEqual(getAgentSkillExternalLoaderIpcContractCodes(parsed).sort(), required.sort());

const ignored = parseAgentSkillExternalLoaderIpcContractRegistryJson(JSON.stringify({
  records: [{ code: 'ipc-arbitrary-channel', reviewedAt: '2026-06-29T23:02:00.000Z' }],
}));
assert.deepEqual(getAgentSkillExternalLoaderIpcContractCodes(ignored), []);

const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillExternalLoaderIpcContractRegistry.ts');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalLoaderIpcContractPanel.tsx');
const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
assert.match(hookSource, /setAgentSkillExternalLoaderIpcContractCode/u);
assert.match(panelSource, /onSetContractCode/u);
assert.match(exchangeSource, /useSettingsAgentSkillExternalLoaderIpcContractRegistry/u);

console.log('agent skill external loader ipc contract registry smoke passed');
