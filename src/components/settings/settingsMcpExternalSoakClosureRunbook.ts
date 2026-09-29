import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

export type SettingsMcpExternalSoakClosureRunbookStatus = 'blocked' | 'ready' | 'todo';

export interface SettingsMcpExternalSoakClosureRunbookCommand {
  command: string;
  id: string;
  label: string;
}

export interface SettingsMcpExternalSoakClosureRunbook {
  commands: SettingsMcpExternalSoakClosureRunbookCommand[];
  detail: string;
  status: SettingsMcpExternalSoakClosureRunbookStatus;
  summaryText: string;
}

function createBlockedRunbook(detail: string): SettingsMcpExternalSoakClosureRunbook {
  return {
    commands: [],
    detail,
    status: 'blocked',
    summaryText: 'MCPExternalSoakClosureRunbook status=blocked commands=0',
  };
}

function createPerServerCommands(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult,
): SettingsMcpExternalSoakClosureRunbookCommand[] {
  return readinessSummary.runbook.perServer
    .filter((item) => item.serverId && item.command)
    .map((item) => ({
      command: item.command,
      id: `soak-${item.serverId}`,
      label: `Run soak: ${item.serverId}`,
    }));
}

function createIndexCommand(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult,
): SettingsMcpExternalSoakClosureRunbookCommand[] {
  return readinessSummary.runbook.indexReports ? [{
    command: readinessSummary.runbook.indexReports,
    id: 'index-reports',
    label: 'Index reports',
  }] : [];
}

export function createSettingsMcpExternalSoakClosureRunbook(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpExternalSoakClosureRunbook {
  if (!readinessSummary) {
    return createBlockedRunbook('Generate or import readiness before closure runbook commands are available.');
  }

  if (readinessSummary.totals.readyServers <= 0) {
    return createBlockedRunbook('Readiness has no ready external server candidates.');
  }

  const commands = [
    ...createPerServerCommands(readinessSummary),
    ...createIndexCommand(readinessSummary),
  ];
  return {
    commands,
    detail: `${readinessSummary.totals.readyServers} ready server(s), ${commands.length} closure command(s).`,
    status: commands.length > 0 ? 'ready' : 'todo',
    summaryText: `MCPExternalSoakClosureRunbook status=${commands.length > 0 ? 'ready' : 'todo'} commands=${commands.length}`,
  };
}

export function formatSettingsMcpExternalSoakClosureRunbookText(
  runbook: SettingsMcpExternalSoakClosureRunbook,
) {
  return runbook.commands
    .map((item, index) => `${index + 1}. ${item.label}\n${item.command}`)
    .join('\n\n');
}
