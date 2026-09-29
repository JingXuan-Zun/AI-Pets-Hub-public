import { createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import {
  createAgentSkillPackageCanonicalSignaturePayload,
  createAgentSkillPackageExport,
  createAgentSkillTrustedSignatureVerifierFromRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillPackageDraftLibrary,
  createEmptyAgentSkillTrustedSignatureKeyRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillPackageDraftEnabled,
  upsertAgentSkillTrustedSignatureKey,
  type AgentSkillInstalledPackageRegistry,
  type AgentSkillPackageDraftLibrary,
} from '../src/agent';

export function createEnabledUpdateDraftLibrary(exportedAt: string, signature?: string, keyId = 'update-key') {
  const packageExport = createAgentSkillPackageExport('character.animation', exportedAt)!;
  const packageJson = signature
    ? { ...packageExport, signature: { algorithm: 'ed25519', digest: 'sha256:canonical-v1', keyId, signature } }
    : packageExport;
  const preview = parseAgentSkillPackageImportJson(JSON.stringify(packageJson));
  const saved = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), preview, exportedAt);
  return setAgentSkillPackageDraftEnabled(saved.library, saved.draft?.id ?? '', true, exportedAt).library;
}

export function createSignatureForUpdateDraft(library: AgentSkillPackageDraftLibrary, privateKey: KeyObject) {
  const draft = library.drafts[0]!;
  const payload = createAgentSkillPackageCanonicalSignaturePayload({
    id: draft.id,
    installedAt: draft.savedAt,
    package: draft.package,
    runtimeEnabled: false,
    skillId: draft.skillId,
    sourceDraftId: draft.id,
  });
  return sign(null, Buffer.from(payload), privateKey).toString('base64');
}

export function createUpdateSignatureVerifier(keyId: string, publicKey: KeyObject) {
  const trustedRegistry = upsertAgentSkillTrustedSignatureKey(createEmptyAgentSkillTrustedSignatureKeyRegistry(), {
    algorithm: 'ed25519',
    keyId,
    publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
  }).registry;
  return createAgentSkillTrustedSignatureVerifierFromRegistry({
    registry: trustedRegistry,
    verifySignature(input) {
      return verify(
        null,
        Buffer.from(input.payload),
        createPublicKey(input.publicKey),
        Buffer.from(input.signature, 'base64'),
      );
    },
  }).verifier;
}

export function createSignedUpdateFixture(exportedAt = '2026-06-29T20:00:00.000Z', keyId = 'update-key') {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const unsignedForSigning = createEnabledUpdateDraftLibrary(exportedAt);
  const signature = createSignatureForUpdateDraft(unsignedForSigning, privateKey);
  return {
    signedLibrary: createEnabledUpdateDraftLibrary(exportedAt, signature, keyId),
    verifier: createUpdateSignatureVerifier(keyId, publicKey),
  };
}

export function installUpdateDraftLibrary(library: AgentSkillPackageDraftLibrary) {
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    library,
    createEmptyAgentSkillInstalledPackageRegistry(),
    library.drafts[0]?.savedAt,
  ).registry;
}

export function replaceInstalledPackageExportedAt(
  registry: AgentSkillInstalledPackageRegistry,
  packageExportedAt: string,
) {
  return {
    ...registry,
    packages: registry.packages.map((item) => ({
      ...item,
      package: { ...item.package, exportedAt: packageExportedAt },
    })),
  };
}
