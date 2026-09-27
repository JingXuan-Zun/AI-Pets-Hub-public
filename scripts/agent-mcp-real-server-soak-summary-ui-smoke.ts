import { strict as assert } from 'node:assert';
import {
  parseSettingsMcpSoakReportText,
} from '../src/components/settings/settingsMcpSoakImport.ts';
import {
  createSettingsMcpSoakEvidenceText,
  SETTINGS_MCP_SOAK_EVIDENCE_KIND,
} from '../src/components/settings/settingsMcpSoakEvidence.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const panelSource = readProjectFile('src/components/settings/SettingsMcpSoakSummaryPanel.tsx');
const evidenceActionsSource = readProjectFile('src/components/settings/SettingsMcpSoakEvidenceActions.tsx');
const evidenceSource = readProjectFile('src/components/settings/settingsMcpSoakEvidence.ts');
const downloadUtilsSource = readProjectFile('src/components/settings/settingsDownloadUtils.ts');
const progressBlockSource = readProjectFile('src/components/settings/SettingsMcpEvidenceProgressBlock.tsx');
const operationalPanelsSource = readProjectFile('src/components/settings/SettingsMcpOperationalPanels.tsx');

const summary = parseSettingsMcpSoakReportText(JSON.stringify({
  kind: 'mcp-real-server-soak-report',
  servers: [{
    history: {
      byStatus: { 'session:restart-cooldown': 1 },
      totalCount: 1,
    },
    id: 'ui-soak-server',
    maxToolCount: 2,
    rounds: [
      { durationMs: 20, error: null, listOk: true, toolCount: 2 },
      { durationMs: 40, error: 'password=secret failed', listOk: false, toolCount: 1 },
    ],
  }],
  totals: { listFailures: 1, listSuccesses: 1, rounds: 2, servers: 1 },
  version: 1,
}), 'ui-report.json');

assert.equal(summary.status, 'degraded');
assert.equal(summary.servers[0]?.toolCountChanged, true);
assert.equal(JSON.stringify(summary).includes('secret'), false);

const evidenceText = createSettingsMcpSoakEvidenceText(summary);
const evidenceSummary = parseSettingsMcpSoakReportText(evidenceText, 'ui-evidence.json');
assert.equal(evidenceSummary.status, summary.status);
assert.equal(evidenceSummary.inputPath, 'ui-evidence.json');
assert.equal(JSON.stringify(evidenceSummary).includes('secret'), false);

const tamperedEvidence = JSON.parse(evidenceText);
tamperedEvidence.summary.servers[0].errorSamples = ['api_key=secret-token failed'];
const redactedEvidenceSummary = parseSettingsMcpSoakReportText(JSON.stringify(tamperedEvidence), 'redacted-evidence.json');
assert.equal(JSON.stringify(redactedEvidenceSummary).includes('secret-token'), false);

assert.throws(() => parseSettingsMcpSoakReportText('{"kind":"other"}', 'bad.json'), /not an MCP real-server soak report or Settings soak evidence/u);
assert.throws(() => parseSettingsMcpSoakReportText(JSON.stringify({
  kind: SETTINGS_MCP_SOAK_EVIDENCE_KIND,
  summary: { kind: 'other' },
  version: 1,
}), 'bad-evidence.json'), /not a soak summary/u);

assert.match(panelSource, /type="file"/u);
assert.match(panelSource, /accept="application\/json,.json"/u);
assert.match(panelSource, /parseSettingsMcpSoakReportText/u);
assert.match(panelSource, /Imported MCP soak evidence/u);
assert.match(panelSource, /onSummaryChange/u);
assert.match(panelSource, /controlledSummary/u);
assert.match(panelSource, /visibleSummary/u);
assert.match(evidenceActionsSource, /downloadJsonTextFile/u);
assert.match(downloadUtilsSource, /URL\.createObjectURL/u);
assert.match(evidenceActionsSource, /createSettingsMcpSoakEvidenceText/u);
assert.match(evidenceSource, /mcp-soak-evidence-\$\{summary\.status\}/u);
assert.match(progressBlockSource, /SettingsMcpSoakSummaryPanel/u);
assert.match(progressBlockSource, /SettingsMcpSoakEvidenceActions/u);
assert.match(operationalPanelsSource, /SettingsMcpEvidenceProgressBlock/u);

console.log('agent MCP real-server soak summary UI smoke passed');
