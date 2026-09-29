import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

export type SettingsMcpReadinessSourceStrengthStatus = 'blocked' | 'ready' | 'warning';
export type SettingsMcpReadinessSourceTier = 'draft-config' | 'missing' | 'saved-config' | 'unknown';

export interface SettingsMcpReadinessSourceStrength {
  configPresent: boolean;
  detail: string;
  readyServerCount: number;
  source: string;
  status: SettingsMcpReadinessSourceStrengthStatus;
  summaryText: string;
  supportsExternalSoakClosure: boolean;
  tier: SettingsMcpReadinessSourceTier;
}

function getSourceTier(summary: SettingsMcpSoakReadinessSummaryResult | null): SettingsMcpReadinessSourceTier {
  if (!summary) {
    return 'missing';
  }

  if (summary.source === 'saved-config') {
    return 'saved-config';
  }

  if (summary.source === 'draft-config') {
    return 'draft-config';
  }

  return 'unknown';
}

function createSourceDetail(options: {
  configPresent: boolean;
  readyServerCount: number;
  source: string;
  tier: SettingsMcpReadinessSourceTier;
}) {
  if (options.tier === 'missing') {
    return 'No readiness evidence has been generated or imported.';
  }

  if (options.tier === 'saved-config' && options.configPresent) {
    return `${options.readyServerCount} ready server(s) came from saved-config readiness evidence.`;
  }

  if (options.tier === 'draft-config') {
    return 'Draft readiness is a preview; save config and regenerate saved-config readiness before estimate review.';
  }

  if (!options.configPresent) {
    return `${options.source} readiness did not prove a saved MCP config was present.`;
  }

  return `${options.source} readiness is not saved-config evidence; review source before estimate review.`;
}

function getSourceStatus(options: {
  configPresent: boolean;
  tier: SettingsMcpReadinessSourceTier;
}) {
  if (options.tier === 'missing' || !options.configPresent) {
    return 'blocked' as const;
  }

  return options.tier === 'saved-config' ? 'ready' as const : 'warning' as const;
}

export function createSettingsMcpReadinessSourceStrength(
  summary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpReadinessSourceStrength {
  const tier = getSourceTier(summary);
  const configPresent = Boolean(summary?.configPresent);
  const readyServerCount = summary?.totals.readyServers ?? 0;
  const source = summary?.source || 'missing';
  const status = getSourceStatus({ configPresent, tier });
  const supportsExternalSoakClosure = status === 'ready';

  return {
    configPresent,
    detail: createSourceDetail({ configPresent, readyServerCount, source, tier }),
    readyServerCount,
    source,
    status,
    summaryText: [
      `MCPReadinessSource status=${status}`,
      `source=${source}`,
      `savedEvidence=${supportsExternalSoakClosure}`,
      `readyServers=${readyServerCount}`,
    ].join(' '),
    supportsExternalSoakClosure,
    tier,
  };
}
