import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

export type SettingsMcpEvidenceStageStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpEvidenceStage {
  detail: string;
  id: 'readiness-ready' | 'soak-evidence-imported' | 'static-preflight-ready';
  label: string;
  status: SettingsMcpEvidenceStageStatus;
}

export interface SettingsMcpEvidenceStageSummary {
  detail: string;
  readyCount: number;
  stages: SettingsMcpEvidenceStage[];
  status: SettingsMcpEvidenceStageStatus;
  summaryText: string;
}

export interface SettingsMcpEvidenceStagesExportPayload {
  exportedAt: string;
  kind: 'mcp-evidence-stages-settings-export';
  source: 'settings-session';
  summary: SettingsMcpEvidenceStageSummary;
  version: 1;
}

export interface SettingsMcpEvidenceStagesImportedPayload extends SettingsMcpEvidenceStagesExportPayload {
  inputPath: string;
}

export interface SettingsMcpEvidenceStagesImportedSummary {
  currentMatch: boolean;
  detail: string;
  exportedAt: string;
  inputPath: string;
  readyCount: number;
  status: SettingsMcpEvidenceStageStatus;
}

function isStageStatus(value: unknown): value is SettingsMcpEvidenceStageStatus {
  return value === 'blocked' || value === 'ready' || value === 'warning';
}

function isEvidenceStage(value: unknown): value is SettingsMcpEvidenceStage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const stage = value as Partial<SettingsMcpEvidenceStage>;
  return (
    stage.id === 'readiness-ready'
    || stage.id === 'soak-evidence-imported'
    || stage.id === 'static-preflight-ready'
  ) && typeof stage.detail === 'string'
    && typeof stage.label === 'string'
    && isStageStatus(stage.status);
}

function isStageSummary(value: unknown): value is SettingsMcpEvidenceStageSummary {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const summary = value as Partial<SettingsMcpEvidenceStageSummary>;
  return typeof summary.detail === 'string'
    && Number.isFinite(Number(summary.readyCount))
    && Array.isArray(summary.stages)
    && summary.stages.every(isEvidenceStage)
    && isStageStatus(summary.status)
    && typeof summary.summaryText === 'string';
}

function isStagesExportPayload(value: unknown): value is SettingsMcpEvidenceStagesExportPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const payload = value as Partial<SettingsMcpEvidenceStagesExportPayload>;
  return payload.kind === 'mcp-evidence-stages-settings-export'
    && payload.version === 1
    && payload.source === 'settings-session'
    && typeof payload.exportedAt === 'string'
    && isStageSummary(payload.summary);
}

function createStaticPreflightStage(
  preflight: SettingsMcpConfigPreflightResult,
): SettingsMcpEvidenceStage {
  if (preflight.status === 'ready') {
    return {
      detail: `${preflight.serverCount} configured server(s) pass static checks.`,
      id: 'static-preflight-ready',
      label: 'Static preflight ready',
      status: 'ready',
    };
  }

  return {
    detail: `${preflight.statusCounts.blocked} blocked / ${preflight.statusCounts.warning} warning checks before readiness.`,
    id: 'static-preflight-ready',
    label: 'Static preflight ready',
    status: preflight.status === 'warning' ? 'warning' : 'blocked',
  };
}

