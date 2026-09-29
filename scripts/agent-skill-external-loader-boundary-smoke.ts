import { strict as assert } from 'node:assert';
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillExternalPackageLoaderBoundaryReport,
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
import { readProjectFile } from './smokeTestHarness.ts';

function createUnsignedRegistry() {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T19:00:00.000Z');
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
        signature: { algorithm: 'ed25519', digest: 'sha256:canonical-v1', keyId: 'loader-key', signature },
      },
    }],
  };
}

const unsignedRegistry = createUnsignedRegistry();
const emptyReport = createAgentSkillExternalPackageLoaderBoundaryReport(
  unsignedRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy(),
  createEmptyAgentSkillTrustEvidenceRegistry(),
);
assert.equal(emptyReport.summary.blocked, 1);
assert.equal(emptyReport.rows[0]?.loaderState, 'disabled');
assert.ok(emptyReport.rows[0]?.blockingIssueCodes.includes('external-package-loader-disabled'));
assert.ok(emptyReport.rows[0]?.readinessIssueCodes.includes('package-signature-missing'));

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const payload = createAgentSkillPackageCanonicalSignaturePayload(unsignedRegistry.packages[0]!);
const signature = sign(null, Buffer.from(payload), privateKey).toString('base64');
const signedRegistry = installSignature(unsignedRegistry, signature);
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
const trustedRegistry = upsertAgentSkillTrustedSignatureKey(createEmptyAgentSkillTrustedSignatureKeyRegistry(), {
  algorithm: 'ed25519',
  keyId: 'loader-key',
  publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
}).registry;
const verifier = createAgentSkillTrustedSignatureVerifierFromRegistry({
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
const trustedPackageIds = createAgentSkillEffectiveTrustedPackageIds(policy, signedRegistry, evidenceRegistry);
const readyReport = createAgentSkillExternalPackageLoaderBoundaryReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  { signatureVerifier: verifier, trustedPackageIds },
);
assert.equal(readyReport.summary['ready-if-loader-enabled'], 1);
assert.equal(readyReport.summary.disabled, 1);
assert.equal(readyReport.rows[0]?.loaderState, 'disabled');
assert.equal(readyReport.rows[0]?.signatureStatus, 'verified');
assert.equal(readyReport.rows[0]?.trustEvidenceStatus, 'valid');
assert.deepEqual(readyReport.rows[0]?.blockingIssueCodes, ['external-package-loader-disabled']);

const source = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
const panel = readProjectFile('src/components/settings/SettingsAgentSkillExternalLoaderBoundaryPanel.tsx');
assert.match(source, /SettingsAgentSkillExternalLoaderBoundaryPanel/u);
assert.match(panel, /External loader boundary/u);
assert.match(panel, /loaderState/u);

console.log('agent skill external loader boundary smoke passed');
