import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';

type SettingsMcpConfigPreflightExportStatus = SettingsMcpConfigPreflightResult['status'];

export interface SettingsMcpConfigPreflightExportPayload {
  exportedAt: string;
  kind: 'mcp-config-preflight-settings-export';
  preflight: SettingsMcpConfigPreflightResult;
  source: 'settings-draft';
  version: 1;
}

export interface SettingsMcpConfigPreflightImportedPayload
  extends SettingsMcpConfigPreflightExportPayload {
  inputPath: string;
}

function isConfigPreflightStatus(value: unknown): value is SettingsMcpConfigPreflightExportStatus {
  return value === 'blocked' || value === 'ready' || value === 'warning';
}

function hasValidStatusCounts(value: Partial<SettingsMcpConfigPreflightResult>) {
  if (!value.statusCounts) {
    return true;
  }

  return Number.isFinite(Number(value.statusCounts.blocked))
    && Number.isFinite(Number(value.statusCounts.ready))
    && Number.isFinite(Number(value.statusCounts.warning));
}

function isConfigPreflightResult(value: unknown): value is SettingsMcpConfigPreflightResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const preflight = value as Partial<SettingsMcpConfigPreflightResult>;
  return isConfigPreflightStatus(preflight.status)
    && Number.isFinite(Number(preflight.serverCount))
    && hasValidStatusCounts(preflight)
    && typeof preflight.summaryText === 'string'
    && Array.isArray(preflight.checks);
}

function isConfigPreflightExportPayload(
  value: unknown,
): value is SettingsMcpConfigPreflightExportPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<SettingsMcpConfigPreflightExportPayload>;
  return payload.kind === 'mcp-config-preflight-settings-export'
    && payload.version === 1
    && payload.source === 'settings-draft'
    && typeof payload.exportedAt === 'string'
    && isConfigPreflightResult(payload.preflight);
}

export function createSettingsMcpConfigPreflightExportPayload(
  preflight: SettingsMcpConfigPreflightResult,
  exportedAt = new Date().toISOString(),
): SettingsMcpConfigPreflightExportPayload {
  return {
    exportedAt,
    kind: 'mcp-config-preflight-settings-export',
    preflight,
    source: 'settings-draft',
    version: 1,
  };
}

export function formatSettingsMcpConfigPreflightExportText(
  preflight: SettingsMcpConfigPreflightResult,
  exportedAt?: string,
) {
  return `${JSON.stringify(
    createSettingsMcpConfigPreflightExportPayload(preflight, exportedAt),
    null,
    2,
  )}\n`;
}

export function createSettingsMcpConfigPreflightExportName(
  preflight: SettingsMcpConfigPreflightResult,
) {
  return `mcp-config-preflight-${preflight.status}-${preflight.serverCount}-servers.json`;
}

export function parseSettingsMcpConfigPreflightExportText(
  text: string,
  inputPath: string,
): SettingsMcpConfigPreflightImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  if (!isConfigPreflightExportPayload(parsed)) {
    throw new Error('Input is not a valid MCP config preflight Settings export.');
  }

  return {
    ...parsed,
    inputPath,
  };
}
