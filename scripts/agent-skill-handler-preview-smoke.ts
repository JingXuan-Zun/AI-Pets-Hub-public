import { strict as assert } from 'node:assert';
import {
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  createAgentSkillInstalledPackageRuntimePreflightReport,
  createAgentSkillPackageExport,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillPackageDraftLibrary,
  getAgentSkillInstalledPackageHandlerPreviewPackageIds,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillInstalledPackageHandlerPreviewRegistryJson,
  parseAgentSkillPackageImportJson,
  removeAgentSkillInstalledPackageHandlerPreview,
  saveAgentSkillPackageImportPreviewToLibrary,
  serializeAgentSkillInstalledPackageHandlerPreviewRegistry,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T02:00:00.000Z');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draftResult = saveAgentSkillPackageImportPreviewToLibrary(
  createEmptyAgentSkillPackageDraftLibrary(),
  importPreview,
);
const enabledDraftResult = setAgentSkillPackageDraftEnabled(
  draftResult.library,
  draftResult.draft?.id ?? '',
  true,
);
const installedResult = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraftResult.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const installedRegistry = installedResult.registry;
const packageId = installedRegistry.packages[0]?.id ?? '';
const previewResult = createAgentSkillInstalledPackageHandlerPreview(
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry(),
  installedRegistry,
  packageId,
  '2026-06-29T02:01:00.000Z',
);

assert.equal(previewResult.error, null);
assert.equal(previewResult.preview?.packageId, packageId);
assert.equal(previewResult.preview?.source, 'local-preview');

const restoredPreviewRegistry = parseAgentSkillInstalledPackageHandlerPreviewRegistryJson(
  serializeAgentSkillInstalledPackageHandlerPreviewRegistry(previewResult.registry),
);
assert.deepEqual(getAgentSkillInstalledPackageHandlerPreviewPackageIds(restoredPreviewRegistry), [packageId]);

const previewOptions = {
  handlerPreviewPackageIds: getAgentSkillInstalledPackageHandlerPreviewPackageIds(restoredPreviewRegistry),
  runtimeEnabledPackageIds: [packageId],
  sandboxedPackageIds: [packageId],
  trustedPackageIds: [packageId],
};
const preflightReport = createAgentSkillInstalledPackageRuntimePreflightReport(installedRegistry, previewOptions);
assert.equal(preflightReport.summary.blocked, 1);
assert.equal(preflightReport.rows[0]?.handlerSource, 'preview');
assert.equal(preflightReport.rows[0]?.issues.map((issue) => issue.code).join(','), 'loader-preview-only');

const boundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(installedRegistry, {
  previewHandlerPackageIds: previewOptions.handlerPreviewPackageIds,
  runtimeEnabledPackageIds: previewOptions.runtimeEnabledPackageIds,
  sandboxedPackageIds: previewOptions.sandboxedPackageIds,
  trustedPackageIds: previewOptions.trustedPackageIds,
});
assert.equal(boundaryReport.summary['metadata-only'], 1);
assert.equal(boundaryReport.rows[0]?.handlerRegistration, 'preview');
assert.equal(boundaryReport.rows[0]?.executableHandlerRegistered, false);

assert.equal(
  createAgentSkillInstalledPackageHandlerPreview(restoredPreviewRegistry, installedRegistry, 'missing').error,
  'Installed package record was not found.',
);
assert.equal(removeAgentSkillInstalledPackageHandlerPreview(restoredPreviewRegistry, packageId).previews.length, 0);

const packageExchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const previewPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageHandlerPreviewPanel.tsx');
const previewHookSource = readProjectFile('src/components/settings/useSettingsAgentSkillInstalledPackageHandlerPreviewRegistry.ts');
const metadataPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimeMetadataPanel.tsx');
assert.match(packageExchangeSource, /SettingsAgentSkillInstalledPackageHandlerPreviewPanel/u);
assert.match(packageExchangeSource, /handlerPreviewPackageIds/u);
assert.match(previewPanelSource, /Handler preview registry/u);
assert.match(previewPanelSource, /executable 0/u);
assert.match(previewHookSource, /desktop-pet\.agent-skill-handler-preview-registry\.v1/u);
assert.match(metadataPanelSource, /handlerRegistration/u);

console.log('agent skill handler preview smoke passed');
