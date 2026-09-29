import type { SettingsMcpConfigPreflightResult } from './settingsMcpConfigPreflight';
import { createSettingsMcpExternalSoakClosureState } from './settingsMcpExternalSoakClosureState';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

export type SettingsMcpExternalSoakClosureStatus = 'blocked' | 'ready' | 'todo' | 'warning';

export interface SettingsMcpExternalSoakClosureStep {
  detail: string;
  id: string;
  label: string;
  status: SettingsMcpExternalSoakClosureStatus;
}

export interface SettingsMcpExternalSoakClosureChecklist {
  nextAction: string;
  readyCount: number;
  status: SettingsMcpExternalSoakClosureStatus;
  steps: SettingsMcpExternalSoakClosureStep[];
  summaryText: string;
}

function createConfigPreflightStep(
  preflight: SettingsMcpConfigPreflightResult,
): SettingsMcpExternalSoakClosureStep {
  if (preflight.status === 'ready') {
    return {
      detail: `${preflight.serverCount} server(s) pass static config checks.`,
      id: 'config-preflight',
      label: 'Config preflight',
      status: 'ready',
    };
  }

  return {
    detail: `${preflight.statusCounts.blocked} blocked / ${preflight.statusCounts.warning} warning checks.`,
    id: 'config-preflight',
    label: 'Config preflight',
    status: preflight.status === 'blocked' ? 'blocked' : 'warning',
  };
}

function createSavedConfigStep(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpExternalSoakClosureStep {
  if (!readinessSummary) {
    return {
      detail: 'Save the MCP config before generating saved-config readiness evidence.',
      id: 'saved-config',
      label: 'Saved config evidence',
      status: 'todo',
    };
  }

  return readinessSummary.configPresent ? {
    detail: `${readinessSummary.configPath || '.desktop-pet-mcp.json'} was present when readiness was generated.`,
    id: 'saved-config',
    label: 'Saved config evidence',
    status: 'ready',
  } : {
    detail: 'Readiness was generated from draft or missing config; save config before claiming external evidence.',
    id: 'saved-config',
    label: 'Saved config evidence',
    status: 'todo',
  };
}

function createReadinessStep(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpExternalSoakClosureStep {
  if (!readinessSummary) {
    return {
      detail: 'Generate or import readiness after config preflight is ready.',
      id: 'readiness',
      label: 'Readiness candidates',
      status: 'todo',
    };
  }

  return readinessSummary.totals.readyServers > 0 ? {
    detail: `${readinessSummary.totals.readyServers} ready server(s), ${readinessSummary.runbook.perServer.length} per-server command(s).`,
    id: 'readiness',
    label: 'Readiness candidates',
    status: 'ready',
  } : {
    detail: 'No ready external server candidates were found.',
    id: 'readiness',
    label: 'Readiness candidates',
    status: 'blocked',
  };
}

function getOverallStatus(steps: SettingsMcpExternalSoakClosureStep[]) {
  if (steps.some((step) => step.status === 'blocked')) {
    return 'blocked' as const;
  }

  if (steps.some((step) => step.status === 'warning')) {
    return 'warning' as const;
  }

  return steps.every((step) => step.status === 'ready') ? 'ready' as const : 'todo' as const;
}

function getNextAction(steps: SettingsMcpExternalSoakClosureStep[]) {
  return steps.find((step) => step.status === 'blocked')?.detail
    || steps.find((step) => step.status === 'todo')?.detail
    || steps.find((step) => step.status === 'warning')?.detail
    || 'External MCP soak closure is ready for estimate review.';
}

export function createSettingsMcpExternalSoakClosureChecklist(options: {
  preflight: SettingsMcpConfigPreflightResult;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpExternalSoakClosureChecklist {
  const closureState = createSettingsMcpExternalSoakClosureState(options);
  const steps = [
    createConfigPreflightStep(options.preflight),
    createSavedConfigStep(options.readinessSummary),
    createReadinessStep(options.readinessSummary),
    {
      detail: closureState.runSoak.detail,
      id: 'run-soak',
      label: 'Run ready-server soak',
      status: closureState.runSoak.status === 'manual' ? 'todo' : closureState.runSoak.status,
    },
    {
      detail: closureState.importSoak.detail,
      id: 'import-soak',
      label: 'Import soak evidence',
      status: closureState.importSoak.status === 'manual' ? 'todo' : closureState.importSoak.status,
    },
    {
      detail: closureState.estimateReview.detail,
      id: 'estimate-review',
      label: 'Estimate review',
      status: closureState.estimateReview.status === 'manual' ? 'blocked' : closureState.estimateReview.status,
    },
  ];
  const readyCount = steps.filter((step) => step.status === 'ready').length;
  const status = getOverallStatus(steps);

  return {
    nextAction: getNextAction(steps),
    readyCount,
    status,
    steps,
    summaryText: `MCPExternalSoakClosure status=${status} ready=${readyCount}/${steps.length}`,
  };
}
