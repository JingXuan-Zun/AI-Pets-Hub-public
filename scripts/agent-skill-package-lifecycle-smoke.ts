import { strict as assert } from 'node:assert';
import {
  applyAgentSkillPackageMetadataUpdate,
  createAgentSkillPackageLifecycleState,
  parseAgentSkillPackageLifecycleState,
  quarantineAgentSkillPackage,
  restoreAgentSkillPackageFromQuarantine,
  rollbackAgentSkillPackageMetadataUpdate,
  rollbackAgentSkillPackageUninstall,
  serializeAgentSkillPackageLifecycleState,
  uninstallAgentSkillPackage,
} from '../src/agent';
import {
  createSignedUpdateFixture,
  installUpdateDraftLibrary,
  replaceInstalledPackageExportedAt,
} from './agent-skill-signed-package-update-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const { signedLibrary, verifier } = createSignedUpdateFixture('2026-07-24T01:00:00.000Z', 'lifecycle-key');
const initial = createAgentSkillPackageLifecycleState();
assert.equal(initial.installedRegistry.packages.length, 0);
const install = applyAgentSkillPackageMetadataUpdate(initial, signedLibrary, signedLibrary.drafts[0]!.id, { signatureVerifier: verifier });
assert.equal(install.action, 'installed');
assert.equal(install.state.installedRegistry.packages[0]?.runtimeEnabled, false);
assert.equal(install.state.auditReceipts[0]?.action, 'installed');

const previousRegistry = replaceInstalledPackageExportedAt(
  installUpdateDraftLibrary(signedLibrary),
  '2026-07-24T00:00:00.000Z',
);
const replace = applyAgentSkillPackageMetadataUpdate(
  createAgentSkillPackageLifecycleState(previousRegistry),
  signedLibrary,
  signedLibrary.drafts[0]!.id,
  { signatureVerifier: verifier },
  '2026-07-24T02:00:00.000Z',
);
assert.equal(replace.action, 'replaced');
assert.equal(replace.state.rollbackSnapshots.length, 1);
const rollback = rollbackAgentSkillPackageMetadataUpdate(replace.state, replace.state.rollbackSnapshots[0]!.id);
assert.equal(rollback.action, 'rolled-back');
assert.equal(rollback.state.installedRegistry.packages[0]?.package.exportedAt, '2026-07-24T00:00:00.000Z');

const quarantine = quarantineAgentSkillPackage(rollback.state, rollback.state.installedRegistry.packages[0]!.id, ['runtime-crash']);
assert.equal(quarantine.action, 'quarantined');
assert.equal(quarantine.state.installedRegistry.packages.length, 0);
assert.equal(quarantine.state.quarantinedPackages[0]?.reasonCodes[0], 'runtime-crash');
const serialized = serializeAgentSkillPackageLifecycleState(quarantine.state);
assert.match(serialized, /agent-skill-package-lifecycle\.v1/u);
const restored = parseAgentSkillPackageLifecycleState(serialized);
assert.equal(restored.auditReceipts.length, quarantine.state.auditReceipts.length);
assert.equal(restored.quarantinedPackages[0]?.package.id, quarantine.state.quarantinedPackages[0]?.package.id);
assert.equal(restored.rollbackSnapshots[0]?.id, quarantine.state.rollbackSnapshots[0]?.id);
const restoredQuarantine = restoreAgentSkillPackageFromQuarantine(
  restored,
  quarantine.state.quarantinedPackages[0]!.package.id,
  '2026-07-24T03:00:00.000Z',
);
assert.equal(restoredQuarantine.action, 'restored');
assert.equal(restoredQuarantine.state.quarantinedPackages.length, 0);
assert.equal(restoredQuarantine.state.installedRegistry.packages.length, 1);
const uninstall = uninstallAgentSkillPackage(
  restoredQuarantine.state,
  restoredQuarantine.state.installedRegistry.packages[0]!.id,
  'uninstall-test-snapshot',
  '2026-07-24T04:00:00.000Z',
);
assert.equal(uninstall.action, 'uninstalled');
assert.equal(uninstall.state.installedRegistry.packages.length, 0);
assert.equal(uninstall.state.uninstallSnapshots[0]?.id, 'uninstall-test-snapshot');
const rollbackUninstall = rollbackAgentSkillPackageUninstall(
  parseAgentSkillPackageLifecycleState(serializeAgentSkillPackageLifecycleState(uninstall.state)),
  'uninstall-test-snapshot',
  '2026-07-24T05:00:00.000Z',
);
assert.equal(rollbackUninstall.action, 'restored');
assert.equal(rollbackUninstall.state.installedRegistry.packages.length, 1);
assert.equal(rollbackUninstall.state.uninstallSnapshots.length, 0);

const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillInstalledPackageRegistry.ts');
const applyPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel.tsx');
const rollbackPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel.tsx');
const recoveryPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageRecoveryPanel.tsx');
const ipcSource = readProjectFile('electron/ipcHandlers.cjs');
const preloadSource = readProjectFile('electron/preload.cjs');
assert.match(hookSource, /applyMetadataUpdate/u);
assert.match(hookSource, /desktop-pet\.agent-skill-package-lifecycle\.v1/u);
assert.match(hookSource, /stageSkillPackageArtifact/u);
assert.match(hookSource, /uninstallExternalSkillPackage/u);
assert.match(hookSource, /restoreQuarantinedExternalSkillPackage/u);
assert.match(hookSource, /rollbackExternalSkillPackageUninstall/u);
assert.match(hookSource, /cleanupExternalSkillPackageUninstallSnapshots/u);
assert.match(applyPanelSource, /Apply metadata/u);
assert.match(rollbackPanelSource, /onRollbackMetadataUpdate/u);
assert.match(recoveryPanelSource, /Package recovery/u);
assert.match(recoveryPanelSource, /Reverify and restore package/u);
assert.match(recoveryPanelSource, /Rollback package uninstall/u);
assert.match(recoveryPanelSource, /Export lifecycle receipts/u);
assert.match(recoveryPanelSource, /Clean expired uninstall snapshots/u);
assert.match(ipcSource, /desktop-pet:restore-quarantined-external-skill-package/u);
assert.match(ipcSource, /desktop-pet:uninstall-external-skill-package/u);
assert.match(ipcSource, /desktop-pet:rollback-external-skill-package-uninstall/u);
assert.match(ipcSource, /desktop-pet:cleanup-external-skill-package-uninstall-snapshots/u);
assert.match(ipcSource, /desktop-pet:list-external-skill-package-uninstall-snapshots/u);
assert.match(preloadSource, /cleanupExternalSkillPackageUninstallSnapshots/u);
assert.match(preloadSource, /listExternalSkillPackageUninstallSnapshots/u);
assert.match(preloadSource, /listExternalSkillPackageLifecycleReceipts/u);
assert.match(preloadSource, /exportExternalSkillPackageLifecycleReceipts/u);
assert.match(ipcSource, /desktop-pet:export-external-skill-package-lifecycle-receipts/u);

console.log('agent skill package lifecycle smoke passed');
