import { strict as assert } from 'node:assert';
import {
  createAgentSkillEffectiveTrustedPackageIds,
  createAgentSkillExecutableHandlerGuardReport,
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillPackageExport,
  createAgentSkillTrustEvidence,
  createAgentSkillTrustEvidenceReport,
  createEmptyAgentSkillExecutableHandlerRegistry,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  createEmptyAgentSkillTrustEvidenceRegistry,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  parseAgentSkillTrustEvidenceRegistryJson,
  registerAgentSkillExecutableHandlersFromPreviews,
  removeAgentSkillTrustEvidence,
  runAgentSkillExecutableHandler,
  saveAgentSkillPackageImportPreviewToLibrary,
  serializeAgentSkillTrustEvidenceRegistry,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T08:00:00.000Z');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
const installed = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraft.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const packageId = installed.registry.packages[0]?.id ?? '';
const previewRegistry = createAgentSkillInstalledPackageHandlerPreview(
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry(),
  installed.registry,
  packageId,
).registry;
const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
  createEmptyAgentSkillInstalledPackageRuntimePolicy(),
  installed.registry,
  packageId,
  { runtimeEnabled: true, sandboxed: true, trusted: true },
).policy;

const emptyEvidence = createEmptyAgentSkillTrustEvidenceRegistry();
const emptyEffectiveTrust = createAgentSkillEffectiveTrustedPackageIds(policy, installed.registry, emptyEvidence);
assert.deepEqual(emptyEffectiveTrust, []);
const blockedGuard = createAgentSkillExecutableHandlerGuardReport(
  installed.registry,
  policy,
  previewRegistry,
  { trustedPackageIds: emptyEffectiveTrust },
);
assert.equal(blockedGuard.rows[0]?.guardIssueCodes.includes('trust-missing'), true);

const evidenceResult = createAgentSkillTrustEvidence(
  emptyEvidence,
  installed.registry,
  packageId,
  '2026-06-29T08:01:00.000Z',
);
assert.equal(evidenceResult.error, null);
const restoredEvidence = parseAgentSkillTrustEvidenceRegistryJson(
  serializeAgentSkillTrustEvidenceRegistry(evidenceResult.registry),
);
const report = createAgentSkillTrustEvidenceReport(installed.registry, restoredEvidence);
assert.equal(report.summary.valid, 1);
assert.equal(report.rows[0]?.evidence?.reviewedAt, '2026-06-29T08:01:00.000Z');

const effectiveTrust = createAgentSkillEffectiveTrustedPackageIds(policy, installed.registry, restoredEvidence);
assert.deepEqual(effectiveTrust, [packageId]);
const registration = registerAgentSkillExecutableHandlersFromPreviews(
  createEmptyAgentSkillExecutableHandlerRegistry(),
  installed.registry,
  policy,
  previewRegistry,
  '2026-06-29T08:02:00.000Z',
  { trustedPackageIds: effectiveTrust },
);
assert.equal(registration.registeredCount, 1);

const runResult = runAgentSkillExecutableHandler(
  registration.registry,
  installed.registry,
  policy,
  previewRegistry,
  { dryRun: true, inputJson: '{"animationId":"wave"}', packageId, skillId: 'character.animation' },
  { trustedPackageIds: effectiveTrust },
);
assert.equal(runResult.error, null);
assert.equal(runResult.result?.marker, '[animation:wave]');

const removedEvidence = removeAgentSkillTrustEvidence(restoredEvidence, packageId);
const staleTrust = createAgentSkillEffectiveTrustedPackageIds(policy, installed.registry, removedEvidence);
const blockedRun = runAgentSkillExecutableHandler(
  registration.registry,
  installed.registry,
  policy,
  previewRegistry,
  { dryRun: true, inputJson: '{}', packageId, skillId: 'character.animation' },
  { trustedPackageIds: staleTrust },
);
assert.match(blockedRun.error ?? '', /trust-missing/u);

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillTrustEvidencePanel.tsx');
const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillTrustEvidenceRegistry.ts');
assert.match(exchangeSource, /SettingsAgentSkillTrustEvidencePanel/u);
assert.match(exchangeSource, /effectiveTrustedPackageIds/u);
assert.match(panelSource, /Trust evidence/u);
assert.match(panelSource, /createAgentSkillTrustEvidenceReport/u);
assert.match(hookSource, /desktop-pet\.agent-skill-trust-evidence-registry\.v1/u);
assert.match(hookSource, /createAgentSkillEffectiveTrustedPackageIds/u);

console.log('agent skill trust evidence smoke passed');
