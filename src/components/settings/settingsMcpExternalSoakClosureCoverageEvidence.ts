import {
  type SettingsMcpExternalSoakClosureCoverage,
  type SettingsMcpExternalSoakClosureCoverageStatus,
  type SettingsMcpExternalSoakClosureCoverageStep,
  type SettingsMcpExternalSoakClosureServerCoverage,
} from './settingsMcpExternalSoakClosureCoverage';
import type { SettingsMcpSoakServerSummary } from './settingsMcpSoakSummary';

export interface SettingsMcpExternalSoakClosureCoverageEvidencePayload {
  coverage: SettingsMcpExternalSoakClosureCoverage;
  exportedAt: string;
  kind: 'mcp-external-soak-coverage-settings-export';
  source: 'settings-session';
  version: 1;
}

export interface SettingsMcpExternalSoakClosureCoverageImportedPayload
  extends SettingsMcpExternalSoakClosureCoverageEvidencePayload {
  inputPath: string;
}

export interface SettingsMcpExternalSoakClosureCoverageImportedSummary {
  coveredCount: number;
  currentMatch: boolean;
  detail: string;
  exportedAt: string;
  inputPath: string;
  status: SettingsMcpExternalSoakClosureCoverageStatus;
  totalReadyServers: number;
}

function isCoverageStatus(value: unknown): value is SettingsMcpExternalSoakClosureCoverageStatus {
  return value === 'blocked' || value === 'covered' || value === 'missing' || value === 'warning';
}

function isSoakStatus(value: unknown): value is SettingsMcpSoakServerSummary['status'] | 'missing' {
  return value === 'degraded'
    || value === 'empty'
    || value === 'failed'
    || value === 'healthy'
    || value === 'missing';
}

function isServerCoverage(value: unknown): value is SettingsMcpExternalSoakClosureServerCoverage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const row = value as Partial<SettingsMcpExternalSoakClosureServerCoverage>;
  return typeof row.detail === 'string'
    && typeof row.actionDetail === 'string'
    && typeof row.actionLabel === 'string'
    && Number.isFinite(Number(row.roundCount))
    && typeof row.serverId === 'string'
    && typeof row.soakCommand === 'string'
    && isSoakStatus(row.soakStatus)
    && isCoverageStatus(row.status);
}

function isClosureStep(value: unknown): value is SettingsMcpExternalSoakClosureCoverageStep {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const step = value as Partial<SettingsMcpExternalSoakClosureCoverageStep>;
  return (
    step.id === 'run-missing-soak'
    || step.id === 'index-reports'
    || step.id === 'import-summary'
  ) && typeof step.command === 'string'
    && typeof step.detail === 'string'
    && typeof step.label === 'string'
    && (
      step.status === 'blocked'
      || step.status === 'copy-ready'
      || step.status === 'manual'
      || step.status === 'ready'
      || step.status === 'warning'
    );
}

function isCoverage(value: unknown): value is SettingsMcpExternalSoakClosureCoverage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const coverage = value as Partial<SettingsMcpExternalSoakClosureCoverage>;
  return Number.isFinite(Number(coverage.coveredCount))
    && Array.isArray(coverage.closureSteps)
    && coverage.closureSteps.every(isClosureStep)
    && typeof coverage.detail === 'string'
    && Number.isFinite(Number(coverage.missingCommandCount))
    && typeof coverage.missingCommandsText === 'string'
    && Array.isArray(coverage.rows)
    && coverage.rows.every(isServerCoverage)
    && isCoverageStatus(coverage.status)
    && typeof coverage.summaryText === 'string'
    && Number.isFinite(Number(coverage.totalReadyServers));
}

function isCoveragePayload(
  value: unknown,
): value is SettingsMcpExternalSoakClosureCoverageEvidencePayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<SettingsMcpExternalSoakClosureCoverageEvidencePayload>;
  return payload.kind === 'mcp-external-soak-coverage-settings-export'
    && payload.version === 1
    && payload.source === 'settings-session'
    && typeof payload.exportedAt === 'string'
    && isCoverage(payload.coverage);
}

function createCoverageSignature(coverage: SettingsMcpExternalSoakClosureCoverage) {
  const rowSignature = coverage.rows
    .map((row) => `${row.serverId}:${row.status}:${row.soakStatus}:${row.roundCount}:${row.soakCommand}`)
    .sort()
    .join('|');
  const stepSignature = coverage.closureSteps
    .map((step) => `${step.id}:${step.status}:${step.command}`)
    .sort()
    .join('|');
  return `${rowSignature}\n${stepSignature}`;
}

function isSameCoverage(
  imported: SettingsMcpExternalSoakClosureCoverage,
  current: SettingsMcpExternalSoakClosureCoverage,
) {
  return imported.status === current.status
    && imported.coveredCount === current.coveredCount
    && imported.missingCommandCount === current.missingCommandCount
    && imported.missingCommandsText === current.missingCommandsText
    && imported.totalReadyServers === current.totalReadyServers
    && createCoverageSignature(imported) === createCoverageSignature(current);
}

export function createSettingsMcpExternalSoakClosureCoverageEvidencePayload(
  coverage: SettingsMcpExternalSoakClosureCoverage,
  exportedAt = new Date().toISOString(),
): SettingsMcpExternalSoakClosureCoverageEvidencePayload {
  return {
    coverage,
    exportedAt,
    kind: 'mcp-external-soak-coverage-settings-export',
    source: 'settings-session',
    version: 1,
  };
}

export function formatSettingsMcpExternalSoakClosureCoverageEvidenceText(
  coverage: SettingsMcpExternalSoakClosureCoverage,
  exportedAt?: string,
) {
  return `${JSON.stringify(
    createSettingsMcpExternalSoakClosureCoverageEvidencePayload(coverage, exportedAt),
    null,
    2,
  )}\n`;
}

export function createSettingsMcpExternalSoakClosureCoverageEvidenceName(
  coverage: SettingsMcpExternalSoakClosureCoverage,
) {
  return `mcp-external-soak-coverage-${coverage.status}-${coverage.coveredCount}-of-${coverage.totalReadyServers}.json`;
}

export function parseSettingsMcpExternalSoakClosureCoverageEvidenceText(
  text: string,
  inputPath: string,
): SettingsMcpExternalSoakClosureCoverageImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  if (!isCoveragePayload(parsed)) {
    throw new Error('Input is not a valid MCP external soak coverage Settings export.');
  }

  return {
    ...parsed,
    inputPath,
  };
}

export function createSettingsMcpExternalSoakClosureCoverageImportedSummary(
  imported: SettingsMcpExternalSoakClosureCoverageImportedPayload,
  current: SettingsMcpExternalSoakClosureCoverage,
): SettingsMcpExternalSoakClosureCoverageImportedSummary {
  const currentMatch = isSameCoverage(imported.coverage, current);
  return {
    coveredCount: imported.coverage.coveredCount,
    currentMatch,
    detail: currentMatch
      ? 'Imported coverage evidence matches the current ready-server soak coverage.'
      : 'Imported coverage evidence differs from the current ready-server soak coverage.',
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    status: imported.coverage.status,
    totalReadyServers: imported.coverage.totalReadyServers,
  };
}
