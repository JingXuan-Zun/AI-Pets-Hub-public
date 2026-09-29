import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import {
  createSettingsMcpReadinessCandidateConsistency,
  type SettingsMcpReadinessCandidateConsistency,
} from './settingsMcpReadinessCandidateConsistency';

export type SettingsMcpPerServerSoakCommandReviewStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpPerServerSoakCommand {
  command: string;
  serverId: string;
}

export interface SettingsMcpPerServerSoakCommandReview {
  commandCount: number;
  commands: SettingsMcpPerServerSoakCommand[];
  commandsText: string;
  configPresent: boolean;
  consistency: SettingsMcpReadinessCandidateConsistency;
  nextAction: string;
  source: string;
  status: SettingsMcpPerServerSoakCommandReviewStatus;
  summaryText: string;
  supportsExternalSoakCollection: boolean;
}

function createCommandMap(summary: SettingsMcpSoakReadinessSummaryResult) {
  return new Map(
    summary.runbook.perServer
      .filter((item) => item.serverId && item.command)
      .map((item) => [item.serverId, item.command]),
  );
}

function collectReadyServerCommands(summary: SettingsMcpSoakReadinessSummaryResult) {
  const commandByServer = createCommandMap(summary);
  return summary.servers
    .filter((server) => server.readyForRealSoak)
    .map((server) => ({
      command: commandByServer.get(server.id) || '',
      serverId: server.id,
    }))
    .filter((item) => item.serverId && item.command);
}

function createCommandsText(commands: SettingsMcpPerServerSoakCommand[]) {
  return commands
    .map((item, index) => `${index + 1}. Run soak: ${item.serverId}\n${item.command}`)
    .join('\n\n');
}

function getStatus(options: {
  commandCount: number;
  configPresent: boolean;
  consistencyStatus: SettingsMcpReadinessCandidateConsistency['status'];
  source: string;
}) {
  if (!options.commandCount) {
    return 'blocked' as const;
  }

  if (options.consistencyStatus === 'blocked') {
    return 'blocked' as const;
  }

  if (options.consistencyStatus === 'warning') {
    return 'warning' as const;
  }

  if (options.source !== 'saved-config') {
    return 'warning' as const;
  }

  return options.configPresent ? 'ready' as const : 'blocked' as const;
}

function createNextAction(options: {
  commandCount: number;
  configPresent: boolean;
  consistency: SettingsMcpReadinessCandidateConsistency;
  source: string;
  status: SettingsMcpPerServerSoakCommandReviewStatus;
}) {
  if (!options.commandCount) {
    return 'Generate saved-config readiness with at least one ready server before collecting soak evidence.';
  }

  if (options.source !== 'saved-config') {
    return 'Draft readiness commands are preview-only; save config and regenerate saved-config readiness before use.';
  }

  if (!options.configPresent) {
    return 'Saved-config readiness did not prove a saved MCP config exists; save config and regenerate readiness.';
  }

  if (options.consistency.status !== 'ready') {
    return options.consistency.nextAction;
  }

  if (options.status === 'ready') {
    return 'Copy or export the per-server commands, run them outside Settings, then import the indexed soak summary.';
  }

  return 'Review readiness source before running per-server soak commands.';
}

function createBlockedReview(): SettingsMcpPerServerSoakCommandReview {
  const consistency = createSettingsMcpReadinessCandidateConsistency({
    configText: '',
    readinessSummary: null,
  });
  return {
    commandCount: 0,
    commands: [],
    commandsText: '',
    configPresent: false,
    consistency,
    nextAction: 'Generate saved-config readiness before per-server soak commands are available.',
    source: 'missing',
    status: 'blocked',
    summaryText: 'MCPPerServerSoakCommandReview status=blocked source=missing commands=0',
    supportsExternalSoakCollection: false,
  };
}

export function createSettingsMcpPerServerSoakCommandReview(
  summary: SettingsMcpSoakReadinessSummaryResult | null,
  configText = '',
): SettingsMcpPerServerSoakCommandReview {
  if (!summary) {
    return createBlockedReview();
  }

  const commands = collectReadyServerCommands(summary);
  const commandCount = commands.length;
  const source = summary.source || 'unknown';
  const configPresent = summary.configPresent;
  const consistency = createSettingsMcpReadinessCandidateConsistency({
    configText,
    readinessSummary: summary,
  });
  const status = getStatus({
    commandCount,
    configPresent,
    consistencyStatus: consistency.status,
    source,
  });
  const supportsExternalSoakCollection = status === 'ready';

  return {
    commandCount,
    commands,
    commandsText: createCommandsText(commands),
    configPresent,
    consistency,
    nextAction: createNextAction({ commandCount, configPresent, consistency, source, status }),
    source,
    status,
    summaryText: [
      `MCPPerServerSoakCommandReview status=${status}`,
      `source=${source}`,
      `commands=${commandCount}`,
      `candidateConsistency=${consistency.status}`,
      `externalSoak=${supportsExternalSoakCollection}`,
    ].join(' '),
    supportsExternalSoakCollection,
  };
}

export function createSettingsMcpPerServerSoakCommandReviewExportName(
  review: SettingsMcpPerServerSoakCommandReview,
) {
  return `mcp-per-server-soak-commands-${review.status}-${review.source}-${review.commandCount}.json`;
}

export function formatSettingsMcpPerServerSoakCommandReviewExportText(
  review: SettingsMcpPerServerSoakCommandReview,
  exportedAt = new Date().toISOString(),
) {
  return `${JSON.stringify({
    exportedAt,
    kind: 'mcp-per-server-soak-command-review-settings-export',
    review,
    version: 1,
  }, null, 2)}\n`;
}
