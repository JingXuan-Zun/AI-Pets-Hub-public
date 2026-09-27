import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMcpRealServerSoak } from './agent-mcp-real-server-soak-runner.ts';
import {
  parseMcpRealServerSoakSummaryArgs,
  runMcpRealServerSoakSummary,
} from './agent-mcp-real-server-soak-summary.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-soak-summary-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
const spawnCountPath = path.join(tempRoot, 'spawn-count.txt');
const serverId = 'soak-summary-fake';
const previousEnvConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;

function writeTempConfig() {
  fs.writeFileSync(path.join(tempRoot, '.desktop-pet-mcp.json'), `${JSON.stringify({
    servers: [{
      args: [fakeServerPath],
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
      id: serverId,
      timeoutMs: 1000,
      title: 'Soak Summary Fake MCP',
    }],
  }, null, 2)}\n`, 'utf8');
}

function writeDegradedReport(reportPath: string) {
  fs.writeFileSync(reportPath, `${JSON.stringify({
    kind: 'mcp-real-server-soak-report',
    servers: [{
      errorCount: 1,
      history: {
        byStatus: {
          'session:restart-blocked': 1,
          'session:restart-cooldown': 1,
          'tool-call:error': 1,
        },
        totalCount: 3,
      },
      id: 'unstable-server',
      listFailureCount: 1,
      maxToolCount: 2,
      optionalCallErrorCount: 1,
      optionalCallSuccessCount: 0,
      rounds: [
        { durationMs: 50, error: null, toolCount: 2 },
        { durationMs: 100, error: 'token=secret-value failed', toolCount: 0 },
      ],
      title: 'Unstable Server',
    }],
    totals: { listFailures: 1, listSuccesses: 1, rounds: 2, servers: 1 },
    version: 1,
  }, null, 2)}\n`, 'utf8');
}

process.env.DESKTOP_PET_MCP_SERVERS_JSON = '';
writeTempConfig();

const healthyReportPath = path.join(tempRoot, 'healthy-report.json');
await runMcpRealServerSoak({
  outputPath: healthyReportPath,
  projectRoot: tempRoot,
  rounds: 2,
  serverId,
});

const parsed = parseMcpRealServerSoakSummaryArgs([
  '--input',
  healthyReportPath,
  '--output',
  path.join(tempRoot, 'healthy-summary.json'),
  '--pretty',
]);
assert.equal(parsed.inputPath, healthyReportPath);
assert.equal(parsed.includeJsonText, true);

const healthySummary = runMcpRealServerSoakSummary(parsed);
assert.equal(healthySummary.status, 'healthy');
assert.equal(healthySummary.totals.servers, 1);
assert.equal(healthySummary.totals.rounds, 2);
assert.match(healthySummary.reportText, /status=healthy/u);
assert.equal(fs.existsSync(path.join(tempRoot, 'healthy-summary.json')), true);

const degradedReportPath = path.join(tempRoot, 'degraded-report.json');
writeDegradedReport(degradedReportPath);
const degradedSummary = runMcpRealServerSoakSummary({
  includeJsonText: true,
  inputPath: degradedReportPath,
  prettyJson: true,
});
assert.equal(degradedSummary.status, 'degraded');
assert.equal(degradedSummary.servers[0]?.status, 'degraded');
assert.equal(degradedSummary.servers[0]?.restartEventCount, 2);
assert.equal(degradedSummary.servers[0]?.toolCountChanged, true);
assert.ok(degradedSummary.recommendations.some((item) => item.includes('diagnostics')));
assert.equal(JSON.stringify(degradedSummary).includes('secret-value'), false);

if (previousEnvConfig === undefined) {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
} else {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousEnvConfig;
}

console.log('agent MCP real-server soak summary smoke passed');
