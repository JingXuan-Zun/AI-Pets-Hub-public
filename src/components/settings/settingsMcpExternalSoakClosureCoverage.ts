import { createSettingsMcpExternalSoakClosureState } from './settingsMcpExternalSoakClosureState';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakServerSummary, SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

export type SettingsMcpExternalSoakClosureCoverageStatus = 'blocked' | 'covered' | 'missing' | 'warning';

export interface SettingsMcpExternalSoakClosureCoverageStep {
  command: string;
  detail: string;
  id: 'import-summary' | 'index-reports' | 'run-missing-soak';
  label: string;
  status: 'blocked' | 'copy-ready' | 'manual' | 'ready' | 'warning';
}

export interface SettingsMcpExternalSoakClosureServerCoverage {
  actionDetail: string;
  actionLabel: string;
  detail: string;
  roundCount: number;
  serverId: string;
  soakCommand: string;
  soakStatus: SettingsMcpSoakServerSummary['status'] | 'missing';
  status: SettingsMcpExternalSoakClosureCoverageStatus;
}

export interface SettingsMcpExternalSoakClosureCoverage {
  closureSteps: SettingsMcpExternalSoakClosureCoverageStep[];
  coveredCount: number;
  detail: string;
  missingCommandCount: number;
  missingCommandsText: string;
  rows: SettingsMcpExternalSoakClosureServerCoverage[];
  status: SettingsMcpExternalSoakClosureCoverageStatus;
  summaryText: string;
  totalReadyServers: number;
}

function createSoakServerMap(soakSummary: SettingsMcpSoakSummaryResult | null) {
  return new Map((soakSummary?.servers ?? [])
    .filter((server) => server.id)
    .map((server) => [server.id, server]));
}

function createCoverageRow(
  serverId: string,
  soakServer: SettingsMcpSoakServerSummary | undefined,
  soakCommand: string,
): SettingsMcpExternalSoakClosureServerCoverage {
  if (!soakServer) {
    return {
      actionDetail: soakCommand
        ? 'Run this ready-server soak command, then import or index the generated report.'
        : 'Regenerate readiness runbook to get a per-server soak command for this ready server.',
      actionLabel: soakCommand ? 'Run ready-server soak' : 'Regenerate readiness runbook',
      detail: 'No imported soak summary row matches this ready server.',
      roundCount: 0,
      serverId,
      soakCommand,
      soakStatus: 'missing',
      status: 'missing',
    };
  }

  const actionLabel = soakServer.status === 'healthy' ? 'No action needed' : 'Review degraded soak row';
  return {
    actionDetail: soakServer.status === 'healthy'
      ? 'Imported soak evidence is healthy for this ready server.'
      : 'Re-run diagnostics or soak after reviewing failures, restarts, empty tools, or drift.',
    actionLabel,
    detail: `${soakServer.roundCount} round(s), ${soakServer.failureCount} failure(s), ${soakServer.restartEventCount} restart event(s).`,
    roundCount: soakServer.roundCount,
    serverId,
    soakCommand,
    soakStatus: soakServer.status,
    status: soakServer.status === 'healthy' ? 'covered' : 'warning',
  };
}

function createRunbookCommandMap(readinessSummary: SettingsMcpSoakReadinessSummaryResult | null) {
  return new Map((readinessSummary?.runbook.perServer ?? [])
    .filter((item) => item.serverId && item.command)
    .map((item) => [item.serverId, item.command]));
}

function getIndexReportsCommand(readinessSummary: SettingsMcpSoakReadinessSummaryResult | null) {
  return readinessSummary?.runbook.indexReports ?? '';
}

function getCoverageStatus(rows: SettingsMcpExternalSoakClosureServerCoverage[]) {
  if (rows.length === 0) {
    return 'blocked' as const;
  }

  if (rows.some((row) => row.status === 'missing')) {
    return 'missing' as const;
  }

  if (rows.some((row) => row.status === 'warning')) {
    return 'warning' as const;
  }

  return 'covered' as const;
}

function createDetail(status: SettingsMcpExternalSoakClosureCoverageStatus, coveredCount: number, total: number) {
  if (status === 'blocked') {
    return 'No ready external server candidates are available for coverage matching.';
  }

  if (status === 'covered') {
    return `${coveredCount}/${total} ready server(s) have healthy imported soak evidence.`;
  }

  if (status === 'warning') {
    return `${coveredCount}/${total} ready server(s) are healthy; review degraded imported soak rows.`;
  }

  return `${coveredCount}/${total} ready server(s) have healthy imported soak evidence; some are missing.`;
}

