import {
  parseMcpConfigText,
  type SettingsMcpServerDraft,
} from './settingsMcpConfigFormUtils';
import { createSettingsMcpServerDraftPreflight } from './settingsMcpServerDraftPreflight';
import {
  isSettingsMcpFixtureServer,
  isSettingsMcpReferenceServer,
} from './settingsMcpServerStaticClassification';

export type SettingsMcpConfigPreflightStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpConfigPreflightCheck {
  detail: string;
  id: string;
  label: string;
  status: SettingsMcpConfigPreflightStatus;
}

export interface SettingsMcpConfigPreflightStatusCounts {
  blocked: number;
  ready: number;
  warning: number;
}

export interface SettingsMcpConfigPreflightResult {
  checks: SettingsMcpConfigPreflightCheck[];
  serverCount: number;
  status: SettingsMcpConfigPreflightStatus;
  statusCounts: SettingsMcpConfigPreflightStatusCounts;
  summaryText: string;
}

function addCheck(
  checks: SettingsMcpConfigPreflightCheck[],
  check: SettingsMcpConfigPreflightCheck,
) {
  checks.push(check);
}

function addParseChecks(checks: SettingsMcpConfigPreflightCheck[], rawText: string) {
  const parsed = parseMcpConfigText(rawText);
  if (parsed.error) {
    addCheck(checks, {
      detail: parsed.error,
      id: 'config-json',
      label: 'Config JSON',
      status: 'blocked',
    });
  }

  return parsed;
}

function addServerCountCheck(
  checks: SettingsMcpConfigPreflightCheck[],
  servers: SettingsMcpServerDraft[],
) {
  addCheck(checks, servers.length ? {
    detail: `${servers.length} server draft(s) found.`,
    id: 'server-count',
    label: 'Server count',
    status: 'ready',
  } : {
    detail: 'Add at least one MCP server before readiness or soak.',
    id: 'server-count',
    label: 'Server count',
    status: 'blocked',
  });
}

function addDuplicateIdChecks(
  checks: SettingsMcpConfigPreflightCheck[],
  servers: SettingsMcpServerDraft[],
) {
  const seen = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const server of servers) {
    const id = server.id.trim();
    if (!id) {
      continue;
    }
    if (seen.has(id)) {
      duplicateIds.add(id);
    }
    seen.add(id);
  }
  for (const id of duplicateIds) {
    addCheck(checks, {
      detail: `Server id ${id} appears more than once.`,
      id: `duplicate-${id}`,
      label: 'Duplicate id',
      status: 'blocked',
    });
  }
}

function addServerDraftChecks(
  checks: SettingsMcpConfigPreflightCheck[],
  servers: SettingsMcpServerDraft[],
) {
  for (const server of servers) {
    const preflight = createSettingsMcpServerDraftPreflight(server);
    if (preflight.status === 'ready') {
      continue;
    }

    const firstIssue = preflight.checks.find((check) => check.status === preflight.status);
    addCheck(checks, {
      detail: firstIssue?.detail || 'Server draft needs review.',
      id: `server-${server.id || 'unknown'}-${preflight.status}`,
      label: `${server.id || 'unknown server'} draft`,
      status: preflight.status,
    });
  }
}

function addFixtureChecks(
  checks: SettingsMcpConfigPreflightCheck[],
  servers: SettingsMcpServerDraft[],
) {
  for (const server of servers) {
    if (isSettingsMcpFixtureServer(server)) {
      addCheck(checks, {
        detail: 'Fixture servers are useful for smoke tests but not real external soak evidence.',
        id: `fixture-${server.id || 'unknown'}`,
        label: `${server.id || 'unknown server'} fixture`,
        status: 'warning',
      });
    }
  }
}

function addReferenceServerChecks(
  checks: SettingsMcpConfigPreflightCheck[],
  servers: SettingsMcpServerDraft[],
) {
  for (const server of servers) {
    if (isSettingsMcpReferenceServer(server)) {
      addCheck(checks, {
        detail: 'Reference servers validate the local pipeline but not real external soak evidence.',
        id: `reference-${server.id || 'unknown'}`,
        label: `${server.id || 'unknown server'} reference`,
        status: 'warning',
      });
    }
  }
}

function getOverallStatus(checks: SettingsMcpConfigPreflightCheck[]) {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked';
  }

  return checks.some((check) => check.status === 'warning') ? 'warning' : 'ready';
}

function createStatusCounts(
  checks: SettingsMcpConfigPreflightCheck[],
): SettingsMcpConfigPreflightStatusCounts {
  return checks.reduce<SettingsMcpConfigPreflightStatusCounts>(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1,
    }),
    { blocked: 0, ready: 0, warning: 0 },
  );
}

export function createSettingsMcpConfigPreflight(rawText: string): SettingsMcpConfigPreflightResult {
  const checks: SettingsMcpConfigPreflightCheck[] = [];
  const parsed = addParseChecks(checks, rawText);
  addServerCountCheck(checks, parsed.servers);
  if (!parsed.error) {
    addDuplicateIdChecks(checks, parsed.servers);
    addServerDraftChecks(checks, parsed.servers);
    addFixtureChecks(checks, parsed.servers);
    addReferenceServerChecks(checks, parsed.servers);
  }
  const status = getOverallStatus(checks);
  const statusCounts = createStatusCounts(checks);
  return {
    checks,
    serverCount: parsed.servers.length,
    status,
    statusCounts,
    summaryText: [
      `MCPConfigPreflight status=${status}`,
      `servers=${parsed.servers.length}`,
      `checks=${checks.length}`,
      `blocked=${statusCounts.blocked}`,
      `warning=${statusCounts.warning}`,
      `ready=${statusCounts.ready}`,
    ].join(' '),
  };
}
