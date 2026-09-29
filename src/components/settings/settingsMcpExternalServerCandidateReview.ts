import { parseMcpConfigText, type SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import { createSettingsMcpServerDraftPreflight } from './settingsMcpServerDraftPreflight';
import {
  isSettingsMcpFixtureServer,
  isSettingsMcpReferenceServer,
} from './settingsMcpServerStaticClassification';

export type SettingsMcpExternalServerCandidateStatus =
  | 'blocked'
  | 'candidate'
  | 'fixture'
  | 'reference'
  | 'template';

export interface SettingsMcpExternalServerCandidate {
  command: string;
  detail: string;
  id: string;
  status: SettingsMcpExternalServerCandidateStatus;
  title: string;
}

export interface SettingsMcpExternalServerCandidateReview {
  candidateCount: number;
  nextAction: string;
  parseError: string;
  rows: SettingsMcpExternalServerCandidate[];
  serverCount: number;
  status: 'blocked' | 'ready' | 'warning';
  summaryText: string;
}

function formatCommand(server: SettingsMcpServerDraft) {
  const args = server.argsText.split(/\r?\n/u).map((item) => item.trim()).filter(Boolean);
  return [server.command.trim(), ...args].filter(Boolean).join(' ');
}

function firstDraftIssue(server: SettingsMcpServerDraft) {
  const preflight = createSettingsMcpServerDraftPreflight(server);
  return {
    issue: preflight.checks.find((check) => check.status === preflight.status),
    status: preflight.status,
  };
}

function createCandidateRow(server: SettingsMcpServerDraft): SettingsMcpExternalServerCandidate {
  const { issue, status } = firstDraftIssue(server);
  if (status === 'blocked') {
    const templateStatus = issue?.id === 'placeholder-values' ? 'template' : 'blocked';
    return {
      command: formatCommand(server),
      detail: issue?.detail || 'Fix blocked server checks before saved-config readiness.',
      id: server.id || 'unknown-server',
      status: templateStatus,
      title: server.title || server.id || 'Unknown server',
    };
  }

  if (isSettingsMcpFixtureServer(server)) {
    return {
      command: formatCommand(server),
      detail: 'Fixture servers prove smoke behavior only and do not count as external MCP soak candidates.',
      id: server.id,
      status: 'fixture',
      title: server.title || server.id,
    };
  }

  if (isSettingsMcpReferenceServer(server)) {
    return {
      command: formatCommand(server),
      detail: 'Reference servers prove the local pipeline only and do not count as external MCP soak candidates.',
      id: server.id,
      status: 'reference',
      title: server.title || server.id,
    };
  }

  return {
    command: formatCommand(server),
    detail: status === 'ready'
      ? 'Static checks pass; save config and generate saved-config readiness to prove this candidate.'
      : issue?.detail || 'Static checks have warnings; saved-config readiness and real soak still required.',
    id: server.id,
    status: 'candidate',
    title: server.title || server.id,
  };
}

function getReviewStatus(rows: SettingsMcpExternalServerCandidate[], parseError: string) {
  if (parseError || rows.some((row) => row.status === 'blocked' || row.status === 'template')) {
    return 'blocked' as const;
  }

  return rows.some((row) => row.status === 'candidate') ? 'ready' as const : 'warning' as const;
}

function createNextAction(options: {
  candidateCount: number;
  parseError: string;
  serverCount: number;
  status: 'blocked' | 'ready' | 'warning';
}) {
  if (options.parseError) {
    return options.parseError;
  }

  if (!options.serverCount) {
    return 'Add at least one real external MCP server before saved-config readiness.';
  }

  if (options.status === 'blocked') {
    return 'Fix blocked/template server rows before treating the config as a real-server candidate list.';
  }

  if (!options.candidateCount) {
    return 'Replace fixture/reference servers with a real third-party or external MCP server.';
  }

  return 'Save this config, generate saved-config readiness, then review per-server soak commands.';
}

export function createSettingsMcpExternalServerCandidateReview(
  configText: string,
): SettingsMcpExternalServerCandidateReview {
  const parsed = parseMcpConfigText(configText);
  const rows = parsed.error ? [] : parsed.servers.map(createCandidateRow);
  const candidateCount = rows.filter((row) => row.status === 'candidate').length;
  const parseError = parsed.error || '';
  const serverCount = parsed.servers.length;
  const status = getReviewStatus(rows, parseError);

  return {
    candidateCount,
    nextAction: createNextAction({ candidateCount, parseError, serverCount, status }),
    parseError,
    rows,
    serverCount,
    status,
    summaryText: `MCPExternalServerCandidateReview status=${status} candidates=${candidateCount}/${serverCount}`,
  };
}
