import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseMcpRealServerSoakArgs } from './agent-mcp-real-server-soak-config.ts';
import { runMcpRealServerSoak } from './agent-mcp-real-server-soak-runner.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-real-soak-'));
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
const failingServerPath = projectPath('scripts/fixtures/failing-mcp-stdio-server.cjs');
const spawnCountPath = path.join(tempRoot, 'spawn-count.txt');
const callArgsPath = path.join(tempRoot, 'call-args.json');
const serverId = 'real-soak-fake';
const failingServerId = 'real-soak-failing';
const previousEnvConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;

function writeTempConfig() {
  fs.writeFileSync(path.join(tempRoot, '.desktop-pet-mcp.json'), `${JSON.stringify({
    servers: [{
      args: [fakeServerPath],
      command: process.execPath,
      env: { FAKE_MCP_SPAWN_COUNT_PATH: spawnCountPath },
      id: serverId,
      timeoutMs: 1000,
      title: 'Real Soak Fake MCP',
    }, {
      args: [failingServerPath],
      command: process.execPath,
      id: failingServerId,
      timeoutMs: 1000,
      title: 'Real Soak Failing MCP',
    }],
  }, null, 2)}\n`, 'utf8');
}

function readReport(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.join(tempRoot, relativePath), 'utf8')) as {
    kind: string;
    options: Record<string, unknown>;
    servers: Array<{
      history: { byStatus: Record<string, number>; totalCount: number };
      historyErrorSamples?: string[];
      id: string;
      listSuccessCount: number;
      maxToolCount: number;
      optionalCallSuccessCount: number;
      rounds: Array<{ callStatus: string; toolNames: string[] }>;
    }>;
    totals: Record<string, number>;
  };
}

function assertListOnlyReport(report: ReturnType<typeof readReport>) {
  assert.equal(report.kind, 'mcp-real-server-soak-report');
  assert.equal(report.options.listOnlyDefault, true);
  assert.equal(report.totals.servers, 1);
  assert.equal(report.totals.rounds, 2);
  assert.equal(report.totals.listSuccesses, 2);
  assert.equal(report.servers[0]?.id, serverId);
  assert.equal(report.servers[0]?.listSuccessCount, 2);
  assert.equal(report.servers[0]?.maxToolCount, 1);
  assert.ok(report.servers[0]?.rounds.every((round) => round.callStatus === 'disabled'));
  assert.ok(report.servers[0]?.rounds.every((round) => round.toolNames.includes('echo')));
}

function assertOptionalCallReport(reportText: string) {
  const report = JSON.parse(reportText) as ReturnType<typeof readReport>;
  assert.equal(report.options.listOnlyDefault, false);
  assert.equal(report.options.callArgsProvided, true);
  assert.equal(report.totals.optionalCallSuccesses, 1);
  assert.equal(report.servers[0]?.optionalCallSuccessCount, 1);
  assert.ok((report.servers[0]?.history.byStatus['tool-call:ok'] ?? 0) >= 1);
  assert.equal(reportText.includes('secret-token'), false);
  assert.equal(reportText.includes('visible-tool-input'), false);
}

function assertFailureDiagnosticsReport(reportText: string) {
  const report = JSON.parse(reportText) as ReturnType<typeof readReport>;
  const server = report.servers[0];
  assert.equal(report.totals.listFailures, 1);
  assert.equal(server?.id, failingServerId);
  assert.equal(server?.history.byStatus['diagnostic:error'], 1);
  assert.match(server?.historyErrorSamples?.[0] ?? '', /fatal startup/u);
  assert.equal(reportText.includes('secret-token'), false);
}

process.env.DESKTOP_PET_MCP_SERVERS_JSON = '';
writeTempConfig();
fs.writeFileSync(callArgsPath, '{"text":"file-args"}\n', 'utf8');

const parsed = parseMcpRealServerSoakArgs([
  '--serverId',
  serverId,
  '--rounds',
  '2',
  '--output',
  'reports/list-only.json',
  '--projectRoot',
  tempRoot,
]);
assert.equal(parsed.serverId, serverId);
assert.equal(parsed.rounds, 2);

const parsedFileArgs = parseMcpRealServerSoakArgs([
  '--callArgsFile',
  callArgsPath,
]);
assert.equal(parsedFileArgs.callArgs?.text, 'file-args');

await runMcpRealServerSoak(parsed);
assertListOnlyReport(readReport('reports/list-only.json'));

const failureReportPath = path.join(tempRoot, 'reports', 'failure-diagnostics.json');
await runMcpRealServerSoak({
  outputPath: failureReportPath,
  projectRoot: tempRoot,
  rounds: 1,
  serverId: failingServerId,
});
assertFailureDiagnosticsReport(fs.readFileSync(failureReportPath, 'utf8'));

await runMcpRealServerSoak({
  callArgs: { text: 'visible-tool-input', token: 'secret-token' },
  callTool: 'echo',
  outputPath: 'reports/optional-call.json',
  projectRoot: tempRoot,
  rounds: 1,
  serverId,
});
assertOptionalCallReport(fs.readFileSync(path.join(tempRoot, 'reports', 'optional-call.json'), 'utf8'));

assert.equal(Number(fs.readFileSync(spawnCountPath, 'utf8')) >= 2, true);
if (previousEnvConfig === undefined) {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
} else {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousEnvConfig;
}

console.log('agent MCP real-server soak runner smoke passed');
