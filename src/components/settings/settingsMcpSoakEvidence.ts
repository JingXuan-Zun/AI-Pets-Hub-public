import {
  redactSettingsMcpSoakText,
  type SettingsMcpSoakServerSummary,
  type SettingsMcpSoakSummaryResult,
  type SettingsMcpSoakSummaryStatus,
} from './settingsMcpSoakSummary';

export const SETTINGS_MCP_SOAK_EVIDENCE_KIND = 'mcp-soak-summary-settings-evidence';

const SETTINGS_MCP_SOAK_SUMMARY_KIND = 'mcp-real-server-soak-summary';
const VALID_SUMMARY_STATUSES: SettingsMcpSoakSummaryStatus[] = [
  'degraded',
  'empty',
  'failed',
  'healthy',
];

function asRecord(value: unknown, label: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }

  return value as Record<string, unknown>;
}

function requiredString(value: unknown, label: string, limit = 240) {
  if (typeof value !== 'string') {
    throw new Error(`${label} is missing or invalid.`);
  }

  return redactSettingsMcpSoakText(value, limit);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusValue(value: unknown, label: string) {
  if (VALID_SUMMARY_STATUSES.includes(value as SettingsMcpSoakSummaryStatus)) {
    return value as SettingsMcpSoakSummaryStatus;
  }

  throw new Error(`${label} is missing or invalid.`);
}

function stringArrayValue(value: unknown, label: string, limit = 240) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }

  return value
    .map((item) => requiredString(item, label, limit))
    .filter(Boolean);
}

function normalizeServer(value: unknown, index: number): SettingsMcpSoakServerSummary {
  const server = asRecord(value, `summary.servers[${index}]`);
  return {
    errorSamples: stringArrayValue(server.errorSamples, `summary.servers[${index}].errorSamples`, 160).slice(0, 3),
    failureCount: numberValue(server.failureCount),
    historyEventCount: numberValue(server.historyEventCount),
    id: requiredString(server.id, `summary.servers[${index}].id`, 120),
    maxDurationMs: numberValue(server.maxDurationMs),
    maxToolCount: numberValue(server.maxToolCount),
    optionalCallErrorCount: numberValue(server.optionalCallErrorCount),
    optionalCallSuccessCount: numberValue(server.optionalCallSuccessCount),
    restartEventCount: numberValue(server.restartEventCount),
    roundCount: numberValue(server.roundCount),
    status: statusValue(server.status, `summary.servers[${index}].status`),
    title: requiredString(server.title, `summary.servers[${index}].title`, 120),
    toolCountChanged: Boolean(server.toolCountChanged),
  };
}

function normalizeTotals(value: unknown): SettingsMcpSoakSummaryResult['totals'] {
  const totals = asRecord(value, 'summary.totals');
  return {
    failedServers: numberValue(totals.failedServers),
    listedServers: numberValue(totals.listedServers),
    restartEvents: numberValue(totals.restartEvents),
    rounds: numberValue(totals.rounds),
    servers: numberValue(totals.servers),
  };
}

function normalizeSummary(value: unknown, inputPath: string): SettingsMcpSoakSummaryResult {
  const summary = asRecord(value, 'MCP soak evidence summary');
  if (summary.kind !== SETTINGS_MCP_SOAK_SUMMARY_KIND) {
    throw new Error('MCP soak evidence summary is not a soak summary.');
  }
  if (summary.version !== 1) {
    throw new Error('MCP soak evidence summary version is unsupported.');
  }
  if (!Array.isArray(summary.servers)) {
    throw new Error('summary.servers is missing or invalid.');
  }

  return {
    generatedAt: requiredString(summary.generatedAt, 'summary.generatedAt'),
    inputPath,
    jsonText: null,
    kind: SETTINGS_MCP_SOAK_SUMMARY_KIND,
    recommendations: stringArrayValue(summary.recommendations, 'summary.recommendations', 240),
    reportText: requiredString(summary.reportText, 'summary.reportText', 4000),
    servers: summary.servers.map(normalizeServer),
    status: statusValue(summary.status, 'summary.status'),
    summaryText: requiredString(summary.summaryText, 'summary.summaryText', 400),
    totals: normalizeTotals(summary.totals),
    version: 1,
  };
}

export function isSettingsMcpSoakEvidenceEnvelope(value: unknown) {
  return Boolean(value && typeof value === 'object' && (value as { kind?: unknown }).kind === SETTINGS_MCP_SOAK_EVIDENCE_KIND);
}

export function createSettingsMcpSoakEvidenceFileName(summary: SettingsMcpSoakSummaryResult) {
  return `mcp-soak-evidence-${summary.status}-${summary.totals.servers}-servers.json`;
}

export function createSettingsMcpSoakEvidenceText(summary: SettingsMcpSoakSummaryResult) {
  return `${JSON.stringify({
    exportedAt: new Date().toISOString(),
    kind: SETTINGS_MCP_SOAK_EVIDENCE_KIND,
    summary,
    version: 1,
  }, null, 2)}\n`;
}

export function parseSettingsMcpSoakEvidenceEnvelope(
  value: unknown,
  inputPath: string,
): SettingsMcpSoakSummaryResult {
  const envelope = asRecord(value, 'MCP soak evidence export');
  if (envelope.kind !== SETTINGS_MCP_SOAK_EVIDENCE_KIND) {
    throw new Error('Input is not an MCP Settings soak evidence export.');
  }
  if (envelope.version !== 1) {
    throw new Error('MCP Settings soak evidence version is unsupported.');
  }

  return normalizeSummary(envelope.summary, inputPath);
}
