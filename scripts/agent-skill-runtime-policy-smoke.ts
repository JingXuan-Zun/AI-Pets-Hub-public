import { strict as assert } from 'node:assert';
import {
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy,
  createAgentSkillInstalledPackageRuntimePreflightReport,
  createAgentSkillPackageExport,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillInstalledPackageRuntimePolicyJson,
  parseAgentSkillPackageImportJson,
  pruneAgentSkillInstalledPackageRuntimePolicy,
  removeAgentSkillInstalledPackageRuntimePolicyRecord,
  saveAgentSkillPackageImportPreviewToLibrary,
  serializeAgentSkillInstalledPackageRuntimePolicy,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T01:00:00.000Z');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draftResult = saveAgentSkillPackageImportPreviewToLibrary(
  createEmptyAgentSkillPackageDraftLibrary(),
  importPreview,
  '2026-06-29T01:01:00.000Z',
);
const enabledDraftResult = setAgentSkillPackageDraftEnabled(
  draftResult.library,
  draftResult.draft?.id ?? '',
  true,
  '2026-06-29T01:02:00.000Z',
);
const installedResult = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraftResult.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
  '2026-06-29T01:03:00.000Z',
);
const registry = installedResult.registry;
const packageId = registry.packages[0]?.id ?? '';

assert.ok(packageId);
assert.equal(registry.packages[0]?.runtimeEnabled, false);

const emptyPolicy = createEmptyAgentSkillInstalledPackageRuntimePolicy();
const trustedResult = setAgentSkillInstalledPackageRuntimePolicyRecord(
  emptyPolicy,
  registry,
  packageId,
  { trusted: true },
  '2026-06-29T01:04:00.000Z',
);
assert.equal(trustedResult.error, null);
assert.equal(trustedResult.policy.records[0]?.trusted, true);
assert.equal(trustedResult.policy.records[0]?.runtimeEnabled, false);
assert.equal(registry.packages[0]?.runtimeEnabled, false);

const fullPolicyResult = setAgentSkillInstalledPackageRuntimePolicyRecord(
  trustedResult.policy,
  registry,
  packageId,
  { runtimeEnabled: true, sandboxed: true },
  '2026-06-29T01:05:00.000Z',
);
assert.equal(fullPolicyResult.error, null);

const restoredPolicy = parseAgentSkillInstalledPackageRuntimePolicyJson(
  serializeAgentSkillInstalledPackageRuntimePolicy(fullPolicyResult.policy),
);
const policyOptions = createAgentSkillInstalledPackageRuntimePreflightOptionsFromPolicy(restoredPolicy);
assert.deepEqual(policyOptions.trustedPackageIds, [packageId]);
assert.deepEqual(policyOptions.runtimeEnabledPackageIds, [packageId]);
assert.deepEqual(policyOptions.sandboxedPackageIds, [packageId]);

const policyPreflightReport = createAgentSkillInstalledPackageRuntimePreflightReport(registry, policyOptions);
assert.equal(policyPreflightReport.summary.blocked, 1);
assert.equal(
  policyPreflightReport.rows[0]?.issues.map((issue) => issue.code).join(','),
  'loader-missing',
);

const metadataOnlyBoundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(registry, policyOptions);
assert.equal(metadataOnlyBoundaryReport.summary['metadata-only'], 1);
assert.equal(metadataOnlyBoundaryReport.rows[0]?.executableHandlerRegistered, false);

const readyBoundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(registry, {
  ...policyOptions,
  executableHandlerPackageIds: [packageId],
});
assert.equal(readyBoundaryReport.summary['execution-ready'], 1);

const removedPolicy = removeAgentSkillInstalledPackageRuntimePolicyRecord(restoredPolicy, packageId);
assert.equal(removedPolicy.records.length, 0);
assert.equal(
  setAgentSkillInstalledPackageRuntimePolicyRecord(emptyPolicy, registry, 'missing', { trusted: true }).error,
  'Installed package record was not found.',
);
assert.equal(pruneAgentSkillInstalledPackageRuntimePolicy(restoredPolicy, createEmptyAgentSkillInstalledPackageRegistry()).records.length, 0);

const packageExchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const policyPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimePolicyPanel.tsx');
const policyHookSource = readProjectFile('src/components/settings/useSettingsAgentSkillInstalledPackageRuntimePolicy.ts');
const metadataPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimeMetadataPanel.tsx');
assert.match(packageExchangeSource, /SettingsAgentSkillInstalledPackageRuntimePolicyPanel/u);
assert.match(packageExchangeSource, /policyOptions=/u);
assert.match(policyPanelSource, /Runtime policy/u);
assert.match(policyPanelSource, /trusted/u);
assert.match(policyPanelSource, /runtimeEnabled/u);
assert.match(policyPanelSource, /sandboxed/u);
assert.match(policyHookSource, /desktop-pet\.agent-skill-installed-runtime-policy\.v1/u);
assert.match(metadataPanelSource, /policyOptions/u);

console.log('agent skill runtime policy smoke passed');
