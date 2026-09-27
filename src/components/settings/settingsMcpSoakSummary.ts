export type SettingsMcpSoakSummaryStatus = 'degraded' | 'empty' | 'failed' | 'healthy';

export interface SettingsMcpSoakRound {
  durationMs?: number;
  error?: string | null;
  listOk?: boolean;
  toolCount?: number;
}

export interface SettingsMcpSoakServerReport {
  errorCount?: number;
  history?: { byStatus?: Record<string, number>; totalCount?: number };
  historyErrorSamples?: string[];
  id?: string;
  listFailureCount?: number;
  maxToolCount?: number;
  optionalCallErrorCount?: number;
  optionalCallSuccessCount?: number;
  rounds?: SettingsMcpSoakRound[];
  title?: string;
}

export interface SettingsMcpSoakReport {
  kind?: string;
  servers?: SettingsMcpSoakServerReport[];
  totals?: Record<string, number>;
}

export interface SettingsMcpSoakServerSummary {
  errorSamples: string[];
  failureCount: number;
  historyEventCount: number;
  id: string;
  maxDurationMs: number;
  maxToolCount: number;
  optionalCallErrorCount: number;
  optionalCallSuccessCount: number;
  restartEventCount: number;
  roundCount: number;
  status: SettingsMcpSoakSummaryStatus;
  title: string;
  toolCountChanged: boolean;
}

export interface SettingsMcpSoakSummaryResult {
  generatedAt: string;
  inputPath: string;
  jsonText: string | null;
  kind: 'mcp-real-server-soak-summary';
  recommendations: string[];
  reportText: string;
  servers: SettingsMcpSoakServerSummary[];
  status: SettingsMcpSoakSummaryStatus;
  summaryText: string;
  totals: {
    failedServers: number;
    listedServers: number;
    restartEvents: number;
    rounds: number;
    servers: number;
  };
  version: 1;
}

