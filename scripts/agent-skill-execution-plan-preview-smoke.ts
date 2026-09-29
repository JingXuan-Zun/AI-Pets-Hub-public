import { strict as assert } from 'node:assert';
import {
  createAgentSkillExecutionPlanPreview,
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

const packageExport = createAgentSkillPackageExport('character.animation', '2026-06-29T06:00:00.000Z');
const importPreview = parseAgentSkillPackageImportJson(JSON.stringify(packageExport));
const draft = saveAgentSkillPackageImportPreviewToLibrary(createEmptyAgentSkillPackageDraftLibrary(), importPreview);
const enabledDraft = setAgentSkillPackageDraftEnabled(draft.library, draft.draft?.id ?? '', true);
const installed = gateEnabledSkillPackageDraftsIntoInstalledRegistry(
  enabledDraft.library,
  createEmptyAgentSkillInstalledPackageRegistry(),
);
const packageId = installed.registry.packages[0]?.id ?? '';
const emptyPolicy = createEmptyAgentSkillInstalledPackageRuntimePolicy();
const emptyPreview = createEmptyAgentSkillInstalledPackageHandlerPreviewRegistry();
const blockedPreview = createAgentSkillExecutionPlanPreview(
  installed.registry,
  emptyPolicy,
  emptyPreview,
  '2026-06-29T06:01:00.000Z',
);
assert.equal(blockedPreview.kind, 'agent-skill-execution-plan-preview.v1');
assert.equal(blockedPreview.summary.blocked, 1);
assert.equal(blockedPreview.rows[0]?.planned, false);

const policy = setAgentSkillInstalledPackageRuntimePolicyRecord(
  emptyPolicy,
  installed.registry,
  packageId,
  { runtimeEnabled: true, sandboxed: true, trusted: true },
).policy;
const previewRegistry = createAgentSkillInstalledPackageHandlerPreview(
  emptyPreview,
  installed.registry,
  packageId,
).registry;
const plannedPreview = createAgentSkillExecutionPlanPreview(
  installed.registry,
  policy,
  previewRegistry,
  '2026-06-29T06:02:00.000Z',
);
assert.equal(plannedPreview.summary.planned, 1);
assert.equal(plannedPreview.rows[0]?.planned, true);
assert.equal(plannedPreview.rows[0]?.contractStatus, 'valid');
assert.equal(plannedPreview.rows[0]?.guardIssueCodes.length, 0);
assert.equal(plannedPreview.rows[0]?.boundaryId, 'hybrid-agent-mcp-boundary');

const exchangeSource = readProjectFile('src/components/settings/SettingsAgentSkillPackageExchangePreview.tsx');
const panelSource = readProjectFile('src/components/settings/SettingsAgentSkillExecutionPlanPreviewPanel.tsx');
assert.match(exchangeSource, /SettingsAgentSkillExecutionPlanPreviewPanel/u);
assert.match(panelSource, /Execution plan preview/u);
assert.match(panelSource, /createAgentSkillExecutionPlanPreview/u);

console.log('agent skill execution plan preview smoke passed');
