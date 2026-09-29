const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');

const packageId = 'character.animation@audit-rate-limit';

function createGateway(userDataPath, now) {
  return createExternalSkillCapabilityGateway({
    artifactStore: {
      readPackageArtifact: () => ({
        artifact: { artifactDigest: 'b'.repeat(64) },
        ok: true,
        rawPackageJson: JSON.stringify({ scaffold: { skill: { id: 'character.animation' } } }),
      }),
    },
    now,
    supervisor: { cancelProbe: () => ({ cancelled: false }), runPackageExecution: async () => ({ status: 'succeeded' }) },
    userDataPath,
  });
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-capability-audit-'));
  let nowMs = Date.parse('2026-07-26T12:00:00.000Z');
  const gateway = createGateway(tempRoot, () => nowMs);
  assert.equal(gateway.setGrant({ packageId, scopes: ['storage.read'] }).ok, true);
  fs.writeFileSync(gateway.getPaths().storagePath, JSON.stringify({
    kind: 'external-skill-capability-storage.v1',
    packages: { [packageId]: { 'role.preference': { mood: 'focused' } } },
  }), 'utf8');

  for (let index = 0; index < 20; index += 1) {
    const result = gateway.readStorageValue({
      key: 'role.preference',
      packageId,
      permissionScopes: ['storage.read'],
      requestId: `audit-rate-${index}`,
    });
    assert.equal(result.status, 'succeeded', JSON.stringify(result));
    assert.equal(result.capabilityRateLimit.remaining, 19 - index);
  }

  const persistedGateway = createGateway(tempRoot, () => nowMs);
  const limited = persistedGateway.readStorageValue({
    key: 'role.preference',
    packageId,
    permissionScopes: ['storage.read'],
    requestId: 'audit-rate-limited',
  });
  assert.equal(limited.status, 'rejected');
  assert.equal(limited.error, 'capability_storage_rate_limited');
  assert.equal(limited.capabilityRateLimit.retryAfterMs, 60000);
  assert.equal(limited.capabilityReceipt.status, 'rate-limited');

  const history = persistedGateway.listReceiptHistory({ packageId, limit: 200 });
  assert.equal(history.ok, true);
  assert.equal(history.totalCount, 21);
  assert.equal(history.receipts[0].receiptId, limited.capabilityReceipt.receiptId);
  assert.equal(history.receipts[0].rateLimit.allowed, false);
  assert.equal(fs.existsSync(persistedGateway.getPaths().receiptHistoryPath), true);
  assert.equal(fs.existsSync(persistedGateway.getPaths().rateLimitPath), true);

  nowMs += 60001;
  const recovered = persistedGateway.readStorageValue({
    key: 'role.preference',
    packageId,
    permissionScopes: ['storage.read'],
    requestId: 'audit-rate-recovered',
  });
  assert.equal(recovered.status, 'succeeded');
  assert.equal(recovered.capabilityRateLimit.remaining, 19);

  const errorPackageId = 'character.animation@audit-error-budget';
  assert.equal(persistedGateway.setGrant({ packageId: errorPackageId, scopes: ['storage.read'] }).ok, true);
  const invalidKey = persistedGateway.readStorageValue({
    key: '../role.preference',
    packageId: errorPackageId,
    permissionScopes: ['storage.read'],
    requestId: 'audit-invalid-key',
  });
  assert.equal(invalidKey.error, 'capability_storage_key_invalid');
  assert.equal(invalidKey.capabilityRateLimit.remaining, 19);
  const missingKey = persistedGateway.readStorageValue({
    key: 'role.missing',
    packageId: errorPackageId,
    permissionScopes: ['storage.read'],
    requestId: 'audit-missing-key',
  });
  assert.equal(missingKey.error, 'capability_storage_key_not_found');
  assert.equal(missingKey.capabilityRateLimit.remaining, 18);

  const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  const typeSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'vite-env.d.ts'), 'utf8');
  assert.match(ipcSource, /desktop-pet:list-skill-capability-receipts/u);
  assert.match(ipcSource, /desktop-pet:clear-skill-capability-receipts/u);
  assert.match(preloadSource, /listSkillCapabilityReceipts/u);
  assert.match(preloadSource, /clearSkillCapabilityReceipts/u);
  assert.match(typeSource, /external-skill-capability-receipt-history\.v1/u);

  const cleared = persistedGateway.clearReceiptHistory({ packageId });
  assert.equal(cleared.ok, true);
  assert.equal(cleared.removedCount, 22);
  assert.equal(persistedGateway.listReceiptHistory({ packageId }).totalCount, 0);
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

run().then(() => console.log('agent skill capability audit rate limit smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
