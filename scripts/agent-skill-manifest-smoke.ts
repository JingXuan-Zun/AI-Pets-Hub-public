import { strict as assert } from 'node:assert';
import {
  callAgentMcpTool,
  createEmptyAgentSkillPackageDraftLibrary,
  createAgentSkillPackageDraftReview,
  createAgentSkillPackageDraftLibraryExport,
  createAgentSkillPackageSourceView,
  createAgentSkillInstalledPackageAudit,
  createAgentSkillInstalledPackageRegistryExport,
  createAgentSkillInstalledPackageLoaderBoundaryReport,
  createAgentSkillInstalledPackageRuntimeMetadataReport,
  createAgentSkillInstalledPackageRuntimePreflightReport,
  createEmptyAgentSkillInstalledPackageRegistry,
  createAgentSkillAuthoringScaffold,
  createAgentSkillInstallValidationReport,
  createAgentSkillManifest,
  createAgentSkillPackageExport,
  listAgentMcpTools,
  parseAgentSkillPackageImportJson,
  parseAgentSkillPackageDraftLibraryJson,
  parseAgentSkillPackageDraftLibraryImportJson,
  parseAgentSkillInstalledPackageRegistryJson,
  parseAgentSkillInstalledPackageRegistryImportJson,
  removeAgentSkillPackageDraft,
  removeAgentSkillInstalledPackage,
  saveAgentSkillPackageImportPreviewToLibrary,
  serializeAgentSkillPackageDraftLibrary,
  serializeAgentSkillInstalledPackageRegistry,
  setAgentSkillPackageDraftEnabled,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
} from '../src/agent';
import { summarizeAgentMcpToolRisk } from '../src/agent/agentMcpRiskSummary';
import { type PetConfig } from '../src/types';
import {
  createSettingsSkillMcpProgressEvidenceText,
  parseSettingsSkillMcpProgressEvidenceText,
} from '../src/components/settings/settingsSkillMcpProgress.ts';
import {
  formatSettingsSkillMcpAreaLabel,
  formatSettingsSkillMcpStatusLabel,
} from '../src/components/settings/settingsSkillMcpProgressLocale.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const manifest = createAgentSkillManifest();

function createValidationConfig(options: { audio?: boolean; motion?: boolean } = {}) {
  return {
    customModelPresets: options.motion
      ? [
          {
            id: 'validation-model',
            motionBindings: [
              {
                format: 'vrma',
                id: 'wave',
                motionKey: 'happy',
                name: 'Wave',
                sourceUrl: 'C:/motions/wave.vrma',
              },
            ],
            name: 'Validation Model',
            type: '3d',
            url: 'C:/models/validation.vrm',
          },
        ]
      : [],
    musicAssets: options.audio
      ? [
          {
            id: 'song',
            name: 'Song',
            url: 'C:/music/song.mp3',
          },
        ]
      : [],
    settings: {
      localSttModelId: '',
      localTtsModelId: '',
      sttProvider: 'browser',
      ttsProvider: 'browser',
    },
  } as PetConfig;
}

assert.equal(manifest.summary.total, manifest.entries.length);
assert.ok(manifest.entries.some((entry) => entry.id === 'character.animation'));
assert.ok(manifest.entries.some((entry) => entry.id === 'mcp.tool'));
assert.equal(manifest.summary.stageCounts.mvp > 0, true);
assert.equal(manifest.summary.stageCounts.foundation > 0, true);
assert.equal(manifest.summary.riskCounts.action > 0, true);
assert.equal(manifest.summary.toolRoutedCount > 0, true);
assert.equal(manifest.summary.installStatusCounts.bundled > 0, true);
assert.equal(manifest.summary.installStatusCounts['external-required'] > 0, true);
assert.equal(manifest.summary.runtimeCounts.hybrid > 0, true);
assert.equal(manifest.summary.runtimeCounts['external-mcp'] > 0, true);
assert.equal(manifest.summary.assetRequirementCounts.motionBindings > 0, true);
assert.equal(manifest.summary.runtimeRequirementCounts['skill-registry'] > 0, true);

const animationEntry = manifest.entries.find((entry) => entry.id === 'character.animation');
assert.ok(animationEntry);
assert.ok(animationEntry.inputKeys.includes('timeline'));
assert.ok(animationEntry.inputKeys.includes('songId'));
assert.equal(animationEntry.package.installStatus, 'bundled');
assert.equal(animationEntry.package.runtime, 'hybrid');
assert.ok(animationEntry.package.assetRequirements.includes('motionBindings'));
assert.match(animationEntry.routeSummary, /local runtime/u);