export function createSettingsMcpExternalSoakClosureMissingCommandsText(
  rows: SettingsMcpExternalSoakClosureServerCoverage[],
  indexReportsCommand = '',
) {
  const runCommandsText = rows
    .filter((row) => row.status === 'missing' && row.soakCommand)
    .map((row, index) => `${index + 1}. Run soak: ${row.serverId}\n${row.soakCommand}`)
    .join('\n\n');
  const indexText = indexReportsCommand ? `Index reports\n${indexReportsCommand}` : '';

  return [runCommandsText, indexText].filter(Boolean).join('\n\n');
}

function createClosureSteps(options: {
  hasSoakSummary: boolean;
  indexReportsCommand: string;
  importSummaryStatus: SettingsMcpExternalSoakClosureCoverageStep['status'];
  missingCommandCount: number;
  missingCommandsText: string;
  status: SettingsMcpExternalSoakClosureCoverageStatus;
}): SettingsMcpExternalSoakClosureCoverageStep[] {
  const runMissingStatus = options.missingCommandCount
    ? 'copy-ready'
    : options.status === 'covered' || options.status === 'warning' ? 'ready' : 'blocked';
  const indexReportsStatus = options.hasSoakSummary
    ? 'ready'
    : options.indexReportsCommand ? 'copy-ready' : 'blocked';

  return [{
    command: options.missingCommandsText,
    detail: options.missingCommandCount
      ? `${options.missingCommandCount} missing ready-server soak command(s) can be copied.`
      : options.hasSoakSummary
        ? 'Imported soak evidence exists; no missing ready-server soak command is available.'
        : 'No missing ready-server soak command is available.',
    id: 'run-missing-soak',
    label: 'Run missing soak',
    status: runMissingStatus,
  }, {
    command: options.indexReportsCommand,
    detail: options.hasSoakSummary
      ? 'Imported soak summary is already present in Settings.'
      : options.indexReportsCommand
      ? 'Copy the index command after generated soak reports exist.'
      : 'Generate readiness runbook with an index command before indexing reports.',
    id: 'index-reports',
    label: 'Index reports',
    status: indexReportsStatus,
  }, {
    command: '',
    detail: options.importSummaryStatus === 'ready'
      ? 'Imported soak summary is already present in Settings.'
      : options.importSummaryStatus === 'warning'
        ? 'Imported soak summary is present but needs review before estimate changes.'
        : 'Import the generated soak summary in Settings after reports are indexed.',
    id: 'import-summary',
    label: 'Import summary',
    status: options.importSummaryStatus,
  }];
}

export function createSettingsMcpExternalSoakClosureCoverage(options: {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpExternalSoakClosureCoverage {
  const readyServerIds = (options.readinessSummary?.servers ?? [])
    .filter((server) => server.readyForRealSoak && server.id)
    .map((server) => server.id);
  const soakServerMap = createSoakServerMap(options.soakSummary);
  const commandMap = createRunbookCommandMap(options.readinessSummary);
  const indexReportsCommand = getIndexReportsCommand(options.readinessSummary);
  const rows = readyServerIds.map((serverId) => createCoverageRow(
    serverId,
    soakServerMap.get(serverId),
    commandMap.get(serverId) ?? '',
  ));
  const coveredCount = rows.filter((row) => row.status === 'covered').length;
  const missingCommandCount = rows.filter((row) => row.status === 'missing' && row.soakCommand).length;
  const missingCommandsText = createSettingsMcpExternalSoakClosureMissingCommandsText(rows, indexReportsCommand);
  const status = getCoverageStatus(rows);
  const closureState = createSettingsMcpExternalSoakClosureState(options);
  const importSummaryStatus = closureState.importSoak.status === 'ready'
    || closureState.importSoak.status === 'warning'
    ? closureState.importSoak.status
    : status === 'missing' ? 'manual' : 'blocked';

  return {
    closureSteps: createClosureSteps({
      hasSoakSummary: Boolean(options.soakSummary),
      importSummaryStatus,
      indexReportsCommand,
      missingCommandCount,
      missingCommandsText,
      status,
    }),
    coveredCount,
    detail: createDetail(status, coveredCount, rows.length),
    missingCommandCount,
    missingCommandsText,
    rows,
    status,
    summaryText: `MCPExternalSoakCoverage status=${status} covered=${coveredCount}/${rows.length}`,
    totalReadyServers: rows.length,
  };
}
