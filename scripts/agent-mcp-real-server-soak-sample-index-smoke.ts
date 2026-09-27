import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpSoakSampleIndexArgs,
  runMcpSoakSampleIndex,
} from './agent-mcp-real-server-soak-sample-index.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-mcp-soak-index-'));
const reportDir = path.join(tempRoot, 'reports');
fs.mkdirSync(reportDir, { recursive: true });

function writeJson(name: string, value: unknown) {
  fs.writeFileSync(path.join(reportDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

writeJson('healthy.json', {
  kind: 'mcp-real-server-soak-report',
  servers: [{
    id: 'healthy-server',
    maxToolCount: 2,
    rounds: [
      { durationMs: 10, error: null, listOk: true, toolCount: 2 },
      { durationMs: 12, error: null, listOk: true, toolCount: 2 },
    ],
  }],
  totals: { listSuccesses: 2, rounds: 2, servers: 1 },
  version: 1,
});

writeJson('degraded.json', {
  kind: 'mcp-real-server-soak-report',
  servers: [{
    history: { byStatus: { 'session:restart-cooldown': 1 }, totalCount: 1 },
    id: 'degraded-server',
    maxToolCount: 1,
    rounds: [
      { durationMs: 10, error: null, listOk: true, toolCount: 1 },
      { durationMs: 15, error: 'token=secret failed', listOk: false, toolCount: 0 },
    ],
  }],
  totals: { listFailures: 1, listSuccesses: 1, rounds: 2, servers: 1 },
  version: 1,
});

writeJson('other.json', { kind: 'other-report', secret: 'should-not-matter' });
fs.writeFileSync(path.join(reportDir, 'note.txt'), 'ignored', 'utf8');

const parsed = parseMcpSoakSampleIndexArgs([
  '--dir',
  reportDir,
  '--output',
  path.join(tempRoot, 'index.json'),
  '--pretty',
]);
assert.equal(parsed.dir, reportDir);
assert.equal(parsed.prettyJson, true);

const index = runMcpSoakSampleIndex(parsed);
assert.equal(index.kind, 'mcp-real-server-soak-sample-index');
assert.equal(index.totals.files, 3);
assert.equal(index.totals.invalidFiles, 1);
assert.equal(index.totals.rounds, 4);
assert.equal(index.totals.servers, 2);
assert.equal(index.totals.statusCounts.healthy, 1);
assert.equal(index.totals.statusCounts.degraded, 1);
assert.equal(index.totals.statusCounts.invalid, 1);
assert.deepEqual(index.totals.uniqueServerIds, ['degraded-server', 'healthy-server']);
assert.equal(JSON.stringify(index).includes('secret'), false);
assert.equal(fs.existsSync(path.join(tempRoot, 'index.json')), true);

console.log('agent MCP real-server soak sample index smoke passed');
