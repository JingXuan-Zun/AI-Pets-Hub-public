import assert from 'node:assert/strict';

import { migrateLegacyAgentRuntimeSettings } from '../src/legacyPetConfigMigration.ts';

const migrated = migrateLegacyAgentRuntimeSettings({
  agentRuntimeMode: 'v3-experimental',
  avatar3dRuntimeBackend: 'three',
  memoryDepth: 4096,
});

assert.equal(migrated.legacyAgentRuntimeMode, 'v3-experimental');
assert.equal('agentRuntimeMode' in migrated.activeSettings, false);
assert.equal(migrated.activeSettings.avatar3dRuntimeBackend, 'three');
assert.equal(migrated.activeSettings.memoryDepth, 4096);

console.log('agent runtime legacy config migration smoke ok');