const SENSITIVE_TEXT_PATTERN = /(token|password|secret|apikey|api_key)\s*[=:]\s*[^,\s}]+/giu;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function redactSettingsMcpSoakText(value: unknown, limit = 240) {
  const text = String(value ?? '')
    .replace(SENSITIVE_TEXT_PATTERN, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function getHistoryCount(server: SettingsMcpSoakServerReport, suffix: string) {
  const byStatus = server.history?.byStatus || {};
  return Object.entries(byStatus)
    .filter(([key]) => key.endsWith(suffix))
    .reduce((sum, [, count]) => sum + numberValue(count), 0);
}

function hasToolCountDrift(rounds: SettingsMcpSoakRound[]) {
  const counts = rounds.map((round) => numberValue(round.toolCount));
  return new Set(counts).size > 1;
}

function collectErrorSamples(rounds: SettingsMcpSoakRound[]) {
  return rounds
    .map((round) => round.error)
    .filter((error): error is string => Boolean(error))
    .map((error) => redactSettingsMcpSoakText(error, 160))
    .slice(0, 3);
}

function collectServerErrorSamples(server: SettingsMcpSoakServerReport, rounds: SettingsMcpSoakRound[]) {
  const historySamples = Array.isArray(server.historyErrorSamples) ? server.historyErrorSamples : [];
  return [
    ...collectErrorSamples(rounds),
    ...historySamples.map((error) => redactSettingsMcpSoakText(error, 160)),
  ].slice(0, 3);
}

function getFailureCount(server: SettingsMcpSoakServerReport, rounds: SettingsMcpSoakRound[]) {
  if (rounds.length > 0) {
    return rounds.filter((round) => round.listOk === false || Boolean(round.error)).length;
  }

  return Math.max(numberValue(server.listFailureCount), numberValue(server.errorCount));
}

function getServerStatus(options: {
  failureCount: number;
  maxToolCount: number;
  optionalCallErrorCount: number;
  restartEventCount: number;
  roundCount: number;
  toolCountChanged: boolean;
}) {
  if (options.roundCount === 0 || options.maxToolCount <= 0) {
    return 'empty' as const;
  }

  if (options.failureCount >= options.roundCount) {
    return 'failed' as const;
  }

  if (
    options.failureCount > 0
    || options.optionalCallErrorCount > 0
    || options.restartEventCount > 0
    || options.toolCountChanged
  ) {
    return 'degraded' as const;
  }

  return 'healthy' as const;
}

export function summarizeSettingsMcpSoakServer(
  server: SettingsMcpSoakServerReport,
): SettingsMcpSoakServerSummary {
  const rounds = Array.isArray(server.rounds) ? server.rounds : [];
  const restartEventCount = getHistoryCount(server, 'restart-cooldown')
    + getHistoryCount(server, 'restart-blocked')
    + getHistoryCount(server, 'restart-recovered');
  const failureCount = getFailureCount(server, rounds);
  const optionalCallErrorCount = numberValue(server.optionalCallErrorCount);
  const maxToolCount = numberValue(server.maxToolCount);
  const toolCountChanged = hasToolCountDrift(rounds);
  return {
    errorSamples: collectServerErrorSamples(server, rounds),
    failureCount,
    historyEventCount: numberValue(server.history?.totalCount),
    id: String(server.id || ''),
    maxDurationMs: Math.max(0, ...rounds.map((round) => numberValue(round.durationMs))),
    maxToolCount,
    optionalCallErrorCount,
    optionalCallSuccessCount: numberValue(server.optionalCallSuccessCount),
    restartEventCount,
    roundCount: rounds.length,
    status: getServerStatus({
      failureCount,
      maxToolCount,
      optionalCallErrorCount,
      restartEventCount,
      roundCount: rounds.length,
      toolCountChanged,
    }),
    title: String(server.title || server.id || ''),
    toolCountChanged,
  };
}

export function createSettingsMcpSoakRecommendations(servers: SettingsMcpSoakServerSummary[]) {
  const recommendations = [];
  if (servers.some((server) => server.restartEventCount > 0)) {
    recommendations.push('Inspect restart/cooldown history before adding longer soak windows.');
  }
  if (servers.some((server) => server.failureCount > 0)) {
    recommendations.push('Run server diagnostics for servers with list failures or round errors.');
  }
  if (servers.some((server) => server.maxToolCount <= 0)) {
    recommendations.push('Verify server command, cwd, and initialization if no tools were discovered.');
  }
  if (servers.some((server) => server.toolCountChanged)) {
    recommendations.push('Review tool-count drift; dynamic tool registries may need separate acceptance criteria.');
  }

  return recommendations.length ? recommendations : ['No immediate MCP soak follow-up is required.'];
}

export function getSettingsMcpSoakOverallStatus(
  servers: SettingsMcpSoakServerSummary[],
): SettingsMcpSoakSummaryStatus {
  if (servers.length === 0 || servers.every((server) => server.status === 'empty')) {
    return 'empty';
  }

  if (servers.every((server) => server.status === 'failed')) {
    return 'failed';
  }

  if (servers.some((server) => server.status !== 'healthy')) {
    return 'degraded';
  }

  return 'healthy';
}

export function createSettingsMcpSoakReportText(
  result: Omit<SettingsMcpSoakSummaryResult, 'jsonText' | 'reportText'>,
) {
  const serverLines = result.servers.map((server) => [
    `- ${server.id}`,
    `status=${server.status}`,
    `rounds=${server.roundCount}`,
    `failures=${server.failureCount}`,
    `maxTools=${server.maxToolCount}`,
    `restarts=${server.restartEventCount}`,
    `maxDurationMs=${server.maxDurationMs}`,
  ].join(' '));
  return [
    result.summaryText,
    ...serverLines,
    'recommendations:',
    ...result.recommendations.map((item) => `- ${item}`),
  ].join('\n');
}

export function createSettingsMcpSoakSummaryResult(options: {
  includeJsonText?: boolean;
  inputPath: string;
  prettyJson?: boolean;
  report: SettingsMcpSoakReport;
}): SettingsMcpSoakSummaryResult {
  const servers = (options.report.servers || []).map(summarizeSettingsMcpSoakServer);
  const status = getSettingsMcpSoakOverallStatus(servers);
  const totals = {
    failedServers: servers.filter((server) => server.status === 'failed').length,
    listedServers: numberValue(options.report.totals?.listSuccesses),
    restartEvents: servers.reduce((sum, server) => sum + server.restartEventCount, 0),
    rounds: numberValue(options.report.totals?.rounds),
    servers: servers.length,
  };
  const baseResult = {
    generatedAt: new Date().toISOString(),
    inputPath: options.inputPath,
    kind: 'mcp-real-server-soak-summary' as const,
    recommendations: createSettingsMcpSoakRecommendations(servers),
    servers,
    status,
    summaryText: `MCPSoakSummary status=${status} servers=${totals.servers} rounds=${totals.rounds} listed=${totals.listedServers} restarts=${totals.restartEvents}`,
    totals,
    version: 1 as const,
  };
  const reportText = createSettingsMcpSoakReportText(baseResult);
  const result = { ...baseResult, jsonText: null, reportText };
  const jsonText = options.includeJsonText ? JSON.stringify(result, null, options.prettyJson ? 2 : 0) : null;
  return { ...result, jsonText };
}
