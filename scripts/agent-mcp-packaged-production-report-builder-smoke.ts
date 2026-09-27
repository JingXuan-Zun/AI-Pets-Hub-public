import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createSettingsMcpPackagedProductionReview,
  parseSettingsMcpPackagedProductionEvidenceText,
} from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';
import {
  createSettingsMcpPackagedProductionReportFromSoakSummary,
} from '../src/components/settings/settingsMcpPackagedProductionReportBuilder.ts';
import type { SettingsMcpSoakSummaryResult } from '../src/components/settings/settingsMcpSoakSummary.ts';
import {
  parseMcpPackagedProductionReportBuilderArgs,
  runMcpPackagedProductionReportBuilder,
} from './agent-mcp-packaged-production-report-builder.ts';

const soakSummary = {
  generatedAt: '2026-06-30T00:00:00.000Z',
  inputPath: 'soak-summary.json',
  jsonText: null,
  kind: 'mcp-real-server-soak-summary',
  recommendations: ['No immediate MCP soak follow-up is required.'],
  reportText: 'MCPSoakSummary status=healthy servers=2 rounds=40 listed=40 restarts=0',
  servers: [
    {
      errorSamples: [],
      failureCount: 0,
      historyEventCount: 0,
      id: 'filesystem',
      maxDurationMs: 1000,
      maxToolCount: 14,
      optionalCallErrorCount: 0,
      optionalCallSuccessCount: 20,
      restartEventCount: 0,
      roundCount: 20,
      status: 'healthy',
      title: 'Filesystem MCP server',
      toolCountChanged: false,
    },
    {
      errorSamples: [],
      failureCount: 0,
      historyEventCount: 0,
      id: 'memory',
      maxDurationMs: 900,
      maxToolCount: 9,
      optionalCallErrorCount: 0,
      optionalCallSuccessCount: 20,
      restartEventCount: 0,
      roundCount: 20,
      status: 'healthy',
      title: 'Memory MCP server',
      toolCountChanged: false,
    },
  ],
  status: 'healthy',
  summaryText: 'MCPSoakSummary status=healthy servers=2 rounds=40 listed=40 restarts=0',
  totals: {
    failedServers: 0,
    listedServers: 40,
    restartEvents: 0,
    rounds: 40,
    servers: 2,
  },
  version: 1,
} satisfies SettingsMcpSoakSummaryResult;

const readyReport = createSettingsMcpPackagedProductionReportFromSoakSummary({
  automaticHighRiskCallCount: 0,
  configPath: '.desktop-pet-mcp.json',
  configSource: 'saved-config',
  controlledCloseCount: 1,
  deniedHighRiskCallCount: 2,
  durationMs: 31 * 60 * 1000,
  gracefulQuitCount: 1,
  packagedArtifactPath: 'release/AI-Desktop-Pet-0.0.1.exe',
  platform: 'win32',
  pooledSessionReuseCount: 12,
  readyServerIds: ['filesystem', 'memory'],
  runtimeMode: 'packaged',
  runtimeVersion: '0.0.1',
  sessionCount: 1,
  soakSummary,
  startupCount: 1,
  unexpectedExitCount: 0,
  writeToolCallCount: 0,
});

assert.equal(readyReport.kind, 'mcp-packaged-production-long-run-report');
assert.equal(readyReport.config?.source, 'saved-config');
assert.deepEqual(readyReport.config?.candidateServerIds, ['filesystem', 'memory']);
assert.deepEqual(readyReport.config?.readyServerIds, ['filesystem', 'memory']);
assert.equal(readyReport.servers?.[0]?.listSuccessCount, 20);
const legacyReadyReview = createSettingsMcpPackagedProductionReview(readyReport);
assert.equal(legacyReadyReview.status, 'blocked');
assert.match(legacyReadyReview.blockers.join('\n'), /same run/u);

const blockedReport = createSettingsMcpPackagedProductionReportFromSoakSummary({
  automaticHighRiskCallCount: 1,
  configSource: 'draft-config',
  controlledCloseCount: 0,
  durationMs: 5 * 60 * 1000,
  readyServerIds: ['filesystem', 'memory'],
  runtimeMode: 'dev',
  soakSummary: {
    ...soakSummary,
    servers: soakSummary.servers.map((server) => (
      server.id === 'memory'
        ? { ...server, maxToolCount: 0, optionalCallErrorCount: 1, restartEventCount: 1 }
        : { ...server, roundCount: 10 }
    )),
  },
  startupCount: 1,
  unexpectedExitCount: 1,
});
const blockedReview = createSettingsMcpPackagedProductionReview(blockedReport);
assert.equal(blockedReview.status, 'blocked');
assert.ok(blockedReview.blockedCount >= 6);

const tempDir = path.resolve('tmp/mcp-packaged-production-builder-smoke');
fs.mkdirSync(tempDir, { recursive: true });
const summaryPath = path.join(tempDir, 'soak-summary.json');
const reportPath = path.join(tempDir, 'packaged-production-report.json');
fs.writeFileSync(summaryPath, `${JSON.stringify(soakSummary, null, 2)}\n`, 'utf8');
const cliOptions = parseMcpPackagedProductionReportBuilderArgs([
  '--soak-summary', summaryPath,
  '--output', reportPath,
  '--ready-server', 'filesystem',
  '--ready-server', 'memory',
  '--runtime-mode', 'packaged',
  '--config-source', 'saved-config',
  '--duration-minutes', '31',
  '--startup-count', '1',
  '--controlled-close-count', '1',
  '--unexpected-exit-count', '0',
  '--automatic-high-risk-call-count', '0',
  '--artifact', 'release/AI-Desktop-Pet-0.0.1.exe',
  '--config-path', '.desktop-pet-mcp.json',
  '--pretty',
]);
const cliReport = runMcpPackagedProductionReportBuilder(cliOptions);
assert.equal(cliReport.runtime?.mode, 'packaged');
assert.equal(fs.existsSync(reportPath), true);
const importedCliReport = parseSettingsMcpPackagedProductionEvidenceText(
  fs.readFileSync(reportPath, 'utf8'),
  reportPath,
);
assert.equal(importedCliReport.review.status, 'blocked');
assert.match(importedCliReport.review.blockers.join('\n'), /same run/u);

assert.throws(
  () => parseMcpPackagedProductionReportBuilderArgs(['--output', reportPath]),
  /Usage:|ready-server/u,
);

console.log('agent MCP packaged-production report builder smoke passed');
