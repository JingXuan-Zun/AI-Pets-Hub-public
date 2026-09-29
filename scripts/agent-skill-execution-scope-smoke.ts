import { strict as assert } from 'node:assert';
import {
  createAgentSkillExecutionScopeReport,
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillPackageExport,
  createAgentSkillTrustEvidence,
  createEmptyAgentSkillExecutableHandlerRegistry,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  createEmptyAgentSkillTrustEvidenceRegistry,
  createAgentSkillEffectiveTrustedPackageIds,
  getAgentSkillExecutableHandlerPackageIds,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  registerAgentSkillExecutableHandlersFromPreviews,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T09:00:00.000Z');
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
const evidence = createAgentSkillTrustEvidence(
  createEmptyAgentSkillTrustEvidenceRegistry(),
  installed.registry,
  packageId,
).registry;
const trustedPackageIds = createAgentSkillEffectiveTrustedPackageIds(policy, installed.registry, evidence);

const blockedScope = createAgentSkillExecutionScopeReport(installed.registry, previewRegistry, {
  previewHandlerPackageIds: [packageId],
  runtimeEnabledPackageIds: [packageId],
  sandboxedPackageIds: [packageId],
  trustedPackageIds,
});
assert.equal(blockedScope.summary.blocked, 1);
assert.equal(blockedScope.rows[0]?.contractStatus, 'valid');
assert.equal(blockedScope.rows[0]?.handlerRegistration, 'preview');
assert.equal(blockedScope.rows[0]?.issues.some((issue) => issue.code === 'execution-boundary-not-ready'), true);
assert.ok(blockedScope.rows[0]?.allowedInputKeys.includes('timeline'));
assert.ok(blockedScope.rows[0]?.packageInputKeys.includes('animationId'));

const registered = registerAgentSkillExecutableHandlersFromPreviews(
  createEmptyAgentSkillExecutableHandlerRegistry(),
  installed.registry,
  policy,
  previewRegistry,
  '2026-06-29T09:01:00.000Z',
  { trustedPackageIds },
);
const scopedReport = createAgentSkillExecutionScopeReport(installed.registry, previewRegistry, {
  executableHandlerPackageIds: getAgentSkillExecutableHandlerPackageIds(registered.registry),
  previewHandlerPackageIds: [packageId],
  runtimeEnabledPackageIds: [packageId],
  sandboxedPackageIds: [packageId],
  trustedPackageIds,
});
assert.equal(scopedReport.summary.scoped, 1);
assert.equal(scopedReport.rows[0]?.issues.length, 0);
assert.equal(scopedReport.rows[0]?.permissionScope, 'agent-action-and-mcp-policy');
assert.equal(scopedReport.rows[0]?.permissionBoundary, 'agent-action-and-mcp-policy');

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExecutionScopePanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillExecutionScopePanel/u);
assert.match(exchangeSource, /loaderOptions/u);
assert.match(panelSource, /Execution scope/u);
assert.match(panelSource, /createAgentSkillExecutionScopeReport/u);
assert.match(panelSource, /allowedInputKeys/u);

console.log('agent skill execution scope smoke passed');
