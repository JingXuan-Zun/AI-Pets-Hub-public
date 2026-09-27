const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');

function packageJson(version) {
  return JSON.stringify({
    kind: 'agent-skill-package.v1',
    scaffold: { skill: { id: 'character.animation' }, version },
  });
}

function packageHash(packageId) {
  return crypto.createHash('sha256').update(packageId).digest('hex');
}

function listArtifactDigests(store, packageId) {
  const directory = path.join(store.getPaths().rootPath, 'packages', packageHash(packageId));
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((entry) => /^[a-f0-9]{64}\.json$/u.test(entry))
    .map((entry) => path.basename(entry, '.json'))
    .sort();
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-snapshot-retention-'));
let nowMs = Date.parse('2026-06-01T00:00:00.000Z');
const store = createSkillPackageArtifactStore({ now: () => nowMs, userDataPath: tempRoot });

try {
  const quantityPackageId = 'character.animation@retention-count';
  const createdSnapshotIds = [];
  for (let index = 0; index < 7; index += 1) {
    nowMs = Date.parse(`2026-06-0${index + 1}T00:00:00.000Z`);
    assert.equal(store.stagePackage({ packageId: quantityPackageId, rawPackageJson: packageJson(index) }).ok, true);
    const uninstalled = store.uninstallPackage(quantityPackageId);
    assert.equal(uninstalled.ok, true);
    assert.equal(uninstalled.retentionCleanup.ok, true);
    assert.equal(uninstalled.retentionCleanup.removedSnapshotIds.includes(uninstalled.snapshot.snapshotId), false);
    createdSnapshotIds.push(uninstalled.snapshot.snapshotId);
  }

  const quantityList = store.listUninstallSnapshots({ packageId: quantityPackageId });
  assert.equal(quantityList.ok, true);
  assert.equal(quantityList.policy.maxSnapshotsPerPackage, 5);
  assert.equal(quantityList.policy.maxAgeDays, 30);
  assert.equal(quantityList.totalCount, 5);
  assert.equal(quantityList.snapshots.some((snapshot) => snapshot.snapshotId === createdSnapshotIds[0]), false);
  assert.equal(quantityList.snapshots.some((snapshot) => snapshot.snapshotId === createdSnapshotIds[6]), true);
  assert.equal(listArtifactDigests(store, quantityPackageId).length, 5);
  assert.equal(store.restoreUninstalledPackage({
    packageId: quantityPackageId,
    snapshotId: createdSnapshotIds[0],
  }).error, 'uninstall_snapshot_not_found');

  nowMs = Date.parse('2026-07-20T00:00:00.000Z');
  const expiredCleanup = store.cleanupUninstallSnapshots({ packageId: quantityPackageId });
  assert.equal(expiredCleanup.ok, true);
  assert.equal(expiredCleanup.removedSnapshotCount, 5);
  assert.equal(expiredCleanup.deletedArtifactCount, 5);
  assert.equal(store.listUninstallSnapshots({ packageId: quantityPackageId }).totalCount, 0);
  assert.equal(listArtifactDigests(store, quantityPackageId).length, 0);

  const malformedPackageId = 'character.animation@retention-malformed';
  assert.equal(store.stagePackage({ packageId: malformedPackageId, rawPackageJson: packageJson('malformed') }).ok, true);
  const malformedUninstall = store.uninstallPackage(malformedPackageId);
  assert.equal(malformedUninstall.ok, true);
  const malformedDirectory = path.join(
    store.getPaths().rootPath,
    'uninstall-snapshots',
    packageHash(malformedPackageId),
  );
  const malformedPath = path.join(malformedDirectory, 'uninstall-invalid-test.json');
  fs.writeFileSync(malformedPath, '{"broken":true}', 'utf8');
  nowMs += 31 * 24 * 60 * 60 * 1000;
  const malformedCleanup = store.cleanupUninstallSnapshots({ packageId: malformedPackageId });
  assert.equal(malformedCleanup.ok, true);
  assert.equal(malformedCleanup.status, 'completed-with-skips');
  assert.equal(malformedCleanup.invalidSnapshotCount, 1);
  assert.equal(malformedCleanup.removedSnapshotCount, 1);
  assert.equal(malformedCleanup.deletedArtifactCount, 0);
  assert.equal(malformedCleanup.artifactCleanupSkips[0].reason, 'uninstall_snapshot_invalid');
  assert.equal(fs.existsSync(malformedPath), true);
  assert.equal(listArtifactDigests(store, malformedPackageId).length, 1);

  const updateReferencePackageId = 'character.animation@retention-update-reference';
  nowMs = Date.parse('2026-06-01T00:00:00.000Z');
  const firstStage = store.stagePackage({ packageId: updateReferencePackageId, rawPackageJson: packageJson('first') });
  assert.equal(firstStage.ok, true);
  const secondStage = store.stagePackage({ packageId: updateReferencePackageId, rawPackageJson: packageJson('second') });
  assert.equal(secondStage.ok, true);
  assert.equal(store.uninstallPackage(updateReferencePackageId).ok, true);
  nowMs = Date.parse('2026-07-10T00:00:00.000Z');
  const updateReferenceCleanup = store.cleanupUninstallSnapshots({ packageId: updateReferencePackageId });
  assert.equal(updateReferenceCleanup.ok, true);
  assert.equal(updateReferenceCleanup.removedSnapshotCount, 1);
  assert.equal(updateReferenceCleanup.deletedArtifactCount, 1);
  assert.deepEqual(listArtifactDigests(store, updateReferencePackageId), [firstStage.package.artifactDigest]);

  assert.equal(JSON.stringify(store.listUninstallSnapshots()).includes(tempRoot), false);
  console.log('agent skill uninstall snapshot retention smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
