import { strict as assert } from 'node:assert';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillExecutableHandlerGuardReport,
  createAgentSkillFixtureSignatureVerifier,
  createAgentSkillInstalledPackageHandlerPreview,
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
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const signature = {
  algorithm: 'ed25519',
  digest: 'sha256:test-fixture',
  keyId: 'fixture-key',
  signature: 'fixture-signature',
};

function createReadyContext(packageSignature = signature) {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T13:00:00.000Z');
  const importPreview = parseAgentSkillPackageImportJson(JSON.stringify({ ...packageExport!, signature: packageSignature }));
  const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
  const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
  const registry = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
    enabledDraft.library,
    createEmptyAgentSkillInstalledPackageRegistry(),
  ).registry;
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
  return { evidenceRegistry, packageId, policy, previewRegistry, registry, trustedPackageIds };
}

const context = createReadyContext();
const verifier = createAgentSkillFixtureSignatureVerifier([{ ...signature, packageId: context.packageId }]);
const verifiedReport = createAgentSkillPackageSignatureVerificationReport(context.registry, { verifier });
assert.equal(verifiedReport.summary.verified, 1);
assert.equal(verifiedReport.rows[0]?.verifier, 'fixture-signature-verifier');
assert.deepEqual(verifiedReport.rows[0]?.issueCodes, []);

const invalidContext = createReadyContext({ ...signature, signature: 'tampered-signature' });
const invalidReport = createAgentSkillPackageSignatureVerificationReport(invalidContext.registry, { verifier });
assert.equal(invalidReport.summary.invalid, 1);
assert.ok(invalidReport.rows[0]?.issueCodes.includes('signature-fixture-mismatch'));

const externalGuard = createAgentSkillExecutableHandlerGuardReport(
  context.registry,
  context.policy,
  context.previewRegistry,
  { signatureMode: 'external-package', signatureVerifier: verifier, trustedPackageIds: context.trustedPackageIds },
);
assert.equal(externalGuard.summary.blocked, 1);
assert.equal(externalGuard.rows[0]?.guardIssueCodes.includes('external-package-loader-disabled'), true);
assert.equal(externalGuard.rows[0]?.guardIssueCodes.some((code) => code.startsWith('signature-')), false);

const modeReport = createAgentSkillRuntimeModeDecisionReport(
  context.registry,
  context.policy,
  context.previewRegistry,
  context.evidenceRegistry,
  { signatureVerifier: verifier, trustedPackageIds: context.trustedPackageIds },
);
assert.equal(modeReport.rows[0]?.signatureStatus, 'verified');
assert.equal(modeReport.rows[0]?.externalPackageIssueCodes.includes('external-package-loader-disabled'), true);

const verifierSource = readProjectFile('src/agent/agentSkillPackageSignatureVerifier.ts');
const verificationSource = readProjectFile('src/agent/agentSkillPackageSignatureVerification.ts');
assert.match(verifierSource, /createAgentSkillFixtureSignatureVerifier/u);
assert.match(verificationSource, /AgentSkillPackageSignatureVerificationOptions/u);
assert.match(verificationSource, /return 'verified'/u);

console.log('agent skill package signature verifier smoke passed');
