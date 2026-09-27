import { strict as assert } from 'node:assert';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillExecutableHandlerGuardReport,
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillPackageExport,
  createAgentSkillTrustEvidence,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  createEmptyAgentSkillTrustEvidenceRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

function createInstalledRegistry(signature?: unknown) {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T11:00:00.000Z');
  const packageJson = JSON.stringify(signature ? { ...packageExport!, signature } : packageExport);
  const importPreview = parseAgentSkillPackageImportJson(packageJson);
  const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
  const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabledDraft.library,
    createEmptyAgentSkillInstalledPackageRegistry(),
  ).registry;
}

function createReadyContext(signature?: unknown) {
  const registry = createInstalledRegistry(signature);
  const packageId = registry.packages[0]?.id ?? '';
  const previewRegistry = createAgentSkillInstalledPackageHandlerPreview(
    createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry(),
    registry,
    packageId,
  ).registry;
  const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
    createEmptyAgentSkillInstalledPackageRuntimePolicy(),
    registry,
    packageId,
    { runtimeEnabled: true, sandboxed: true, trusted: true },
  ).policy;
  const evidence = createAgentSkillTrustEvidence(
    createEmptyAgentSkillTrustEvidenceRegistry(),
    registry,
    packageId,
  ).registry;
  return {
    packageId,
    policy,
    previewRegistry,
    registry,
    trustedPackageIds: createAgentSkillEffectiveTrustedPackageIds(policy, registry, evidence),
  };
}

const unsignedContext = createReadyContext();
const localGuard = createAgentSkillExecutableHandlerGuardReport(
  unsignedContext.registry,
  unsignedContext.policy,
  unsignedContext.previewRegistry,
  { trustedPackageIds: unsignedContext.trustedPackageIds },
);
assert.equal(localGuard.summary.registerable, 1);
assert.equal(localGuard.rows[0]?.guardIssueCodes.some((code) => code.startsWith('signature-')), false);

const externalUnsignedGuard = createAgentSkillExecutableHandlerGuardReport(
  unsignedContext.registry,
  unsignedContext.policy,
  unsignedContext.previewRegistry,
  { signatureMode: 'external-package', trustedPackageIds: unsignedContext.trustedPackageIds },
);
assert.equal(externalUnsignedGuard.summary.blocked, 1);
assert.equal(externalUnsignedGuard.rows[0]?.guardIssueCodes.includes('external-package-loader-disabled'), true);
assert.equal(externalUnsignedGuard.rows[0]?.guardIssueCodes.includes('package-signature-missing'), true);

const signedContext = createReadyContext({
  algorithm: 'ed25519',
  digest: 'sha256:test',
  keyId: 'local-dev-key',
  signature: 'placeholder-signature',
});
const externalSignedGuard = createAgentSkillExecutableHandlerGuardReport(
  signedContext.registry,
  signedContext.policy,
  signedContext.previewRegistry,
  { signatureMode: 'external-package', trustedPackageIds: signedContext.trustedPackageIds },
);
assert.equal(externalSignedGuard.summary.blocked, 1);
assert.equal(externalSignedGuard.rows[0]?.guardIssueCodes.includes('external-package-loader-disabled'), true);
assert.equal(externalSignedGuard.rows[0]?.guardIssueCodes.includes('signature-unverified'), true);
assert.equal(externalSignedGuard.rows[0]?.guardIssueCodes.includes('signature-verifier-missing'), true);

const securityPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalPackageGuardPanel.tsx');
assert.match(securityPanelSource, /SettingsAgentSkillExternalPackageGuardPanel/u);
assert.match(panelSource, /External package guard/u);
assert.match(panelSource, /signatureMode: 'external-package'/u);
assert.match(panelSource, /startsWith\('signature-'\)/u);

console.log('agent skill external package guard smoke passed');
