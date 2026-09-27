import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  createSettingsMcpPackagedProductionReview,
  parseSettingsMcpPackagedProductionEvidenceText,
} from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';
import {
  createSettingsMcpPackagedProductionRuntimeLogSummary,
} from '../src/components/settings/settingsMcpPackagedProductionRuntimeLog.ts';
import {
  createSettingsMcpPackagedProductionRunPlan,
  parseSettingsMcpPackagedProductionLatestBuildInfo,
} from '../src/components/settings/settingsMcpPackagedProductionRunPlan.ts';
import { runMcpPackagedProductionRunCollector } from './agent-mcp-packaged-production-run-collector.ts';

const runtimeLog = [
  '[2026-06-30T00:00:00.000Z] [00:00:00][backend][main-process] bootstrap {isLocalTest: false, isDev: false, cwd: D:\\app, runtimeLogPath: D:\\logs\\desktop-pet-main.log, mcpPackagedProductionRunId: production-smoke}',
  '[2026-06-30T00:00:01.000Z] [00:00:01][backend][main-process] whenReady: complete',
  '[2026-06-30T00:31:00.000Z] [00:31:00][backend][main-process] before-quit',
  '[2026-06-30T00:31:01.000Z] [00:31:01][backend][main-process] will-quit',
  '[2026-06-30T00:31:02.000Z] [00:31:02][backend][main-process] quit {exitCode: 0}',
].join('\n');

const runtimeSummary = createSettingsMcpPackagedProductionRuntimeLogSummary(runtimeLog);
assert.equal(runtimeSummary.runtimeMode, 'packaged');
assert.equal(runtimeSummary.startupCount, 1);
assert.equal(runtimeSummary.controlledCloseCount, 1);
assert.equal(runtimeSummary.productionRunId, 'production-smoke');
assert.equal(runtimeSummary.unexpectedExitCount, 0);
assert.equal(runtimeSummary.durationMs, 1_862_000);
assert.match(runtimeSummary.summaryText, /durationMinutes=31/u);

const latestBuildInfo = parseSettingsMcpPackagedProductionLatestBuildInfo([
  'latest_build=D:\\project\\release\\build-test',
  'portable_exe=D:\\project\\release\\build-test\\AI-Desktop-Pet-0.0.1.exe',
  'generated_at=2026-06-29T00:00:00.000Z',
  'incremental_generated_at=2026-06-30T00:00:00.000Z',
].join('\n'));
assert.equal(latestBuildInfo.generatedAt, '2026-06-30T00:00:00.000Z');
const plan = createSettingsMcpPackagedProductionRunPlan({
  latestBuildInfo,
  logDir: 'D:\\project\\tmp\\mcp-packaged-production-run',
  outputPath: 'D:\\project\\tmp\\mcp-packaged-production-run\\report.json',
  readyServerIds: ['filesystem', 'memory'],
  productionRunId: 'production-smoke',
});
assert.equal(plan.status, 'ready');
assert.equal(plan.autoQuitMs, 31 * 60 * 1000);
assert.equal(plan.env.DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS, String(31 * 60 * 1000));
assert.match(plan.env.DESKTOP_PET_MCP_CONFIG_PATH, /\.desktop-pet-mcp\.json/u);
assert.match(plan.env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT, /packaged-read-only-call-report\.json/u);
assert.equal(plan.env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ROUNDS, '20');
assert.equal(plan.env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_INTERVAL_MS, '95000');
assert.equal(plan.env.DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_QUIT_ON_COMPLETE, '1');
assert.match(plan.startCommand, /Start-Process/u);
assert.match(plan.startCommand, /DESKTOP_PET_PACKAGED_SOAK_AUTO_QUIT_MS/u);
assert.match(plan.startCommand, /\$env:DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_REPORT=/u);
assert.match(plan.startCommand, /\$env:DESKTOP_PET_MCP_PACKAGED_PRODUCTION_RUN_ID='production-smoke'/u);
assert.match(plan.startCommand, /\$env:DESKTOP_PET_MCP_PACKAGED_READ_ONLY_CALL_ENABLE='1'/u);
assert.match(plan.startCommand, /\$env:DESKTOP_PET_RUNTIME_LOG_DIR='D:\\project\\tmp\\mcp-packaged-production-run'/u);
assert.doesNotMatch(plan.startCommand, /ArgumentList/u);
assert.equal(plan.readOnlyProbeStartCommand, plan.startCommand);
assert.match(plan.summaryText, /autoQuitMs=1860000/u);
assert.match(plan.summaryText, /readOnlyProbe=enabled rounds=20 intervalMs=95000/u);
assert.match(plan.collectorCommand, /agent-mcp-packaged-production-run-collector/u);
assert.match(plan.collectorCommand, /--ready-server 'filesystem'/u);
assert.match(plan.coverageCommand, /agent-mcp-packaged-read-only-coverage/u);
assert.match(plan.coverageCommand, /--call-report/u);
assert.match(plan.packagedMainHarnessCommand, /agent-mcp-packaged-main-harness/u);
assert.match(plan.packagedMainHarnessCommand, /--rounds 3/u);
assert.doesNotMatch(plan.packagedMainHarnessCommand, /Start-Process/u);
assert.match(plan.harnessComparisonCommand, /agent-mcp-packaged-harness-comparison/u);
assert.match(plan.harnessComparisonCommand, /--packaged-report/u);
assert.match(plan.harnessComparisonCommand, /--harness-report/u);

