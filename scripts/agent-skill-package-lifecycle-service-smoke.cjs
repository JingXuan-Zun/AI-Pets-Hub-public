const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');
const { createExternalSkillPackageLifecycleService } = require('../electron/externalSkillPackageLifecycleService.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function signPackage(packageValue, privateKey) {
  const payload = JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: packageValue,
  }));
  return {
    ...packageValue,
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-v1',
      keyId: 'lifecycle-test-key',
      signature: crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'),
    },
  };
}

const addOneWasm = Buffer.from(
  '0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b',
  'hex',
).toString('base64');

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-skill-lifecycle-service-'));
  const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
  const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
  const supervisor = {
    cancelProbe: () => ({ cancelled: false }),
    runPackageExecution: async (request) => ({
      output: { value: Number(request.input?.value || 0) + 1 },
      packageCodeLoaded: true,
      packageId: request.packageId,
      requestId: request.requestId,
      status: 'succeeded',
    }),
  };
  const gateway = createExternalSkillCapabilityGateway({
    artifactStore,
    hostContext: { arch: 'x64', packaged: true, platform: 'win32' },
    supervisor,
    userDataPath: tempRoot,
  });
  const lifecycle = createExternalSkillPackageLifecycleService({
    artifactStore,
    capabilityGateway: gateway,
    signedInstallCoordinator: coordinator,
    userDataPath: tempRoot,
  });
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const packageId = 'character.animation@lifecycle-service';
  const packageValue = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: { entrypoint: 'run', kind: 'wasm-pure-i32-v1', moduleBase64: addOneWasm },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  const rawPackageJson = JSON.stringify(packageValue);
  const trustedKeyRegistry = {
    keys: [{
      algorithm: 'ed25519',
      keyId: 'lifecycle-test-key',
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    }],
    kind: 'agent-skill-trusted-signature-key-registry.v1',
  };

  try {
    assert.equal(coordinator.stageSignedPackage({ packageId, rawPackageJson, trustedKeyRegistry }).ok, true);
    assert.equal(gateway.setGrant({ packageId, scopes: ['storage.read'] }).ok, true);
    assert.equal((await gateway.runPackageExecution({ input: { value: 1 }, packageId, requestId: 'lifecycle-health-1' })).status, 'succeeded');
    assert.equal(gateway.listPackageHealth({ packageId }).totalCount, 1);
    assert.equal(artifactStore.quarantinePackage(packageId, 'test-quarantine').ok, true);

    const restored = lifecycle.restoreQuarantinedPackage({ packageId, rawPackageJson, trustedKeyRegistry });
    assert.equal(restored.ok, true, JSON.stringify(restored));
    assert.equal(restored.package.status, 'staged');
    assert.equal(artifactStore.getPackage(packageId).package.status, 'staged');
    assert.equal(gateway.listPackageHealth({ packageId }).totalCount, 0);
    assert.equal(gateway.listGrants().grants.length, 0);

    assert.equal(gateway.setGrant({ packageId, scopes: ['storage.read'] }).ok, true);
    assert.equal((await gateway.runPackageExecution({ input: { value: 2 }, packageId, requestId: 'lifecycle-health-2' })).status, 'succeeded');
    const uninstalled = lifecycle.uninstallPackage({ packageId });
    assert.equal(uninstalled.ok, true, JSON.stringify(uninstalled));
    assert.match(uninstalled.snapshot.snapshotId, /^uninstall-/u);
    assert.equal(artifactStore.getPackage(packageId).package, null);
    assert.equal(gateway.listPackageHealth({ packageId }).totalCount, 0);
    assert.equal(gateway.listGrants().grants.length, 0);

    const rolledBack = lifecycle.rollbackUninstall({
      packageId,
      snapshotId: uninstalled.snapshot.snapshotId,
    });
    assert.equal(rolledBack.ok, true, JSON.stringify(rolledBack));
    assert.equal(rolledBack.package.status, 'staged');
    assert.equal(rolledBack.package.signatureVerification.status, 'verified');
    assert.equal(gateway.createReleaseAdmissionReport({ packageIds: [packageId] }).rows[0].controlledRuntimeStatus, 'controlled-runtime-eligible');

    const snapshots = lifecycle.listUninstallSnapshots({ packageId });
    assert.equal(snapshots.ok, true);
    assert.equal(snapshots.totalCount, 1);
    assert.equal(JSON.stringify(snapshots).includes(tempRoot), false);
    const cleanup = lifecycle.cleanupUninstallSnapshots({ packageId });
    assert.equal(cleanup.ok, true);
    assert.equal(cleanup.removedSnapshotCount, 0);
    assert.equal(cleanup.receipt.action, 'cleanup-uninstall-snapshots');

    const receipts = lifecycle.listReceipts({ packageId });
    assert.equal(receipts.totalCount, 4);
    assert.deepEqual(receipts.receipts.map((receipt) => receipt.action), [
      'cleanup-uninstall-snapshots',
      'rollback-uninstall',
      'uninstall',
      'restore-quarantine',
    ]);
    assert.equal(JSON.stringify(receipts).includes(tempRoot), false);
    assert.equal(fs.existsSync(lifecycle.getPaths().receiptPath), true);
    const exported = lifecycle.exportReceipts({ packageId });
    assert.equal(exported.ok, true);
    assert.equal(exported.mimeType, 'application/json');
    const exportedJson = JSON.parse(exported.text);
    assert.equal(exportedJson.kind, 'external-skill-package-lifecycle-receipt-export.v1');
    assert.equal(exportedJson.summary.total, 4);
    assert.equal(exportedJson.summary.succeeded, 4);
    assert.equal(exportedJson.summary.snapshotCleanups, 1);
    assert.equal(exported.text.includes(tempRoot), false);
    assert.equal(exported.text.includes('receiptPath'), false);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

run().then(() => console.log('agent skill package lifecycle service smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
