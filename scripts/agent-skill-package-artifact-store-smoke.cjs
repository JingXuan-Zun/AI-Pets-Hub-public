const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-skill-artifacts-'));
const store = createSkillPackageArtifactStore({ userDataPath: tempRoot });
const first = JSON.stringify({ kind: 'agent-skill-package.v1', scaffold: { skill: { id: 'character.animation' } } });
const second = JSON.stringify({ kind: 'agent-skill-package.v1', scaffold: { skill: { id: 'character.animation' }, version: 2 } });

try {
  const staged = store.stagePackage({ packageId: 'character.animation@draft-one', rawPackageJson: first });
  assert.equal(staged.ok, true);
  assert.equal(staged.replaced, false);
  assert.equal(staged.package.signatureVerification, null);
  assert.equal(store.getPackage('character.animation@draft-one').package.status, 'staged');
  const readFirst = store.readPackageArtifact('character.animation@draft-one');
  assert.equal(readFirst.ok, true);
  assert.equal(JSON.parse(readFirst.rawPackageJson).scaffold.skill.id, 'character.animation');
  const readyAudit = store.auditPackages({ packages: [{ packageId: 'character.animation@draft-one', rawPackageJson: first }] });
  assert.equal(readyAudit.rows[0].status, 'ready');

  const replaced = store.stagePackage({ packageId: 'character.animation@draft-one', rawPackageJson: second });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.replaced, true);
  const mismatchAudit = store.auditPackages({ packages: [{ packageId: 'character.animation@draft-one', rawPackageJson: first }] });
  assert.equal(mismatchAudit.rows[0].status, 'mismatched');
  const snapshots = fs.readdirSync(path.join(store.getPaths().rootPath, 'snapshots'), { recursive: true })
    .filter((entry) => entry.endsWith('.json'));
  assert.equal(snapshots.length, 1);

  const quarantined = store.quarantinePackage('character.animation@draft-one', 'test_failure');
  assert.equal(quarantined.ok, true);
  assert.equal(quarantined.package.status, 'quarantined');
  assert.equal(store.readPackageArtifact('character.animation@draft-one').error, 'package_artifact_quarantined');
  const quarantinedAudit = store.auditPackages({ packages: [{ packageId: 'character.animation@draft-one', rawPackageJson: second }] });
  assert.equal(quarantinedAudit.rows[0].status, 'quarantined');
  const missingAudit = store.auditPackages({ packages: [{ packageId: 'missing', rawPackageJson: first }] });
  assert.equal(missingAudit.rows[0].status, 'missing');
  assert.equal(store.stagePackage({ packageId: '../unsafe', rawPackageJson: first }).ok, false);
  assert.equal(store.stagePackage({ packageId: 'safe', rawPackageJson: '{bad' }).ok, false);
  const listed = store.listPackages({ packageIds: ['character.animation@draft-one', 'missing'] });
  assert.equal(listed.ok, true);
  assert.equal(listed.totalCount, 1);
  assert.equal(listed.packages[0].packageId, 'character.animation@draft-one');
  const uninstalled = store.uninstallPackage('character.animation@draft-one');
  assert.equal(uninstalled.ok, true);
  assert.equal(store.getPackage('character.animation@draft-one').package, null);
  assert.match(uninstalled.snapshot.snapshotId, /^uninstall-/u);
  const restored = store.restoreUninstalledPackage({
    packageId: 'character.animation@draft-one',
    snapshotId: uninstalled.snapshot.snapshotId,
  });
  assert.equal(restored.ok, true);
  assert.equal(restored.package.status, 'quarantined');
  assert.equal(store.restoreUninstalledPackage({
    packageId: 'character.animation@draft-one',
    snapshotId: uninstalled.snapshot.snapshotId,
  }).error, 'package_artifact_already_installed');
  console.log('agent skill package artifact store smoke passed');
} finally {
  fs.rmSync(tempRoot, { force: true, recursive: true });
}
