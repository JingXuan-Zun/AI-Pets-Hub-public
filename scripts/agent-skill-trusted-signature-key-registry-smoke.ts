import { strict as assert } from 'node:assert';
import {
  createEmptyAgentSkillTrustedSignatureKeyRegistry,
  parseAgentSkillTrustedSignatureKeyRegistryJson,
  removeAgentSkillTrustedSignatureKey,
  serializeAgentSkillTrustedSignatureKeyRegistry,
  upsertAgentSkillTrustedSignatureKey,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const empty = createEmptyAgentSkillTrustedSignatureKeyRegistry();
assert.equal(empty.kind, 'agent-skill-trusted-signature-key-registry.v1');
assert.equal(empty.keys.length, 0);

const first = upsertAgentSkillTrustedSignatureKey(empty, {
  algorithm: 'ed25519',
  keyId: 'local-test-key',
  label: 'Local test key',
  publicKey: '-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----',
}, '2026-06-29T15:00:00.000Z');
assert.equal(first.error, null);
assert.equal(first.registry.keys[0]?.label, 'Local test key');

const replaced = upsertAgentSkillTrustedSignatureKey(first.registry, {
  algorithm: 'ed25519',
  keyId: 'local-test-key',
  label: 'Replacement key',
  publicKey: 'replacement-public-key',
}, '2026-06-29T15:01:00.000Z');
assert.equal(replaced.registry.keys.length, 1);
assert.equal(replaced.registry.keys[0]?.label, 'Replacement key');

const parsed = parseAgentSkillTrustedSignatureKeyRegistryJson(
  serializeAgentSkillTrustedSignatureKeyRegistry(replaced.registry),
);
assert.equal(parsed.keys[0]?.keyId, 'local-test-key');
assert.equal(removeAgentSkillTrustedSignatureKey(parsed, 'local-test-key').keys.length, 0);

const ignoredInvalid = parseAgentSkillTrustedSignatureKeyRegistryJson(JSON.stringify({
  kind: 'agent-skill-trusted-signature-key-registry.v1',
  keys: [{ algorithm: 'rsa', keyId: 'bad', publicKey: 'bad' }],
}));
assert.equal(ignoredInvalid.keys.length, 0);

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const securityPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
const trustedPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillTrustedSignatureKeyPanel.tsx');
const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillTrustedSignatureKeyRegistry.ts');
assert.match(exchangeSource, /SettingsAgentSkillPackageSecurityPanels/u);
assert.match(exchangeSource, /useSettingsAgentSkillTrustedSignatureKeyRegistry/u);
assert.match(securityPanelSource, /SettingsAgentSkillTrustedSignatureKeyPanel/u);
assert.match(trustedPanelSource, /Trusted signature keys/u);
assert.match(hookSource, /desktop-pet\.agent-skill-trusted-signature-key-registry\.v1/u);

console.log('agent skill trusted signature key registry smoke passed');
