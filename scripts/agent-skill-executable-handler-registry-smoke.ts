import { strict as assert } from 'node:assert';
import {
  createAgentSkillInstalledPackageHandlerPreview,
  createAgentSkillInstalledPackageRuntimeReadinessDashboard,
  createAgentSkillPackageExport,
  createEmptyAgentSkillExecutableHandlerRegistry,
  createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry,
  createEmptyAgentSkillInstalledPackageRegistry,
  createEmptyAgentSkillInstalledPackageRuntimePolicy,
  createEmptyAgentSkillPackageDraftLibrary,
  getAgentSkillExecutableHandlerPackageIds,
  gateEnabledSkillPackageDraftsIntoInstalledRegistry,
  parseAgentSkillExecutableHandlerRegistryJson,
  parseAgentSkillPackageImportJson,
  registerAgentSkillExecutableHandlersFromPreviews,
  removeAgentSkillExecutableHandler,
  runAgentSkillExecutableHandler,
  saveAgentSkillPackageImportPreviewToLibrary,
  serializeAgentSkillExecutableHandlerRegistry,
  setAgentSkillInstalledPackageRuntimePolicyRecord,
  setAgentSkillPackageDraftEnabled,
} from '../src/agent';
import { readProjectFile } from './smokeTestHarness.ts';

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T07:00:00.000Z');
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
  '2026-06-29T07:01:00.000Z',
).registry;

const blockedRegistration = registerAgentSkillExecutableHandlersFromPreviews(
  createEmptyAgentSkillExecutableHandlerRegistry(),
  installed.registry,
  emptyPolicy,
  previewRegistry,
);
assert.equal(blockedRegistration.registeredCount, 0);
assert.equal(blockedRegistration.blockedCount, 1);

const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
  emptyPolicy,
  installed.registry,
  packageId,
  { runtimeEnabled: true, sandboxed: true, trusted: true },
  '2026-06-29T07:02:00.000Z',
).policy;
const registration = registerAgentSkillExecutableHandlersFromPreviews(
  createEmptyAgentSkillExecutableHandlerRegistry(),
  installed.registry,
  policy,
  previewRegistry,
  '2026-06-29T07:03:00.000Z',
);
assert.equal(registration.registeredCount, 1);
assert.deepEqual(getAgentSkillExecutableHandlerPackageIds(registration.registry), [packageId]);
assert.equal(registration.registry.handlers[0]?.loaderKind, 'local-skill-resolver');

const restoredRegistry = parseAgentSkillExecutableHandlerRegistryJson(
  serializeAgentSkillExecutableHandlerRegistry(registration.registry),
);
assert.equal(restoredRegistry.handlers[0]?.registeredAt, '2026-06-29T07:03:00.000Z');

const dashboard = createAgentSkillInstalledPackageRuntimeReadinessDashboard(
  installed.registry,
  policy,
  previewRegistry,
  { executableHandlerPackageIds: getAgentSkillExecutableHandlerPackageIds(restoredRegistry) },
);
assert.equal(dashboard.summary['execution-ready'], 1);
assert.equal(dashboard.rows[0]?.handlerRegistration, 'registered');

const runResult = runAgentSkillExecutableHandler(
  restoredRegistry,
  installed.registry,
  policy,
  previewRegistry,
  {
    dryRun: true,
    inputJson: '{"animationId":"wave"}',
    skillId: 'character.animation',
  },
);
assert.equal(runResult.error, null);
assert.equal(runResult.result?.ok, true);
assert.equal(runResult.result?.marker, '[animation:wave]');

const packageRunResult = runAgentSkillExecutableHandler(
  restoredRegistry,
  installed.registry,
  policy,
  previewRegistry,
  {
    dryRun: true,
    inputJson: '{"animationIds":["wave","jump"]}',
    packageId,
    skillId: 'character.animation',
  },
);
assert.equal(packageRunResult.error, null);
assert.equal(packageRunResult.result?.marker, '[animation-sequence:2]');

const blockedRun = runAgentSkillExecutableHandler(
  restoredRegistry,
  installed.registry,
  emptyPolicy,
  previewRegistry,
  {
    dryRun: true,
    inputJson: '{}',
    skillId: 'character.animation',
  },
);
assert.match(blockedRun.error ?? '', /runtime-enable-missing/u);
assert.equal(removeAgentSkillExecutableHandler(restoredRegistry, packageId).handlers.length, 0);

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExecutableHandlerRegistryPanel.tsx');
const runPanelSource = readProjectFile('src/components/settings/SettingsAgentSkillExecutableHandlerRunPreviewPanel.tsx');
const hookSource = readProjectFile('src/components/settings/useSettingsAgentSkillExecutableHandlerRegistry.ts');
const executionPlanSource = readProjectFile('src/components/settings/SettingsAgentSkillExecutionPlanPreviewPanel.tsx');
const readinessSource = readProjectFile('src/components/settings/SettingsAgentSkillInstalledPackageRuntimeReadinessPanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillExecutableHandlerRegistryPanel/u);
assert.match(exchangeSource, /SettingsAgentSkillExecutableHandlerRunPreviewPanel/u);
assert.match(exchangeSource, /executableHandlerPackageIds/u);
assert.match(panelSource, /Executable handler registry/u);
assert.match(panelSource, /Register \{registerableCount\}/u);
assert.match(runPanelSource, /Handler dry-run preview/u);
assert.match(runPanelSource, /runAgentSkillExecutableHandler/u);
assert.match(runPanelSource, /dryRun: true/u);
assert.match(hookSource, /desktop-pet\.agent-skill-executable-handler-registry\.v1/u);
assert.match(executionPlanSource, /executableHandlerPackageIds/u);
assert.match(readinessSource, /executableHandlerPackageIds/u);

console.log('agent skill executable handler registry smoke passed');
