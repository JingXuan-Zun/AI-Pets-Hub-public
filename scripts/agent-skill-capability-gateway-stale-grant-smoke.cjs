const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-capability-stale-'));
  const artifactStore = {
    readPackageArtifact: () => ({
      ok: true,
      rawPackageJson: JSON.stringify({ scaffold: { skill: { id: 'character.animation' } } }),
    }),
  };
  const supervisor = { runPackageExecution: async () => ({ status: 'succeeded' }) };
  const gateway = createExternalSkillCapabilityGateway({ artifactStore, supervisor, userDataPath: tempRoot });
  const grant = gateway.setGrant({ packageId: 'character.animation@stale', scopes: ['filesystem.read'] });
  assert.equal(grant.ok, true);
  const grantsPath = gateway.getPaths().grantPath;
  const registry = JSON.parse(fs.readFileSync(grantsPath, 'utf8'));
  registry.grants[0].skillId = 'different.skill';
  fs.writeFileSync(grantsPath, JSON.stringify(registry), 'utf8');
  const decision = gateway.decide({ packageId: 'character.animation@stale', permissionScopes: ['filesystem.read'] });
  assert.equal(decision.status, 'denied');
  assert.ok(decision.issueCodes.includes('permission_grant_stale'));
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

run().then(() => console.log('agent skill capability gateway stale grant smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
