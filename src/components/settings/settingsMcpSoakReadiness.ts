import {
  createSettingsMcpSoakReadinessNextActions,
  type SettingsMcpSoakReadinessNextAction,
} from './settingsMcpSoakReadinessNextActions';
import {
  getSettingsMcpSoakReadinessServerStatus,
  type SettingsMcpSoakReadinessServerStatus,
} from './settingsMcpSoakReadinessServerStatus';

export type SettingsMcpSoakReadinessStatus = 'blocked' | 'ready';
export type { SettingsMcpSoakReadinessServerStatus };

export interface SettingsMcpSoakReadinessServerReport {
  blockers?: string[];
  command?: string;
  commandPathExists?: boolean | null;
  cwd?: string;
  cwdExists?: boolean | null;
  fakeFixture?: boolean;
  id?: string;
  readyForRealSoak?: boolean;
  referenceServer?: boolean;
  title?: string;
  warning?: string;
}

export interface SettingsMcpSoakReadinessReport {
  configPath?: string;
  configPresent?: boolean;
  kind?: string;
  reportDir?: string;
  runbook?: {
    allServers?: string;
    indexReports?: string;
    perServer?: Array<{ command?: string; serverId?: string }>;
  };
  servers?: SettingsMcpSoakReadinessServerReport[];
  source?: string;
  status?: SettingsMcpSoakReadinessStatus;
  totals?: {
    blockedServers?: number;
    fakeFixtureServers?: number;
    referenceServers?: number;
    readyServers?: number;
    servers?: number;
  };
}

export interface SettingsMcpSoakReadinessServerSummary {
  blockers: string[];
  command: string;
  commandPathExists: boolean | null;
  cwd: string;
  cwdExists: boolean | null;
  fakeFixture: boolean;
  id: string;
  readyForRealSoak: boolean;
  referenceServer: boolean;
  status: SettingsMcpSoakReadinessServerStatus;
  title: string;
  warning: string;
}

export interface SettingsMcpSoakReadinessSummaryResult {
  configPath: string;
  configPresent: boolean;
  generatedAt: string;
  inputPath: string;
  kind: 'mcp-real-server-soak-readiness-summary';
  nextActions?: SettingsMcpSoakReadinessNextAction[];
  recommendations: string[];
  reportDir: string;
  source: string;
  runbook: {
    allServers: string;
    indexReports: string;
    perServer: Array<{ command: string; serverId: string }>;
  };
  servers: SettingsMcpSoakReadinessServerSummary[];
  status: SettingsMcpSoakReadinessStatus;
  summaryText: string;
  totals: {
    blockedServers: number;
    fakeFixtureServers: number;
    referenceServers: number;
    readyServers: number;
    servers: number;
  };
  version: 1;
}

interface SettingsMcpSoakReadinessSettingsExport {
  kind?: string;
  summary?: SettingsMcpSoakReadinessSummaryResult;
}

