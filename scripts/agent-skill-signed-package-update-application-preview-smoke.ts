import { strict as assert } from 'node:assert';
import {
  createAgentSkillSignedPackageUpdateApplicationPreviewReport,
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
const blockedReport = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
  unsignedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
assert.equal(blockedReport.rows[0]?.status, 'blocked');
assert.equal(blockedReport.rows[0]?.plannedAction, 'blocked');
assert.equal(blockedReport.rows[0]?.applicationAttempted, false);
assert.equal(blockedReport.rows[0]?.registryMutated, false);

const { signedLibrary, verifier } = createSignedUpdateFixture('2026-06-29T20:00:00.000Z', 'application-key');
const installReport = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
  signedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
  { signatureVerifier: verifier },
);
assert.equal(installReport.rows[0]?.status, 'install-planned');
assert.equal(installReport.rows[0]?.plannedAction, 'install');
assert.equal(installReport.rows[0]?.rollbackSnapshotId, null);
assert.equal(installReport.summary.applicationAttempted, 0);
assert.equal(installReport.summary.registryMutated, 0);

const installedOlder = replaceInstalledPackageExportedAt(
  installUpdateDraftLibrary(signedLibrary),
  '2026-06-29T19:00:00.000Z',
);
const replaceReport = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
  signedLibrary,
  installedOlder,
  { signatureVerifier: verifier },
);
const replaceRow = replaceReport.rows[0]!;
assert.equal(replaceRow.status, 'replace-planned');
assert.equal(replaceRow.plannedAction, 'replace');
assert.equal(replaceRow.registryMutated, false);
assert.equal(replaceRow.applicationAttempted, false);
assert.ok(replaceRow.rollbackSnapshotId?.includes(':rollback:2026-06-29T19:00:00.000Z'));
assert.equal(replaceRow.rollbackSourcePackageId, replaceRow.targetInstalledPackageId);

const unchangedReport = createAgentSkillSignedPackageUpdateApplicationPreviewReport(
  signedLibrary,
  installUpdateDraftLibrary(signedLibrary),
  { signatureVerifier: verifier },
);
assert.equal(unchangedReport.rows[0]?.status, 'unchanged');
assert.equal(unchangedReport.rows[0]?.plannedAction, 'none');

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const wrapperSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdatePanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillSignedPackageUpdatePanels/u);
assert.match(wrapperSource, /SettingsAgentSkillSignedPackageUpdateApplicationPreviewPanel/u);
assert.match(panelSource, /Signed update application preview/u);

console.log('agent skill signed package update application preview smoke passed');