const mcpEntry = manifest.entries.find((entry) => entry.id === 'mcp.tool');
assert.ok(mcpEntry);
assert.equal(mcpEntry.package.installStatus, 'external-required');
assert.ok(mcpEntry.package.assetRequirements.includes('optional:mcp-server-config'));

const desktopEntry = manifest.entries.find((entry) => entry.id === 'desktop.observation');
assert.ok(desktopEntry);
assert.equal(desktopEntry.preferredToolRoutes.every((route) => route.available), true);
assert.ok(desktopEntry.preferredToolRoutes.some((route) => route.name === 'observe_windows_and_apps'));
assert.ok(desktopEntry.preferredToolRoutes.some((route) => route.name === 'execute_desktop_observation'));

const platformTools = listAgentMcpTools('platform');
assert.ok(platformTools.some((tool) => tool.name === 'skills.manifest'));
assert.ok(platformTools.some((tool) => tool.name === 'skills.scaffold'));
const manifestTool = platformTools.find((tool) => tool.name === 'skills.manifest');
assert.ok(manifestTool);
assert.equal(summarizeAgentMcpToolRisk(manifestTool).approvalMode, 'silent');
assert.equal(summarizeAgentMcpToolRisk(manifestTool).risk, 'read');
const scaffoldTool = platformTools.find((tool) => tool.name === 'skills.scaffold');
assert.ok(scaffoldTool);
assert.equal(summarizeAgentMcpToolRisk(scaffoldTool).approvalMode, 'silent');
assert.equal(summarizeAgentMcpToolRisk(scaffoldTool).risk, 'read');

const mcpResult = callAgentMcpTool({
  name: 'skills.manifest',
  serverId: 'platform',
});
assert.equal(mcpResult.isError, undefined);
assert.equal(mcpResult.structuredContent?.manifest.summary.total, manifest.summary.total);

const scaffold = createAgentSkillAuthoringScaffold('character.animation');
assert.equal(scaffold?.skill.id, 'character.animation');
assert.equal(scaffold?.createdFrom, 'agent-skill-manifest');
assert.equal(scaffold?.package.runtime, 'hybrid');
assert.equal(scaffold?.inputTemplate.timeline, '<optional>');
assert.ok(scaffold?.todo.some((item) => /asset/u.test(item)));
assert.equal(createAgentSkillAuthoringScaffold('missing.skill'), null);

const scaffoldResult = callAgentMcpTool({
  argumentsJson: '{"skillId":"character.animation"}',
  name: 'skills.scaffold',
  serverId: 'platform',
});
assert.equal(scaffoldResult.isError, undefined);
assert.equal(scaffoldResult.structuredContent?.scaffold.skill.id, 'character.animation');

const missingScaffoldResult = callAgentMcpTool({
  argumentsJson: '{"skillId":"missing.skill"}',
  name: 'skills.scaffold',
  serverId: 'platform',
});
assert.equal(missingScaffoldResult.isError, true);

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T00:00:00.000Z');
assert.equal(packageExport?.kind, 'agent-skill-package.v1');
assert.equal(packageExport?.scaffold.skill.id, 'character.animation');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
assert.equal(importPreview.ok, true);
assert.equal(importPreview.skillId, 'character.animation');
assert.equal(importPreview.errors.length, 0);

