import { strict as assert } from 'node:assert';
import {
  createSettingsMcpConfigPreflight,
} from '../src/components/settings/settingsMcpConfigPreflight';
import {
  createSettingsMcpConfigPreflightEvidenceSummary,
} from '../src/components/settings/settingsMcpConfigPreflightEvidence';
import {
  formatSettingsMcpConfigPreflightExportText,
  parseSettingsMcpConfigPreflightExportText,
} from '../src/components/settings/settingsMcpConfigPreflightExport';
import { readProjectFile } from './smokeTestHarness.ts';

const readyPreflight = createSettingsMcpConfigPreflight(JSON.stringify({
  servers: [{
    args: ['server.js'],
    command: 'node',
    id: 'ready-server',
  }],
}));
const imported = parseSettingsMcpConfigPreflightExportText(
  formatSettingsMcpConfigPreflightExportText(readyPreflight, '2026-06-30T00:00:00.000Z'),
  'ready-evidence.json',
);

const matchingSummary = createSettingsMcpConfigPreflightEvidenceSummary(imported, readyPreflight);
assert.equal(matchingSummary.currentMatch, true);
assert.equal(matchingSummary.status, 'ready');
assert.equal(matchingSummary.serverCount, 1);
assert.match(matchingSummary.detail, /matches/u);
assert.equal(readyPreflight.statusCounts.ready, readyPreflight.checks.length);

const changedPreflight = createSettingsMcpConfigPreflight('{"servers":[]}');
const changedSummary = createSettingsMcpConfigPreflightEvidenceSummary(imported, changedPreflight);
assert.equal(changedSummary.currentMatch, false);
assert.match(changedSummary.detail, /differs/u);

const panelSource = readProjectFile('src/components/settings/SettingsMcpConfigPreflightPanel.tsx');
const editorBlockSource = readProjectFile('src/components/settings/SettingsMcpConfigEditorBlock.tsx');
const importButtonSource = readProjectFile('src/components/settings/SettingsMcpConfigPreflightImportButton.tsx');
const evidencePanelSource = readProjectFile('src/components/settings/SettingsMcpConfigPreflightImportedEvidencePanel.tsx');
assert.match(panelSource, /SettingsMcpConfigPreflightImportButton/u);
assert.match(panelSource, /SettingsMcpConfigPreflightExportButton/u);
assert.match(panelSource, /SettingsMcpConfigPreflightImportedEvidencePanel/u);
assert.match(panelSource, /statusCounts\.blocked/u);
assert.match(editorBlockSource, /onFeedback=\{onFeedback\}/u);
assert.match(editorBlockSource, /SettingsMcpRealServerConfigGuidePanel/u);
assert.match(importButtonSource, /parseSettingsMcpConfigPreflightExportText/u);
assert.match(evidencePanelSource, /Imported evidence/u);

console.log('agent MCP config preflight evidence UI smoke passed');