function createReadinessStage(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpEvidenceStage {
  if (!readinessSummary) {
    return {
      detail: 'No saved or imported readiness evidence yet.',
      id: 'readiness-ready',
      label: 'Readiness ready',
      status: 'blocked',
    };
  }

  return {
    detail: `${readinessSummary.totals.readyServers} ready / ${readinessSummary.totals.referenceServers} reference / ${readinessSummary.totals.fakeFixtureServers} fixture server(s).`,
    id: 'readiness-ready',
    label: 'Readiness ready',
    status: readinessSummary.totals.readyServers > 0 ? 'ready' : 'blocked',
  };
}

function createSoakStage(soakSummary: SettingsMcpSoakSummaryResult | null): SettingsMcpEvidenceStage {
  if (!soakSummary) {
    return {
      detail: 'No real-server soak evidence imported into this Settings session.',
      id: 'soak-evidence-imported',
      label: 'Soak evidence imported',
      status: 'blocked',
    };
  }

  return {
    detail: `${soakSummary.totals.servers} server(s), ${soakSummary.totals.rounds} round(s), status ${soakSummary.status}.`,
    id: 'soak-evidence-imported',
    label: 'Soak evidence imported',
    status: soakSummary.status === 'healthy' ? 'ready' : 'warning',
  };
}

function getOverallStatus(stages: SettingsMcpEvidenceStage[]): SettingsMcpEvidenceStageStatus {
  if (stages.some((stage) => stage.status === 'blocked')) {
    return 'blocked';
  }

  return stages.some((stage) => stage.status === 'warning') ? 'warning' : 'ready';
}

export function createSettingsMcpEvidenceStageSummary(options: {
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpEvidenceStageSummary {
  const stages = [
    createStaticPreflightStage(options.preflight),
    createReadinessStage(options.readinessSummary),
    createSoakStage(options.soakSummary),
  ];
  const readyCount = stages.filter((stage) => stage.status === 'ready').length;
  const status = getOverallStatus(stages);
  return {
    detail: `${readyCount}/${stages.length} evidence stage(s) ready.`,
    readyCount,
    stages,
    status,
    summaryText: `MCPEvidenceStages status=${status} ready=${readyCount}/${stages.length}`,
  };
}

export function createSettingsMcpEvidenceStagesExportPayload(
  summary: SettingsMcpEvidenceStageSummary,
  exportedAt = new Date().toISOString(),
): SettingsMcpEvidenceStagesExportPayload {
  return {
    exportedAt,
    kind: 'mcp-evidence-stages-settings-export',
    source: 'settings-session',
    summary,
    version: 1,
  };
}

export function formatSettingsMcpEvidenceStagesExportText(
  summary: SettingsMcpEvidenceStageSummary,
  exportedAt?: string,
) {
  return `${JSON.stringify(createSettingsMcpEvidenceStagesExportPayload(summary, exportedAt), null, 2)}\n`;
}

export function createSettingsMcpEvidenceStagesExportName(summary: SettingsMcpEvidenceStageSummary) {
  return `mcp-evidence-stages-${summary.status}-${summary.readyCount}-of-${summary.stages.length}.json`;
}

export function parseSettingsMcpEvidenceStagesExportText(
  text: string,
  inputPath: string,
): SettingsMcpEvidenceStagesImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  if (!isStagesExportPayload(parsed)) {
    throw new Error('Input is not a valid MCP evidence stages Settings export.');
  }

  return {
    ...parsed,
    inputPath,
  };
}

function createStageSignature(summary: SettingsMcpEvidenceStageSummary) {
  return summary.stages
    .map((stage) => `${stage.id}:${stage.status}`)
    .sort()
    .join('|');
}

function compareEvidenceStages(
  imported: SettingsMcpEvidenceStageSummary,
  current: SettingsMcpEvidenceStageSummary,
) {
  return imported.status === current.status
    && imported.readyCount === current.readyCount
    && createStageSignature(imported) === createStageSignature(current);
}

export function createSettingsMcpEvidenceStagesImportedSummary(
  imported: SettingsMcpEvidenceStagesImportedPayload,
  current: SettingsMcpEvidenceStageSummary,
): SettingsMcpEvidenceStagesImportedSummary {
  const currentMatch = compareEvidenceStages(imported.summary, current);
  return {
    currentMatch,
    detail: currentMatch
      ? 'Imported stage evidence matches the current MCP evidence stages.'
      : 'Imported stage evidence differs from the current MCP evidence stages.',
    exportedAt: imported.exportedAt,
    inputPath: imported.inputPath,
    readyCount: imported.summary.readyCount,
    status: imported.summary.status,
  };
}
