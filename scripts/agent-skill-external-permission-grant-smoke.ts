import { strict as assert } from 'node:assert';
import {
  createAgentSkillExternalPermissionDecision,
  createEmptyAgentSkillExternalPermissionGrantRegistry,
  parseAgentSkillExternalPermissionGrantRegistryJson,
  serializeAgentSkillExternalPermissionGrantRegistry,
  setAgentSkillExternalPermissionGrant,
} from '../src/agent';
import { createSignedUpdateFixture, installUpdateDraftLibrary } from './agent-skill-signed-package-update-fixture';

const { signedLibrary } = createSignedUpdateFixture('2026-07-24T04:00:00.000Z', 'permission-key');
const installedRegistry = installUpdateDraftLibrary(signedLibrary);
const packageId = installedRegistry.packages[0]!.id;
const empty = createEmptyAgentSkillExternalPermissionGrantRegistry();

assert.equal(
  createAgentSkillExternalPermissionDecision(empty, installedRegistry, packageId, ['filesystem.read']).status,
  'denied',
);
const granted = setAgentSkillExternalPermissionGrant(empty, installedRegistry, packageId, ['filesystem.read', 'screen.read']);
assert.equal(granted.error, null);
assert.equal(
  createAgentSkillExternalPermissionDecision(granted.registry, installedRegistry, packageId, ['filesystem.read']).status,
  'allowed',
);
const denied = createAgentSkillExternalPermissionDecision(granted.registry, installedRegistry, packageId, ['filesystem.write']);
assert.equal(denied.status, 'denied');
assert.ok(denied.issueCodes.includes('permission-scope-not-granted'));
assert.equal(setAgentSkillExternalPermissionGrant(empty, installedRegistry, packageId, ['unknown.scope']).error, 'Permission grant contains an unsupported scope.');
assert.equal(
  parseAgentSkillExternalPermissionGrantRegistryJson(serializeAgentSkillExternalPermissionGrantRegistry(granted.registry)).grants[0]?.scopes.length,
  2,
);

console.log('agent skill external permission grant smoke passed');
