import { strict as assert } from 'node:assert';
import {
  createSettingsSkillMcpProgressImportedSummary,
  createSettingsSkillMcpProgressEvidenceText,
  parseSettingsSkillMcpProgressEvidenceImportText,
  parseSettingsSkillMcpProgressEvidenceText,
} from '../src/components/settings/settingsSkillMcpProgress.ts';
import {
  formatSettingsSkillMcpAreaLabel,
  formatSettingsSkillMcpImportDetail,
  formatSettingsSkillMcpStatusLabel,
  formatSettingsSkillMcpSummaryStatus,
} from '../src/components/settings/settingsSkillMcpProgressLocale.ts';
import {
  createSettingsMcpConfigPreflight,
} from '../src/components/settings/settingsMcpConfigPreflight.ts';
import {
  createSettingsMcpEvidenceStageSummary,
  createSettingsMcpEvidenceStagesExportName,
  createSettingsMcpEvidenceStagesImportedSummary,
  formatSettingsMcpEvidenceStagesExportText,
  parseSettingsMcpEvidenceStagesExportText,
} from '../src/components/settings/settingsMcpEvidenceStages.ts';
import {
  createSettingsMcpExternalSoakEvidenceGap,
} from '../src/components/settings/settingsMcpExternalSoakEvidenceGap.ts';
import {
  createSettingsMcpReadinessSourceStrength,
} from '../src/components/settings/settingsMcpReadinessSourceStrength.ts';
import {
  createSettingsMcpPostSaveReadinessReview,
} from '../src/components/settings/settingsMcpPostSaveReadinessReview.ts';
import {
  createSettingsMcpSavedConfigReadinessHandoff,
} from '../src/components/settings/settingsMcpSavedConfigReadinessHandoff.ts';
import {
  createSettingsMcpPerServerSoakCommandReview,
  createSettingsMcpPerServerSoakCommandReviewExportName,
  formatSettingsMcpPerServerSoakCommandReviewExportText,
} from '../src/components/settings/settingsMcpPerServerSoakCommandReview.ts';
import {
  createSettingsMcpReadinessSourceStrengthEvidenceName,
  createSettingsMcpReadinessSourceStrengthImportedSummary,
  formatSettingsMcpReadinessSourceStrengthEvidenceText,
  parseSettingsMcpReadinessSourceStrengthEvidenceText,
} from '../src/components/settings/settingsMcpReadinessSourceStrengthEvidence.ts';
import {
  createSettingsMcpExternalSoakClosureChecklist,
} from '../src/components/settings/settingsMcpExternalSoakClosureChecklist.ts';
import {
  createSettingsMcpExternalSoakClosureRunbook,
  formatSettingsMcpExternalSoakClosureRunbookText,
} from '../src/components/settings/settingsMcpExternalSoakClosureRunbook.ts';
import {
  createSettingsMcpExternalSoakClosureCoverage,
} from '../src/components/settings/settingsMcpExternalSoakClosureCoverage.ts';
import {
  createSettingsMcpExternalSoakClosureDrift,
} from '../src/components/settings/settingsMcpExternalSoakClosureDrift.ts';
import {
  createSettingsMcpExternalSoakClosureReviewEvidenceName,
  createSettingsMcpExternalSoakClosureReviewImportedSummary,
  formatSettingsMcpExternalSoakClosureReviewEvidenceText,
  parseSettingsMcpExternalSoakClosureReviewEvidenceText,
} from '../src/components/settings/settingsMcpExternalSoakClosureReviewEvidence.ts';
import {
  createSettingsMcpExternalSoakClosureCoverageEvidenceName,
  createSettingsMcpExternalSoakClosureCoverageImportedSummary,
  formatSettingsMcpExternalSoakClosureCoverageEvidenceText,
  parseSettingsMcpExternalSoakClosureCoverageEvidenceText,
} from '../src/components/settings/settingsMcpExternalSoakClosureCoverageEvidence.ts';
import {
  createSettingsMcpExternalSoakClosureEvidenceName,
  createSettingsMcpExternalSoakClosureImportedSummary,
  formatSettingsMcpExternalSoakClosureEvidenceText,
  parseSettingsMcpExternalSoakClosureEvidenceText,
} from '../src/components/settings/settingsMcpExternalSoakClosureEvidence.ts';
import {
  parseSettingsMcpSoakReadinessText,
} from '../src/components/settings/settingsMcpSoakReadiness.ts';
import {
  parseSettingsMcpSoakReportText,
} from '../src/components/settings/settingsMcpSoakImport.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const overviewSource = readProjectFile('src/components/settings/SettingsMcpProgressOverview.tsx');
const blockSource = readProjectFile('src/components/settings/SettingsMcpEvidenceProgressBlock.tsx');
const evidenceActionsSource = readProjectFile('src/components/settings/SettingsMcpSoakEvidenceActions.tsx');
const evidenceSource = readProjectFile('src/components/settings/settingsMcpSoakEvidence.ts');
const evidenceStagesExchangeSource = readProjectFile('src/components/settings/SettingsMcpEvidenceStagesExchangePanel.tsx');
const evidenceStagesSource = readProjectFile('src/components/settings/settingsMcpEvidenceStages.ts');
const externalSoakClosurePanelSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureChecklistPanel.tsx');
const externalSoakClosureExchangeSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureEvidenceExchangePanel.tsx');
const externalSoakClosureEvidenceSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureEvidence.ts');
const externalSoakClosureCoveragePanelSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureCoveragePanel.tsx');
const externalSoakClosureCoverageRowSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureCoverageRow.tsx');
const externalSoakClosureCoverageMissingCommandsSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureCoverageMissingCommandsPanel.tsx');
const externalSoakClosureCoverageExchangeSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureCoverageEvidenceExchangePanel.tsx');
const externalSoakClosureDriftPanelSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureDriftPanel.tsx');
const externalSoakClosureDriftSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureDrift.ts');
const externalSoakClosureReviewExchangeSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureReviewEvidenceExchangePanel.tsx');
const externalSoakClosureReviewSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureReviewEvidence.ts');
const externalSoakClosureCoverageSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureCoverage.ts');
const externalSoakClosureCoverageEvidenceSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureCoverageEvidence.ts');
const externalSoakClosureRunbookPanelSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakClosureRunbookPanel.tsx');
const externalSoakClosureRunbookSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureRunbook.ts');
const externalSoakClosureSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureChecklist.ts');
const externalSoakClosureStateSource = readProjectFile('src/components/settings/settingsMcpExternalSoakClosureState.ts');
const externalSoakGapPanelSource = readProjectFile('src/components/settings/SettingsMcpExternalSoakEvidenceGapPanel.tsx');
const externalSoakGapSource = readProjectFile('src/components/settings/settingsMcpExternalSoakEvidenceGap.ts');
const readinessSourceStrengthPanelSource = readProjectFile('src/components/settings/SettingsMcpReadinessSourceStrengthPanel.tsx');
const readinessSourceStrengthExchangeSource = readProjectFile('src/components/settings/SettingsMcpReadinessSourceStrengthEvidenceExchangePanel.tsx');
const readinessSourceStrengthSource = readProjectFile('src/components/settings/settingsMcpReadinessSourceStrength.ts');
const readinessSourceStrengthEvidenceSource = readProjectFile('src/components/settings/settingsMcpReadinessSourceStrengthEvidence.ts');
const postSaveReviewPanelSource = readProjectFile('src/components/settings/SettingsMcpPostSaveReadinessReviewPanel.tsx');
const postSaveReviewSource = readProjectFile('src/components/settings/settingsMcpPostSaveReadinessReview.ts');
const savedConfigHandoffPanelSource = readProjectFile('src/components/settings/SettingsMcpSavedConfigReadinessHandoffPanel.tsx');
const savedConfigHandoffSource = readProjectFile('src/components/settings/settingsMcpSavedConfigReadinessHandoff.ts');
const perServerSoakCommandReviewPanelSource = readProjectFile('src/components/settings/SettingsMcpPerServerSoakCommandReviewPanel.tsx');
const perServerSoakCommandReviewSource = readProjectFile('src/components/settings/settingsMcpPerServerSoakCommandReview.ts');
const readinessCandidateConsistencySource = readProjectFile('src/components/settings/settingsMcpReadinessCandidateConsistency.ts');
const clipboardUtilsSource = readProjectFile('src/components/settings/settingsClipboardUtils.ts');
const skillMcpProgressExchangeSource = readProjectFile('src/components/settings/SettingsSkillMcpProgressEvidenceExchangePanel.tsx');
const skillMcpProgressPanelSource = readProjectFile('src/components/settings/SettingsSkillMcpProgressPanel.tsx');
const skillMcpProgressModelSource = readProjectFile('src/components/settings/settingsSkillMcpProgress.ts');
const packagedProductionEvidenceSource = readProjectFile('src/components/settings/settingsMcpPackagedProductionEvidence.ts');
const packagedProductionEvidenceCliSource = readProjectFile('scripts/agent-mcp-packaged-production-evidence.ts');
const packagedProductionReportBuilderSource = readProjectFile('src/components/settings/settingsMcpPackagedProductionReportBuilder.ts');
const packagedProductionReportBuilderCliSource = readProjectFile('scripts/agent-mcp-packaged-production-report-builder.ts');
const packagedProductionRuntimeLogSource = readProjectFile('src/components/settings/settingsMcpPackagedProductionRuntimeLog.ts');
const packagedProductionRunPlanSource = readProjectFile('src/components/settings/settingsMcpPackagedProductionRunPlan.ts');
const packagedProductionRunPlanCliSource = readProjectFile('scripts/agent-mcp-packaged-production-run-plan.ts');
const packagedProductionRunCollectorCliSource = readProjectFile('scripts/agent-mcp-packaged-production-run-collector.ts');
const packagedMainHarnessCliSource = readProjectFile('scripts/agent-mcp-packaged-main-harness.ts');
const packagedHarnessComparisonSource = readProjectFile('src/components/settings/settingsMcpPackagedHarnessComparison.ts');
const packagedHarnessComparisonCliSource = readProjectFile('scripts/agent-mcp-packaged-harness-comparison.ts');
const packagedReadOnlyCoverageSource = readProjectFile('src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts');
const packagedReadOnlyCoverageCliSource = readProjectFile('scripts/agent-mcp-packaged-read-only-coverage.ts');
const sectionSource = readProjectFile('src/components/settings/SettingsMcpSection.tsx');
const advancedWorkspaceSource = readProjectFile('src/components/settings/SettingsMcpAdvancedWorkspace.tsx');
const operationalPanelsSource = readProjectFile('src/components/settings/SettingsMcpOperationalPanels.tsx');
const historyPanelSource = readProjectFile('src/components/settings/SettingsMcpHistoryPanel.tsx');

