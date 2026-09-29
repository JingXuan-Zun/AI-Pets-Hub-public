import { strict as assert } from 'node:assert';
import {
  createAgentSkillMarketplaceInstallReadinessPreviewReport,
  createEmptyAgentSkillInstalledPackageRegistry,
} from '../src/agent';
import {
  createEnabledUpdateDraftLibrary,
  createSignedUpdateFixture,
} from './agent-skill-signed-package-update-fixture';
import { readProjectFile } from './smokeTestHarness.ts';

const unsignedLibrary = createEnabledUpdateDraftLibrary('2026-06-29T19:30:00.000Z');
const unsignedReport = createAgentSkillMarketplaceInstallReadinessPreviewReport(
  unsignedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const unsignedRow = unsignedReport.rows[0]!;
assert.equal(unsignedRow.status, 'blocked');
assert.equal(unsignedRow.downloadAttempted, false);
assert.equal(unsignedRow.installAttempted, false);
assert.equal(unsignedRow.registryMutated, false);
assert.ok(unsignedRow.issueCodes.includes('package-signature-missing'));

const { signedLibrary, verifier } = createSignedUpdateFixture('2026-06-29T20:00:00.000Z', 'marketplace-key');
const signedReport = createAgentSkillMarketplaceInstallReadinessPreviewReport(
  signedLibrary,
  createEmptyAgentSkillInstalledPackageRegistry(),
  { signatureVerifier: verifier },
);
const signedRow = signedReport.rows[0]!;
assert.equal(signedRow.status, 'review-required');
assert.equal(signedRow.marketplaceEnabled, false);
assert.equal(signedRow.sourceIdentity, 'marketplace-identity-missing');
assert.equal(signedRow.channelPolicy, 'local-draft-review');
assert.equal(signedRow.versionPolicy, 'install-or-update-preview');
assert.equal(signedRow.signatureStatus, 'verified');
assert.equal(signedReport.summary.downloadAttempted, 0);
assert.equal(signedReport.summary.installAttempted, 0);
assert.equal(signedReport.summary.registryMutated, 0);

const wrapperSource = readProjectFile('src/components/settings/SettingsAgentSkillSignedPackageUpdatePanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillMarketplaceInstallReadinessPanel.tsx');
assert.match(wrapperSource, /SettingsAgentSkillMarketplaceInstallReadinessPanel/u);
assert.match(panelSource, /Marketplace install readiness/u);

console.log('agent skill marketplace install readiness preview smoke passed');
