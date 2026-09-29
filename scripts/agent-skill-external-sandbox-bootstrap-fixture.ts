import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillPackageCanonicalSignaturePayload,
  createAgentSkillPackageExport,
  createAgentSkillTrustEvidence,
  createAgentSkillTrustedSignatureVerifierFromRegistry,
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

function installSignature(registry: AgentSkillInstalledPackageRegistry, keyId: string, signature: string) {
  const item = registry.packages[0]!;
  return {
    ...registry,
    packages: [{
      ...item,
      package: {
        ...item.package,
        signature: { algorithm: 'ed25519', digest: 'sha256:canonical-v1', keyId, signature },
      },
    }],
  };
}

export function createUnsignedBootstrapRegistry(exportedAt = '2026-06-29T23:30:00.000Z') {
  const packageExport = createAgentSkillPackageExport('character.animation', exportedAt);
  const preview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
  const saved = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), preview);
  const enabled = setAgentSkillPackageDraftEnabled(saved.library, saved.draft?.id ?? '', true);
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabled.library,
    createEmptyAgentSkillInstalledPackageRegistry(),
  ).registry;
}

export function createBootstrapReadyFixture(keyId = 'bootstrap-key') {
  const unsignedRegistry = createUnsignedBootstrapRegistry();
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const payload = createAgentSkillPackageCanonicalSignaturePayload(unsignedRegistry.packages[0]!);
  const signedRegistry = installSignature(
    unsignedRegistry,
    keyId,
    sign(null, Buffer.from(payload), privateKey).toString('base64'),
  );
  const packageId = signedRegistry.packages[0]?.id ?? '';
  const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
    createEmptyAgentSkillInstalledPackageRuntimePolicy(),
    signedRegistry,
    packageId,
    { runtimeEnabled: true, sandboxed: true, trusted: true },
  ).policy;
  const evidenceRegistry = createAgentSkillTrustEvidence(
    createEmptyAgentSkillTrustEvidenceRegistry(),
    signedRegistry,
    packageId,
  ).registry;
  const trustedKeys = upsertAgentSkillTrustedSignatureKey(createEmptyAgentSkillTrustedSignatureKeyRegistry(), {
    algorithm: 'ed25519',
    keyId,
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  }).registry;
  const verifier = createAgentSkillTrustedSignatureVerifierFromRegistry({
    registry: trustedKeys,
    verifySignature(input) {
      return verify(null, Buffer.from(input.payload), createPublicKey(input.publicKey), Buffer.from(input.signature, 'base64'));
    },
  }).verifier;

  return {
    evidenceRegistry,
    packageId,
    policy,
    signedRegistry,
    trustedPackageIds: createAgentSkillEffectiveTrustedPackageIds(policy, signedRegistry, evidenceRegistry),
    verifier,
  };
}
