import { strict as assert } from 'node:assert';
import { generateKeyPairSync, sign } from 'node:crypto';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillExecutableHandlerGuardReport,
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillPackageCanonicalSignaturePayload,
  createAgentSkillPackageExport,
  createAgentSkillPackageSignatureVerificationReport,
  createAgentSkillRuntimeModeDecisionReport,
  createAgentSkillTrustEvidence,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  createEmptyAgentSkillTrustedSignatureKeyRegistry,
  createEmptyAgentSkillTrustEvidenceRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
  upsertAgentSkillTrustedSignatureKey,
  type AgentSkillInstalledPackageRegistry,
} from '../src/agent';
import {
  createSettingsAgentSkillRendererSignatureVerifier,
} from '../src/components/settings/settingsAgentSkillRendererSignatureVerifier';
import { readProjectFile } from './smokeTestHarness.ts';

function createUnsignedRegistry() {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T18:00:00.000Z');
  const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
  const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
  const enabled = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabled.library,
    createEmptyAgentSkillInstalledPackageRegistry(),
  ).registry;
}

function installSignature(registry: AgentSkillInstalledPackageRegistry, signature: string) {
  const item = registry.packages[0]!;
  return {
    ...registry,
    packages: [{
      ...item,
      package: {
        ...item.package,
        signature: { algorithm: 'ed25519', digest: 'sha256:canonical-v1', keyId: 'renderer-key', signature },
      },
    }],
  };
}

function createRuntimeContext(registry: AgentSkillInstalledPackageRegistry) {
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
  const evidenceRegistry = createAgentSkillTrustEvidence(
    createEmptyAgentSkillTrustEvidenceRegistry(),
    registry,
    packageId,
  ).registry;
  return {
    evidenceRegistry,
    policy,
    previewRegistry,
    trustedPackageIds: createAgentSkillEffectiveTrustedPackageIds(policy, registry, evidenceRegistry),
  };
}

const emptyResult = createSettingsAgentSkillRendererSignatureVerifier(createEmptyAgentSkillTrustedSignatureKeyRegistry());
assert.equal(emptyResult.verifier, null);
assert.deepEqual(emptyResult.issueCodes, ['trusted-signature-key-registry-empty']);

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const unsignedRegistry = createUnsignedRegistry();
const payload = createAgentSkillPackageCanonicalSignaturePayload(unsignedRegistry.packages[0]!);
const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
const signedRegistry = installSignature(unsignedRegistry, signature);
const trustedRegistry = upsertAgentSkillTrustedSignatureKey(createEmptyAgentSkillTrustedSignatureKeyRegistry(), {
  algorithm: 'ed25519',
  keyId: 'renderer-key',
  label: 'Renderer key',
  publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
}).registry;
const verifierResult = createSettingsAgentSkillRendererSignatureVerifier(trustedRegistry);
assert.deepEqual(verifierResult.issueCodes, []);
assert.ok(verifierResult.verifier);

const report = createAgentSkillPackageSignatureVerificationReport(signedRegistry, {
  verifier: verifierResult.verifier,
});
assert.equal(report.summary.verified, 1);

const context = createRuntimeContext(signedRegistry);
const guard = createAgentSkillExecutableHandlerGuardReport(
  signedRegistry,
  context.policy,
  context.previewRegistry,
  {
    signatureMode: 'external-package',
    signatureVerifier: verifierResult.verifier,
    trustedPackageIds: context.trustedPackageIds,
  },
);
assert.deepEqual(guard.rows[0]?.guardIssueCodes, ['external-package-loader-disabled']);

const mode = createAgentSkillRuntimeModeDecisionReport(
  signedRegistry,
  context.policy,
  context.previewRegistry,
  context.evidenceRegistry,
  { signatureVerifier: verifierResult.verifier, trustedPackageIds: context.trustedPackageIds },
);
assert.equal(mode.rows[0]?.signatureStatus, 'verified');
assert.ok(mode.rows[0]?.externalPackageIssueCodes.includes('external-package-loader-disabled'));

const securityPanel = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
assert.match(securityPanel, /createSettingsAgentSkillRendererSignatureVerifier/u);
assert.ok(securityPanel.includes('signatureVerifier={signatureVerifier.verifier}'));

console.log('agent skill renderer signature verifier smoke passed');