const tempDir = path.resolve('tmp/mcp-packaged-production-run-collector-smoke');
const runtimeLogPath = path.join(tempDir, 'desktop-pet-main.log');
const callReportPath = path.join(tempDir, 'packaged-read-only-call-report.json');
const outputPath = path.join(tempDir, 'packaged-production-report.json');
fs.mkdirSync(tempDir, { recursive: true });
fs.writeFileSync(runtimeLogPath, `${runtimeLog}\n`, 'utf8');
const callReport = {
  elapsedMs: 1_810_000,
  endedAt: '2026-06-30T00:30:20.000Z',
  kind: 'mcp-packaged-read-only-call-report',
  productionRunId: 'production-smoke',
  runtime: { mode: 'packaged' },
  safety: {
    expectedProbeCallCount: 20,
    historyAvailable: true,
    observedProbeCallCount: 20,
    unexpectedToolCallCount: 0,
  },
  servers: [
    {
      id: 'filesystem',
      listFailureCount: 0,
      listSuccessCount: 20,
      maxToolCount: 14,
      minToolCount: 14,
      optionalCallErrorCount: 0,
      optionalCallSkippedCount: 0,
      optionalCallSuccessCount: 20,
      restartEventCount: 0,
      roundCount: 20,
      toolCountChanged: false,
      toolNames: ['list_directory'],
    },
  ],
  startedAt: '2026-06-30T00:00:10.000Z',
  version: 1,
};
fs.writeFileSync(callReportPath, `${JSON.stringify(callReport, null, 2)}\n`, 'utf8');

const report = runMcpPackagedProductionRunCollector([
  '--runtime-log', runtimeLogPath,
  '--call-report', callReportPath,
  '--output', outputPath,
  '--ready-server', 'filesystem',
  '--artifact', 'D:\\project\\release\\build-test\\win-unpacked\\AI Desktop Pet.exe',
  '--config-path', '.desktop-pet-mcp.json',
  '--config-source', 'saved-config',
  '--pretty',
]);
const review = createSettingsMcpPackagedProductionReview(report);
assert.equal(report.lifecycle?.gracefulQuitCount, 2);
assert.equal(report.provenance?.sameRunVerified, true);
assert.equal(report.run?.productionRunId, 'production-smoke');
assert.equal(review.status, 'ready');
assert.equal(fs.existsSync(outputPath), true);
assert.equal(parseSettingsMcpPackagedProductionEvidenceText(
  fs.readFileSync(outputPath, 'utf8'),
  outputPath,
).review.status, 'ready');

assert.throws(
  () => runMcpPackagedProductionRunCollector([
    '--runtime-log', runtimeLogPath,
    '--call-report', callReportPath,
    '--output', outputPath,
    '--ready-server', 'filesystem',
    '--config-source', 'draft-config',
  ]),
  /only accepts saved-config/u,
);

assert.throws(
  () => runMcpPackagedProductionRunCollector([
    '--runtime-log', runtimeLogPath,
    '--soak-summary', callReportPath,
    '--output', outputPath,
    '--ready-server', 'filesystem',
  ]),
  /Unexpected argument: --soak-summary/u,
);

const mismatchedCallReportPath = path.join(tempDir, 'mismatched-call-report.json');
fs.writeFileSync(mismatchedCallReportPath, `${JSON.stringify({
  ...callReport,
  productionRunId: 'another-run',
}, null, 2)}\n`, 'utf8');
assert.throws(
  () => runMcpPackagedProductionRunCollector([
    '--runtime-log', runtimeLogPath,
    '--call-report', mismatchedCallReportPath,
    '--output', outputPath,
    '--ready-server', 'filesystem',
  ]),
  /same non-empty production run ID/u,
);

const extraToolCallReportPath = path.join(tempDir, 'extra-tool-call-report.json');
fs.writeFileSync(extraToolCallReportPath, `${JSON.stringify({
  ...callReport,
  servers: callReport.servers.map((server) => ({
    ...server,
    toolNames: ['list_directory', 'write_file'],
  })),
}, null, 2)}\n`, 'utf8');
assert.throws(
  () => runMcpPackagedProductionRunCollector([
    '--runtime-log', runtimeLogPath,
    '--call-report', extraToolCallReportPath,
    '--output', outputPath,
    '--ready-server', 'filesystem',
  ]),
  /approved read-only production probe tool/u,
);

const duplicateServerCallReportPath = path.join(tempDir, 'duplicate-server-call-report.json');
fs.writeFileSync(duplicateServerCallReportPath, `${JSON.stringify({
  ...callReport,
  servers: [...callReport.servers, callReport.servers[0]],
}, null, 2)}\n`, 'utf8');
assert.throws(
  () => runMcpPackagedProductionRunCollector([
    '--runtime-log', runtimeLogPath,
    '--call-report', duplicateServerCallReportPath,
    '--output', outputPath,
    '--ready-server', 'filesystem',
  ]),
  /server set must exactly match/u,
);

const portablePlan = createSettingsMcpPackagedProductionRunPlan({
  executablePathExists: (candidatePath) => candidatePath === latestBuildInfo.portableExe,
  latestBuildInfo,
  logDir: 'D:\\project\\tmp\\portable-fallback',
  outputPath,
  productionRunId: 'portable-smoke',
  readyServerIds: ['filesystem'],
});
assert.equal(portablePlan.executablePath, latestBuildInfo.portableExe);

const stalePackagePlan = createSettingsMcpPackagedProductionRunPlan({
  latestBuildInfo,
  logDir: 'D:\\project\\tmp\\stale-package',
  outputPath,
  packagedRuntimeContractReady: false,
  productionRunId: 'stale-package-smoke',
  readyServerIds: ['filesystem'],
});
assert.equal(stalePackagePlan.status, 'blocked');
assert.equal(stalePackagePlan.startCommand, '');
assert.match(stalePackagePlan.summaryText, /runtimeContract=stale/u);

console.log('agent MCP packaged-production run collector smoke passed');
