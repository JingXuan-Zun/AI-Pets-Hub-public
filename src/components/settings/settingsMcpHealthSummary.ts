import { type SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';

export type SettingsMcpServerHealthStatus = 'error' | 'ok' | 'pending' | 'warning';

export interface SettingsMcpServerHealthSummary {
  commandHint: string;
  diagnostics: string[];
  error: string | null;
  lastRefreshLabel: string;
  server: SettingsMcpServerDraft;
  status: SettingsMcpServerHealthStatus;
  statusLabel: string;
  toolCount: number;
}

export interface SettingsMcpServerCheckState {
  commandPathExists?: boolean | null;
  compatibilityIssueCode?: NonNullable<DesktopPetMcpServerDiagnosticLike['compatibility']>['issueCode'];
  compatibilityNextAction?: string | null;
  compatibilityStatus?: NonNullable<DesktopPetMcpServerDiagnosticLike['compatibility']>['status'];
  compatibilitySummary?: string | null;
  cwdExists?: boolean | null;
  durationMs?: number | null;
  error?: string | null;
  lastCheckedAt?: number | null;
  stderrSnippet?: string | null;
  timeoutMs?: number | null;
  toolCount?: number | null;
}

export type SettingsMcpServerRuntimeHealth = Pick<
  DesktopPetMcpServerHealthLike,
  | 'consecutiveFailures'
  | 'lastError'
  | 'lastFailureAt'
  | 'lastOkAt'
  | 'lastRecoveryAt'
  | 'nextRetryAt'
  | 'serverId'
  | 'status'
>;

export interface CreateSettingsMcpHealthSummaryOptions {
  checksByServerId?: Record<string, SettingsMcpServerCheckState | undefined>;
  lastError?: string | null;
  lastRefreshAt?: number | null;
  serverHealthById?: Record<string, SettingsMcpServerRuntimeHealth | undefined>;
  servers: SettingsMcpServerDraft[];
  tools: DesktopPetMcpToolLike[];
}

function createRefreshLabel(lastRefreshAt?: number | null) {
  if (!lastRefreshAt) {
    return 'not refreshed';
  }

  return new Date(lastRefreshAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function createCommandHint(server: SettingsMcpServerDraft) {
  if (!server.command.trim()) {
    return 'missing command';
  }

  const argCount = server.argsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .length;
  const cwdHint = server.cwd.trim() ? 'custom cwd' : 'project cwd';
  return `${server.command.trim()} (${argCount} args, ${cwdHint})`;
}

function hasInvalidEnv(server: SettingsMcpServerDraft) {
  try {
    const parsed = JSON.parse(server.envJson || '{}') as unknown;
    return !parsed || typeof parsed !== 'object' || Array.isArray(parsed);
  } catch {
    return true;
  }
}

function resolveServerStatus(options: {
  commandMissing: boolean;
  hasRefreshError: boolean;
  invalidEnv: boolean;
  refreshed: boolean;
  toolCount: number;
}): SettingsMcpServerHealthStatus {
  if (options.commandMissing || options.invalidEnv || options.hasRefreshError) {
    return 'error';
  }

  if (!options.refreshed) {
    return 'pending';
  }

  return options.toolCount > 0 ? 'ok' : 'warning';
}

function createStatusLabel(status: SettingsMcpServerHealthStatus) {
  switch (status) {
    case 'ok':
      return 'ok';
    case 'warning':
      return 'no tools';
    case 'error':
      return 'error';
    default:
      return 'pending';
  }
}

function createServerError(options: {
  commandMissing: boolean;
  invalidEnv: boolean;
  lastError?: string | null;
}) {
  if (options.commandMissing) {
    return 'Command is required before this server can be tested.';
  }

  if (options.invalidEnv) {
    return 'Environment JSON must be an object.';
  }

  return options.lastError?.trim() || null;
}

function createDiagnostics(check: SettingsMcpServerCheckState | null) {
  if (!check) {
    return [];
  }

  const diagnostics: string[] = [];
  if (typeof check.durationMs === 'number') {
    diagnostics.push(`${check.durationMs}ms`);
  }
  if (typeof check.timeoutMs === 'number' && check.timeoutMs > 0) {
    diagnostics.push(`timeout ${check.timeoutMs}ms`);
  }
  if (check.cwdExists === false) {
    diagnostics.push('cwd missing');
  }
  if (check.commandPathExists === false) {
    diagnostics.push('command path missing');
  }
  if (check.compatibilityIssueCode && check.compatibilityIssueCode !== 'ready') {
    diagnostics.push(`compatibility: ${check.compatibilityIssueCode}`);
  }
  if (check.compatibilitySummary?.trim()) {
    diagnostics.push(check.compatibilitySummary.trim());
  }
  if (check.compatibilityNextAction?.trim() && check.compatibilityIssueCode !== 'ready') {
    diagnostics.push(`next: ${check.compatibilityNextAction.trim()}`);
  }
  if (check.stderrSnippet?.trim()) {
    diagnostics.push(`stderr: ${check.stderrSnippet.trim()}`);
  }

  return diagnostics;
}

function createRuntimeHealthDiagnostics(health: SettingsMcpServerRuntimeHealth | null) {
  if (!health || health.status === 'unknown') {
    return [];
  }

  const diagnostics = [`runtime ${health.status}`];
  if (health.consecutiveFailures > 0) {
    diagnostics.push(`${health.consecutiveFailures} failure(s)`);
  }
  if (health.nextRetryAt && health.nextRetryAt > Date.now()) {
    diagnostics.push(`retry ${Math.ceil((health.nextRetryAt - Date.now()) / 1000)}s`);
  }
  if (health.lastRecoveryAt) {
    diagnostics.push('recovered');
  }

  return diagnostics;
}

function getServerCheck(
  checksByServerId: Record<string, SettingsMcpServerCheckState | undefined> | undefined,
  serverId: string,
) {
  return serverId ? checksByServerId?.[serverId] ?? null : null;
}

function getServerRuntimeHealth(
  healthByServerId: Record<string, SettingsMcpServerRuntimeHealth | undefined> | undefined,
  serverId: string,
) {
  return serverId ? healthByServerId?.[serverId] ?? null : null;
}

export function createSettingsMcpHealthSummaries(
  options: CreateSettingsMcpHealthSummaryOptions,
): SettingsMcpServerHealthSummary[] {
  const toolCountByServer = new Map<string, number>();
  for (const tool of options.tools) {
    toolCountByServer.set(tool.serverId, (toolCountByServer.get(tool.serverId) ?? 0) + 1);
  }

  const refreshed = Boolean(options.lastRefreshAt);
  const lastRefreshLabel = createRefreshLabel(options.lastRefreshAt);
  return options.servers.map((server) => {
    const check = getServerCheck(options.checksByServerId, server.id);
    const runtimeHealth = getServerRuntimeHealth(options.serverHealthById, server.id);
    const commandMissing = !server.command.trim();
    const invalidEnv = hasInvalidEnv(server);
    const toolCount = check?.toolCount ?? toolCountByServer.get(server.id) ?? 0;
    const runtimeError = runtimeHealth?.status === 'unhealthy' ? runtimeHealth.lastError ?? null : null;
    const lastError = check ? check.error ?? runtimeError : runtimeError ?? options.lastError;
    const checkedAt = check?.lastCheckedAt ?? options.lastRefreshAt;
    const status = resolveServerStatus({
      commandMissing,
      hasRefreshError: Boolean(lastError),
      invalidEnv,
      refreshed: refreshed || Boolean(check?.lastCheckedAt),
      toolCount,
    });

    return {
      commandHint: createCommandHint(server),
      diagnostics: [...createDiagnostics(check), ...createRuntimeHealthDiagnostics(runtimeHealth)],
      error: createServerError({ commandMissing, invalidEnv, lastError }),
      lastRefreshLabel: createRefreshLabel(checkedAt),
      server,
      status,
      statusLabel: createStatusLabel(status),
      toolCount,
    };
  });
}
