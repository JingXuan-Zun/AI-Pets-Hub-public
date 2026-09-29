import { strict as assert } from 'node:assert';
import {
  createAgentSkillInstalledPackageHandlerContractReport,
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
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T04:00:00.000Z');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
const installed = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraft.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const packageId = installed.registry.packages[0]?.id ?? '';
const emptyPreview = createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry();

const missingReport = createAgentSkillInstalledPackageHandlerContractReport(installed.registry, emptyPreview);
assert.equal(missingReport.summary.missing, 1);
assert.equal(missingReport.rows[0]?.issues.join(','), 'contract-missing');

const previewRegistry = createAgentSkillInstalledPackageHandlerPreview(
  emptyPreview,
  installed.registry,
  packageId,
).registry;
const contractReport = createAgentSkillInstalledPackageHandlerContractReport(installed.registry, previewRegistry);
assert.equal(contractReport.summary.valid, 1);
assert.equal(contractReport.rows[0]?.contract?.inputContract, 'json-object');
assert.equal(contractReport.rows[0]?.contract?.permissionScope, 'agent-action-and-mcp-policy');
assert.equal(contractReport.rows[0]?.contract?.receiptShape, 'agent-runtime-result');
assert.equal(contractReport.rows[0]?.contract?.sandboxBoundary, 'agent-runtime-plus-mcp-approval');

const dashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installed.registry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy(),
  previewRegistry,
);
assert.equal(dashboard.rows[0]?.contractStatus, 'valid');

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageHandlerContractPanel.tsx');
const readinessSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimeReadinessPanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillInstalledPackageHandlerContractPanel/u);
assert.match(panelSource, /Handler contract/u);
assert.match(panelSource, /createAgentSkillInstalledPackageHandlerContractReport/u);
assert.match(readinessSource, /contractStatus/u);

console.log('agent skill handler contract smoke passed');
