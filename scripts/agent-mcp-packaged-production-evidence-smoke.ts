import { strict as assert } from 'node:assert';
import {
  createSettingsMcpPackagedProductionReview,
  parseSettingsMcpPackagedProductionEvidenceText,
  type SettingsMcpPackagedProductionReport,
} from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';

const readyReport = {
  config: {
    configPath: '.desktop-pet-mcp.json',
    readyServerIds: ['filesystem', 'memory'],
    source: 'saved-config',
  },
  kind: 'mcp-packaged-production-long-run-report',
  lifecycle: {
    controlledCloseCount: 1,
    gracefulQuitCount: 1,
    pooledSessionReuseCount: 36,
    startupCount: 1,
    unexpectedExitCount: 0,
  },
  provenance: {
    callReportSha256: 'call-sha256',
    runtimeLogSha256: 'runtime-sha256',
    sameRunVerified: true,
  },
  run: {
    durationMs: 31 * 60 * 1000,
    productionRunId: 'production-ready',
    sessionCount: 1,
  },
  runtime: {
    artifactPath: 'release/AI-Desktop-Pet-0.0.1.exe',
    mode: 'packaged',
    platform: 'win32',
    version: '0.0.1',
  },
  safety: {
    automaticHighRiskCallCount: 0,
    deniedHighRiskCallCount: 2,
    writeToolCallCount: 0,
  },
  servers: [
    {
      failureCount: 0,
      id: 'filesystem',
      listSuccessCount: 24,
      maxToolCount: 14,
      optionalCallErrorCount: 0,
      optionalCallSuccessCount: 20,
      restartEventCount: 0,
      roundCount: 24,
      toolCountChanged: false,
    },
    {
      failureCount: 0,
      id: 'memory',
      listSuccessCount: 24,
      maxToolCount: 9,
      optionalCallErrorCount: 0,
      optionalCallSuccessCount: 20,
      restartEventCount: 0,
      roundCount: 24,
      toolCountChanged: false,
    },
  ],
  version: 1,
} satisfies SettingsMcpPackagedProductionReport;

const readyReview = createSettingsMcpPackagedProductionReview(readyReport);
assert.equal(readyReview.kind, 'settings-mcp-packaged-production-evidence-review');
assert.equal(readyReview.status, 'ready');
assert.equal(readyReview.readyCount, 8);
assert.equal(readyReview.blockedCount, 0);
assert.match(readyReview.summaryText, /MCPPackagedProductionEvidence status=ready/u);
assert.equal(readyReview.durationMinutes, 31);

const importedReady = parseSettingsMcpPackagedProductionEvidenceText(
  JSON.stringify(readyReport),
  'packaged-production-ready.json',
);
assert.equal(importedReady.inputPath, 'packaged-production-ready.json');
assert.equal(importedReady.review.status, 'ready');

const blockedReport = {
  ...readyReport,
  config: {
    readyServerIds: ['filesystem', 'memory', 'missing-server'],
    source: 'draft-config',
  },
  lifecycle: {
    controlledCloseCount: 0,
    startupCount: 1,
    unexpectedExitCount: 1,
  },
  run: {
    durationMs: 5 * 60 * 1000,
  },
  runtime: {
    mode: 'dev',
  },
  safety: {
    automaticHighRiskCallCount: 1,
  },
  servers: [
    {
      failureCount: 1,
      id: 'filesystem',
      maxToolCount: 14,
      optionalCallErrorCount: 0,
      restartEventCount: 0,
      roundCount: 10,
      toolCountChanged: false,
    },
    {
      failureCount: 0,
      id: 'memory',
      maxToolCount: 0,
      optionalCallErrorCount: 1,
      restartEventCount: 1,
      roundCount: 10,
      toolCountChanged: true,
    },
  ],
  version: 1,
} satisfies SettingsMcpPackagedProductionReport;

const blockedReview = createSettingsMcpPackagedProductionReview(blockedReport);
assert.equal(blockedReview.status, 'blocked');
assert.equal(blockedReview.readyCount, 0);
assert.equal(blockedReview.blockedCount, 8);
assert.match(blockedReview.blockers.join('\n'), /packaged app run/u);
assert.match(blockedReview.blockers.join('\n'), /saved-config/u);
assert.match(blockedReview.blockers.join('\n'), /at least 30 minutes/u);
assert.match(blockedReview.blockers.join('\n'), /20 rounds/u);
assert.match(blockedReview.blockers.join('\n'), /stability review/u);
assert.match(blockedReview.blockers.join('\n'), /unexpected-exit/u);
assert.match(blockedReview.blockers.join('\n'), /automatic high-risk/u);

assert.throws(
  () => parseSettingsMcpPackagedProductionEvidenceText('{"kind":"other","version":1}', 'bad.json'),
  /packaged-production long-run report/u,
);

console.log('agent MCP packaged-production evidence smoke passed');
