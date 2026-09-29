import { strict as assert } from 'node:assert';
import {
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillInstalledPackageRuntimeReadinessDashboard,
  createAgentSkillPackageExport,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillPackageImportJson,
  saveAgentSkillPackageImportPreviewToLibrary,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T03:00:00.000Z');
const preview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), preview);
const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
const installed = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraft.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const packageId = installed.registry.packages[0]?.id ?? '';
const emptyPolicy = createEmptyAgentSkillInstalledPackageRuntimePolicy();
const emptyHandlerPreview = createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry();

const blockedDashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installed.registry,
  emptyPolicy,
  emptyHandlerPreview,
);
assert.equal(blockedDashboard.summary.blocked, 1);
assert.equal(blockedDashboard.rows[0]?.status, 'blocked');

const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
  emptyPolicy,
  installed.registry,
  packageId,
  { runtimeEnabled: true, sandboxed: true, trusted: true },
).policy;
const policyDashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installed.registry,
  policy,
  emptyHandlerPreview,
);
assert.equal(policyDashboard.summary['policy-ready'], 1);
assert.equal(policyDashboard.rows[0]?.preflightIssueCodes.join(','), 'loader-missing');

const handlerPreview = createAgentSkillInstalledPackageHandlerPreview(
  emptyHandlerPreview,
  installed.registry,
  packageId,
).registry;
const previewDashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installed.registry,
  policy,
  handlerPreview,
);
assert.equal(previewDashboard.summary['handler-preview'], 1);
assert.equal(previewDashboard.rows[0]?.handlerRegistration, 'preview');
assert.equal(previewDashboard.rows[0]?.preflightIssueCodes.join(','), 'loader-preview-only');

const executableDashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installed.registry,
  policy,
  handlerPreview,
  { executableHandlerPackageIds: [packageId] },
);
assert.equal(executableDashboard.summary['execution-ready'], 1);
assert.equal(executableDashboard.rows[0]?.handlerRegistration, 'registered');
assert.equal(executableDashboard.rows[0]?.preflightIssueCodes.length, 0);

const packageExchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const readinessPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimeReadinessPanel.tsx');
assert.match(packageExchangeSource, /SettingsAgentSkillInstalledPackageRuntimeReadinessPanel/u);
assert.match(readinessPanelSource, /Runtime readiness/u);
assert.match(readinessPanelSource, /createAgentSkillInstalledPackageRuntimeReadinessDashboard/u);
assert.match(readinessPanelSource, /handlerRegistration/u);

console.log('agent skill runtime readiness smoke passed');
