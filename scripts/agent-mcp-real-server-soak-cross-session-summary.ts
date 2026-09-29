import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createSettingsMcpSoakSummaryResult,
  type SettingsMcpSoakReport,
  type SettingsMcpSoakServerSummary,
  type SettingsMcpSoakSummaryResult,
  type SettingsMcpSoakSummaryStatus,
} from '../src/components/settings/settingsMcpSoakSummary.ts';
import { redactMcpSoakText } from './agent-mcp-real-server-soak-config.ts';

export interface McpRealServerCrossSessionSummaryOptions {
  inputPaths: string[];
  outputPath?: string;
  prettyJson?: boolean;
}

interface McpCrossSessionReportRow {
  inputPath: string;
  listedServers: number;
  restartEvents: number;
  rounds: number;
  serverIds: string[];
  status: SettingsMcpSoakSummaryStatus;
  summaryText: string;
}

interface McpCrossSessionServerRow {
  failureCount: number;
  id: string;
  maxToolCount: number;
  minToolCount: number;
  missingReportCount: number;
  optionalCallErrorCount: number;
  optionalCallSuccessCount: number;
  reportCount: number;
  restartEventCount: number;
  roundCount: number;
  status: SettingsMcpSoakSummaryStatus;
  toolCountConsistent: boolean;
}

export interface McpRealServerCrossSessionSummary {
  generatedAt: string;
  inputPaths: string[];
  kind: 'mcp-real-server-soak-cross-session-summary';
  recommendations: string[];
  reportText: string;
  reports: McpCrossSessionReportRow[];
  servers: McpCrossSessionServerRow[];
  status: SettingsMcpSoakSummaryStatus;
  summaryText: string;
  totals: {
    failedServers: number;
    healthyReports: number;
    listedServers: number;
    reports: number;
    restartEvents: number;
    rounds: number;
    servers: number;
  };
  version: 1;
}