const SENSITIVE_TEXT_PATTERN = /(token|password|secret|apikey|api_key)\s*[=:]\s*[^,\s}]+/giu;

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function booleanOrNull(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function redactReadinessText(value: unknown, limit = 220) {
  const text = String(value ?? '')
    .replace(SENSITIVE_TEXT_PATTERN, '$1=[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

function summarizeReadinessServer(
  server: SettingsMcpSoakReadinessServerReport,
): SettingsMcpSoakReadinessServerSummary {
  return {
    blockers: (server.blockers || []).map((item) => redactReadinessText(item, 120)).slice(0, 4),
    command: redactReadinessText(server.command),
    commandPathExists: booleanOrNull(server.commandPathExists),
    cwd: redactReadinessText(server.cwd),
    cwdExists: booleanOrNull(server.cwdExists),
    fakeFixture: Boolean(server.fakeFixture),
    id: String(server.id || ''),
    readyForRealSoak: Boolean(server.readyForRealSoak),
    referenceServer: Boolean(server.referenceServer),
    status: getSettingsMcpSoakReadinessServerStatus(server),
    title: String(server.title || server.id || ''),
    warning: redactReadinessText(server.warning, 160),
  };
}

function createConfigPresenceRecommendation(report: SettingsMcpSoakReadinessReport) {
  if (report.configPresent) {
    return '';
  }

  return report.source === 'draft-config'
    ? 'Save the draft MCP config before collecting real external soak evidence.'
    : 'Create or load .desktop-pet-mcp.json before collecting real external soak evidence.';
}

function addRecommendation(recommendations: string[], recommendation: string) {
  if (recommendation) {
    recommendations.push(recommendation);
  }
}

function createReadinessRecommendations(
  report: SettingsMcpSoakReadinessReport,
  servers: SettingsMcpSoakReadinessServerSummary[],
) {
  const recommendations = [];
  addRecommendation(recommendations, createConfigPresenceRecommendation(report));
  if (servers.length === 0) {
    recommendations.push('Add at least one MCP server before running the real-soak runner.');
  }
  if (servers.some((server) => server.blockers.length > 0)) {
    recommendations.push('Fix command path or cwd blockers before running generated soak commands.');
  }
  if (servers.some((server) => server.fakeFixture)) {
    recommendations.push('Treat fixture servers as smoke coverage only, not production soak evidence.');
  }
  if (servers.some((server) => server.referenceServer)) {
    recommendations.push('Treat local reference servers as pipeline evidence only, not external MCP soak evidence.');
  }
  if (servers.some((server) => server.readyForRealSoak)) {
    recommendations.push('Run generated per-server soak commands and import the resulting soak reports.');
  }

  return recommendations.length ? recommendations : ['Readiness has no immediate follow-up.'];
}

function normalizeRunbook(report: SettingsMcpSoakReadinessReport) {
  const runbook = report.runbook || {};
  return {
    allServers: redactReadinessText(runbook.allServers, 600),
    indexReports: redactReadinessText(runbook.indexReports, 600),
    perServer: (runbook.perServer || []).map((item) => ({
      command: redactReadinessText(item.command, 600),
      serverId: String(item.serverId || ''),
    })),
  };
}

function createReadinessNextActions(options: {
  configPresent: boolean;
  runbook: ReturnType<typeof normalizeRunbook>;
  servers: SettingsMcpSoakReadinessServerSummary[];
  source: string;
  totals: SettingsMcpSoakReadinessSummaryResult['totals'];
}) {
  return createSettingsMcpSoakReadinessNextActions({
    configPresent: options.configPresent,
    runbook: options.runbook,
    servers: options.servers,
    source: options.source,
    totals: options.totals,
  });
}

export function createSettingsMcpSoakReadinessSummaryResult(options: {
  inputPath: string;
  report: SettingsMcpSoakReadinessReport;
}): SettingsMcpSoakReadinessSummaryResult {
  const servers = (options.report.servers || []).map(summarizeReadinessServer);
  const readyServers = numberValue(options.report.totals?.readyServers);
  const totals = {
    blockedServers: numberValue(options.report.totals?.blockedServers),
    fakeFixtureServers: numberValue(options.report.totals?.fakeFixtureServers),
    referenceServers: numberValue(options.report.totals?.referenceServers),
    readyServers,
    servers: numberValue(options.report.totals?.servers) || servers.length,
  };
  const status = readyServers > 0 ? 'ready' : 'blocked';
  const configPresent = Boolean(options.report.configPresent);
  const runbook = normalizeRunbook(options.report);
  const source = String(options.report.source || 'unknown');
  return {
    configPath: String(options.report.configPath || ''),
    configPresent,
    generatedAt: new Date().toISOString(),
    inputPath: options.inputPath,
    kind: 'mcp-real-server-soak-readiness-summary',
    nextActions: createReadinessNextActions({
      configPresent,
      runbook,
      servers,
      source,
      totals,
    }),
    recommendations: createReadinessRecommendations(options.report, servers),
    reportDir: String(options.report.reportDir || ''),
    runbook,
    servers,
    source,
    status,
    summaryText: `MCPSoakReadiness status=${status} servers=${totals.servers} ready=${totals.readyServers} fixtures=${totals.fakeFixtureServers} references=${totals.referenceServers}`,
    totals,
    version: 1,
  };
}

function isReadinessSummary(value: unknown): value is SettingsMcpSoakReadinessSummaryResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const summary = value as Partial<SettingsMcpSoakReadinessSummaryResult>;
  return summary.kind === 'mcp-real-server-soak-readiness-summary'
    && (summary.status === 'ready' || summary.status === 'blocked')
    && Boolean(summary.totals)
    && Boolean(summary.runbook)
    && Array.isArray(summary.servers)
    && Array.isArray(summary.recommendations);
}

function parseSettingsReadinessExport(
  parsed: SettingsMcpSoakReadinessSettingsExport,
  inputPath: string,
) {
  if (!isReadinessSummary(parsed.summary)) {
    throw new Error('Settings readiness export does not contain a valid readiness summary.');
  }

  return {
    ...parsed.summary,
    inputPath,
  };
}

export function parseSettingsMcpSoakReadinessText(
  text: string,
  inputPath: string,
): SettingsMcpSoakReadinessSummaryResult {
  const parsed = JSON.parse(text) as SettingsMcpSoakReadinessReport | SettingsMcpSoakReadinessSettingsExport;
  if (parsed.kind === 'mcp-real-server-soak-readiness-settings-export') {
    return parseSettingsReadinessExport(parsed, inputPath);
  }

  if (parsed.kind !== 'mcp-real-server-soak-readiness') {
    throw new Error('Input is not an MCP real-server soak readiness report.');
  }

  return createSettingsMcpSoakReadinessSummaryResult({
    inputPath,
    report: parsed,
  });
}
