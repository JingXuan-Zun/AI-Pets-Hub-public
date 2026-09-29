import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import type { SettingsMcpConfigPreflightImportedPayload } from './settingsMcpConfigPreflightExport';

export interface SettingsMcpConfigPreflightEvidenceSummary {
  currentMatch: boolean;
  detail: string;
  exportedAt: string;
  inputPath: string;
  serverCount: number;
  status: SettingsMcpConfigPreflightResult['status'];
}

function createCheckSignature(preflight: SettingsMcpConfigPreflightResult) {
  return preflight.checks
    .map((check) => `${check.id}:${check.status}`)
    .sort()
    .join('|');
}

function comparePreflightEvidence(
  imported: SettingsMcpConfigPreflightResult,
  current: SettingsMcpConfigPreflightResult,
) {
  return imported.status === current.status
    && imported.serverCount === current.serverCount
    && createCheckSignature(imported) === createCheckSignature(current);
}

export function createSettingsMcpConfigPreflightEvidenceSummary(
  imported: SettingsMcpConfigPreflightImportedPayload,
  current: SettingsMcpConfigPreflightResult,
): SettingsMcpConfigPreflightEvidenceSummary {
  const currentMatch = comparePreflightEvidence(imported.preflight, current);
  return {
    currentMatch,
    detail: currentMatch
      ? 'Imported evidence matches the current draft preflight.'
      : 'Imported evidence differs from the current draft preflight.',
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    serverCount: imported.preflight.serverCount,
    status: imported.preflight.status,
  };
}
