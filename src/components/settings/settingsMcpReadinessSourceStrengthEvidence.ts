import {
  type SettingsMcpReadinessSourceStrength,
  type SettingsMcpReadinessSourceStrengthStatus,
  type SettingsMcpReadinessSourceTier,
} from './settingsMcpReadinessSourceStrength';

export interface SettingsMcpReadinessSourceStrengthEvidencePayload {
  exportedAt: string;
  kind: 'mcp-readiness-source-strength-settings-export';
  source: 'settings-session';
  strength: SettingsMcpReadinessSourceStrength;
  version: 1;
}

export interface SettingsMcpReadinessSourceStrengthImportedPayload
  extends SettingsMcpReadinessSourceStrengthEvidencePayload {
  inputPath: string;
}

export interface SettingsMcpReadinessSourceStrengthImportedSummary {
  currentMatch: boolean;
  detail: string;
  exportedAt: string;
  inputPath: string;
  source: string;
  status: SettingsMcpReadinessSourceStrengthStatus;
  supportsExternalSoakClosure: boolean;
  tier: SettingsMcpReadinessSourceTier;
}

function isSourceStrengthStatus(value: unknown): value is SettingsMcpReadinessSourceStrengthStatus {
  return value === 'blocked' || value === 'ready' || value === 'warning';
}

function isSourceTier(value: unknown): value is SettingsMcpReadinessSourceTier {
  return value === 'draft-config' || value === 'missing' || value === 'saved-config' || value === 'unknown';
}

function isSourceStrength(value: unknown): value is SettingsMcpReadinessSourceStrength {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const strength = value as Partial<SettingsMcpReadinessSourceStrength>;
  return typeof strength.configPresent === 'boolean'
    && typeof strength.detail === 'string'
    && Number.isFinite(Number(strength.readyServerCount))
    && typeof strength.source === 'string'
    && isSourceStrengthStatus(strength.status)
    && typeof strength.summaryText === 'string'
    && typeof strength.supportsExternalSoakClosure === 'boolean'
    && isSourceTier(strength.tier);
}

function isSourceStrengthPayload(
  value: unknown,
): value is SettingsMcpReadinessSourceStrengthEvidencePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<SettingsMcpReadinessSourceStrengthEvidencePayload>;
  return payload.kind === 'mcp-readiness-source-strength-settings-export'
    && payload.version === 1
    && payload.source === 'settings-session'
    && typeof payload.exportedAt === 'string'
    && isSourceStrength(payload.strength);
}

function createSourceStrengthSignature(strength: SettingsMcpReadinessSourceStrength) {
  return [
    strength.configPresent,
    strength.readyServerCount,
    strength.source,
    strength.status,
    strength.supportsExternalSoakClosure,
    strength.tier,
  ].join('|');
}

function isSameSourceStrength(
  imported: SettingsMcpReadinessSourceStrength,
  current: SettingsMcpReadinessSourceStrength,
) {
  return createSourceStrengthSignature(imported) === createSourceStrengthSignature(current);
}

export function createSettingsMcpReadinessSourceStrengthEvidencePayload(
  strength: SettingsMcpReadinessSourceStrength,
  exportedAt = new Date().toISOString(),
): SettingsMcpReadinessSourceStrengthEvidencePayload {
  return {
    exportedAt,
    kind: 'mcp-readiness-source-strength-settings-export',
    source: 'settings-session',
    strength,
    version: 1,
  };
}

export function formatSettingsMcpReadinessSourceStrengthEvidenceText(
  strength: SettingsMcpReadinessSourceStrength,
  exportedAt?: string,
) {
  return `${JSON.stringify(
    createSettingsMcpReadinessSourceStrengthEvidencePayload(strength, exportedAt),
    null,
    2,
  )}\n`;
}

export function createSettingsMcpReadinessSourceStrengthEvidenceName(
  strength: SettingsMcpReadinessSourceStrength,
) {
  return `mcp-readiness-source-${strength.status}-${strength.tier}-${strength.readyServerCount}-ready.json`;
}

export function parseSettingsMcpReadinessSourceStrengthEvidenceText(
  text: string,
  inputPath: string,
): SettingsMcpReadinessSourceStrengthImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  if (!isSourceStrengthPayload(parsed)) {
    throw new Error('Input is not a valid MCP readiness source strength Settings export.');
  }

  return {
    ...parsed,
    inputPath,
  };
}

export function createSettingsMcpReadinessSourceStrengthImportedSummary(
  imported: SettingsMcpReadinessSourceStrengthImportedPayload,
  current: SettingsMcpReadinessSourceStrength,
): SettingsMcpReadinessSourceStrengthImportedSummary {
  const currentMatch = isSameSourceStrength(imported.strength, current);
  return {
    currentMatch,
    detail: currentMatch
      ? 'Imported readiness source evidence matches the current source strength.'
      : 'Imported readiness source evidence differs from the current source strength.',
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    source: imported.strength.source,
    status: imported.strength.status,
    supportsExternalSoakClosure: imported.strength.supportsExternalSoakClosure,
    tier: imported.strength.tier,
  };
}
