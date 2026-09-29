import { createSettingsMcpReadinessSourceStrength } from './settingsMcpReadinessSourceStrength';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';
import type { SettingsMcpSoakSummaryResult } from './settingsMcpSoakSummary';

export type SettingsMcpPostSaveReadinessReviewStatus = 'blocked' | 'ready' | 'todo' | 'warning';

export interface SettingsMcpPostSaveReadinessReviewStep {
  detail: string;
  id: 'ready-servers' | 'saved-config' | 'saved-readiness' | 'soak-evidence';
  label: string;
  status: SettingsMcpPostSaveReadinessReviewStatus;
}

export interface SettingsMcpPostSaveReadinessReview {
  nextAction: string;
  readyForPerServerSoak: boolean;
  savedAt: number | null;
  status: SettingsMcpPostSaveReadinessReviewStatus;
  steps: SettingsMcpPostSaveReadinessReviewStep[];
  summaryText: string;
}

function formatSavedAt(savedAt: number | null) {
  return savedAt ? new Date(savedAt).toLocaleTimeString() : '';
}

function createSavedConfigStep(savedAt: number | null): SettingsMcpPostSaveReadinessReviewStep {
  if (!savedAt) {
    return {
      detail: 'Save the MCP config before generating saved-config readiness.',
      id: 'saved-config',
      label: 'Saved config',
      status: 'todo',
    };
  }

  return {
    detail: `MCP config was saved in this Settings session at ${formatSavedAt(savedAt)}.`,
    id: 'saved-config',
    label: 'Saved config',
    status: 'ready',
  };
}

function createSavedReadinessStep(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpPostSaveReadinessReviewStep {
  const sourceStrength = createSettingsMcpReadinessSourceStrength(readinessSummary);
  if (!readinessSummary) {
    return {
      detail: 'Generate readiness with the saved-config source selected.',
      id: 'saved-readiness',
      label: 'Saved readiness',
      status: 'todo',
    };
  }

  return {
    detail: sourceStrength.detail,
    id: 'saved-readiness',
    label: 'Saved readiness',
    status: sourceStrength.status,
  };
}

function createReadyServersStep(
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null,
): SettingsMcpPostSaveReadinessReviewStep {
  const readyServers = readinessSummary?.totals.readyServers ?? 0;
  if (readyServers <= 0) {
    return {
      detail: 'No ready server candidates are available for per-server soak.',
      id: 'ready-servers',
      label: 'Ready servers',
      status: readinessSummary ? 'blocked' : 'todo',
    };
  }

  return {
    detail: `${readyServers} ready server candidate(s) have generated runbook commands.`,
    id: 'ready-servers',
    label: 'Ready servers',
    status: 'ready',
  };
}

function createSoakEvidenceStep(soakSummary: SettingsMcpSoakSummaryResult | null) {
  if (!soakSummary) {
    return {
      detail: 'Run per-server soak commands, index reports, then import the soak summary.',
      id: 'soak-evidence' as const,
      label: 'Soak evidence',
      status: 'todo' as const,
    };
  }

  return {
    detail: `${soakSummary.status} soak summary imported from ${soakSummary.inputPath}.`,
    id: 'soak-evidence' as const,
    label: 'Soak evidence',
    status: soakSummary.status === 'healthy' ? 'ready' as const : 'warning' as const,
  };
}

function getOverallStatus(steps: SettingsMcpPostSaveReadinessReviewStep[]) {
  if (steps.some((step) => step.status === 'blocked')) {
    return 'blocked' as const;
  }

  if (steps.some((step) => step.status === 'warning')) {
    return 'warning' as const;
  }

  return steps.every((step) => step.status === 'ready') ? 'ready' as const : 'todo' as const;
}

function getNextAction(steps: SettingsMcpPostSaveReadinessReviewStep[]) {
  return steps.find((step) => step.status === 'blocked')?.detail
    || steps.find((step) => step.status === 'todo')?.detail
    || steps.find((step) => step.status === 'warning')?.detail
    || 'Healthy imported soak evidence is ready for MCP foundation estimate review.';
}

export function createSettingsMcpPostSaveReadinessReview(options: {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  savedAt: number | null;
  soakSummary: SettingsMcpSoakSummaryResult | null;
}): SettingsMcpPostSaveReadinessReview {
  const sourceStrength = createSettingsMcpReadinessSourceStrength(options.readinessSummary);
  const steps = [
    createSavedConfigStep(options.savedAt),
    createSavedReadinessStep(options.readinessSummary),
    createReadyServersStep(options.readinessSummary),
    createSoakEvidenceStep(options.soakSummary),
  ];
  const status = getOverallStatus(steps);
  const readyForPerServerSoak = sourceStrength.supportsExternalSoakClosure
    && (options.readinessSummary?.totals.readyServers ?? 0) > 0;

  return {
    nextAction: getNextAction(steps),
    readyForPerServerSoak,
    savedAt: options.savedAt,
    status,
    steps,
    summaryText: `MCPPostSaveReadinessReview status=${status} perServerSoak=${readyForPerServerSoak}`,
  };
}
