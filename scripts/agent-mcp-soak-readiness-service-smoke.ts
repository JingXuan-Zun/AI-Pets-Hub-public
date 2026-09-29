import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { projectPath, readProjectFile } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-soak-service-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');

const { createMcpSoakReadinessService } = await import('../electron/mcpSoakReadinessService.cjs') as {
  createMcpSoakReadinessService: (options?: { projectRoot?: string }) => {
    createReadinessReport: (request?: { rawText?: string; reportDir?: string; rounds?: number }) => {
      configPresent: boolean;
      kind: string;
      runbook: { perServer: Array<{ command: string; serverId: string }> };
      servers: Array<{
        blockers?: string[];
        fakeFixture: boolean;
        id: string;
        readyForRealSoak: boolean;
      }>;
      status: string;
      totals: {
        fakeFixtureServers: number;
        readyServers: number;
        servers: number;
      };
      source: string;
    };
  };
};

const emptyService = createMcpSoakReadinessService({ projectRoot: tempRoot });
const emptyReport = emptyService.createReadinessReport({ rounds: 3 });
assert.equal(emptyReport.kind, 'mcp-real-server-soak-readiness');
assert.equal(emptyReport.status, 'blocked');
assert.equal(emptyReport.configPresent, false);
assert.equal(emptyReport.totals.servers, 0);
assert.equal(emptyReport.source, 'saved-config');

const draftReport = emptyService.createReadinessReport({
  rawText: JSON.stringify({
    servers: [{
      args: ['--version'],
      command: process.execPath,
      id: 'draft-ready-server',
    }],
  }),
  rounds: 4,
});
assert.equal(draftReport.configPresent, false);
assert.equal(draftReport.source, 'draft-config');
assert.equal(draftReport.status, 'ready');
assert.equal(draftReport.totals.readyServers, 1);
assert.equal(fs.existsSync(path.join(tempRoot, '.desktop-pet-mcp.json')), false);

const placeholderReport = emptyService.createReadinessReport({
  rawText: JSON.stringify({
    servers: [{
      args: ['-y', '@vendor/real-mcp-server'],
      command: 'npx.cmd',
      env: { API_KEY: 'replace-me' },
      id: 'template-server',
    }, {
      args: ['C:\\path\\to\\real-mcp-server.js'],
      command: 'node',
      id: 'script-placeholder-server',
    }, {
      args: ['missing-real-server.js'],
      command: process.execPath,
      id: 'missing-script-server',
    }],
  }),
});
assert.equal(placeholderReport.status, 'blocked');
assert.equal(placeholderReport.totals.readyServers, 0);
assert.match(placeholderReport.servers[0]?.blockers?.join(' ') ?? '', /placeholder values/u);
assert.match(placeholderReport.servers[1]?.blockers?.join(' ') ?? '', /placeholder values/u);
assert.match(placeholderReport.servers[2]?.blockers?.join(' ') ?? '', /server script path does not exist/u);

fs.writeFileSync(path.join(tempRoot, '.desktop-pet-mcp.json'), JSON.stringify({
  servers: [{
    args: [fakeServerPath],
    command: process.execPath,
    id: 'fixture-server',
  }, {
    args: ['--version'],
    command: process.execPath,
    id: 'ready-server',
  }],
}, null, 2));

const service = createMcpSoakReadinessService({ projectRoot: tempRoot });
const report = service.createReadinessReport({ reportDir: 'reports', rounds: 5 });
assert.equal(report.configPresent, true);
assert.equal(report.status, 'ready');
assert.equal(report.totals.servers, 2);
assert.equal(report.totals.readyServers, 1);
assert.equal(report.totals.fakeFixtureServers, 1);
assert.equal(report.servers.find((server) => server.id === 'fixture-server')?.fakeFixture, true);
assert.equal(report.servers.find((server) => server.id === 'ready-server')?.readyForRealSoak, true);
assert.match(report.runbook.perServer[0]?.command ?? '', /--serverId "ready-server"/u);

const ipcSource = readProjectFile('electron/ipcHandlers.cjs');
const preloadSource = readProjectFile('electron/preload.cjs');
const bridgeSource = readProjectFile('src/desktopShellBridge.ts');
const panelSource = readProjectFile('src/components/settings/SettingsMcpSoakReadinessPanel.tsx');
const exportButtonSource = readProjectFile('src/components/settings/SettingsMcpSoakReadinessExportButton.tsx');
const runbookPanelSource = readProjectFile('src/components/settings/SettingsMcpSoakReadinessRunbookPanel.tsx');
const progressBlockSource = readProjectFile('src/components/settings/SettingsMcpEvidenceProgressBlock.tsx');
const operationalPanelsSource = readProjectFile('src/components/settings/SettingsMcpOperationalPanels.tsx');
assert.match(ipcSource, /desktop-pet:get-mcp-soak-readiness/u);
assert.match(preloadSource, /getMcpSoakReadiness/u);
assert.match(bridgeSource, /getMcpSoakReadiness/u);
assert.match(bridgeSource, /rawText\?: string/u);
assert.match(panelSource, /Generate/u);
assert.match(panelSource, /draft-mcp-config/u);
assert.match(panelSource, /SettingsMcpSoakReadinessExportButton/u);
assert.match(panelSource, /SettingsMcpSoakReadinessRunbookPanel/u);
assert.match(exportButtonSource, /mcp-real-server-soak-readiness-settings-export/u);
assert.match(exportButtonSource, /Export/u);
assert.match(runbookPanelSource, /MCP readiness runbook copied/u);
assert.match(runbookPanelSource, /navigator\.clipboard\.writeText/u);
assert.match(runbookPanelSource, /textarea/u);
assert.match(progressBlockSource, /SettingsMcpSoakReadinessPanel/u);
assert.match(progressBlockSource, /configText=\{configText\}/u);
assert.match(operationalPanelsSource, /SettingsMcpEvidenceProgressBlock/u);

console.log('agent MCP soak readiness service smoke passed');
