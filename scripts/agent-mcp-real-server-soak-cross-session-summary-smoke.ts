import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpRealServerCrossSessionSummaryArgs,
  runMcpRealServerCrossSessionSummary,
} from './agent-mcp-real-server-soak-cross-session-summary.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-cross-session-'));

function writeJson(name: string, value: unknown) {
  const filePath = path.join(tempRoot, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

function createHealthyReport(label: string) {
  return writeJson(`${label}.json`, {
    kind: 'mcp-real-server-soak-report',
    servers: [
      {
        id: 'filesystem',
        maxToolCount: 14,
        rounds: [
          { durationMs: 10, error: null, listOk: true, toolCount: 14 },
          { durationMs: 11, error: null, listOk: true, toolCount: 14 },
        ],
      },
      {
        id: 'memory',
        maxToolCount: 9,
        rounds: [
          { durationMs: 12, error: null, listOk: true, toolCount: 9 },
          { durationMs: 13, error: null, listOk: true, toolCount: 9 },
        ],
      },
    ],
    totals: { listFailures: 0, listSuccesses: 4, rounds: 4, servers: 2 },
    version: 1,
  });
}

const reportA = createHealthyReport('session-a');
const reportB = createHealthyReport('session-b');
const parsed = parseMcpRealServerCrossSessionSummaryArgs([
  '--input',
  reportA,
  '--input',
  reportB,
  '--output',
  path.join(tempRoot, 'cross-session-summary.json'),
  '--pretty',
]);
assert.deepEqual(parsed.inputPaths, [reportA, reportB]);
assert.equal(parsed.prettyJson, true);

const summary = runMcpRealServerCrossSessionSummary(parsed);
assert.equal(summary.kind, 'mcp-real-server-soak-cross-session-summary');
assert.equal(summary.status, 'healthy');
assert.equal(summary.totals.reports, 2);
assert.equal(summary.totals.healthyReports, 2);
assert.equal(summary.totals.servers, 2);
assert.equal(summary.totals.rounds, 8);
assert.equal(summary.totals.restartEvents, 0);
assert.deepEqual(summary.servers.map((server) => server.id), ['filesystem', 'memory']);
assert.ok(summary.servers.every((server) => server.toolCountConsistent));
assert.match(summary.reportText, /MCPCrossSessionSoak status=healthy/u);
assert.equal(fs.existsSync(path.join(tempRoot, 'cross-session-summary.json')), true);

const missingMemoryReport = writeJson('session-c-missing-memory.json', {
  kind: 'mcp-real-server-soak-report',
  servers: [{
    id: 'filesystem',
    maxToolCount: 14,
    rounds: [{ durationMs: 10, error: null, listOk: true, toolCount: 14 }],
  }],
  totals: { listFailures: 0, listSuccesses: 1, rounds: 1, servers: 1 },
  version: 1,
});
const degradedSummary = runMcpRealServerCrossSessionSummary({
  inputPaths: [reportA, missingMemoryReport],
});
assert.equal(degradedSummary.status, 'degraded');
assert.equal(degradedSummary.servers.find((server) => server.id === 'memory')?.missingReportCount, 1);
assert.ok(degradedSummary.recommendations.some((item) => item.includes('same server set')));

assert.throws(
  () => parseMcpRealServerCrossSessionSummaryArgs(['--output', 'only-output.json']),
  /Usage: npx tsx/u,
);
assert.throws(
  () => runMcpRealServerCrossSessionSummary({ inputPaths: [writeJson('bad.json', { kind: 'other' })] }),
  /not an MCP real-server soak report/u,
);

console.log('agent MCP real-server soak cross-session summary smoke passed');
