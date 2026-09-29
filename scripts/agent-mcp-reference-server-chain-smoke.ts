import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runMcpConfigPreflight } from './agent-mcp-config-preflight.ts';
import { runMcpSoakReadiness } from './agent-mcp-real-server-soak-readiness.ts';
import { runMcpRealServerSoak } from './agent-mcp-real-server-soak-runner.ts';
import { runMcpSoakSampleIndex } from './agent-mcp-real-server-soak-sample-index.ts';
import { runMcpRealServerSoakSummary } from './agent-mcp-real-server-soak-summary.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-reference-chain-'));
const reportDir = path.join(tempRoot, 'reports');
const referenceServerPath = projectPath('scripts/reference-mcp-stdio-server.cjs');
const serverId = 'desktop-pet-reference';
const previousEnvConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;

function writeReferenceConfig() {
  fs.writeFileSync(path.join(tempRoot, '.desktop-pet-mcp.json'), `${JSON.stringify({
    servers: [{
      args: [referenceServerPath],
      command: process.execPath,
      id: serverId,
      timeoutMs: 2000,
      title: 'Desktop Pet Reference MCP',
    }],
  }, null, 2)}\n`, 'utf8');
}

delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
writeReferenceConfig();

const preflight = runMcpConfigPreflight({ projectRoot: tempRoot });
assert.equal(preflight.status, 'warning');
assert.equal(preflight.preflight.serverCount, 1);
assert.equal(
  preflight.preflight.checks.some((check) => check.id === `reference-${serverId}`),
  true,
);

const readiness = await runMcpSoakReadiness({
  projectRoot: tempRoot,
  reportDir,
  rounds: 2,
});
assert.equal(readiness.status, 'blocked');
assert.equal(readiness.totals.readyServers, 0);
assert.equal(readiness.totals.fakeFixtureServers, 0);
assert.equal(readiness.totals.referenceServers, 1);
assert.equal(readiness.servers[0]?.readyForRealSoak, false);
assert.equal(readiness.servers[0]?.referenceServer, true);
assert.equal(readiness.runbook.perServer.length, 0);

const soakReportPath = path.join(reportDir, 'reference-soak.json');
const soakReport = await runMcpRealServerSoak({
  callArgs: { text: 'reference-visible-input', token: 'secret-token' },
  callTool: 'reference_echo',
  outputPath: soakReportPath,
  projectRoot: tempRoot,
  rounds: 2,
  serverId,
});
assert.equal(soakReport.totals.servers, 1);
assert.equal(soakReport.totals.rounds, 2);
assert.equal(soakReport.totals.listSuccesses, 2);
assert.equal(soakReport.totals.optionalCallSuccesses, 2);

const soakText = fs.readFileSync(soakReportPath, 'utf8');
assert.equal(soakText.includes('secret-token'), false);
assert.equal(soakText.includes('reference-visible-input'), false);

const summary = runMcpRealServerSoakSummary({
  includeJsonText: true,
  inputPath: soakReportPath,
  prettyJson: true,
});
assert.equal(summary.status, 'healthy');
assert.equal(summary.totals.servers, 1);
assert.equal(summary.totals.rounds, 2);

const index = runMcpSoakSampleIndex({
  dir: reportDir,
  outputPath: path.join(reportDir, 'index.json'),
  prettyJson: true,
});
assert.equal(index.totals.files, 1);
assert.equal(index.totals.statusCounts.healthy, 1);
assert.deepEqual(index.totals.uniqueServerIds, [serverId]);

if (previousEnvConfig === undefined) {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
} else {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousEnvConfig;
}

console.log('agent MCP reference server chain smoke passed');
