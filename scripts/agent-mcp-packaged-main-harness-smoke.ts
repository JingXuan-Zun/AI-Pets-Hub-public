import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseMcpPackagedMainHarnessArgs,
  runMcpPackagedMainHarness,
} from './agent-mcp-packaged-main-harness.ts';
import {
  createSettingsMcpPackagedReadOnlyCoverageReview,
} from '../src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts';
import { projectPath } from './smokeTestHarness.ts';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-packaged-main-harness-'));
const outputPath = path.join(tempRoot, 'harness-report.json');
const configPath = path.join(tempRoot, '.desktop-pet-mcp.json');
const fakeServerPath = projectPath('scripts/fixtures/fake-mcp-stdio-server.cjs');
const previousEnvConfig = process.env.DESKTOP_PET_MCP_SERVERS_JSON;

fs.writeFileSync(configPath, `${JSON.stringify({
  servers: [{
    args: [fakeServerPath],
    command: process.execPath,
    id: 'filesystem',
    timeoutMs: 1000,
    title: 'Harness filesystem-like MCP',
  }],
}, null, 2)}\n`, 'utf8');

process.env.DESKTOP_PET_MCP_SERVERS_JSON = '';
const parsed = parseMcpPackagedMainHarnessArgs([
  '--config',
  configPath,
  '--output',
  outputPath,
  '--project-root',
  tempRoot,
  '--rounds',
  '2',
]);
assert.equal(parsed.configPath, configPath);
assert.equal(parsed.outputPath, outputPath);
assert.equal(parsed.rounds, 2);

const report = await runMcpPackagedMainHarness(parsed);
assert.equal(report.kind, 'mcp-packaged-read-only-call-report');
assert.equal(report.runtime.mode, 'unknown');
assert.equal(report.runtime.kind, 'packaged-main-harness');
assert.equal(report.totals.servers, 2);
assert.equal(report.servers.find((server: { id: string }) => server.id === 'filesystem')?.optionalCallSkippedCount, 2);
assert.equal(fs.existsSync(outputPath), true);

const review = createSettingsMcpPackagedReadOnlyCoverageReview({
  config: { readyServerIds: ['filesystem'], source: 'saved-config' },
  kind: 'mcp-packaged-production-long-run-report',
  runtime: { mode: 'packaged' },
  servers: [{ id: 'filesystem', optionalCallErrorCount: 0, optionalCallSuccessCount: 0, roundCount: 20 }],
  version: 1,
}, report);
assert.equal(review.status, 'blocked');
assert.equal(review.totalCallSuccessCount, 0);

if (previousEnvConfig === undefined) {
  delete process.env.DESKTOP_PET_MCP_SERVERS_JSON;
} else {
  process.env.DESKTOP_PET_MCP_SERVERS_JSON = previousEnvConfig;
}

console.log('agent MCP packaged-main harness smoke passed');
