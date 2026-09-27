import { strict as assert } from 'node:assert';
import {
  applyAgentSkillSignedArchiveInstall,
  createAgentSkillPackageLifecycleState,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const identity = {
  packageId: 'studio.example:character.animation',
  publisherId: 'studio.example',
  skillId: 'character.animation',
  version: '1.0.0',
};

function createPackageJson(version: string) {
  return JSON.stringify({
    distribution: {
      kind: 'agent-skill-package-distribution.v1',
      ...identity,
      version,
    },
    kind: 'agent-skill-package.v1',
    publisher: { id: identity.publisherId },
    runtime: {
      entrypoint: 'run',
      kind: 'wasm-pure-i32-v1',
      moduleBase64: 'AGFzbQEAAA==',
    },
    scaffold: {
      package: { runtime: 'external-sandbox', version },
      skill: { id: identity.skillId },
    },
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-v1',
      keyId: 'studio-key-v1',
      signature: 'signed-package-placeholder',
    },
  });
}

const initial = createAgentSkillPackageLifecycleState();
const installed = applyAgentSkillSignedArchiveInstall(initial, {
  identity,
  installedAt: '2026-07-29T01:00:00.000Z',
  packageJson: createPackageJson('1.0.0'),
  status: 'installed',
});
assert.equal(installed.error, null);
assert.equal(installed.action, 'installed');
assert.equal(installed.package?.id, identity.packageId);
assert.equal(installed.package?.runtimeEnabled, false);
assert.equal(installed.state.installedRegistry.packages.length, 1);
assert.equal(installed.state.auditReceipts[0]?.issueCodes[0], 'main-process-signed-archive-verified');

const updateIdentity = { ...identity, version: '2.0.0' };
const updated = applyAgentSkillSignedArchiveInstall(installed.state, {
  identity: updateIdentity,
  installedAt: '2026-07-29T02:00:00.000Z',
  packageJson: createPackageJson('2.0.0'),
  status: 'updated',
});
assert.equal(updated.error, null);
assert.equal(updated.action, 'replaced');
assert.equal(updated.state.installedRegistry.packages.length, 1);
assert.equal(updated.state.installedRegistry.packages[0]?.package.scaffold.package.version, '2.0.0');
assert.equal(updated.state.installedRegistry.packages[0]?.runtimeEnabled, false);

const mismatched = applyAgentSkillSignedArchiveInstall(updated.state, {
  identity: { ...updateIdentity, publisherId: 'attacker.example' },
  packageJson: createPackageJson('2.0.0'),
  status: 'updated',
});
assert.equal(mismatched.error, 'signed_archive_verified_package_invalid');
assert.equal(mismatched.state, updated.state);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedArchiveInstallerPanel.tsx');
const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillInstalledPackageRegistry.ts');
const installerSource = readProjectFile('electron/externalSkillPackageArchiveInstallerService.cjs');
assert.match(panelSource, /\.skillpkg\.zip/u);
assert.match(panelSource, /trustedKeyRegistry\.keys\.length/u);
assert.match(panelSource, /package_archive_version_downgrade_rejected/u);
assert.match(panelSource, /package_signing_key_migration_missing/u);
assert.match(exchangeSource, /SettingsAgentSkillSignedArchiveInstallerPanel/u);
assert.match(hookSource, /stageSignedSkillPackageArchive/u);
assert.match(hookSource, /applyAgentSkillSignedArchiveInstall/u);
assert.match(installerSource, /packageJson: JSON\.stringify\(archive\.packageValue\)/u);
assert.equal(panelSource.includes('marketReleaseAllowed: true'), false);
assert.equal(panelSource.includes('runtimeEnabled: true'), false);

console.log('agent skill signed archive install UI smoke passed');