function readArgValue(args: readonly string[], index: number, name: string) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value after ${name}.`);
  }

  return value;
}

export function parseMcpRealServerCrossSessionSummaryArgs(
  args: readonly string[],
): McpRealServerCrossSessionSummaryOptions {
  const inputPaths: string[] = [];
  const options: Partial<McpRealServerCrossSessionSummaryOptions> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--input') {
      inputPaths.push(readArgValue(args, index, arg));
      index += 1;
    } else if (arg === '--output') {
      options.outputPath = readArgValue(args, index, arg);
      index += 1;
    } else if (arg === '--pretty') {
      options.prettyJson = true;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (inputPaths.length === 0) {
    throw new Error('Usage: npx tsx scripts/agent-mcp-real-server-soak-cross-session-summary.ts --input report-a.json --input report-b.json [--output summary.json] [--pretty]');
  }

  return { ...options, inputPaths };
}

function readSoakSummary(inputPath: string): SettingsMcpSoakSummaryResult {
  const resolvedPath = path.resolve(inputPath);
  const report = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as SettingsMcpSoakReport;
  if (report.kind !== 'mcp-real-server-soak-report') {
    throw new Error(`${resolvedPath} is not an MCP real-server soak report.`);
  }

  return createSettingsMcpSoakSummaryResult({ inputPath: resolvedPath, report });
}

function createReportRow(summary: SettingsMcpSoakSummaryResult): McpCrossSessionReportRow {
  return {
    inputPath: summary.inputPath,
    listedServers: summary.totals.listedServers,
    restartEvents: summary.totals.restartEvents,
    rounds: summary.totals.rounds,
    serverIds: summary.servers.map((server) => server.id).sort((left, right) => left.localeCompare(right)),
    status: summary.status,
    summaryText: summary.summaryText,
  };
}

function uniqueServerIds(summaries: SettingsMcpSoakSummaryResult[]) {
  return [...new Set(summaries.flatMap((summary) => summary.servers.map((server) => server.id)))]
    .sort((left, right) => left.localeCompare(right));
}

function getServerStatus(
  entries: SettingsMcpSoakServerSummary[],
  missingReportCount: number,
  toolCountConsistent: boolean,
): SettingsMcpSoakSummaryStatus {
  if (entries.length === 0) {
    return 'empty';
  }
  if (entries.every((entry) => entry.status === 'failed')) {
    return 'failed';
  }
  if (
    missingReportCount > 0
    || !toolCountConsistent
    || entries.some((entry) => entry.status !== 'healthy')
  ) {
    return 'degraded';
  }

  return 'healthy';
}

function createServerRow(
  serverId: string,
  summaries: SettingsMcpSoakSummaryResult[],
): McpCrossSessionServerRow {
  const entries = summaries
    .map((summary) => summary.servers.find((server) => server.id === serverId))
    .filter((server): server is SettingsMcpSoakServerSummary => Boolean(server));
  const toolCounts = entries.map((entry) => entry.maxToolCount);
  const toolCountConsistent = new Set(toolCounts).size <= 1 && entries.every((entry) => !entry.toolCountChanged);
  const missingReportCount = summaries.length - entries.length;
  return {
    failureCount: entries.reduce((sum, entry) => sum + entry.failureCount, 0),
    id: serverId,
    maxToolCount: Math.max(0, ...toolCounts),
    minToolCount: Math.min(...toolCounts),
    missingReportCount,
    optionalCallErrorCount: entries.reduce((sum, entry) => sum + entry.optionalCallErrorCount, 0),
    optionalCallSuccessCount: entries.reduce((sum, entry) => sum + entry.optionalCallSuccessCount, 0),
    reportCount: entries.length,
    restartEventCount: entries.reduce((sum, entry) => sum + entry.restartEventCount, 0),
    roundCount: entries.reduce((sum, entry) => sum + entry.roundCount, 0),
    status: getServerStatus(entries, missingReportCount, toolCountConsistent),
    toolCountConsistent,
  };
}

function createOverallStatus(
  summaries: SettingsMcpSoakSummaryResult[],
  servers: McpCrossSessionServerRow[],
): SettingsMcpSoakSummaryStatus {
  if (summaries.length === 0 || servers.length === 0) {
    return 'empty';
  }
  if (summaries.every((summary) => summary.status === 'failed')) {
    return 'failed';
  }
  if (summaries.some((summary) => summary.status !== 'healthy')) {
    return 'degraded';
  }
  if (servers.some((server) => server.status !== 'healthy')) {
    return 'degraded';
  }

  return 'healthy';
}

function createRecommendations(status: SettingsMcpSoakSummaryStatus, servers: McpCrossSessionServerRow[]) {
  const recommendations: string[] = [];
  if (servers.some((server) => server.missingReportCount > 0)) {
    recommendations.push('Regenerate saved-config readiness and rerun cross-session soak with the same server set.');
  }
  if (servers.some((server) => server.failureCount > 0 || server.restartEventCount > 0)) {
    recommendations.push('Inspect failing server diagnostics before increasing MCP foundation confidence.');
  }
  if (servers.some((server) => !server.toolCountConsistent)) {
    recommendations.push('Review cross-session tool-count drift before treating the server as stable.');
  }

  if (recommendations.length === 0 && status === 'healthy') {
    return ['Cross-session saved-config soak is healthy across all imported reports.'];
  }

  return recommendations.length ? recommendations : ['Review cross-session soak evidence before increasing confidence.'];
}

function createReportText(summary: Omit<McpRealServerCrossSessionSummary, 'reportText'>) {
  const serverLines = summary.servers.map((server) => [
    `- ${server.id}`,
    `status=${server.status}`,
    `reports=${server.reportCount}`,
    `rounds=${server.roundCount}`,
    `failures=${server.failureCount}`,
    `restarts=${server.restartEventCount}`,
    `tools=${server.minToolCount}-${server.maxToolCount}`,
  ].join(' '));
  return [
    summary.summaryText,
    ...serverLines,
    'recommendations:',
    ...summary.recommendations.map((item) => `- ${item}`),
  ].join('\n');
}

export function runMcpRealServerCrossSessionSummary(
  options: McpRealServerCrossSessionSummaryOptions,
): McpRealServerCrossSessionSummary {
  const inputPaths = options.inputPaths.map((inputPath) => path.resolve(inputPath));
  const summaries = inputPaths.map(readSoakSummary);
  const reports = summaries.map(createReportRow);
  const servers = uniqueServerIds(summaries).map((serverId) => createServerRow(serverId, summaries));
  const status = createOverallStatus(summaries, servers);
  const totals = {
    failedServers: servers.filter((server) => server.status === 'failed').length,
    healthyReports: reports.filter((report) => report.status === 'healthy').length,
    listedServers: reports.reduce((sum, report) => sum + report.listedServers, 0),
    reports: reports.length,
    restartEvents: servers.reduce((sum, server) => sum + server.restartEventCount, 0),
    rounds: reports.reduce((sum, report) => sum + report.rounds, 0),
    servers: servers.length,
  };
  const baseSummary = {
    generatedAt: new Date().toISOString(),
    inputPaths,
    kind: 'mcp-real-server-soak-cross-session-summary' as const,
    recommendations: createRecommendations(status, servers),
    reports,
    servers,
    status,
    summaryText: `MCPCrossSessionSoak status=${status} reports=${totals.reports} servers=${totals.servers} rounds=${totals.rounds} restarts=${totals.restartEvents}`,
    totals,
    version: 1 as const,
  };
  const result = { ...baseSummary, reportText: createReportText(baseSummary) };
  if (options.outputPath) {
    const outputPath = path.resolve(options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, options.prettyJson ? 2 : 0)}\n`, 'utf8');
  }

  return result;
}

function runCli() {
  const result = runMcpRealServerCrossSessionSummary(
    parseMcpRealServerCrossSessionSummaryArgs(process.argv.slice(2)),
  );
  console.log(result.reportText);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(redactMcpSoakText(error));
    process.exitCode = 1;
  }
}
