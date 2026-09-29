import type { SettingsMcpServerDraft } from './settingsMcpConfigFormUtils';
import { hasSettingsMcpServerPlaceholderValues } from './settingsMcpServerStaticClassification';

export type SettingsMcpServerDraftPreflightStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpServerDraftPreflightCheck {
  detail: string;
  id: string;
  label: string;
  status: SettingsMcpServerDraftPreflightStatus;
}

export interface SettingsMcpServerDraftPreflightResult {
  checks: SettingsMcpServerDraftPreflightCheck[];
  status: SettingsMcpServerDraftPreflightStatus;
  summaryText: string;
}

export interface SettingsMcpServerDraftApplyGate {
  canApply: boolean;
  message: string;
}

function splitArgs(argsText: string) {
  return argsText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

function addCheck(
  checks: SettingsMcpServerDraftPreflightCheck[],
  check: SettingsMcpServerDraftPreflightCheck,
) {
  checks.push(check);
}

function addRequiredChecks(checks: SettingsMcpServerDraftPreflightCheck[], draft: SettingsMcpServerDraft) {
  addCheck(checks, draft.id.trim() ? {
    detail: 'Server id is present.',
    id: 'server-id',
    label: 'Server id',
    status: 'ready',
  } : {
    detail: 'Add a stable id before applying or saving this server.',
    id: 'server-id',
    label: 'Server id',
    status: 'blocked',
  });
  addCheck(checks, draft.command.trim() ? {
    detail: 'Launch command is present.',
    id: 'command',
    label: 'Command',
    status: 'ready',
  } : {
    detail: 'Add a real command such as node, python, npx.cmd, or an executable path.',
    id: 'command',
    label: 'Command',
    status: 'blocked',
  });
}

function addEnvJsonCheck(checks: SettingsMcpServerDraftPreflightCheck[], envJson: string) {
  try {
    const parsed = JSON.parse(envJson.trim() || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('env JSON must be an object.');
    }
    addCheck(checks, {
      detail: 'Environment JSON can be parsed as an object.',
      id: 'env-json',
      label: 'Environment JSON',
      status: 'ready',
    });
  } catch (error) {
    addCheck(checks, {
      detail: error instanceof Error ? error.message : 'Environment JSON is invalid.',
      id: 'env-json',
      label: 'Environment JSON',
      status: 'blocked',
    });
  }
}

function addPlaceholderCheck(checks: SettingsMcpServerDraftPreflightCheck[], draft: SettingsMcpServerDraft) {
  if (hasSettingsMcpServerPlaceholderValues(draft)) {
    addCheck(checks, {
      detail: 'Replace template package names, script paths, and secrets before saving.',
      id: 'placeholder-values',
      label: 'Placeholder values',
      status: 'blocked',
    });
  }
}

function addArgumentShapeCheck(checks: SettingsMcpServerDraftPreflightCheck[], draft: SettingsMcpServerDraft) {
  const command = draft.command.trim().toLowerCase();
  const args = splitArgs(draft.argsText);
  const needsScriptArg = /^(node|python|python3|py)$/iu.test(command);
  const npxLike = /^(npx|npx\.cmd)$/iu.test(command);
  if (needsScriptArg && args.length === 0) {
    addCheck(checks, {
      detail: 'This command usually needs a server script or module argument.',
      id: 'missing-script-arg',
      label: 'Server arguments',
      status: 'warning',
    });
  }
  if (npxLike && !args.some((arg) => !arg.startsWith('-'))) {
    addCheck(checks, {
      detail: 'npx usually needs a package name after flags.',
      id: 'missing-package-arg',
      label: 'NPX package',
      status: 'warning',
    });
  }
}

function getOverallStatus(checks: SettingsMcpServerDraftPreflightCheck[]) {
  if (checks.some((check) => check.status === 'blocked')) {
    return 'blocked';
  }

  return checks.some((check) => check.status === 'warning') ? 'warning' : 'ready';
}

export function createSettingsMcpServerDraftPreflight(
  draft: SettingsMcpServerDraft,
): SettingsMcpServerDraftPreflightResult {
  const checks: SettingsMcpServerDraftPreflightCheck[] = [];
  addRequiredChecks(checks, draft);
  addEnvJsonCheck(checks, draft.envJson);
  addPlaceholderCheck(checks, draft);
  addArgumentShapeCheck(checks, draft);
  const status = getOverallStatus(checks);
  return {
    checks,
    status,
    summaryText: `MCPDraftPreflight status=${status} checks=${checks.length}`,
  };
}

export function createSettingsMcpServerDraftApplyGate(
  preflight: SettingsMcpServerDraftPreflightResult,
): SettingsMcpServerDraftApplyGate {
  if (preflight.status !== 'blocked') {
    return {
      canApply: true,
      message: 'MCP server draft can be applied to JSON config.',
    };
  }

  const firstBlocker = preflight.checks.find((check) => check.status === 'blocked');
  return {
    canApply: false,
    message: firstBlocker
      ? `Fix blocked MCP draft preflight first: ${firstBlocker.label}.`
      : 'Fix blocked MCP draft preflight first.',
  };
}