const emptyDraftLibrary = createEmptyAgentSkillPackageDraftLibrary();
const draftSaveResult = saveAgentSkillPackageImportPreviewToLibrary(emptyDraftLibrary, importPreview, '2026-06-29T00:00:00.000Z');
assert.equal(draftSaveResult.error, null);
assert.equal(draftSaveResult.library.drafts.length, 1);
assert.equal(draftSaveResult.draft?.skillId, 'character.animation');
const duplicateDraftSaveResult = saveAgentSkillPackageImportPreviewToLibrary(draftSaveResult.library, importPreview);
assert.equal(duplicateDraftSaveResult.library.drafts.length, 1);
const restoredDraftLibrary = parseAgentSkillPackageDraftLibraryJson(
  serializeAgentSkillPackageDraftLibrary(duplicateDraftSaveResult.library),
);
assert.equal(restoredDraftLibrary.drafts[0]?.skillId, 'character.animation');
const draftReview = createAgentSkillPackageDraftReview(restoredDraftLibrary, restoredDraftLibrary.drafts[0]?.id ?? '');
assert.equal(draftReview?.eligible, true);
assert.equal(draftReview?.status, 'warning');
const enabledDraftResult = setAgentSkillPackageDraftEnabled(
  restoredDraftLibrary,
  restoredDraftLibrary.drafts[0]?.id ?? '',
  true,
  '2026-06-29T00:01:00.000Z',
);
assert.equal(enabledDraftResult.error, null);
assert.equal(enabledDraftResult.library.drafts[0]?.enabled, true);
assert.equal(enabledDraftResult.library.drafts[0]?.reviewedAt, '2026-06-29T00:01:00.000Z');
const enabledSourceView = createAgentSkillPackageSourceView(enabledDraftResult.library);
const animationSource = enabledSourceView.rows.find((row) => row.skillId === 'character.animation');
assert.equal(animationSource?.primarySource, 'enabled-draft');
assert.equal(enabledSourceView.summary['enabled-draft'], 1);
const installedGateResult = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraftResult.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
  '2026-06-29T00:04:00.000Z',
);
assert.equal(installedGateResult.installedCount, 1);
assert.equal(installedGateResult.registry.packages[0]?.runtimeEnabled, false);
assert.equal(installedGateResult.registry.packages[0]?.skillId, 'character.animation');
const repeatedInstalledGateResult = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraftResult.library,
  installedGateResult.registry,
);
assert.equal(repeatedInstalledGateResult.installedCount, 0);
assert.equal(repeatedInstalledGateResult.skippedCount, 1);
const restoredInstalledRegistry = parseAgentSkillInstalledPackageRegistryJson(
  serializeAgentSkillInstalledPackageRegistry(installedGateResult.registry),
);
assert.equal(restoredInstalledRegistry.packages.length, 1);
const installedAudit = createAgentSkillInstalledPackageAudit(restoredInstalledRegistry);
assert.equal(installedAudit.total, 1);
assert.equal(installedAudit.runtimeEnabledCount, 0);
assert.equal(installedAudit.unknownSkillCount, 0);
const runtimeMetadataReport = createAgentSkillInstalledPackageRuntimeMetadataReport(restoredInstalledRegistry);
assert.equal(runtimeMetadataReport.summary['runtime-disabled'], 1);
assert.equal(runtimeMetadataReport.summary['metadata-ready'], 0);
assert.equal(runtimeMetadataReport.rows[0]?.registryVersion, '0.3.0');
const runtimePreflightReport = createAgentSkillInstalledPackageRuntimePreflightReport(restoredInstalledRegistry);
assert.equal(runtimePreflightReport.summary.blocked, 1);
assert.equal(runtimePreflightReport.rows[0]?.trustState, 'untrusted');
assert.equal(runtimePreflightReport.rows[0]?.sandboxBoundary, 'missing');
assert.equal(runtimePreflightReport.rows[0]?.handlerSource, 'none');
assert.equal(runtimePreflightReport.rows[0]?.permissionRoute, 'agent-action-approval');
assert.equal(
  runtimePreflightReport.rows[0]?.issues.some((issue) => issue.code === 'runtime-enable-missing'),
  true,
);
const packageId = restoredInstalledRegistry.packages[0]?.id ?? '';
const runtimePreflightPassedReport = createAgentSkillInstalledPackageRuntimePreflightReport(restoredInstalledRegistry, {
  loaderPackageIds: [packageId],
  runtimeEnabledPackageIds: [packageId],
  sandboxedPackageIds: [packageId],
  trustedPackageIds: [packageId],
});
assert.equal(runtimePreflightPassedReport.summary['preflight-passed'], 1);
assert.equal(runtimePreflightPassedReport.rows[0]?.issues.length, 0);
const loaderBoundaryReport = createAgentSkillInstalledPackageLoaderBoundaryReport(restoredInstalledRegistry);
assert.equal(loaderBoundaryReport.summary['metadata-only'], 1);
assert.equal(loaderBoundaryReport.rows[0]?.boundaryId, 'hybrid-agent-mcp-boundary');
assert.equal(loaderBoundaryReport.rows[0]?.boundaryMode, 'metadata-only');
assert.equal(loaderBoundaryReport.rows[0]?.executableHandlerRegistered, false);
assert.equal(loaderBoundaryReport.rows[0]?.preflightIssueCodes.includes('loader-missing'), true);
const loaderBoundaryReadyReport = createAgentSkillInstalledPackageLoaderBoundaryReport(restoredInstalledRegistry, {
  executableHandlerPackageIds: [packageId],
  runtimeEnabledPackageIds: [packageId],
  sandboxedPackageIds: [packageId],
  trustedPackageIds: [packageId],
});
assert.equal(loaderBoundaryReadyReport.summary['execution-ready'], 1);
assert.equal(loaderBoundaryReadyReport.rows[0]?.executableHandlerRegistered, true);
const installedRegistryExport = createAgentSkillInstalledPackageRegistryExport(
  restoredInstalledRegistry,
  '2026-06-29T00:05:00.000Z',
);
assert.equal(installedRegistryExport.kind, 'agent-skill-installed-package-registry-export.v1');
const duplicateInstalledImport = parseAgentSkillInstalledPackageRegistryImportJson(
  JSON.stringify(installedRegistryExport),
  restoredInstalledRegistry,
);
assert.equal(duplicateInstalledImport.ok, true);
assert.equal(duplicateInstalledImport.importedCount, 0);
assert.equal(duplicateInstalledImport.skippedDuplicateCount, 1);
assert.equal(
  removeAgentSkillInstalledPackage(restoredInstalledRegistry, restoredInstalledRegistry.packages[0]?.id ?? '').packages.length,
  0,
);
const draftLibraryExport = createAgentSkillPackageDraftLibraryExport(enabledDraftResult.library, '2026-06-29T00:03:00.000Z');
assert.equal(draftLibraryExport.kind, 'agent-skill-package-draft-library-export.v1');
const duplicateLibraryImport = parseAgentSkillPackageDraftLibraryImportJson(
  JSON.stringify(draftLibraryExport),
  enabledDraftResult.library,
);
assert.equal(duplicateLibraryImport.ok, true);
assert.equal(duplicateLibraryImport.importedCount, 0);
assert.equal(duplicateLibraryImport.skippedDuplicateCount, 1);
const secondPackageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T00:02:00.000Z');
const secondImportPreview = parseAgentSkillPackageImportJson(JSON.stringify(secondPackageExport));
const secondDraftResult = saveAgentSkillPackageImportPreviewToLibrary(enabledDraftResult.library, secondImportPreview);
assert.equal(secondDraftResult.library.drafts.length, 2);
const mcpPackageExport = createAgentSkillPackageExport('mcp.tool', '2026-06-29T00:06:00.000Z');
const mcpImportPreview = parseAgentSkillPackageImportJson(JSON.stringify(mcpPackageExport));
const mcpDraftResult = saveAgentSkillPackageImportPreviewToLibrary(emptyDraftLibrary, mcpImportPreview);
const enabledMcpDraftResult = setAgentSkillPackageDraftEnabled(
  mcpDraftResult.library,
  mcpDraftResult.draft?.id ?? '',
  true,
);
const mcpInstalledGateResult = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledMcpDraftResult.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const newInstalledImport = parseAgentSkillInstalledPackageRegistryImportJson(
  JSON.stringify(createAgentSkillInstalledPackageRegistryExport(mcpInstalledGateResult.registry)),
  restoredInstalledRegistry,
);
assert.equal(newInstalledImport.ok, true);
assert.equal(newInstalledImport.importedCount, 1);
assert.equal(newInstalledImport.registry?.packages.length, 2);
assert.equal(parseAgentSkillInstalledPackageRegistryImportJson('{"kind":"other"}', restoredInstalledRegistry).ok, false);
const newLibraryImport = parseAgentSkillPackageDraftLibraryImportJson(
  JSON.stringify(createAgentSkillPackageDraftLibraryExport(secondDraftResult.library)),
  enabledDraftResult.library,
);
assert.equal(newLibraryImport.ok, true);
assert.equal(newLibraryImport.importedCount, 1);
assert.equal(newLibraryImport.library?.drafts.length, 2);
assert.equal(parseAgentSkillPackageDraftLibraryImportJson('{"kind":"other"}', enabledDraftResult.library).ok, false);
const secondDraftReview = createAgentSkillPackageDraftReview(secondDraftResult.library, secondDraftResult.draft?.id ?? '');
assert.equal(secondDraftReview?.status, 'blocked');
assert.equal(secondDraftReview?.issues.some((issue) => issue.code === 'enabled-duplicate'), true);
assert.match(
  setAgentSkillPackageDraftEnabled(secondDraftResult.library, secondDraftResult.draft?.id ?? '', true).error ?? '',
  /already enabled/u,
);
assert.equal(
  removeAgentSkillPackageDraft(restoredDraftLibrary, restoredDraftLibrary.drafts[0]?.id ?? '').drafts.length,
  0,
);
assert.equal(saveAgentSkillPackageImportPreviewToLibrary(emptyDraftLibrary, null).error?.includes('valid'), true);

