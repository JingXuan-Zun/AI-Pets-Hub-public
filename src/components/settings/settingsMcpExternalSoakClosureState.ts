import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

export type SettingsMcpExternalSoakClosureStateStatus = 'blocked' | 'manual' | 'ready' | 'todo' | 'warning';

export interface SettingsMcpExternalSoakClosureStateItem {
  detail: string;
  status: SettingsMcpExternalSoakClosureStateStatus;
}

export interface SettingsMcpExternalSoakClosureState {
  estimateReview: SettingsMcpExternalSoakClosureStateItem;
  importSoak: SettingsMcpExternalSoakClosureStateItem;
  runSoak: SettingsMcpExternalSoakClosureStateItem;
}

function createRunSoakState(options: {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpExternalSoakClosureStateItem {
  if (options.soakSummary) {
    return {
      detail: `${options.soakSummary.totals.rounds} soak round(s) imported from ${options.soakSummary.inputPath}.`,
      status: 'ready',
    };
  }

  if ((options.readinessSummary?.totals.readyServers ?? 0) > 0) {
    return {
      detail: `Run ${options.readinessSummary?.runbook.perServer.length ?? 0} generated per-server soak command(s).`,
      status: 'todo',
    };
  }

  return {
    detail: 'Readiness must produce ready servers before soak commands are useful.',
    status: 'blocked',
  };
}

function createImportSoakState(soakSummary: SettingsMcpSoakSummaryResult | null) {
  if (!soakSummary) {
    return {
      detail: 'Import the generated soak report summary into Settings.',
      status: 'todo' as const,
    };
  }

  return {
    detail: `${soakSummary.status} report: ${soakSummary.totals.servers} server(s), ${soakSummary.totals.rounds} round(s).`,
    status: soakSummary.status === 'healthy' ? 'ready' as const : 'warning' as const,
  };
}

function createEstimateReviewState(soakSummary: SettingsMcpSoakSummaryResult | null) {
  if (soakSummary?.status === 'healthy') {
    return {
      detail: 'Healthy external soak evidence is available for MCP foundation estimate review.',
      status: 'ready' as const,
    };
  }

  return {
    detail: 'Keep MCP foundation estimate held until healthy external soak evidence exists.',
    status: 'blocked' as const,
  };
}

export function createSettingsMcpExternalSoakClosureState(options: {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpExternalSoakClosureState {
  return {
    estimateReview: createEstimateReviewState(options.soakSummary),
    importSoak: createImportSoakState(options.soakSummary),
    runSoak: createRunSoakState(options),
  };
}
