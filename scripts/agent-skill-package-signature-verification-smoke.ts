import { strict as assert } from 'node:assert';
import {
  createAgentSkillPackageExport,
  createAgentSkillPackageSignatureVerificationReport,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillPackageDraftLibrary,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillPackageDraftEnabled,
  type AgentSkillInstalledPackageRegistry,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

function createInstalledRegistry(signature?: unknown): AgentSkillInstalledPackageRegistry {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T10:00:00.000Z');
  const signedPackage = signature
    ? { ...packageExport!, signature }
    : packageExport;
  const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(signedPackage));
  const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
  const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabledDraft.library,
    createEmptyAgentSkillInstalledPackageRegistry(),
  ).registry;
}

const unsignedReport = createAgentSkillPackageSignatureVerificationReport(createInstalledRegistry());
assert.equal(unsignedReport.summary.unsigned, 1);
assert.equal(unsignedReport.rows[0]?.issueCodes.join(','), 'package-signature-missing');

const blockedReport = createAgentSkillPackageSignatureVerificationReport(createInstalledRegistry({
  algorithm: 'ed25519',
  digest: 'sha256:test',
}));
assert.equal(blockedReport.summary.blocked, 1);
assert.equal(blockedReport.rows[0]?.issueCodes.includes('signature-verifier-missing'), true);
assert.equal(blockedReport.rows[0]?.issueCodes.includes('signature-key-missing'), true);

const unverifiedReport = createAgentSkillPackageSignatureVerificationReport(createInstalledRegistry({
  algorithm: 'ed25519',
  digest: 'sha256:test',
  keyId: 'local-dev-key',
  signature: 'placeholder-signature',
}));
assert.equal(unverifiedReport.summary.unverified, 1);
assert.equal(unverifiedReport.rows[0]?.verifier, 'missing');
assert.equal(unverifiedReport.rows[0]?.metadata?.keyId, 'local-dev-key');

const securityPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSignatureVerificationPanel.tsx');
assert.match(securityPanelSource, /SettingsAgentSkillPackageSignatureVerificationPanel/u);
assert.match(panelSource, /Signature verification/u);
assert.match(panelSource, /createAgentSkillPackageSignatureVerificationReport/u);
assert.match(panelSource, /verifier \{row\.verifier\}/u);

console.log('agent skill package signature verification smoke passed');