const mismatchPackage = {
  ...packageExport!,
  scaffold: {
    ...packageExport!.scaffold,
    package: {
      ...packageExport!.scaffold.package,
      version: '999.0.0',
    },
  },
};
const mismatchPreview = parseAgentSkillPackageImportJson(JSON.stringify(mismatchPackage));
assert.equal(mismatchPreview.ok, true);
assert.equal(mismatchPreview.warnings.length, 1);

const invalidImportPreview = parseAgentSkillPackageImportJson('{"kind":"other"}');
assert.equal(invalidImportPreview.ok, false);
assert.match(invalidImportPreview.errors.join('\n'), /agent-skill-package/u);

const validationReport = createAgentSkillInstallValidationReport({
  config: createValidationConfig({ audio: true, motion: true }),
  mcpConfig: { servers: [{ id: 'filesystem' }] },
});
assert.equal(validationReport.summary.blocked, 0);
assert.ok(validationReport.summary.ready > 0);
assert.equal(
  validationReport.validations.find((item) => item.skillId === 'character.animation')?.status,
  'ready',
);
assert.equal(
  validationReport.validations.find((item) => item.skillId === 'mcp.tool')?.status,
  'ready',
);

const blockedValidationReport = createAgentSkillInstallValidationReport({
  config: createValidationConfig(),
  mcpConfig: { servers: [] },
});
assert.equal(
  blockedValidationReport.validations.find((item) => item.skillId === 'character.animation')?.status,
  'blocked',
);
assert.equal(
  blockedValidationReport.validations.find((item) => item.skillId === 'mcp.tool')?.status,
  'blocked',
);

