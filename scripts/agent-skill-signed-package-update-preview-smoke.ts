import { strict as assert } from 'node:assert';
import {
  createAgentSkillSignedPackageUpdatePreviewReport,
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
const unsignedReport = createAgentSkillSignedPackageUpdatePreviewReport(
  unsignedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
assert.equal(unsignedReport.rows[0]?.status, 'blocked');
assert.ok(unsignedReport.rows[0]?.issueCodes.includes('package-signature-missing'));

const { signedLibrary, verifier } = createSignedUpdateFixture();

const installReadyReport = createAgentSkillSignedPackageUpdatePreviewReport(
  signedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
  { signatureVerifier: verifier },
);
assert.equal(installReadyReport.rows[0]?.status, 'install-ready');
assert.equal(installReadyReport.rows[0]?.signatureStatus, 'verified');

const installedOlder = replaceInstalledPackageExportedAt(
  installUpdateDraftLibrary(signedLibrary),
  '2026-06-29T19:00:00.000Z',
);
const updateReport = createAgentSkillSignedPackageUpdatePreviewReport(signedLibrary, installedOlder, { signatureVerifier: verifier });
assert.equal(updateReport.rows[0]?.status, 'update-ready');

const installedSame = installUpdateDraftLibrary(signedLibrary);
const unchangedReport = createAgentSkillSignedPackageUpdatePreviewReport(signedLibrary, installedSame, { signatureVerifier: verifier });
assert.equal(unchangedReport.rows[0]?.status, 'unchanged');

const installedNewer = replaceInstalledPackageExportedAt(
  installUpdateDraftLibrary(signedLibrary),
  '2026-06-29T21:00:00.000Z',
);
const downgradeReport = createAgentSkillSignedPackageUpdatePreviewReport(signedLibrary, installedNewer, { signatureVerifier: verifier });
assert.equal(downgradeReport.rows[0]?.status, 'blocked');
assert.ok(downgradeReport.rows[0]?.issueCodes.includes('candidate-older-than-installed'));

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const wrapperSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdatePanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdatePreviewPanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillSignedPackageUpdatePanels/u);
assert.match(wrapperSource, /SettingsAgentSkillSignedPackageUpdatePreviewPanel/u);
assert.match(panelSource, /Signed update preview/u);

console.log('agent skill signed package update preview smoke passed');
