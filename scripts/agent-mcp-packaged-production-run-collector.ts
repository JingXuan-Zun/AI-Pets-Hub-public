import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpPackagedProductionReview,
  type SettingsMcpPackagedProductionReport,
} from '../src/components/settings/settingsMcpPackagedProductionEvidence.ts';
import type {
  SettingsMcpPackagedReadOnlyCallReport,
  SettingsMcpPackagedReadOnlyCallReportServer,
} from '../src/components/settings/settingsMcpPackagedReadOnlyCoverage.ts';
import {
  createSettingsMcpPackagedProductionReportFromBoundCallReport,
} from '../src/components/settings/settingsMcpPackagedProductionReportBuilder.ts';
import {
  createSettingsMcpPackagedProductionRuntimeLogSummary,
  type SettingsMcpPackagedProductionRuntimeLogSummary,
} from '../src/components/settings/settingsMcpPackagedProductionRuntimeLog.ts';

const SAFE_PRODUCTION_PROBE_TOOLS = new Map([
  ['filesystem', 'list_directory'],
  ['memory', 'read_graph'],
]);
const MIN_DISTRIBUTED_CALL_WINDOW_MS = 30 * 60 * 1000;

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

function usage() {
  return [
    'Usage: npx tsx scripts/agent-mcp-packaged-production-run-collector.ts',
    '--runtime-log log --call-report report.json --output report.json --ready-server id',
    '[--artifact exe] [--config-path .desktop-pet-mcp.json] [--config-source saved-config] [--pretty]',
  ].join(' ');
}

function isPackagedCallReport(value: unknown): value is SettingsMcpPackagedReadOnlyCallReport {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Partial<SettingsMcpPackagedReadOnlyCallReport>).kind === 'mcp-packaged-read-only-call-report'
    && (value as Partial<SettingsMcpPackagedReadOnlyCallReport>).version === 1;
}