const progressEvidence = parseSettingsSkillMcpProgressEvidenceText(
  createSettingsSkillMcpProgressEvidenceText('2026-06-30T00:00:00.000Z'),
);
assert.equal(progressEvidence.kind, 'settings-skill-mcp-progress-evidence');
assert.equal(progressEvidence.version, 1);
assert.equal(progressEvidence.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(progressEvidence.items.length, 4);
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.estimateLabel, '99.99%');
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.estimateLabel, '99.8%');
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('readiness/runbook'), true);
assert.equal(formatSettingsSkillMcpAreaLabel('role-skill-performance'), '角色 Skill 演出');
assert.equal(formatSettingsSkillMcpStatusLabel('partial'), '部分完成');
assert.throws(() => parseSettingsSkillMcpProgressEvidenceText('{"kind":"other"}'), /not a Skill\/MCP progress/u);
assert.throws(() => parseSettingsSkillMcpProgressEvidenceText(JSON.stringify({
  exportedAt: '2026-06-30T00:00:00.000Z',
  items: [{ ...progressEvidence.items[0], area: 'unknown' }],
  kind: 'settings-skill-mcp-progress-evidence',
  version: 1,
})), /item\.area/u);

const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillManifestPanel.tsx');
const progressPanelSource = readProjectFile('src/components/settings/SettingsSkillMcpProgressPanel.tsx');
const progressExchangeSource = readProjectFile('src/components/settings/SettingsSkillMcpProgressEvidenceExchangePanel.tsx');
const progressModelSource = readProjectFile('src/components/settings/settingsSkillMcpProgress.ts');
const scaffoldPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillScaffoldPreview.tsx');
const validationPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstallValidationPanel.tsx');
const packagePanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const draftPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageDraftLibraryPanel.tsx');
const draftHookSource = readProjectFile('src/components/settings/useSettingsAgentSkillPackageDraftLibrary.ts');
const draftLibraryExchangePanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageDraftLibraryExchangePanel.tsx');
const installedRegistryPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRegistryPanel.tsx');
const installedRegistryExchangePanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRegistryExchangePanel.tsx');
const installedRuntimeMetadataPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimeMetadataPanel.tsx');
const installedRegistryHookSource = readProjectFile('src/components/settings/useSettingsAgentSkillInstalledPackageRegistry.ts');
const sourcePanelSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageSourceViewPanel.tsx');
const controlsSource = readProjectFile('src/components/settings/SettingsControlsTab.tsx');
assert.match(panelSource, /createAgentSkillManifest/u);
assert.match(panelSource, /Agent Skill manifest/u);
assert.match(panelSource, /SettingsSkillMcpProgressPanel/u);
assert.match(progressPanelSource, /Skill \/ MCP 进度/u);
assert.match(progressPanelSource, /getSettingsSkillMcpProgressItems/u);
assert.match(progressPanelSource, /formatSettingsSkillMcpEvidence/u);
assert.match(progressPanelSource, /SettingsSkillMcpProgressEvidenceExchangePanel/u);
assert.match(progressExchangeSource, /createSettingsSkillMcpProgressEvidenceText/u);
assert.match(progressExchangeSource, /skill-mcp-progress-evidence\.json/u);
assert.match(progressExchangeSource, /导出进度/u);
assert.match(progressModelSource, /Skill foundation/u);
assert.match(progressModelSource, /Role Skill performance/u);
assert.match(progressModelSource, /MCP foundation/u);
assert.match(progressModelSource, /MCP safety\/visibility/u);
assert.match(progressModelSource, /99\.99%/u);
assert.match(progressModelSource, /99\.8%/u);
assert.match(panelSource, /SettingsAgentSkillScaffoldPreview/u);
assert.match(panelSource, /SettingsAgentSkillInstallValidationPanel/u);
assert.match(panelSource, /SettingsAgentSkillPackageExchangePreview/u);
assert.match(panelSource, /package \{entry\.package\.version\}/u);
assert.match(panelSource, /assetRequirementCounts/u);
assert.match(scaffoldPanelSource, /createAgentSkillAuthoringScaffold/u);
assert.match(validationPanelSource, /createAgentSkillInstallValidationReport/u);
assert.match(validationPanelSource, /useSettingsAgentSkillMcpConfigSnapshot/u);
assert.match(packagePanelSource, /parseAgentSkillPackageImportJson/u);
assert.match(packagePanelSource, /SettingsAgentSkillPackageDraftLibraryPanel/u);
assert.match(draftPanelSource, /Draft library/u);
assert.match(draftPanelSource, /createAgentSkillPackageDraftReview/u);
assert.match(draftHookSource, /localStorage/u);
assert.match(draftHookSource, /setAgentSkillPackageDraftEnabled/u);
assert.match(draftHookSource, /replaceLibrary/u);
assert.match(draftLibraryExchangePanelSource, /Draft library exchange/u);
assert.match(draftLibraryExchangePanelSource, /parseAgentSkillPackageDraftLibraryImportJson/u);
assert.match(installedRegistryPanelSource, /Installed package registry/u);
assert.match(installedRegistryPanelSource, /runtime disabled by default/u);
assert.match(installedRegistryHookSource, /gateEnabledSkillPackageDraftsIntoInstalledRegistry/u);
assert.match(installedRegistryHookSource, /replaceRegistry/u);
assert.match(installedRegistryExchangePanelSource, /Installed registry exchange/u);
assert.match(installedRegistryExchangePanelSource, /createAgentSkillInstalledPackageAudit/u);
assert.match(installedRegistryExchangePanelSource, /parseAgentSkillInstalledPackageRegistryImportJson/u);
assert.match(installedRuntimeMetadataPanelSource, /Runtime metadata/u);
assert.match(installedRuntimeMetadataPanelSource, /createAgentSkillInstalledPackageRuntimeMetadataReport/u);
assert.match(installedRuntimeMetadataPanelSource, /Runtime preflight/u);
assert.match(installedRuntimeMetadataPanelSource, /createAgentSkillInstalledPackageRuntimePreflightReport/u);
assert.match(installedRuntimeMetadataPanelSource, /Loader boundary/u);
assert.match(installedRuntimeMetadataPanelSource, /createAgentSkillInstalledPackageLoaderBoundaryReport/u);
assert.match(sourcePanelSource, /createAgentSkillPackageSourceView/u);
assert.match(sourcePanelSource, /Package sources/u);
assert.match(controlsSource, /SettingsAgentSkillManifestPanel/u);

console.log('agent skill manifest smoke passed');
