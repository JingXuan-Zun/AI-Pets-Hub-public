import { strict as assert } from 'node:assert';
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillExternalLoaderIpcContractPreviewReport,
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
  getAgentSkillExternalLoaderRequiredIpcContractCodes,
  getAgentSkillExternalSandboxRequiredEvidenceCodes,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
  upsertAgentSkillTrustedSignatureKey,
  type AgentSkillInstalledPackageRegistry,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

function createUnsignedRegistry() {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T22:30:00.000Z');
  const preview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
  const saved = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), preview);
  const enabled = setAgentSkillPackageDraftEnabled(saved.library, saved.draft?.id ?? '', true);
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
        signature: { algorithm: 'ed25519', digest: 'sha256:canonical-v1', keyId: 'ipc-key', signature },
      },
    }],
  };
}

const unsignedRegistry = createUnsignedRegistry();
const blockedReport = createAgentSkillExternalLoaderIpcContractPreviewReport(
  unsignedRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy(),
  createEmptyAgentSkillTrustEvidenceRegistry(),
);
assert.equal(blockedReport.rows[0]?.status, 'blocked');
assert.ok(blockedReport.rows[0]?.issueCodes.includes('missing-ipc-json-request-schema'));
assert.equal(blockedReport.rows[0]?.loaderState, 'disabled');

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const payload = createAgentSkillPackageCanonicalSignaturePayload(unsignedRegistry.packages[0]!);
const signedRegistry = installSignature(unsignedRegistry, sign(null, Buffer.from(payload), privateKey).toString('base64'));
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
  keyId: 'ipc-key',
  publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
}).registry;
const verifier = createAgentSkillTrustedSignatureVerifierFromRegistry({
  registry: trustedKeys,
  verifySignature(input) {
    return verify(null, Buffer.from(input.payload), createPublicKey(input.publicKey), Buffer.from(input.signature, 'base64'));
  },
}).verifier;
const trustedPackageIds = createAgentSkillEffectiveTrustedPackageIds(policy, signedRegistry, evidenceRegistry);
const readyReport = createAgentSkillExternalLoaderIpcContractPreviewReport(
  signedRegistry,
  policy,
  evidenceRegistry,
  {
    contractCodes: getAgentSkillExternalLoaderRequiredIpcContractCodes(),
    evidenceCodes: getAgentSkillExternalSandboxRequiredEvidenceCodes(),
    signatureVerifier: verifier,
    trustedPackageIds,
  },
);
assert.equal(readyReport.summary['contract-ready-if-loader-enabled'], 1);
assert.equal(readyReport.summary.disabled, 1);
assert.deepEqual(readyReport.rows[0]?.issueCodes, ['external-package-loader-disabled']);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExternalLoaderIpcContractPanel.tsx');
const securitySource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
assert.match(panelSource, /External loader IPC contract/u);
assert.match(securitySource, /SettingsAgentSkillExternalLoaderIpcContractPanel/u);
assert.match(panelSource, /getAgentSkillExternalLoaderRequiredIpcContractCodes/u);

console.log('agent skill external loader ipc contract smoke passed');
