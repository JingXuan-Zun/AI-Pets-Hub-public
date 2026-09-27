import { strict as assert } from 'node:assert';
import {
  parseSettingsMcpSoakReadinessText,
} from '../src/components/settings/settingsMcpSoakReadiness.ts';
import {
  createSettingsMcpReadinessSourceStrength,
} from '../src/components/settings/settingsMcpReadinessSourceStrength.ts';
import { projectRoot, readProjectFile } from './smokeTestHarness.ts';

const panelSource = readProjectFile('src/components/settings/SettingsMcpSoakReadinessPanel.tsx');
const sourceModePanelSource = readProjectFile('src/components/settings/SettingsMcpSoakReadinessSourceModePanel.tsx');
const nextActionsSource = readProjectFile('src/components/settings/settingsMcpSoakReadinessNextActions.ts');
const progressBlockSource = readProjectFile('src/components/settings/SettingsMcpEvidenceProgressBlock.tsx');
const progressOverviewSource = readProjectFile('src/components/settings/SettingsMcpProgressOverview.tsx');
const sourceStrengthPanelSource = readProjectFile('src/components/settings/SettingsMcpReadinessSourceStrengthPanel.tsx');
const sourceStrengthExchangeSource = readProjectFile('src/components/settings/SettingsMcpReadinessSourceStrengthEvidenceExchangePanel.tsx');
const sourceStrengthSource = readProjectFile('src/components/settings/settingsMcpReadinessSourceStrength.ts');
const templatePanelSource = readProjectFile('src/components/settings/SettingsMcpServerTemplatePanel.tsx');
const templateUtilsSource = readProjectFile('src/components/settings/settingsMcpServerTemplateUtils.ts');

const summary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  configPath: '.desktop-pet-mcp.json',
  configPresent: true,
  kind: 'mcp-real-server-soak-readiness',
  reportDir: 'tmp/mcp-real-soak-samples',
  runbook: {
    allServers: 'npx.cmd tsx runner --all token=secret',
    indexReports: 'npx.cmd tsx indexer',
    perServer: [{ command: 'npx.cmd tsx runner --serverId ready-server', serverId: 'ready-server' }],
  },
  servers: [{
    blockers: [],
    command: process.execPath,
    commandPathExists: true,
    cwd: projectRoot,
    cwdExists: true,
    fakeFixture: false,
    id: 'ready-server',
    readyForRealSoak: true,
  }, {
    blockers: ['cwd does not exist'],
    command: 'missing-command',
    commandPathExists: false,
    cwd: 'missing-cwd',
    cwdExists: false,
    fakeFixture: false,
    id: 'blocked-server',
    readyForRealSoak: false,
  }],
  source: 'saved-config',
  status: 'ready',
  totals: {
    blockedServers: 1,
    fakeFixtureServers: 0,
    readyServers: 1,
    servers: 2,
  },
}), 'readiness.json');
const exportedSummary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  exportedAt: new Date().toISOString(),
  kind: 'mcp-real-server-soak-readiness-settings-export',
  summary,
  version: 1,
}), 'settings-export.json');
const draftEmptySummary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  configPresent: false,
  kind: 'mcp-real-server-soak-readiness',
  runbook: {},
  servers: [],
  source: 'draft-config',
  totals: { readyServers: 0, servers: 0 },
}), 'draft-empty.json');
const savedEmptySummary = parseSettingsMcpSoakReadinessText(JSON.stringify({
  configPresent: false,
  kind: 'mcp-real-server-soak-readiness',
  runbook: {},
  servers: [],
  source: 'saved-config',
  totals: { readyServers: 0, servers: 0 },
}), 'saved-empty.json');

