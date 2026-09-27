import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createSettingsMcpPackagedReadOnlyCoverageReview,
} from '../src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts';
import type { SettingsMcpPackagedProductionReport } from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';
import {
  parseMcpPackagedReadOnlyCoverageArgs,
  runMcpPackagedReadOnlyCoverage,
} from './agent-mcp-packaged-read-only-coverage.ts';

function createReport(optionalCallSuccessCount: number): SettingsMcpPackagedProductionReport {
  return {
    config: {
      readyServerIds: ['filesystem', 'memory'],
      source: 'saved-config',
    },
    kind: 'mcp-packaged-production-long-run-report',
    runtime: {
      mode: 'packaged',
    },
    servers: [
      {
        failureCount: 0,
        id: 'filesystem',
        optionalCallErrorCount: 0,
        optionalCallSuccessCount,
        roundCount: 20,
      },
      {
        failureCount: 0,
        id: 'memory',
        optionalCallErrorCount: 0,
        optionalCallSuccessCount,
        roundCount: 20,
      },
    ],
    version: 1,
  };
}

const blockedReview = createSettingsMcpPackagedReadOnlyCoverageReview(createReport(0));
assert.equal(blockedReview.status, 'blocked');
assert.equal(blockedReview.coveredServerCount, 0);
assert.deepEqual(blockedReview.missingServerIds, ['filesystem', 'memory']);
assert.match(blockedReview.summaryText, /covered=0\/2/u);

const readyReview = createSettingsMcpPackagedReadOnlyCoverageReview(createReport(20));
assert.equal(readyReview.status, 'ready');
assert.equal(readyReview.coveredServerCount, 2);
assert.equal(readyReview.totalCallSuccessCount, 40);
assert.match(readyReview.summaryText, /calls=40/u);

const readyFromProbeReview = createSettingsMcpPackagedReadOnlyCoverageReview(createReport(0), {
  kind: 'mcp-packaged-read-only-call-report',
  runtime: { mode: 'packaged' },
  servers: [
    { id: 'filesystem', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
    { id: 'memory', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
  ],
  version: 1,
});
assert.equal(readyFromProbeReview.status, 'ready');
assert.equal(readyFromProbeReview.totalCallSuccessCount, 40);
assert.equal(readyFromProbeReview.servers[0]?.packagedProbeCallSuccessCount, 20);

const sameRunReview = createSettingsMcpPackagedReadOnlyCoverageReview({
  ...createReport(20),
  provenance: {
    callReportSha256: 'call-report-sha256',
    runtimeLogSha256: 'runtime-log-sha256',
    sameRunVerified: true,
  },
}, {
  kind: 'mcp-packaged-read-only-call-report',
  runtime: { mode: 'packaged' },
  servers: [
    { id: 'filesystem', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
    { id: 'memory', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
  ],
  version: 1,
});
assert.equal(sameRunReview.status, 'ready');
assert.equal(sameRunReview.totalCallSuccessCount, 40);

const blockedProbeReview = createSettingsMcpPackagedReadOnlyCoverageReview(createReport(0), {
  kind: 'mcp-packaged-read-only-call-report',
  runtime: { mode: 'packaged' },
  servers: [
    {
      errorSamples: ['spawn EPERM; server=filesystem spawnCommand=C:\\Windows\\System32\\cmd.exe serverCommand=npx.cmd cwd=D:\\app'],
      id: 'filesystem',
      optionalCallSkippedCount: 20,
      optionalCallSuccessCount: 0,
    },
    { id: 'memory', optionalCallSkippedCount: 20, optionalCallSuccessCount: 0 },
  ],
  version: 1,
});
assert.equal(blockedProbeReview.status, 'blocked');
assert.match(blockedProbeReview.servers[0]?.errorSamples[0] ?? '', /spawnCommand=/u);
assert.match(blockedProbeReview.servers[0]?.errorSamples[0] ?? '', /serverCommand=npx\.cmd/u);

const ignoredDevProbeReview = createSettingsMcpPackagedReadOnlyCoverageReview(createReport(0), {
  kind: 'mcp-packaged-read-only-call-report',
  runtime: { mode: 'dev' },
  servers: [
    { id: 'filesystem', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
    { id: 'memory', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
  ],
  version: 1,
});
assert.equal(ignoredDevProbeReview.status, 'blocked');

const warningReview = createSettingsMcpPackagedReadOnlyCoverageReview({
  ...createReport(20),
  servers: [
    {
      id: 'filesystem',
      optionalCallErrorCount: 1,
      optionalCallSuccessCount: 20,
    },
  ],
});
assert.equal(warningReview.status, 'blocked');
assert.equal(warningReview.warningCount, 1);
assert.deepEqual(warningReview.missingServerIds, ['memory']);

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-packaged-read-only-'));
const inputPath = path.join(tempDir, 'packaged-report.json');
const outputPath = path.join(tempDir, 'coverage-review.json');
fs.writeFileSync(inputPath, `${JSON.stringify({
  ...createReport(20),
  provenance: {
    callReportSha256: 'call-report-sha256',
    runtimeLogSha256: 'runtime-log-sha256',
    sameRunVerified: true,
  },
}, null, 2)}\n`, 'utf8');
const callReportPath = path.join(tempDir, 'call-report.json');
fs.writeFileSync(callReportPath, `${JSON.stringify({
  kind: 'mcp-packaged-read-only-call-report',
  runtime: { mode: 'packaged' },
  servers: [
    { id: 'filesystem', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
    { id: 'memory', optionalCallErrorCount: 0, optionalCallSuccessCount: 20 },
  ],
  version: 1,
}, null, 2)}\n`, 'utf8');
const parsed = parseMcpPackagedReadOnlyCoverageArgs([
  '--input',
  inputPath,
  '--call-report',
  callReportPath,
  '--output',
  outputPath,
  '--pretty',
]);
assert.equal(parsed.inputPath, inputPath);
assert.equal(parsed.pretty, true);

const cliReview = runMcpPackagedReadOnlyCoverage(parsed);
assert.equal(cliReview.status, 'ready');
assert.equal(cliReview.totalCallSuccessCount, 40);
assert.equal(fs.existsSync(outputPath), true);

assert.throws(
  () => parseMcpPackagedReadOnlyCoverageArgs(['--output', outputPath]),
  /Usage:/u,
);

console.log('agent MCP packaged read-only coverage smoke passed');
