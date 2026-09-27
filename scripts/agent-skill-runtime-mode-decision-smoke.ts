import { strict as assert } from 'node:assert';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillPackageExport,
  createAgentSkillRuntimeModeDecisionReport,
  createAgentSkillTrustEvidence,
  createEmptyAgentSkillExecutableHandlerRegistry,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  createEmptyAgentSkillTrustEvidenceRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  registerAgentSkillExecutableHandlersFromPreviews,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

function createReadyContext(signature?: unknown) {
  const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T12:00:00.000Z');
  const packageJson = JSON.stringify(signature ? { ...packageExport!, signature } : packageExport);
  const importPreview = parseAgentSkillPackageImportJson(packageJson);
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

const unsignedContext = createReadyContext();
const registerableReport = createAgentSkillRuntimeModeDecisionReport(
  unsignedContext.registry,
  unsignedContext.policy,
  unsignedContext.previewRegistry,
  unsignedContext.evidenceRegistry,
  { trustedPackageIds: unsignedContext.trustedPackageIds },
);
assert.equal(registerableReport.summary['local-resolver-registerable'], 1);
assert.equal(registerableReport.rows[0]?.activeMode, 'none');
assert.equal(registerableReport.rows[0]?.externalPackageStatus, 'disabled');
assert.ok(registerableReport.rows[0]?.externalPackageIssueCodes.includes('external-package-loader-disabled'));
assert.ok(registerableReport.rows[0]?.externalPackageIssueCodes.includes('package-signature-missing'));

const handlerRegistry = registerAgentSkillExecutableHandlersFromPreviews(
  createEmptyAgentSkillExecutableHandlerRegistry(),
  unsignedContext.registry,
  unsignedContext.policy,
  unsignedContext.previewRegistry,
  '2026-06-29T12:01:00.000Z',
  { trustedPackageIds: unsignedContext.trustedPackageIds },
).registry;
const activeReport = createAgentSkillRuntimeModeDecisionReport(
  unsignedContext.registry,
  unsignedContext.policy,
  unsignedContext.previewRegistry,
  unsignedContext.evidenceRegistry,
  { executableHandlerRegistry: handlerRegistry, trustedPackageIds: unsignedContext.trustedPackageIds },
);
assert.equal(activeReport.summary['local-resolver-active'], 1);
assert.equal(activeReport.rows[0]?.activeMode, 'local-skill-resolver');
assert.equal(activeReport.rows[0]?.loaderKind, 'local-skill-resolver');
assert.equal(activeReport.rows[0]?.boundaryStatus, 'execution-ready');
assert.equal(activeReport.rows[0]?.scopeStatus, 'scoped');

const signedContext = createReadyContext({
  algorithm: 'ed25519',
  digest: 'sha256:test',
  keyId: 'local-dev-key',
  signature: 'placeholder-signature',
});
const signedReport = createAgentSkillRuntimeModeDecisionReport(
  signedContext.registry,
  signedContext.policy,
  signedContext.previewRegistry,
  signedContext.evidenceRegistry,
  { trustedPackageIds: signedContext.trustedPackageIds },
);
assert.equal(signedReport.rows[0]?.signatureStatus, 'unverified');
assert.ok(signedReport.rows[0]?.externalPackageIssueCodes.includes('signature-unverified'));
assert.ok(signedReport.rows[0]?.externalPackageIssueCodes.includes('signature-verifier-missing'));

const securityPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSecurityPanels.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillRuntimeModeDecisionPanel.tsx');
assert.match(securityPanelSource, /SettingsAgentSkillRuntimeModeDecisionPanel/u);
assert.match(panelSource, /Runtime mode decision/u);
assert.match(panelSource, /externalPackageStatus/u);
assert.match(panelSource, /localResolverStatus/u);

console.log('agent skill runtime mode decision smoke passed');