assert.equal(summary.status, 'ready');
assert.equal(summary.totals.readyServers, 1);
assert.equal(summary.servers[0]?.status, 'ready');
assert.equal(summary.servers[1]?.status, 'blocked');
assert.deepEqual(summary.nextActions?.map((action) => action.id), [
  'fix-server-blockers',
  'run-ready-server-soak',
  'index-and-import-soak',
]);
assert.equal(exportedSummary.status, 'ready');
assert.equal(exportedSummary.inputPath, 'settings-export.json');
assert.equal(draftEmptySummary.recommendations[0], 'Save the draft MCP config before collecting real external soak evidence.');
assert.equal(draftEmptySummary.nextActions?.[0]?.id, 'save-draft-config');
assert.equal(draftEmptySummary.nextActions?.[1]?.id, 'add-mcp-server');
assert.equal(savedEmptySummary.recommendations[0], 'Create or load .desktop-pet-mcp.json before collecting real external soak evidence.');
assert.equal(savedEmptySummary.nextActions?.[0]?.id, 'create-saved-config');
assert.equal(createSettingsMcpReadinessSourceStrength(summary).supportsExternalSoakClosure, true);
assert.equal(createSettingsMcpReadinessSourceStrength(draftEmptySummary).status, 'blocked');
assert.equal(createSettingsMcpReadinessSourceStrength(draftEmptySummary).supportsExternalSoakClosure, false);
assert.equal(createSettingsMcpReadinessSourceStrength(savedEmptySummary).supportsExternalSoakClosure, false);
assert.equal(JSON.stringify(summary).includes('secret'), false);
assert.throws(
  () => parseSettingsMcpSoakReadinessText('{"kind":"mcp-real-server-soak-readiness-settings-export","summary":{}}', 'bad-export.json'),
  /does not contain a valid readiness summary/u,
);
assert.throws(
  () => parseSettingsMcpSoakReadinessText('{"kind":"mcp-real-server-soak-report"}', 'bad.json'),
  /not an MCP real-server soak readiness report/u,
);

assert.match(panelSource, /MCP soak readiness/u);
assert.match(panelSource, /parseSettingsMcpSoakReadinessText/u);
assert.match(panelSource, /getMcpSoakReadiness/u);
assert.match(panelSource, /SettingsMcpSoakReadinessSourceModePanel/u);
assert.match(panelSource, /useState<SettingsMcpSoakReadinessSourceMode>\('saved-config'\)/u);
assert.match(panelSource, /sourceMode === 'draft-config'/u);
assert.match(panelSource, /draft-mcp-config/u);
assert.match(panelSource, /saved-mcp-config/u);
assert.match(panelSource, /SettingsMcpSoakReadinessNextActionsPanel/u);
assert.match(nextActionsSource, /run-ready-server-soak/u);
assert.match(nextActionsSource, /index-and-import-soak/u);
assert.match(panelSource, /MCP soak readiness:/u);
assert.match(panelSource, /onSummaryChange/u);
assert.match(progressBlockSource, /SettingsMcpSoakReadinessPanel/u);
assert.match(progressOverviewSource, /SettingsMcpReadinessSourceStrengthPanel/u);
assert.match(sourceStrengthSource, /draft-config/u);
assert.match(sourceStrengthSource, /saved-config/u);
assert.match(sourceStrengthPanelSource, /Readiness source/u);
assert.match(sourceStrengthPanelSource, /SettingsMcpReadinessSourceStrengthEvidenceExchangePanel/u);
assert.match(sourceStrengthExchangeSource, /Readiness source exchange/u);
assert.match(sourceModePanelSource, /Readiness generation source/u);
assert.match(sourceModePanelSource, /Saved config/u);
assert.match(sourceModePanelSource, /Draft config/u);
assert.match(sourceModePanelSource, /preview evidence only/u);
assert.match(sourceModePanelSource, /external-soak closure/u);
assert.match(templatePanelSource, /Ready draft examples/u);
assert.match(templateUtilsSource, /createMcpServerReadyDraftExamples/u);
assert.match(templateUtilsSource, /@modelcontextprotocol\/server-filesystem/u);

console.log('agent MCP real-server soak readiness UI smoke passed');
