import { strict as assert } from 'node:assert';
import {
  createAgentSkillExecutableHandlerGuardReport,
  createAgentSkillInstalledPackageHandlerPreview,
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

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T05:00:00.000Z');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
const installed = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraft.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const packageId = installed.registry.packages[0]?.id ?? '';
const emptyPolicy = createEmptyAgentSkillInstalledPackageRuntimePolicy();
const previewRegistry = createAgentSkillInstalledPackageHandlerPreview(
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry(),
  installed.registry,
  packageId,
).registry;

const blockedReport = createAgentSkillExecutableHandlerGuardReport(
  installed.registry,
  emptyPolicy,
  previewRegistry,
);
assert.equal(blockedReport.summary.blocked, 1);
assert.equal(blockedReport.rows[0]?.canRegister, false);
assert.equal(blockedReport.rows[0]?.guardIssueCodes.includes('runtime-enable-missing'), true);
assert.equal(blockedReport.rows[0]?.guardIssueCodes.includes('loader-preview-only'), false);

const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
  emptyPolicy,
  installed.registry,
  packageId,
  { runtimeEnabled: true, sandboxed: true, trusted: true },
).policy;
const registerableReport = createAgentSkillExecutableHandlerGuardReport(
  installed.registry,
  policy,
  previewRegistry,
);
assert.equal(registerableReport.summary.registerable, 1);
assert.equal(registerableReport.rows[0]?.canRegister, true);
assert.equal(registerableReport.rows[0]?.guardIssueCodes.length, 0);
assert.equal(registerableReport.rows[0]?.preflightIssueCodes.join(','), 'loader-preview-only');

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExecutableHandlerGuardPanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillExecutableHandlerGuardPanel/u);
assert.match(panelSource, /Handler registration guard/u);
assert.match(panelSource, /dry-run only/u);

console.log('agent skill executable handler guard smoke passed');
