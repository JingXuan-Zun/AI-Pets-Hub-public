import { strict as assert } from 'node:assert';
import {
  createAgentSkillSignedPackageUpdateRollbackPreviewReport,
  createEmptyAgentSkillInstalledPackageRegistry,
} from '../src/agent';
import {
  createEnabledUpdateDraftLibrary,
  createSignedUpdateFixture,
  installUpdateDraftLibrary,
  replaceInstalledPackageExportedAt,
} from './agent-skill-signed-package-update-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const unsignedLibrary = createEnabledUpdateDraftLibrary('2026-06-29T19:30:00.000Z');
const blockedReport = createAgentSkillSignedPackageUpdateRollbackPreviewReport(
  unsignedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
assert.equal(blockedReport.rows[0]?.status, 'blocked');
assert.equal(blockedReport.rows[0]?.rollbackAttempted, false);
assert.equal(blockedReport.rows[0]?.auditWritten, false);
assert.equal(blockedReport.rows[0]?.registryMutated, false);

const { signedLibrary, verifier } = createSignedUpdateFixture('2026-06-29T20:00:00.000Z', 'rollback-key');
const installReport = createAgentSkillSignedPackageUpdateRollbackPreviewReport(
  signedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
  { signatureVerifier: verifier },
);
assert.equal(installReport.rows[0]?.status, 'not-needed');
assert.equal(installReport.rows[0]?.auditReceiptId, null);
assert.equal(installReport.summary.auditWritten, 0);
assert.equal(installReport.summary.rollbackAttempted, 0);
assert.equal(installReport.summary.registryMutated, 0);

const installedOlder = replaceInstalledPackageExportedAt(
  installUpdateDraftLibrary(signedLibrary),
  '2026-06-29T19:00:00.000Z',
);
const rollbackReport = createAgentSkillSignedPackageUpdateRollbackPreviewReport(
  signedLibrary,
  installedOlder,
  { signatureVerifier: verifier },
);
const rollbackRow = rollbackReport.rows[0]!;
assert.equal(rollbackRow.status, 'rollback-ready-if-applied');
assert.equal(rollbackRow.updateAction, 'replace');
assert.equal(rollbackRow.rollbackAttempted, false);
assert.equal(rollbackRow.auditWritten, false);
assert.equal(rollbackRow.registryMutated, false);
assert.ok(rollbackRow.rollbackSnapshotId?.includes(':rollback:2026-06-29T19:00:00.000Z'));
assert.ok(rollbackRow.auditReceiptId?.endsWith(':audit-preview'));
assert.equal(rollbackReport.summary['rollback-ready-if-applied'], 1);

const wrapperSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdatePanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel.tsx');
assert.match(wrapperSource, /SettingsAgentSkillSignedPackageUpdateRollbackPreviewPanel/u);
assert.match(panelSource, /Signed update rollback preview/u);

console.log('agent skill signed package update rollback preview smoke passed');
