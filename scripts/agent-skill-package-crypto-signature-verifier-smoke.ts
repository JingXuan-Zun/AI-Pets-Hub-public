import { strict as assert } from 'node:assert';
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import {
  createAgentSkillCryptoSignatureVerifier,
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
  createEmptyAgentSkillTrustEvidenceRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
  type AgentSkillInstalledPackageRegistry,
} from '../src/agent';

function createUnsignedInstalledRegistry() {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T14:00:00.000Z');
  const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
  const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
  const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabledDraft.library,
    createEmptyAgentSkillInstalledPackageRegistry(),
  ).registry;
}

function installSignedRegistry(registry: AgentSkillInstalledPackageRegistry, signature: string) {
  const item = registry.packages[0]!;
  return {
    ...registry,
    packages: [{
      ...item,
      package: {
        ...item.package,
        signature: {
          algorithm: 'ed25519',
          digest: 'sha256:canonical-v1',
          keyId: 'local-test-key',
          signature,
        },
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
  const trustedPackageIds = createAgentSkillEffectiveTrustedPackageIds(policy, registry, evidenceRegistry);
  return { evidenceRegistry, packageId, policy, previewRegistry, trustedPackageIds };
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const unsignedRegistry = createUnsignedInstalledRegistry();
const payload = createAgentSkillPackageCanonicalSignaturePayload(unsignedRegistry.packages[0]!);
const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
const signedRegistry = installSignedRegistry(unsignedRegistry, signature);
const verifier = createAgentSkillCryptoSignatureVerifier({
  trustedKeys: [{
    algorithm: 'ed25519',
    keyId: 'local-test-key',
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  }],
  verifySignature(input) {
    const key = createPublicKey(input.publicKey);
    return verify(null, Buffer.from(input.payload), key, Buffer.from(input.signature, 'base64'));
  },
});

const verifiedReport = createAgentSkillPackageSignatureVerificationReport(signedRegistry, { verifier });
assert.equal(verifiedReport.summary.verified, 1);
assert.equal(verifiedReport.rows[0]?.verifier, 'crypto-signature-verifier');

const tamperedRegistry = installSignedRegistry(unsignedRegistry, `${signature.slice(0, -4)}AAAA`);
const invalidReport = createAgentSkillPackageSignatureVerificationReport(tamperedRegistry, { verifier });
assert.equal(invalidReport.summary.invalid, 1);
assert.ok(invalidReport.rows[0]?.issueCodes.includes('signature-crypto-verification-failed'));

const missingKeyVerifier = createAgentSkillCryptoSignatureVerifier({
  trustedKeys: [],
  verifySignature() {
    return false;
  },
});
const missingKeyReport = createAgentSkillPackageSignatureVerificationReport(signedRegistry, { verifier: missingKeyVerifier });
assert.equal(missingKeyReport.summary.blocked, 1);
assert.ok(missingKeyReport.rows[0]?.issueCodes.includes('signature-trusted-key-missing'));

const context = createRuntimeContext(signedRegistry);
const guardReport = createAgentSkillExecutableHandlerGuardReport(
  signedRegistry,
  context.policy,
  context.previewRegistry,
  { signatureMode: 'external-package', signatureVerifier: verifier, trustedPackageIds: context.trustedPackageIds },
);
assert.equal(guardReport.summary.blocked, 1);
assert.deepEqual(guardReport.rows[0]?.guardIssueCodes, ['external-package-loader-disabled']);

const modeReport = createAgentSkillRuntimeModeDecisionReport(
  signedRegistry,
  context.policy,
  context.previewRegistry,
  context.evidenceRegistry,
  { signatureVerifier: verifier, trustedPackageIds: context.trustedPackageIds },
);
assert.equal(modeReport.rows[0]?.signatureStatus, 'verified');
assert.ok(modeReport.rows[0]?.externalPackageIssueCodes.includes('external-package-loader-disabled'));

const securitySignedRegistry = {
  ...signedRegistry,
  packages: [{
    ...signedRegistry.packages[0]!,
    package: {
      ...signedRegistry.packages[0]!.package,
      security: { signature: signedRegistry.packages[0]!.package.signature },
      signature: undefined,
    },
  }],
};
assert.equal(
  createAgentSkillPackageCanonicalSignaturePayload(securitySignedRegistry.packages[0]!),
  payload,
);

console.log('agent skill package crypto signature verifier smoke passed');
