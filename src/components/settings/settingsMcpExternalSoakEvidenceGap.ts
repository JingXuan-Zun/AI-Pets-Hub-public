import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import { createSettingsMcpReadinessSourceStrength } from './settingsMcpReadinessSourceStrength';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

export type SettingsMcpExternalSoakEvidenceGapStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpExternalSoakEvidenceGap {
  blockers: string[];
  eligibleForMcpFoundationIncrease: boolean;
  nextAction: string;
  readyServerCount: number;
  soakRoundCount: number;
  status: SettingsMcpExternalSoakEvidenceGapStatus;
  summaryText: string;
  warnings: string[];
}

function createReadinessBlocker(readinessSummary: SettingsMcpSoakReadinessSummaryResult | null) {
  if (!readinessSummary) {
    return 'Generate or import real-soak readiness evidence.';
  }

  return readinessSummary.totals.readyServers > 0
    ? ''
    : 'Readiness has no ready external MCP server candidates.';
}

function createSoakBlocker(soakSummary: SettingsMcpSoakSummaryResult | null) {
  if (!soakSummary) {
    return 'Import a real-server soak report after running generated per-server commands.';
  }

  if (soakSummary.totals.servers <= 0 || soakSummary.totals.rounds <= 0) {
    return 'Imported soak report has no server rounds.';
  }

  return '';
}

function createWarnings(options: {
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}) {
  const warnings: string[] = [];
  if (options.preflight.status === 'warning') {
    warnings.push('Config preflight still has warning checks.');
  }
  if ((options.readinessSummary?.totals.referenceServers ?? 0) > 0) {
    warnings.push('Readiness still includes reference servers that do not count as external soak evidence.');
  }
  if ((options.readinessSummary?.totals.fakeFixtureServers ?? 0) > 0) {
    warnings.push('Readiness still includes fixture servers that do not count as external soak evidence.');
  }
  const sourceStrength = createSettingsMcpReadinessSourceStrength(options.readinessSummary);
  if (options.readinessSummary && !sourceStrength.supportsExternalSoakClosure) {
    warnings.push(sourceStrength.detail);
  }
  if (options.soakSummary && options.soakSummary.status !== 'healthy') {
    warnings.push(`Imported soak report is ${options.soakSummary.status}, not healthy.`);
  }

  return warnings;
}

function createNextAction(blockers: string[], warnings: string[]) {
  if (blockers.length > 0) {
    return blockers[0];
  }

  if (warnings.length > 0) {
    return warnings[0];
  }

  return 'External MCP soak evidence is healthy; review whether MCP foundation estimate can move.';
}

export function createSettingsMcpExternalSoakEvidenceGap(options: {
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpExternalSoakEvidenceGap {
  const blockers = [
    options.preflight.status === 'blocked' ? 'Config preflight is blocked.' : '',
    createReadinessBlocker(options.readinessSummary),
    createSoakBlocker(options.soakSummary),
  ].filter(Boolean);
  const warnings = createWarnings(options);
  const eligibleForMcpFoundationIncrease = blockers.length === 0 && warnings.length === 0;
  const status: SettingsMcpExternalSoakEvidenceGapStatus = eligibleForMcpFoundationIncrease
    ? 'ready'
    : blockers.length > 0 ? 'blocked' : 'warning';
  const readyServerCount = options.readinessSummary?.totals.readyServers ?? 0;
  const soakRoundCount = options.soakSummary?.totals.rounds ?? 0;

  return {
    blockers,
    eligibleForMcpFoundationIncrease,
    nextAction: createNextAction(blockers, warnings),
    readyServerCount,
    soakRoundCount,
    status,
    summaryText: [
      `MCPExternalSoakEvidence status=${status}`,
      `eligible=${eligibleForMcpFoundationIncrease}`,
      `readyServers=${readyServerCount}`,
      `soakRounds=${soakRoundCount}`,
    ].join(' '),
    warnings,
  };
}
