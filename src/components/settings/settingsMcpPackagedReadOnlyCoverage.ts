import type {
  SettingsMcpPackagedProductionReport,
  SettingsMcpPackagedProductionServerEvidence,
  SettingsMcpPackagedProductionStatus,
} from './settingsMcpPackagedProductionEvidenceTypes';

export interface SettingsMcpPackagedReadOnlyCoverageServer {
  callErrorCount: number;
  callSuccessCount: number;
  errorSamples: string[];
  id: string;
  packagedProbeCallSuccessCount: number;
  status: SettingsMcpPackagedProductionStatus;
}

export interface SettingsMcpPackagedReadOnlyCallReportServer {
  id: string;
  errorSamples?: string[];
  listFailureCount?: number;
  listSuccessCount?: number;
  maxToolCount?: number;
  minToolCount?: number;
  optionalCallErrorCount?: number;
  optionalCallSkippedCount?: number;
  optionalCallSuccessCount?: number;
  roundCount?: number;
  restartEventCount?: number;
  toolCountChanged?: boolean;
  toolNames?: string[];
}

export interface SettingsMcpPackagedReadOnlyCallReport {
  elapsedMs?: number;
  endedAt?: string;
  kind: 'mcp-packaged-read-only-call-report';
  productionRunId?: string | null;
  probe?: {
    intervalMs?: number;
    roundsPerServer?: number;
  };
  runtime?: {
    mode?: 'dev' | 'packaged' | 'unknown';
    platform?: string;
    version?: string;
  };
  safety?: {
    expectedProbeCallCount?: number;
    historyAvailable?: boolean;
    observedProbeCallCount?: number;
    unexpectedToolCallCount?: number;
  };
  servers?: SettingsMcpPackagedReadOnlyCallReportServer[];
  startedAt?: string;
  version: 1;
}

export interface SettingsMcpPackagedReadOnlyCoverageReview {
  blockedCount: number;
  coveredServerCount: number;
  generatedAt: string;
  kind: 'settings-mcp-packaged-read-only-coverage-review';
  missingServerIds: string[];
  serverCount: number;
  servers: SettingsMcpPackagedReadOnlyCoverageServer[];
  status: SettingsMcpPackagedProductionStatus;
  summaryText: string;
  totalCallSuccessCount: number;
  version: 1;
  warningCount: number;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function compactSamples(value: unknown) {
  return stringArray(value)
    .map((item) => item.replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
    .slice(0, 3);
}

function findServer(
  servers: SettingsMcpPackagedProductionServerEvidence[],
  serverId: string,
) {
  return servers.find((server) => server.id === serverId);
}

function findProbeServer(
  callReport: SettingsMcpPackagedReadOnlyCallReport | undefined,
  serverId: string,
) {
  if (callReport?.runtime?.mode !== 'packaged') {
    return undefined;
  }

  return (callReport.servers || []).find((server) => server.id === serverId);
}

function createServerCoverage(
  serverId: string,
  server: SettingsMcpPackagedProductionServerEvidence | undefined,
  probeServer?: SettingsMcpPackagedReadOnlyCallReportServer,
  sameRunVerified = false,
): SettingsMcpPackagedReadOnlyCoverageServer {
  const packagedProbeCallSuccessCount = numberValue(probeServer?.optionalCallSuccessCount);
  const reportCallErrorCount = numberValue(server?.optionalCallErrorCount);
  const probeCallErrorCount = numberValue(probeServer?.optionalCallErrorCount)
    + numberValue(probeServer?.optionalCallSkippedCount);
  const reportCallSuccessCount = numberValue(server?.optionalCallSuccessCount);
  const callErrorCount = sameRunVerified && probeServer
    ? Math.max(reportCallErrorCount, probeCallErrorCount)
    : reportCallErrorCount + probeCallErrorCount;
  const callSuccessCount = sameRunVerified && probeServer
    ? Math.max(reportCallSuccessCount, packagedProbeCallSuccessCount)
    : reportCallSuccessCount + packagedProbeCallSuccessCount;
  const status = !server || callSuccessCount <= 0
    ? 'blocked'
    : callErrorCount > 0
      ? 'warning'
      : 'ready';

  return {
    callErrorCount,
    callSuccessCount,
    errorSamples: compactSamples(probeServer?.errorSamples),
    id: serverId,
    packagedProbeCallSuccessCount,
    status,
  };
}

function getOverallStatus(servers: SettingsMcpPackagedReadOnlyCoverageServer[]) {
  if (servers.length === 0 || servers.some((server) => server.status === 'blocked')) {
    return 'blocked' as const;
  }

  return servers.some((server) => server.status === 'warning') ? 'warning' as const : 'ready';
}

export function createSettingsMcpPackagedReadOnlyCoverageReview(
  report: SettingsMcpPackagedProductionReport,
  callReport?: SettingsMcpPackagedReadOnlyCallReport,
): SettingsMcpPackagedReadOnlyCoverageReview {
  const readyServerIds = stringArray(report.config?.readyServerIds);
  const reportServers = report.servers || [];
  const sameRunVerified = report.provenance?.sameRunVerified === true;
  const servers = readyServerIds.map((serverId) => createServerCoverage(
    serverId,
    findServer(reportServers, serverId),
    findProbeServer(callReport, serverId),
    sameRunVerified,
  ));
  const status = getOverallStatus(servers);
  const coveredServerCount = servers.filter((server) => server.status !== 'blocked').length;
  const totalCallSuccessCount = servers.reduce((sum, server) => sum + server.callSuccessCount, 0);
  const missingServerIds = servers
    .filter((server) => server.status === 'blocked')
    .map((server) => server.id);

  return {
    blockedCount: servers.filter((server) => server.status === 'blocked').length,
    coveredServerCount,
    generatedAt: new Date().toISOString(),
    kind: 'settings-mcp-packaged-read-only-coverage-review',
    missingServerIds,
    serverCount: servers.length,
    servers,
    status,
    summaryText: [
      `MCPPackagedReadOnlyCoverage status=${status}`,
      `covered=${coveredServerCount}/${servers.length}`,
      `calls=${totalCallSuccessCount}`,
    ].join(' '),
    totalCallSuccessCount,
    version: 1,
    warningCount: servers.filter((server) => server.status === 'warning').length,
  };
}