const progressEvidence = parseSettingsSkillMcpProgressEvidenceText(
  createSettingsSkillMcpProgressEvidenceText('2026-06-30T00:00:00.000Z'),
);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.estimateLabel, '99.9%');
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.blocker.includes('Signed WASM execution'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.blocker.includes('static and real packaged admission'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.blocker.includes('signing-key continuity'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.blocker.includes('reviewed real Publisher lifecycle'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.evidence.includes('install a bounded local archive'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'skill-foundation')?.nextStep.includes('ordinary-user MCP setup'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.blocker.includes('first isolated third-party reference family are closed'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('draft 7/2019/2020 validation'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('exact JSON Pointer field rules'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('process-backed local draft 7/2019/2020 matrix'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('64 KiB UTF-8 renderer input'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('36/36 supported schemas'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('14 homogeneous-array structures'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('5 safely editable scalar-array fields'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('deny-items/allow-items'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.blocker.includes('spawn EPERM'), false);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('readiness/runbook/closure visibility'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('2/2 official packaged server coverage'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('40/40 tools/list successes'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('40/40 read-only list_directory/read_graph call successes'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('risk/policy consistency evidence'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('lifecycle hardening evidence'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('packaged-production review gates'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('20 rounds per server'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('mcp-packaged-production-1785341969341/report.json'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('30.34-minute packaged session'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('packaged-read-only-call-report.json'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('without spawning a process'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('missing runtimes/commands'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('server crash'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.evidence.includes('passes 8/8'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-foundation')?.nextStep.includes('packaged hostile-environment lifecycle evidence'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.estimateLabel, '99.8%');
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('risk/policy preset/decision consistency evidence'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('lifecycle hardening evidence'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.evidence.includes('standard MCP read-only/destructive/open-world annotations'), true);
assert.equal(progressEvidence.items.find((item) => item.area === 'mcp-safety')?.nextStep.includes('packaged hostile-environment lifecycle evidence'), true);
const importedProgressEvidence = parseSettingsSkillMcpProgressEvidenceImportText(
  createSettingsSkillMcpProgressEvidenceText('2026-06-30T00:00:00.000Z'),
  'progress.json',
);
assert.equal(importedProgressEvidence.inputPath, 'progress.json');
const importedProgressSummary = createSettingsSkillMcpProgressImportedSummary(importedProgressEvidence);
assert.equal(importedProgressSummary.currentMatch, true);
assert.equal(importedProgressSummary.itemCount, 4);
assert.equal(importedProgressSummary.mismatchCount, 0);
assert.equal(formatSettingsSkillMcpAreaLabel('skill-foundation'), 'Skill 基础能力');
assert.equal(formatSettingsSkillMcpAreaLabel('mcp-foundation'), 'MCP 基础能力');
assert.equal(formatSettingsSkillMcpStatusLabel('near-complete'), '接近完成');
assert.equal(formatSettingsSkillMcpStatusLabel('partial'), '部分完成');
assert.equal(formatSettingsSkillMcpSummaryStatus(importedProgressSummary), '4 个领域 / 2 接近完成 / 2 部分完成');
assert.equal(formatSettingsSkillMcpImportDetail(importedProgressSummary), '导入的进度证据与当前内置进度一致。');
const staleProgressSummary = createSettingsSkillMcpProgressImportedSummary({
  ...importedProgressEvidence,
  items: importedProgressEvidence.items.map((item) => (
    item.area === 'mcp-foundation'
      ? { ...item, estimateLabel: '94%' }
      : item
  )),
});
assert.equal(staleProgressSummary.currentMatch, false);
assert.equal(staleProgressSummary.mismatchCount, 1);
assert.equal(formatSettingsSkillMcpImportDetail(staleProgressSummary), '1 个进度领域与当前内置进度不一致。');
const staleEvidenceSummary = createSettingsSkillMcpProgressImportedSummary({
  ...importedProgressEvidence,
  items: importedProgressEvidence.items.map((item) => (
    item.area === 'mcp-safety'
      ? { ...item, evidence: 'stale evidence text' }
      : item
  )),
});
assert.equal(staleEvidenceSummary.currentMatch, false);
assert.equal(staleEvidenceSummary.mismatchCount, 1);

const blockedStages = createSettingsMcpEvidenceStageSummary({
  preflight: createSettingsMcpConfigPreflight('{"servers":[]}'),
  readinessSummary: null,
  soakSummary: null,
});
assert.equal(blockedStages.status, 'blocked');
assert.equal(blockedStages.readyCount, 0);
assert.equal(blockedStages.stages.map((stage) => stage.id).join(','), 'static-preflight-ready,readiness-ready,soak-evidence-imported');
const blockedExternalEvidence = createSettingsMcpExternalSoakEvidenceGap({
  preflight: createSettingsMcpConfigPreflight('{"servers":[]}'),
  readinessSummary: null,
  soakSummary: null,
});
assert.equal(blockedExternalEvidence.status, 'blocked');
assert.equal(blockedExternalEvidence.eligibleForMcpFoundationIncrease, false);
assert.match(blockedExternalEvidence.summaryText, /eligible=false/u);
const initialPostSaveReview = createSettingsMcpPostSaveReadinessReview({
  readinessSummary: null,
  savedAt: null,
  soakSummary: null,
});
assert.equal(initialPostSaveReview.status, 'todo');
assert.equal(initialPostSaveReview.readyForPerServerSoak, false);
assert.equal(initialPostSaveReview.steps.find((step) => step.id === 'saved-config')?.status, 'todo');
const emptyHandoff = createSettingsMcpSavedConfigReadinessHandoff({
  configText: '{"servers":[]}',
  readinessSummary: null,
  savedAt: null,
});
assert.equal(emptyHandoff.status, 'warning');
assert.equal(emptyHandoff.candidateCount, 0);
assert.equal(emptyHandoff.readyForCommandReview, false);
const unsavedHandoff = createSettingsMcpSavedConfigReadinessHandoff({
  configText: JSON.stringify({ servers: [{ args: ['server.js'], command: 'node', id: 'ready-server' }] }),
  readinessSummary: null,
  savedAt: null,
});
assert.equal(unsavedHandoff.status, 'todo');
assert.equal(unsavedHandoff.candidateCount, 1);
assert.equal(unsavedHandoff.steps.find((step) => step.id === 'saved-config')?.status, 'todo');
const blockedClosure = createSettingsMcpExternalSoakClosureChecklist({
  preflight: createSettingsMcpConfigPreflight('{"servers":[]}'),
  readinessSummary: null,
  soakSummary: null,
});
assert.equal(blockedClosure.status, 'blocked');
assert.equal(blockedClosure.steps.find((step) => step.id === 'config-preflight')?.status, 'blocked');
assert.equal(blockedClosure.steps.find((step) => step.id === 'saved-config')?.status, 'todo');
assert.match(blockedClosure.summaryText, /MCPExternalSoakClosure status=blocked/u);
assert.match(createSettingsMcpExternalSoakClosureEvidenceName(blockedClosure), /mcp-external-soak-closure-blocked-\d-of-6\.json/u);
const blockedClosureRunbook = createSettingsMcpExternalSoakClosureRunbook(null);
assert.equal(blockedClosureRunbook.status, 'blocked');
assert.equal(blockedClosureRunbook.commands.length, 0);
const blockedCoverage = createSettingsMcpExternalSoakClosureCoverage({
  readinessSummary: null,
  soakSummary: null,
});
assert.equal(blockedCoverage.status, 'blocked');
assert.equal(blockedCoverage.totalReadyServers, 0);

const readyPreflight = createSettingsMcpConfigPreflight(JSON.stringify({
  servers: [{ args: ['--version'], command: process.execPath, id: 'ready-server' }],
}));
const readyConfigText = JSON.stringify({
  servers: [{ args: ['server.js'], command: 'node', id: 'ready-server' }],
});
const readinessSummary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  configPresent: true,
  kind: 'mcp-real-server-soak-readiness',
  runbook: {
    indexReports: 'npx.cmd tsx indexer --dir reports',
    perServer: [{ command: 'npx.cmd tsx runner --serverId ready-server', serverId: 'ready-server' }],
  },
  servers: [{ id: 'ready-server', readyForRealSoak: true }],
  source: 'saved-config',
  totals: { readyServers: 1, servers: 1 },
}), 'ready.json');
const soakSummary = parseSettingsMcpSoakReportText(JSON.stringify({
  kind: 'mcp-real-server-soak-report',
  servers: [{
    id: 'ready-server',
    maxToolCount: 1,
    rounds: [{ durationMs: 5, listOk: true, toolCount: 1 }],
  }],
  totals: { listSuccesses: 1, rounds: 1 },
}), 'soak.json');
const readyStages = createSettingsMcpEvidenceStageSummary({
  preflight: readyPreflight,
  readinessSummary,
  soakSummary,
});
assert.equal(readyStages.status, 'ready');
assert.equal(readyStages.readyCount, 3);
const readyExternalEvidence = createSettingsMcpExternalSoakEvidenceGap({
  preflight: readyPreflight,
  readinessSummary,
  soakSummary,
});
assert.equal(readyExternalEvidence.status, 'ready');
assert.equal(readyExternalEvidence.eligibleForMcpFoundationIncrease, true);
assert.equal(readyExternalEvidence.readyServerCount, 1);
assert.equal(readyExternalEvidence.soakRoundCount, 1);
const savedSourceStrength = createSettingsMcpReadinessSourceStrength(readinessSummary);
assert.equal(savedSourceStrength.status, 'ready');
assert.equal(savedSourceStrength.supportsExternalSoakClosure, true);
assert.equal(savedSourceStrength.tier, 'saved-config');
const readyPostSaveReview = createSettingsMcpPostSaveReadinessReview({
  readinessSummary,
  savedAt: Date.parse('2026-06-30T00:00:00.000Z'),
  soakSummary: null,
});
assert.equal(readyPostSaveReview.status, 'todo');
assert.equal(readyPostSaveReview.readyForPerServerSoak, true);
assert.equal(readyPostSaveReview.steps.find((step) => step.id === 'ready-servers')?.status, 'ready');
const readyHandoff = createSettingsMcpSavedConfigReadinessHandoff({
  configText: readyConfigText,
  readinessSummary: {
    ...readinessSummary,
    generatedAt: '2026-06-30T00:00:01.000Z',
  },
  savedAt: Date.parse('2026-06-30T00:00:00.000Z'),
});
assert.equal(readyHandoff.status, 'ready');
assert.equal(readyHandoff.readyForCommandReview, true);
assert.equal(readyHandoff.steps.find((step) => step.id === 'readiness-freshness')?.status, 'ready');
const staleHandoff = createSettingsMcpSavedConfigReadinessHandoff({
  configText: readyConfigText,
  readinessSummary: {
    ...readinessSummary,
    generatedAt: '2026-06-29T23:59:59.000Z',
  },
  savedAt: Date.parse('2026-06-30T00:00:00.000Z'),
});
assert.equal(staleHandoff.status, 'warning');
assert.equal(staleHandoff.readyForCommandReview, false);
assert.match(staleHandoff.nextAction, /regenerate saved-config readiness/u);
const readyPerServerCommandReview = createSettingsMcpPerServerSoakCommandReview(readinessSummary, readyConfigText);
assert.equal(readyPerServerCommandReview.status, 'ready');
assert.equal(readyPerServerCommandReview.commandCount, 1);
assert.equal(readyPerServerCommandReview.consistency.status, 'ready');
assert.equal(readyPerServerCommandReview.supportsExternalSoakCollection, true);
assert.match(readyPerServerCommandReview.commandsText, /Run soak: ready-server/u);
assert.match(readyPerServerCommandReview.commandsText, /npx\.cmd tsx runner --serverId ready-server/u);
assert.match(
  createSettingsMcpPerServerSoakCommandReviewExportName(readyPerServerCommandReview),
  /mcp-per-server-soak-commands-ready-saved-config-1\.json/u,
);
const staleCandidateCommandReview = createSettingsMcpPerServerSoakCommandReview(
  readinessSummary,
  JSON.stringify({ servers: [{ args: ['server.js'], command: 'node', id: 'other-server' }] }),
);
assert.equal(staleCandidateCommandReview.status, 'blocked');
assert.equal(staleCandidateCommandReview.consistency.status, 'blocked');
assert.equal(staleCandidateCommandReview.supportsExternalSoakCollection, false);
assert.match(staleCandidateCommandReview.nextAction, /Regenerate saved-config readiness/u);
assert.match(
  formatSettingsMcpPerServerSoakCommandReviewExportText(
    readyPerServerCommandReview,
    '2026-06-30T00:00:00.000Z',
  ),
  /mcp-per-server-soak-command-review-settings-export/u,
);
assert.match(createSettingsMcpReadinessSourceStrengthEvidenceName(savedSourceStrength), /mcp-readiness-source-ready-saved-config-1-ready\.json/u);
const importedSourceStrength = parseSettingsMcpReadinessSourceStrengthEvidenceText(
  formatSettingsMcpReadinessSourceStrengthEvidenceText(savedSourceStrength, '2026-06-30T00:00:00.000Z'),
  'source-strength.json',
);
assert.equal(importedSourceStrength.kind, 'mcp-readiness-source-strength-settings-export');
assert.equal(importedSourceStrength.inputPath, 'source-strength.json');
assert.equal(importedSourceStrength.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(createSettingsMcpReadinessSourceStrengthImportedSummary(
  importedSourceStrength,
  savedSourceStrength,
).currentMatch, true);
const draftReadinessSummary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  configPresent: false,
  kind: 'mcp-real-server-soak-readiness',
  runbook: { perServer: [{ command: 'npx.cmd tsx runner --serverId draft-server', serverId: 'draft-server' }] },
  servers: [{ id: 'draft-server', readyForRealSoak: true }],
  source: 'draft-config',
  totals: { readyServers: 1, servers: 1 },
}), 'draft-ready.json');
const draftSourceStrength = createSettingsMcpReadinessSourceStrength(draftReadinessSummary);
assert.equal(draftSourceStrength.status, 'blocked');
assert.equal(draftSourceStrength.supportsExternalSoakClosure, false);
assert.equal(draftSourceStrength.tier, 'draft-config');
const draftPostSaveReview = createSettingsMcpPostSaveReadinessReview({
  readinessSummary: draftReadinessSummary,
  savedAt: Date.parse('2026-06-30T00:00:00.000Z'),
  soakSummary: null,
});
assert.equal(draftPostSaveReview.status, 'blocked');
assert.equal(draftPostSaveReview.readyForPerServerSoak, false);
const draftHandoff = createSettingsMcpSavedConfigReadinessHandoff({
  configText: JSON.stringify({ servers: [{ args: ['server.js'], command: 'node', id: 'draft-server' }] }),
  readinessSummary: draftReadinessSummary,
  savedAt: Date.parse('2026-06-30T00:00:00.000Z'),
});
assert.equal(draftHandoff.status, 'blocked');
assert.equal(draftHandoff.readyForCommandReview, false);
assert.equal(draftHandoff.steps.find((step) => step.id === 'saved-readiness')?.status, 'blocked');
const draftPerServerCommandReview = createSettingsMcpPerServerSoakCommandReview(
  draftReadinessSummary,
  JSON.stringify({ servers: [{ args: ['server.js'], command: 'node', id: 'draft-server' }] }),
);
assert.equal(draftPerServerCommandReview.status, 'warning');
assert.equal(draftPerServerCommandReview.commandCount, 1);
assert.equal(draftPerServerCommandReview.consistency.status, 'ready');
assert.equal(draftPerServerCommandReview.supportsExternalSoakCollection, false);
assert.equal(createSettingsMcpReadinessSourceStrengthImportedSummary(
  importedSourceStrength,
  draftSourceStrength,
).currentMatch, false);
assert.throws(
  () => parseSettingsMcpReadinessSourceStrengthEvidenceText('{"kind":"other"}', 'bad-source.json'),
  /not a valid MCP readiness source strength/u,
);
const draftExternalEvidence = createSettingsMcpExternalSoakEvidenceGap({
  preflight: readyPreflight,
  readinessSummary: draftReadinessSummary,
  soakSummary,
});
assert.equal(draftExternalEvidence.eligibleForMcpFoundationIncrease, false);
assert.match(draftExternalEvidence.warnings.join(' '), /Draft readiness is a preview/u);
const missingPerServerCommandReview = createSettingsMcpPerServerSoakCommandReview(null);
assert.equal(missingPerServerCommandReview.status, 'blocked');
assert.equal(missingPerServerCommandReview.commandCount, 0);
assert.equal(missingPerServerCommandReview.commandsText, '');
const todoClosure = createSettingsMcpExternalSoakClosureChecklist({
  preflight: readyPreflight,
  readinessSummary,
  soakSummary: null,
});
assert.equal(todoClosure.status, 'blocked');
assert.equal(todoClosure.steps.find((step) => step.id === 'run-soak')?.status, 'todo');
assert.equal(todoClosure.steps.find((step) => step.id === 'estimate-review')?.status, 'blocked');
const missingCoverage = createSettingsMcpExternalSoakClosureCoverage({
  readinessSummary,
  soakSummary: null,
});
assert.equal(missingCoverage.status, 'missing');
assert.equal(missingCoverage.rows[0]?.serverId, 'ready-server');
assert.equal(missingCoverage.rows[0]?.soakStatus, 'missing');
assert.equal(missingCoverage.rows[0]?.actionLabel, 'Run ready-server soak');
assert.match(missingCoverage.rows[0]?.actionDetail ?? '', /import or index/u);
assert.match(missingCoverage.rows[0]?.soakCommand ?? '', /--serverId ready-server/u);
assert.equal(missingCoverage.missingCommandCount, 1);
assert.match(missingCoverage.missingCommandsText, /Run soak: ready-server/u);
assert.match(missingCoverage.missingCommandsText, /--serverId ready-server/u);
assert.match(missingCoverage.missingCommandsText, /Index reports/u);
assert.equal(missingCoverage.closureSteps.map((step) => `${step.id}:${step.status}`).join(','), 'run-missing-soak:copy-ready,index-reports:copy-ready,import-summary:manual');
const missingClosureDrift = createSettingsMcpExternalSoakClosureDrift({
  checklist: todoClosure,
  coverage: missingCoverage,
});
assert.equal(missingClosureDrift.status, 'blocked');
assert.equal(missingClosureDrift.alignedCount, 3);
const multiMissingCoverage = createSettingsMcpExternalSoakClosureCoverage({
  readinessSummary: parseSettingsMcpSoakReadinessText(JSON.stringify({
    configPresent: true,
    kind: 'mcp-real-server-soak-readiness',
    runbook: {
      indexReports: 'npx.cmd tsx indexer --dir reports',
      perServer: [
        { command: 'npx.cmd tsx runner --serverId alpha', serverId: 'alpha' },
        { command: 'npx.cmd tsx runner --serverId beta', serverId: 'beta' },
      ],
    },
    servers: [
      { id: 'alpha', readyForRealSoak: true },
      { id: 'beta', readyForRealSoak: true },
    ],
    source: 'saved-config',
    totals: { readyServers: 2, servers: 2 },
  }), 'multi-ready.json'),
  soakSummary: null,
});
assert.equal(multiMissingCoverage.missingCommandCount, 2);
assert.match(multiMissingCoverage.missingCommandsText, /1\. Run soak: alpha/u);
assert.match(multiMissingCoverage.missingCommandsText, /2\. Run soak: beta/u);
assert.match(multiMissingCoverage.missingCommandsText, /Index reports\nnpx\.cmd tsx indexer/u);
const readyClosureRunbook = createSettingsMcpExternalSoakClosureRunbook(readinessSummary);
assert.equal(readyClosureRunbook.status, 'ready');
assert.equal(readyClosureRunbook.commands.length, 2);
assert.match(formatSettingsMcpExternalSoakClosureRunbookText(readyClosureRunbook), /Run soak: ready-server/u);
assert.match(formatSettingsMcpExternalSoakClosureRunbookText(readyClosureRunbook), /Index reports/u);
const coveredCoverage = createSettingsMcpExternalSoakClosureCoverage({
  readinessSummary,
  soakSummary,
});
assert.equal(coveredCoverage.status, 'covered');
assert.equal(coveredCoverage.coveredCount, 1);
assert.equal(coveredCoverage.rows[0]?.roundCount, 1);
assert.equal(coveredCoverage.rows[0]?.actionLabel, 'No action needed');
assert.equal(coveredCoverage.closureSteps.find((step) => step.id === 'run-missing-soak')?.status, 'ready');
assert.equal(coveredCoverage.closureSteps.find((step) => step.id === 'index-reports')?.status, 'ready');
assert.equal(coveredCoverage.closureSteps.find((step) => step.id === 'import-summary')?.status, 'ready');
const completedPostSaveReview = createSettingsMcpPostSaveReadinessReview({
  readinessSummary,
  savedAt: Date.parse('2026-06-30T00:00:00.000Z'),
  soakSummary,
});
assert.equal(completedPostSaveReview.status, 'ready');
assert.equal(completedPostSaveReview.nextAction, 'Healthy imported soak evidence is ready for MCP foundation estimate review.');
assert.match(createSettingsMcpExternalSoakClosureCoverageEvidenceName(coveredCoverage), /mcp-external-soak-coverage-covered-1-of-1\.json/u);
const importedCoverage = parseSettingsMcpExternalSoakClosureCoverageEvidenceText(
  formatSettingsMcpExternalSoakClosureCoverageEvidenceText(coveredCoverage, '2026-06-30T00:00:00.000Z'),
  'coverage.json',
);
assert.equal(importedCoverage.kind, 'mcp-external-soak-coverage-settings-export');
assert.equal(importedCoverage.inputPath, 'coverage.json');
assert.equal(importedCoverage.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(createSettingsMcpExternalSoakClosureCoverageImportedSummary(importedCoverage, coveredCoverage).currentMatch, true);
assert.equal(createSettingsMcpExternalSoakClosureCoverageImportedSummary(importedCoverage, missingCoverage).currentMatch, false);
assert.equal(createSettingsMcpExternalSoakClosureCoverageImportedSummary(importedCoverage, {
  ...coveredCoverage,
  missingCommandCount: 1,
  missingCommandsText: 'stale missing commands',
}).currentMatch, false);
assert.equal(createSettingsMcpExternalSoakClosureCoverageImportedSummary(importedCoverage, {
  ...coveredCoverage,
  closureSteps: coveredCoverage.closureSteps.map((step) => (
    step.id === 'index-reports' ? { ...step, command: 'stale index command' } : step
  )),
}).currentMatch, false);
assert.equal(createSettingsMcpExternalSoakClosureCoverageImportedSummary(importedCoverage, {
  ...coveredCoverage,
  rows: coveredCoverage.rows.map((row) => ({ ...row, soakCommand: `${row.soakCommand} --rounds 20` })),
}).currentMatch, false);
assert.throws(
  () => parseSettingsMcpExternalSoakClosureCoverageEvidenceText('{"kind":"other"}', 'bad-coverage.json'),
  /not a valid MCP external soak coverage/u,
);
const readyClosure = createSettingsMcpExternalSoakClosureChecklist({
  preflight: readyPreflight,
  readinessSummary,
  soakSummary,
});
assert.equal(readyClosure.status, 'ready');
assert.equal(readyClosure.readyCount, 6);
const readyClosureDrift = createSettingsMcpExternalSoakClosureDrift({
  checklist: readyClosure,
  coverage: coveredCoverage,
});
assert.equal(readyClosureDrift.status, 'aligned');
assert.equal(readyClosureDrift.summaryText, 'MCPExternalSoakClosureDrift status=aligned aligned=3/3');
const readyClosureReviewSnapshot = {
  checklist: readyClosure,
  coverage: coveredCoverage,
  drift: readyClosureDrift,
};
assert.match(
  createSettingsMcpExternalSoakClosureReviewEvidenceName(readyClosureReviewSnapshot),
  /mcp-external-soak-closure-review-aligned-3-of-3\.json/u,
);
const importedReview = parseSettingsMcpExternalSoakClosureReviewEvidenceText(
  formatSettingsMcpExternalSoakClosureReviewEvidenceText(readyClosureReviewSnapshot, '2026-06-30T00:00:00.000Z'),
  'review.json',
);
assert.equal(importedReview.kind, 'mcp-external-soak-closure-review-settings-export');
assert.equal(importedReview.inputPath, 'review.json');
assert.equal(importedReview.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(createSettingsMcpExternalSoakClosureReviewImportedSummary(
  importedReview,
  readyClosureReviewSnapshot,
).currentMatch, true);
assert.equal(createSettingsMcpExternalSoakClosureReviewImportedSummary(
  importedReview,
  {
    ...readyClosureReviewSnapshot,
    coverage: missingCoverage,
  },
).currentMatch, false);
assert.equal(createSettingsMcpExternalSoakClosureReviewImportedSummary(
  importedReview,
  {
    ...readyClosureReviewSnapshot,
    drift: { ...readyClosureDrift, alignedCount: 2 },
  },
).currentMatch, false);
assert.throws(
  () => parseSettingsMcpExternalSoakClosureReviewEvidenceText('{"kind":"other"}', 'bad-review.json'),
  /not a valid MCP external soak closure review/u,
);
const importedClosure = parseSettingsMcpExternalSoakClosureEvidenceText(
  formatSettingsMcpExternalSoakClosureEvidenceText(readyClosure, '2026-06-30T00:00:00.000Z'),
  'closure.json',
);
assert.equal(importedClosure.kind, 'mcp-external-soak-closure-settings-export');
assert.equal(importedClosure.inputPath, 'closure.json');
assert.equal(importedClosure.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(createSettingsMcpExternalSoakClosureImportedSummary(importedClosure, readyClosure).currentMatch, true);
assert.equal(createSettingsMcpExternalSoakClosureImportedSummary(importedClosure, blockedClosure).currentMatch, false);
assert.throws(
  () => parseSettingsMcpExternalSoakClosureEvidenceText('{"kind":"other"}', 'bad-closure.json'),
  /not a valid MCP external soak closure/u,
);
assert.match(createSettingsMcpEvidenceStagesExportName(readyStages), /mcp-evidence-stages-ready-3-of-3\.json/u);
const importedReadyStages = parseSettingsMcpEvidenceStagesExportText(
  formatSettingsMcpEvidenceStagesExportText(readyStages, '2026-06-30T00:00:00.000Z'),
  'stages.json',
);
assert.equal(importedReadyStages.kind, 'mcp-evidence-stages-settings-export');
assert.equal(importedReadyStages.inputPath, 'stages.json');
assert.equal(importedReadyStages.exportedAt, '2026-06-30T00:00:00.000Z');
assert.equal(createSettingsMcpEvidenceStagesImportedSummary(importedReadyStages, readyStages).currentMatch, true);
assert.equal(createSettingsMcpEvidenceStagesImportedSummary(importedReadyStages, blockedStages).currentMatch, false);
assert.throws(
  () => parseSettingsMcpEvidenceStagesExportText('{"kind":"other"}', 'bad-stages.json'),
  /not a valid MCP evidence stages/u,
);

const degradedSoakSummary = parseSettingsMcpSoakReportText(JSON.stringify({
  kind: 'mcp-real-server-soak-report',
  servers: [{
    id: 'drift-server',
    maxToolCount: 1,
    rounds: [
      { durationMs: 5, listOk: true, toolCount: 1 },
      { durationMs: 6, error: 'token=secret failed', listOk: false, toolCount: 0 },
    ],
  }],
  totals: { listSuccesses: 1, rounds: 2 },
}), 'degraded-soak.json');
const degradedReadinessSummary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  configPresent: true,
  kind: 'mcp-real-server-soak-readiness',
  runbook: {
    indexReports: 'npx.cmd tsx indexer --dir reports',
    perServer: [{ command: 'npx.cmd tsx runner --serverId drift-server', serverId: 'drift-server' }],
  },
  servers: [{ id: 'drift-server', readyForRealSoak: true }],
  source: 'saved-config',
  totals: { readyServers: 1, servers: 1 },
}), 'drift-ready.json');
const warningStages = createSettingsMcpEvidenceStageSummary({
  preflight: readyPreflight,
  readinessSummary,
  soakSummary: degradedSoakSummary,
});
assert.equal(warningStages.status, 'warning');
assert.equal(warningStages.readyCount, 2);
const warningExternalEvidence = createSettingsMcpExternalSoakEvidenceGap({
  preflight: readyPreflight,
  readinessSummary,
  soakSummary: degradedSoakSummary,
});
assert.equal(warningExternalEvidence.status, 'warning');
assert.equal(warningExternalEvidence.eligibleForMcpFoundationIncrease, false);
assert.match(warningExternalEvidence.nextAction, /degraded/u);
const warningCoverage = createSettingsMcpExternalSoakClosureCoverage({
  readinessSummary: degradedReadinessSummary,
  soakSummary: degradedSoakSummary,
});
assert.equal(warningCoverage.status, 'warning');
assert.equal(warningCoverage.rows[0]?.soakStatus, 'degraded');
assert.equal(warningCoverage.closureSteps.map((step) => `${step.id}:${step.status}`).join(','), 'run-missing-soak:ready,index-reports:ready,import-summary:warning');
const warningClosure = createSettingsMcpExternalSoakClosureChecklist({
  preflight: readyPreflight,
  readinessSummary: degradedReadinessSummary,
  soakSummary: degradedSoakSummary,
});
const warningClosureDrift = createSettingsMcpExternalSoakClosureDrift({
  checklist: warningClosure,
  coverage: warningCoverage,
});
assert.equal(warningClosureDrift.status, 'warning');
assert.equal(warningClosureDrift.comparisons.find((comparison) => comparison.id === 'import-soak')?.coverageStatus, 'warning');

assert.match(overviewSource, /Evidence stages/u);
assert.match(overviewSource, /Config preflight/u);
assert.match(overviewSource, /Saved server health/u);
assert.match(overviewSource, /Real-soak readiness/u);
assert.match(overviewSource, /Imported soak report/u);
assert.match(overviewSource, /Tool visibility/u);
assert.match(overviewSource, /statusCounts\.blocked/u);
assert.match(overviewSource, /createSettingsMcpEvidenceStageSummary/u);
assert.match(overviewSource, /SettingsMcpExternalSoakClosureChecklistPanel/u);
assert.match(overviewSource, /SettingsMcpExternalSoakEvidenceGapPanel/u);
assert.match(overviewSource, /SettingsMcpReadinessSourceStrengthPanel/u);
assert.match(overviewSource, /SettingsMcpEvidenceStagesExchangePanel/u);
assert.match(overviewSource, /lg:grid-cols-6/u);
assert.match(evidenceStagesSource, /MCPEvidenceStages/u);
assert.match(evidenceStagesSource, /mcp-evidence-stages-settings-export/u);
assert.match(externalSoakClosureSource, /MCPExternalSoakClosure/u);
assert.match(externalSoakClosureSource, /estimate-review/u);
assert.match(externalSoakClosureSource, /createSettingsMcpExternalSoakClosureState/u);
assert.match(externalSoakClosureStateSource, /createSettingsMcpExternalSoakClosureState/u);
assert.match(externalSoakClosureStateSource, /estimateReview/u);
assert.match(externalSoakClosureStateSource, /importSoak/u);
assert.match(externalSoakClosurePanelSource, /External MCP soak closure/u);
assert.match(externalSoakClosurePanelSource, /checklist\.readyCount/u);
assert.match(externalSoakClosurePanelSource, /SettingsMcpExternalSoakClosureCoveragePanel/u);
assert.match(externalSoakClosurePanelSource, /checklist=\{checklist\}/u);
assert.match(externalSoakClosurePanelSource, /SettingsMcpExternalSoakClosureRunbookPanel/u);
assert.match(externalSoakClosurePanelSource, /SettingsMcpExternalSoakClosureEvidenceExchangePanel/u);
assert.match(externalSoakClosureCoverageSource, /MCPExternalSoakCoverage/u);
assert.match(externalSoakClosureCoverageSource, /readyForRealSoak/u);
assert.match(externalSoakClosureCoverageSource, /createRunbookCommandMap/u);
assert.match(externalSoakClosureCoverageSource, /createClosureSteps/u);
assert.match(externalSoakClosureCoverageSource, /createSettingsMcpExternalSoakClosureState/u);
assert.match(externalSoakClosureCoverageSource, /createSettingsMcpExternalSoakClosureMissingCommandsText/u);
assert.match(externalSoakClosureCoverageSource, /Index reports/u);
assert.match(externalSoakClosureCoverageSource, /Run ready-server soak/u);
assert.match(externalSoakClosureCoverageSource, /hasSoakSummary/u);
assert.match(externalSoakClosureCoverageSource, /Imported soak summary is present but needs review/u);
assert.match(externalSoakClosureCoverageEvidenceSource, /mcp-external-soak-coverage-settings-export/u);
assert.match(externalSoakClosureCoverageEvidenceSource, /createSettingsMcpExternalSoakClosureCoverageImportedSummary/u);
assert.match(externalSoakClosureCoveragePanelSource, /Ready-server soak coverage/u);
assert.match(externalSoakClosureCoveragePanelSource, /coverage\.coveredCount/u);
assert.match(externalSoakClosureCoveragePanelSource, /SettingsMcpExternalSoakClosureCoverageRow/u);
assert.match(externalSoakClosureCoveragePanelSource, /SettingsMcpExternalSoakClosureCoverageMissingCommandsPanel/u);
assert.match(externalSoakClosureCoveragePanelSource, /SettingsMcpExternalSoakClosureDriftPanel/u);
assert.doesNotMatch(externalSoakClosureCoveragePanelSource, /row\.actionLabel/u);
assert.match(externalSoakClosureCoverageMissingCommandsSource, /Copy all missing commands/u);
assert.match(externalSoakClosureCoverageMissingCommandsSource, /missingCommandCount/u);
assert.match(externalSoakClosureCoverageMissingCommandsSource, /missingCommandsText/u);
assert.match(externalSoakClosureCoverageMissingCommandsSource, /closureSteps/u);
assert.match(externalSoakClosureCoverageMissingCommandsSource, /copySettingsTextToClipboard/u);
assert.match(externalSoakClosureCoverageMissingCommandsSource, /copy failed/u);
assert.match(externalSoakClosureCoverageRowSource, /Copy command/u);
assert.match(externalSoakClosureCoverageRowSource, /copySettingsTextToClipboard/u);
assert.match(externalSoakClosureCoverageRowSource, /copyStatus/u);
assert.match(externalSoakClosureCoverageRowSource, /copy failed/u);
assert.match(externalSoakClosureCoverageRowSource, /row\.actionLabel/u);
assert.match(externalSoakClosureCoverageRowSource, /row\.soakCommand/u);
assert.match(externalSoakClosureCoveragePanelSource, /SettingsMcpExternalSoakClosureCoverageEvidenceExchangePanel/u);
assert.match(externalSoakClosureCoverageExchangeSource, /Coverage evidence exchange/u);
assert.match(externalSoakClosureCoverageExchangeSource, /Import coverage/u);
assert.match(externalSoakClosureCoverageExchangeSource, /Export coverage/u);
assert.match(externalSoakClosureDriftSource, /MCPExternalSoakClosureDrift/u);
assert.match(externalSoakClosureDriftSource, /createSettingsMcpExternalSoakClosureDrift/u);
assert.match(externalSoakClosureDriftPanelSource, /Closure evidence drift/u);
assert.match(externalSoakClosureDriftPanelSource, /checklist=\{comparison\.checklistStatus\}/u);
assert.match(externalSoakClosureDriftPanelSource, /coverage=\{comparison\.coverageStatus\}/u);
assert.match(externalSoakClosureDriftPanelSource, /SettingsMcpExternalSoakClosureReviewEvidenceExchangePanel/u);
assert.match(externalSoakClosureReviewSource, /mcp-external-soak-closure-review-settings-export/u);
assert.match(externalSoakClosureReviewSource, /createSettingsMcpExternalSoakClosureReviewImportedSummary/u);
assert.match(externalSoakClosureReviewSource, /createSnapshotSignature/u);
assert.match(externalSoakClosureReviewExchangeSource, /Closure review snapshot/u);
assert.match(externalSoakClosureReviewExchangeSource, /Import review/u);
assert.match(externalSoakClosureReviewExchangeSource, /Export review/u);
assert.match(externalSoakClosureEvidenceSource, /mcp-external-soak-closure-settings-export/u);
assert.match(externalSoakClosureEvidenceSource, /createSettingsMcpExternalSoakClosureImportedSummary/u);
assert.match(externalSoakClosureExchangeSource, /Closure evidence exchange/u);
assert.match(externalSoakClosureExchangeSource, /Import closure/u);
assert.match(externalSoakClosureExchangeSource, /Export closure/u);
assert.match(externalSoakClosureRunbookSource, /MCPExternalSoakClosureRunbook/u);
assert.match(externalSoakClosureRunbookSource, /index-reports/u);
assert.match(externalSoakClosureRunbookPanelSource, /Closure runbook/u);
assert.match(externalSoakClosureRunbookPanelSource, /Copy closure runbook/u);
assert.match(externalSoakGapSource, /MCPExternalSoakEvidence/u);
assert.match(externalSoakGapSource, /eligibleForMcpFoundationIncrease/u);
assert.match(externalSoakGapSource, /createSettingsMcpReadinessSourceStrength/u);
assert.match(externalSoakGapPanelSource, /External MCP soak evidence/u);
assert.match(externalSoakGapPanelSource, /estimate held/u);
assert.match(readinessSourceStrengthSource, /MCPReadinessSource/u);
assert.match(readinessSourceStrengthSource, /supportsExternalSoakClosure/u);
assert.match(readinessSourceStrengthEvidenceSource, /mcp-readiness-source-strength-settings-export/u);
assert.match(readinessSourceStrengthEvidenceSource, /createSettingsMcpReadinessSourceStrengthImportedSummary/u);
assert.match(readinessSourceStrengthPanelSource, /Readiness source/u);
assert.match(readinessSourceStrengthPanelSource, /closure source ready/u);
assert.match(readinessSourceStrengthPanelSource, /SettingsMcpReadinessSourceStrengthEvidenceExchangePanel/u);
assert.match(readinessSourceStrengthExchangeSource, /Readiness source exchange/u);
assert.match(readinessSourceStrengthExchangeSource, /Import source/u);
assert.match(readinessSourceStrengthExchangeSource, /Export source/u);
assert.match(postSaveReviewSource, /MCPPostSaveReadinessReview/u);
assert.match(postSaveReviewSource, /readyForPerServerSoak/u);
assert.match(postSaveReviewPanelSource, /Post-save readiness review/u);
assert.match(postSaveReviewPanelSource, /per-server soak=\{review\.readyForPerServerSoak/u);
assert.match(savedConfigHandoffSource, /MCPSavedConfigReadinessHandoff/u);
assert.match(savedConfigHandoffSource, /readiness-freshness/u);
assert.match(savedConfigHandoffSource, /readyForCommandReview/u);
assert.match(savedConfigHandoffPanelSource, /Saved-config readiness handoff/u);
assert.match(savedConfigHandoffPanelSource, /command review ready/u);
assert.doesNotMatch(savedConfigHandoffPanelSource, /desktopPetShellRuntime/u);
assert.doesNotMatch(savedConfigHandoffPanelSource, /child_process/u);
assert.doesNotMatch(savedConfigHandoffPanelSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(savedConfigHandoffPanelSource, /\bspawn(Sync)?\b/u);
assert.match(perServerSoakCommandReviewSource, /MCPPerServerSoakCommandReview/u);
assert.match(perServerSoakCommandReviewSource, /supportsExternalSoakCollection/u);
assert.match(perServerSoakCommandReviewSource, /mcp-per-server-soak-command-review-settings-export/u);
assert.match(perServerSoakCommandReviewSource, /saved-config/u);
assert.match(perServerSoakCommandReviewSource, /candidateConsistency/u);
assert.match(perServerSoakCommandReviewSource, /createSettingsMcpReadinessCandidateConsistency/u);
assert.match(readinessCandidateConsistencySource, /MCPReadinessCandidateConsistency/u);
assert.match(readinessCandidateConsistencySource, /missing from the current config/u);
assert.match(perServerSoakCommandReviewPanelSource, /Per-server soak commands/u);
assert.match(perServerSoakCommandReviewPanelSource, /Copy all per-server commands/u);
assert.match(perServerSoakCommandReviewPanelSource, /Export command review/u);
assert.match(perServerSoakCommandReviewPanelSource, /candidate consistency/u);
assert.match(perServerSoakCommandReviewPanelSource, /copySettingsTextToClipboard/u);
assert.match(perServerSoakCommandReviewPanelSource, /downloadJsonTextFile/u);
assert.doesNotMatch(perServerSoakCommandReviewPanelSource, /desktopPetShellRuntime/u);
assert.doesNotMatch(perServerSoakCommandReviewPanelSource, /child_process/u);
assert.doesNotMatch(perServerSoakCommandReviewPanelSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(perServerSoakCommandReviewPanelSource, /\bspawn(Sync)?\b/u);
assert.match(clipboardUtilsSource, /navigator\.clipboard\.writeText/u);
assert.match(evidenceStagesExchangeSource, /Evidence stages exchange/u);
assert.match(evidenceStagesExchangeSource, /Export stages/u);
assert.match(evidenceStagesExchangeSource, /Import stages/u);
assert.match(blockSource, /SettingsMcpProgressOverview/u);
assert.match(blockSource, /SettingsMcpPostSaveReadinessReviewPanel/u);
assert.match(blockSource, /SettingsMcpSavedConfigReadinessHandoffPanel/u);
assert.match(blockSource, /SettingsMcpPerServerSoakCommandReviewPanel/u);
assert.match(blockSource, /SettingsMcpSoakEvidenceActions/u);
assert.match(blockSource, /onSummaryChange=\{setReadinessSummary\}/u);
assert.match(blockSource, /onSummaryChange=\{setSoakSummary\}/u);
assert.match(blockSource, /summary=\{soakSummary\}/u);
assert.match(blockSource, /MCP soak evidence cleared/u);
assert.match(evidenceSource, /mcp-soak-summary-settings-evidence/u);
assert.match(evidenceSource, /parseSettingsMcpSoakEvidenceEnvelope/u);
assert.match(evidenceActionsSource, /Export evidence/u);
assert.match(evidenceActionsSource, /Clear evidence/u);
assert.match(skillMcpProgressPanelSource, /Skill \/ MCP 进度/u);
assert.match(skillMcpProgressPanelSource, /阻塞：\{formatSettingsSkillMcpBlocker\(item\)\}/u);
assert.match(skillMcpProgressPanelSource, /证据：\{formatSettingsSkillMcpEvidence\(item\)\}/u);
assert.match(skillMcpProgressPanelSource, /下一步：\{formatSettingsSkillMcpNextStep\(item\)\}/u);
assert.match(skillMcpProgressPanelSource, /SettingsSkillMcpProgressEvidenceExchangePanel/u);
assert.match(skillMcpProgressExchangeSource, /进度证据导入\/导出/u);
assert.match(skillMcpProgressExchangeSource, /导入进度/u);
assert.match(skillMcpProgressExchangeSource, /导出进度/u);
assert.match(skillMcpProgressExchangeSource, /skill-mcp-progress-evidence\.json/u);
assert.match(skillMcpProgressModelSource, /createSettingsSkillMcpProgressImportedSummary/u);
assert.match(skillMcpProgressModelSource, /packaged-production review gates/u);
assert.match(skillMcpProgressModelSource, /2\/2 official packaged server coverage/u);
assert.match(skillMcpProgressModelSource, /40\/40 tools\/list successes/u);
assert.match(skillMcpProgressModelSource, /40\/40 read-only list_directory\/read_graph call successes/u);
assert.match(skillMcpProgressModelSource, /Signed WASM execution/u);
assert.match(skillMcpProgressModelSource, /SPKI SHA-256 signing-key continuity/u);
assert.match(skillMcpProgressModelSource, /root-signed publisher-catalog provisioning/u);
assert.match(skillMcpProgressModelSource, /bundled root registry is empty/u);
assert.match(skillMcpProgressModelSource, /forged, future, expired, replayed, revoked-root/u);
assert.match(skillMcpProgressModelSource, /bounded wasm-pure-json-v1 execution/u);
assert.match(skillMcpProgressModelSource, /200-entry redacted receipt history/u);
assert.match(skillMcpProgressModelSource, /20-call\/60-second storage\.read limits/u);
assert.match(skillMcpProgressModelSource, /automatic quarantine after three consecutive package-attributed failures/u);
assert.match(skillMcpProgressModelSource, /redacted package-health JSON export/u);
assert.match(skillMcpProgressModelSource, /static WASM admission matrix/u);
assert.match(skillMcpProgressModelSource, /7\/7 real packaged-process admission probe/u);
assert.match(skillMcpProgressModelSource, /external-skill-packaged-admission-report\.json/u);
assert.match(skillMcpProgressModelSource, /fresh Ed25519 staging/u);
assert.match(skillMcpProgressModelSource, /immutable rollback snapshot/u);
assert.match(skillMcpProgressModelSource, /Rejected key changes do not mutate/u);
assert.match(skillMcpProgressModelSource, /redacted health and lifecycle receipt JSON exports/u);
assert.match(skillMcpProgressModelSource, /dual-signature migration/u);
assert.match(skillMcpProgressModelSource, /main-process-ed25519-dual-signature/u);
assert.match(skillMcpProgressModelSource, /Market release remains explicitly disabled/u);
assert.match(skillMcpProgressModelSource, /first isolated third-party reference family are closed/u);
assert.match(skillMcpProgressModelSource, /draft 7\/2019\/2020 validation/u);
assert.match(skillMcpProgressModelSource, /exact JSON Pointer field rules/u);
assert.match(skillMcpProgressModelSource, /process-backed local draft 7\/2019\/2020 matrix/u);
assert.match(skillMcpProgressModelSource, /36\/36 supported schemas/u);
assert.match(skillMcpProgressModelSource, /version-pinned official server-everything audit/u);
assert.match(skillMcpProgressModelSource, /no longer inherit DESKTOP_PET values/u);
assert.doesNotMatch(skillMcpProgressModelSource, /spawn EPERM/u);
assert.match(skillMcpProgressModelSource, /settings-skill-mcp-progress-evidence/u);
assert.match(skillMcpProgressModelSource, /99\.9%/u);
assert.match(packagedProductionEvidenceSource, /mcp-packaged-production-long-run-report/u);
assert.match(packagedProductionEvidenceSource, /MCP_PACKAGED_PRODUCTION_MIN_DURATION_MS/u);
assert.match(packagedProductionEvidenceSource, /automaticHighRiskCallCount/u);
assert.match(packagedProductionEvidenceCliSource, /agent-mcp-packaged-production-evidence/u);
assert.doesNotMatch(packagedProductionEvidenceCliSource, /child_process/u);
assert.doesNotMatch(packagedProductionEvidenceCliSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(packagedProductionEvidenceCliSource, /\bspawn(Sync)?\b/u);
assert.match(packagedProductionReportBuilderSource, /createSettingsMcpPackagedProductionReportFromSoakSummary/u);
assert.match(packagedProductionReportBuilderSource, /SettingsMcpSoakSummaryResult/u);
assert.match(packagedProductionReportBuilderCliSource, /agent-mcp-packaged-production-report-builder/u);
assert.doesNotMatch(packagedProductionReportBuilderCliSource, /child_process/u);
assert.doesNotMatch(packagedProductionReportBuilderCliSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(packagedProductionReportBuilderCliSource, /\bspawn(Sync)?\b/u);
assert.match(packagedProductionRuntimeLogSource, /createSettingsMcpPackagedProductionRuntimeLogSummary/u);
assert.match(packagedProductionRuntimeLogSource, /whenReady: complete/u);
assert.match(packagedProductionRunPlanSource, /createSettingsMcpPackagedProductionRunPlan/u);
assert.match(packagedProductionRunPlanSource, /DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS/u);
assert.match(packagedProductionRunPlanSource, /autoQuitMs/u);
assert.match(packagedProductionRunPlanSource, /Start-Process/u);
assert.match(packagedProductionRunPlanSource, /packagedMainHarnessCommand/u);
assert.match(packagedProductionRunPlanSource, /agent-mcp-packaged-main-harness/u);
assert.match(packagedProductionRunPlanSource, /harnessComparisonCommand/u);
assert.match(packagedProductionRunPlanSource, /agent-mcp-packaged-harness-comparison/u);
assert.match(packagedProductionRunPlanCliSource, /agent-mcp-packaged-production-run-plan/u);
assert.match(packagedProductionRunCollectorCliSource, /agent-mcp-packaged-production-run-collector/u);
assert.match(packagedMainHarnessCliSource, /packaged-main-harness/u);
assert.match(packagedMainHarnessCliSource, /runtimeKind: 'packaged-main-harness'/u);
assert.match(packagedHarnessComparisonSource, /settings-mcp-packaged-harness-comparison/u);
assert.match(packagedHarnessComparisonSource, /exe\/Electron packaged launch behavior/u);
assert.match(packagedHarnessComparisonCliSource, /agent-mcp-packaged-harness-comparison/u);
assert.match(packagedReadOnlyCoverageSource, /createSettingsMcpPackagedReadOnlyCoverageReview/u);
assert.match(packagedReadOnlyCoverageSource, /settings-mcp-packaged-read-only-coverage-review/u);
assert.match(packagedReadOnlyCoverageCliSource, /agent-mcp-packaged-read-only-coverage/u);
assert.doesNotMatch(packagedProductionRunPlanCliSource, /child_process/u);
assert.doesNotMatch(packagedProductionRunPlanCliSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(packagedProductionRunPlanCliSource, /\bspawn(Sync)?\b/u);
assert.doesNotMatch(packagedProductionRunCollectorCliSource, /child_process/u);
assert.doesNotMatch(packagedProductionRunCollectorCliSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(packagedProductionRunCollectorCliSource, /\bspawn(Sync)?\b/u);
assert.doesNotMatch(packagedReadOnlyCoverageCliSource, /child_process/u);
assert.doesNotMatch(packagedReadOnlyCoverageCliSource, /\bexec(File|Sync)?\b/u);
assert.doesNotMatch(packagedReadOnlyCoverageCliSource, /\bspawn(Sync)?\b/u);
assert.match(sectionSource, /SettingsMcpAdvancedWorkspace/u);
assert.match(sectionSource, /lastConfigSavedAt/u);
assert.match(advancedWorkspaceSource, /SettingsMcpOperationalPanels/u);
assert.match(advancedWorkspaceSource, /lastConfigSavedAt/u);
assert.match(operationalPanelsSource, /SettingsSkillMcpProgressPanel/u);
assert.match(operationalPanelsSource, /SettingsMcpEvidenceProgressBlock/u);
assert.match(operationalPanelsSource, /lastConfigSavedAt/u);
assert.doesNotMatch(historyPanelSource, /SettingsMcpSoakReadinessPanel/u);
assert.doesNotMatch(historyPanelSource, /SettingsMcpSoakSummaryPanel/u);

console.log('agent MCP progress overview UI smoke passed');