function sha256(text: string) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function parseTimestamp(value: string | undefined, label: string) {
  const timestamp = Date.parse(value || '');
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Packaged evidence is missing a valid ${label} timestamp.`);
  }
  return timestamp;
}

function validateServerEvidence(server: SettingsMcpPackagedReadOnlyCallReportServer, serverId: string) {
  const expectedTool = SAFE_PRODUCTION_PROBE_TOOLS.get(serverId);
  if (!expectedTool || server.toolNames?.length !== 1 || server.toolNames[0] !== expectedTool) {
    throw new Error(`Server ${serverId} is not bound to an approved read-only production probe tool.`);
  }
  if (server.toolCountChanged !== false || server.minToolCount !== server.maxToolCount) {
    throw new Error(`Server ${serverId} does not prove a stable tool count across packaged rounds.`);
  }
  if (!Number.isFinite(server.restartEventCount)) {
    throw new Error(`Server ${serverId} does not include packaged restart-event evidence.`);
  }
}

function validateSameRunEvidence(
  runtimeSummary: SettingsMcpPackagedProductionRuntimeLogSummary,
  callReport: SettingsMcpPackagedReadOnlyCallReport,
  readyServerIds: string[],
) {
  if (runtimeSummary.runtimeMode !== 'packaged' || callReport.runtime?.mode !== 'packaged') {
    throw new Error('Runtime log and call report must both identify a packaged runtime.');
  }
  if (
    !runtimeSummary.productionRunId
    || !callReport.productionRunId
    || runtimeSummary.productionRunId !== callReport.productionRunId
  ) {
    throw new Error('Runtime log and call report do not share the same non-empty production run ID.');
  }

  const runtimeStartedAt = parseTimestamp(runtimeSummary.startedAt, 'runtime start');
  const runtimeEndedAt = parseTimestamp(runtimeSummary.endedAt, 'runtime end');
  const callStartedAt = parseTimestamp(callReport.startedAt, 'call-report start');
  const callEndedAt = parseTimestamp(callReport.endedAt, 'call-report end');
  if (callStartedAt < runtimeStartedAt || callEndedAt > runtimeEndedAt || callEndedAt < callStartedAt) {
    throw new Error('Packaged call rounds fall outside the bound runtime-log time window.');
  }
  if (
    callEndedAt - callStartedAt < MIN_DISTRIBUTED_CALL_WINDOW_MS
    || Number(callReport.elapsedMs) < MIN_DISTRIBUTED_CALL_WINDOW_MS
  ) {
    throw new Error('Packaged call rounds must span at least 30 minutes of the bound runtime window.');
  }
  const expectedCallCount = readyServerIds.length * 20;
  if (
    callReport.safety?.historyAvailable !== true
    || Number(callReport.safety.expectedProbeCallCount) !== expectedCallCount
    || Number(callReport.safety.observedProbeCallCount) !== expectedCallCount
    || Number(callReport.safety.unexpectedToolCallCount) !== 0
  ) {
    throw new Error('Packaged call history must prove all expected probe calls and zero unexpected tool calls.');
  }

  const uniqueReadyServerIds = [...new Set(readyServerIds)];
  const reportServers = callReport.servers || [];
  const reportServerIds = [...new Set(reportServers.map((server) => server.id))];
  if (
    reportServers.length !== reportServerIds.length
    || uniqueReadyServerIds.length !== readyServerIds.length
    || uniqueReadyServerIds.length !== reportServerIds.length
    || uniqueReadyServerIds.some((serverId) => !reportServerIds.includes(serverId))
  ) {
    throw new Error('Packaged call report server set must exactly match the ready-server set.');
  }

  for (const serverId of uniqueReadyServerIds) {
    const server = callReport.servers?.find((candidate) => candidate.id === serverId);
    if (!server) {
      throw new Error(`Packaged call report is missing ready server ${serverId}.`);
    }
    validateServerEvidence(server, serverId);
  }
}

export function parseMcpPackagedProductionRunCollectorArgs(args: readonly string[]) {
  const readyServerIds: string[] = [];
  const options: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--ready-server') {
      readyServerIds.push(readArgValue(args, index, arg));
      index += 1;
    } else if (arg === '--pretty') {
      options.pretty = true;
    } else if (
      arg === '--runtime-log'
      || arg === '--call-report'
      || arg === '--output'
      || arg === '--artifact'
      || arg === '--config-path'
      || arg === '--config-source'
    ) {
      options[arg.slice(2)] = readArgValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`${usage()} Unexpected argument: ${arg}`);
    }
  }

  return { options, readyServerIds };
}

export function runMcpPackagedProductionRunCollector(args: readonly string[]): SettingsMcpPackagedProductionReport {
  const { options, readyServerIds } = parseMcpPackagedProductionRunCollectorArgs(args);
  if (!options['runtime-log'] || !options['call-report'] || !options.output || readyServerIds.length === 0) {
    throw new Error(usage());
  }
  if (options['config-source'] && options['config-source'] !== 'saved-config') {
    throw new Error('Packaged production evidence only accepts saved-config source.');
  }

  const runtimeLogText = fs.readFileSync(path.resolve(String(options['runtime-log'])), 'utf8');
  const callReportText = fs.readFileSync(path.resolve(String(options['call-report'])), 'utf8');
  const parsedCallReport = JSON.parse(callReportText) as unknown;
  if (!isPackagedCallReport(parsedCallReport)) {
    throw new Error('Input is not an MCP packaged read-only call report.');
  }

  const runtimeSummary = createSettingsMcpPackagedProductionRuntimeLogSummary(runtimeLogText);
  validateSameRunEvidence(runtimeSummary, parsedCallReport, readyServerIds);
  const report = createSettingsMcpPackagedProductionReportFromBoundCallReport({
    callReport: parsedCallReport,
    callReportSha256: sha256(callReportText),
    configPath: options['config-path'] ? String(options['config-path']) : undefined,
    controlledCloseCount: runtimeSummary.controlledCloseCount,
    durationMs: runtimeSummary.durationMs,
    endedAt: runtimeSummary.endedAt,
    gracefulQuitCount: runtimeSummary.gracefulQuitCount,
    packagedArtifactPath: options.artifact ? String(options.artifact) : undefined,
    readyServerIds,
    runtimeLogSha256: sha256(runtimeLogText),
    startedAt: runtimeSummary.startedAt,
    startupCount: runtimeSummary.startupCount,
    unexpectedExitCount: runtimeSummary.unexpectedExitCount,
  });
  const outputPath = path.resolve(String(options.output));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, options.pretty ? 2 : 0)}\n`, 'utf8');
  return report;
}

function runCli() {
  const report = runMcpPackagedProductionRunCollector(process.argv.slice(2));
  console.log(createSettingsMcpPackagedProductionReview(report).summaryText);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
