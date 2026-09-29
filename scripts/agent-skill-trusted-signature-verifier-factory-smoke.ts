import { strict as assert } from 'node:assert';
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import {
  createAgentSkillPackageCanonicalSignaturePayload,
  createAgentSkillPackageExport,
  createAgentSkillPackageSignatureVerificationReport,
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
} from '../src/agent';

function createUnsignedInstalledRegistry() {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T16:00:00.000Z');
  const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
  const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
  const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
  return gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabledDraft.library,
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
        signature: {
          algorithm: 'ed25519',
          digest: 'sha256:canonical-v1',
          keyId: 'factory-key',
          signature,
        },
      },
    }],
  };
}

const emptyResult = createAgentSkillTrustedSignatureVerifierFromRegistry({
  registry: createEmptyAgentSkillTrustedSignatureKeyRegistry(),
  verifySignature: () => false,
});
assert.equal(emptyResult.verifier, null);
assert.deepEqual(emptyResult.issueCodes, ['trusted-signature-key-registry-empty']);

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const unsignedRegistry = createUnsignedInstalledRegistry();
const payload = createAgentSkillPackageCanonicalSignaturePayload(unsignedRegistry.packages[0]!);
const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
const signedRegistry = installSignature(unsignedRegistry, signature);
const trustedKeys = upsertAgentSkillTrustedSignatureKey(createEmptyAgentSkillTrustedSignatureKeyRegistry(), {
  algorithm: 'ed25519',
  keyId: 'factory-key',
  label: 'Factory key',
  publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
}).registry;
const result = createAgentSkillTrustedSignatureVerifierFromRegistry({
  registry: trustedKeys,
  verifySignature(input) {
    return verify(
      null,
      Buffer.from(input.payload),
      createPublicKey(input.publicKey),
      Buffer.from(input.signature, 'base64'),
    );
  },
});
assert.deepEqual(result.issueCodes, []);
assert.ok(result.verifier);

const report = createAgentSkillPackageSignatureVerificationReport(signedRegistry, {
  verifier: result.verifier,
});
assert.equal(report.summary.verified, 1);
assert.equal(report.rows[0]?.verifier, 'crypto-signature-verifier');

console.log('agent skill trusted signature verifier factory smoke passed');
