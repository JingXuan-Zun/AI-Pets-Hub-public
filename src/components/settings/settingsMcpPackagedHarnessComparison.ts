import type {
  SettingsMcpPackagedReadOnlyCallReport,
  SettingsMcpPackagedReadOnlyCallReportServer,
} from './settingsMcpPackagedReadOnlyCoverage';
import type { SettingsMcpPackagedProductionStatus } from './settingsMcpPackagedProductionEvidenceTypes';

export interface SettingsMcpPackagedHarnessComparisonServer {
  harnessCallSuccessCount: number;
  harnessListSuccessCount: number;
  id: string;
  packagedCallSuccessCount: number;
  packagedListSuccessCount: number;
  status: SettingsMcpPackagedProductionStatus;
}

export interface SettingsMcpPackagedHarnessComparison {
  conclusion: string;
  generatedAt: string;
  harnessCoveredServerCount: number;
  kind: 'settings-mcp-packaged-harness-comparison';
  packagedCoveredServerCount: number;
  serverCount: number;
  servers: SettingsMcpPackagedHarnessComparisonServer[];
  status: SettingsMcpPackagedProductionStatus;
  summaryText: string;
  version: 1;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getServerIds(
  packagedReport: SettingsMcpPackagedReadOnlyCallReport,
  harnessReport: SettingsMcpPackagedReadOnlyCallReport,
) {
  return [...new Set([
    ...(packagedReport.servers || []).map((server) => server.id),
    ...(harnessReport.servers || []).map((server) => server.id),
  ].filter(Boolean))];
}

function findServer(
  report: SettingsMcpPackagedReadOnlyCallReport,
  serverId: string,
): SettingsMcpPackagedReadOnlyCallReportServer | undefined {
  return (report.servers || []).find((server) => server.id === serverId);
}

function hasReadOnlyCoverage(server: SettingsMcpPackagedReadOnlyCallReportServer | undefined) {
  return numberValue(server?.optionalCallSuccessCount) > 0;
}

function createServerComparison(
  serverId: string,
  packagedServer: SettingsMcpPackagedReadOnlyCallReportServer | undefined,
  harnessServer: SettingsMcpPackagedReadOnlyCallReportServer | undefined,
): SettingsMcpPackagedHarnessComparisonServer {
  const packagedCallSuccessCount = numberValue(packagedServer?.optionalCallSuccessCount);
  const harnessCallSuccessCount = numberValue(harnessServer?.optionalCallSuccessCount);
  const status = harnessCallSuccessCount > 0 && packagedCallSuccessCount <= 0
    ? 'warning'
    : packagedCallSuccessCount > 0
      ? 'ready'
      : 'blocked';

  return {
    harnessCallSuccessCount,
    harnessListSuccessCount: numberValue(harnessServer?.listSuccessCount),
    id: serverId,
    packagedCallSuccessCount,
    packagedListSuccessCount: numberValue(packagedServer?.listSuccessCount),
    status,
  };
}

function createConclusion(options: {
  harnessCoveredServerCount: number;
  packagedCoveredServerCount: number;
  serverCount: number;
}) {
  if (options.serverCount === 0) {
    return 'No comparable packaged or harness servers were found.';
  }

  if (
    options.packagedCoveredServerCount === 0
    && options.harnessCoveredServerCount === options.serverCount
  ) {
    return 'Harness coverage succeeds while official packaged coverage is blocked; remaining risk is likely exe/Electron packaged launch behavior rather than MCP config/module behavior.';
  }

  if (options.packagedCoveredServerCount === options.serverCount) {
    return 'Official packaged read-only coverage is complete.';
  }

  return 'Packaged and harness coverage are mixed; inspect per-server differences before changing MCP foundation confidence.';
}

function getStatus(options: {
  harnessCoveredServerCount: number;
  packagedCoveredServerCount: number;
  serverCount: number;
}) {
  if (options.serverCount === 0 || options.packagedCoveredServerCount === 0) {
    return 'blocked' as const;
  }

  return options.packagedCoveredServerCount === options.serverCount ? 'ready' as const : 'warning' as const;
}

export function createSettingsMcpPackagedHarnessComparison(
  packagedReport: SettingsMcpPackagedReadOnlyCallReport,
  harnessReport: SettingsMcpPackagedReadOnlyCallReport,
): SettingsMcpPackagedHarnessComparison {
  const serverIds = getServerIds(packagedReport, harnessReport);
  const servers = serverIds.map((serverId) => createServerComparison(
    serverId,
    findServer(packagedReport, serverId),
    findServer(harnessReport, serverId),
  ));
  const packagedCoveredServerCount = serverIds
    .filter((serverId) => hasReadOnlyCoverage(findServer(packagedReport, serverId)))
    .length;
  const harnessCoveredServerCount = serverIds
    .filter((serverId) => hasReadOnlyCoverage(findServer(harnessReport, serverId)))
    .length;
  const status = getStatus({
    harnessCoveredServerCount,
    packagedCoveredServerCount,
    serverCount: serverIds.length,
  });

  return {
    conclusion: createConclusion({
      harnessCoveredServerCount,
      packagedCoveredServerCount,
      serverCount: serverIds.length,
    }),
    generatedAt: new Date().toISOString(),
    harnessCoveredServerCount,
    kind: 'settings-mcp-packaged-harness-comparison',
    packagedCoveredServerCount,
    serverCount: serverIds.length,
    servers,
    status,
    summaryText: [
      `MCPPackagedHarnessComparison status=${status}`,
      `packaged=${packagedCoveredServerCount}/${serverIds.length}`,
      `harness=${harnessCoveredServerCount}/${serverIds.length}`,
    ].join(' '),
    version: 1,
  };
}
