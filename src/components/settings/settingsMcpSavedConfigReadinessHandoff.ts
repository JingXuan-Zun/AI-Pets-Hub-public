import { createSettingsMcpExternalServerCandidateReview } from './settingsMcpExternalServerCandidateReview';
import type { SettingsMcpExternalServerCandidateReview } from './settingsMcpExternalServerCandidateReview';
import { createSettingsMcpReadinessSourceStrength } from './settingsMcpReadinessSourceStrength';
import type { SettingsMcpSoakReadinessSummaryResult } from './settingsMcpSoakReadiness';

export type SettingsMcpSavedConfigReadinessHandoffStatus = 'blocked' | 'ready' | 'todo' | 'warning';

export interface SettingsMcpSavedConfigReadinessHandoffStep {
  detail: string;
  id: 'candidate-review' | 'readiness-freshness' | 'saved-config' | 'saved-readiness';
  label: string;
  status: SettingsMcpSavedConfigReadinessHandoffStatus;
}

export interface SettingsMcpSavedConfigReadinessHandoff {
  candidateCount: number;
  nextAction: string;
  readyForCommandReview: boolean;
  savedAt: number | null;
  status: SettingsMcpSavedConfigReadinessHandoffStatus;
  steps: SettingsMcpSavedConfigReadinessHandoffStep[];
  summaryText: string;
}

function formatSavedAt(savedAt: number | null) {
  return savedAt ? new Date(savedAt).toLocaleTimeString() : '';
}

function createCandidateStep(
  review: SettingsMcpExternalServerCandidateReview,
): SettingsMcpSavedConfigReadinessHandoffStep {
  if (review.status === 'blocked') {
    return {
      detail: review.nextAction,
      id: 'candidate-review',
      label: 'Candidate review',
      status: 'blocked',
    };
  }

  if (review.candidateCount <= 0) {
    return {
      detail: review.nextAction,
      id: 'candidate-review',
      label: 'Candidate review',
      status: 'warning',
    };
  }

  return {
    detail: `${review.candidateCount} static external-server candidate(s) are present.`,
    id: 'candidate-review',
    label: 'Candidate review',
    status: 'ready',
  };
}

function createSavedConfigStep(savedAt: number | null): SettingsMcpSavedConfigReadinessHandoffStep {
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
): SettingsMcpSavedConfigReadinessHandoffStep {
  const strength = createSettingsMcpReadinessSourceStrength(readinessSummary);
  if (!readinessSummary) {
    return {
      detail: 'Generate readiness with saved-config selected after saving the config.',
      id: 'saved-readiness',
      label: 'Saved readiness',
      status: 'todo',
    };
  }

  if (strength.supportsExternalSoakClosure && strength.readyServerCount <= 0) {
    return {
      detail: 'Saved-config readiness has no ready server commands; fix readiness blockers before command review.',
      id: 'saved-readiness',
      label: 'Saved readiness',
      status: 'blocked',
    };
  }

  return {
    detail: strength.detail,
    id: 'saved-readiness',
    label: 'Saved readiness',
    status: strength.status,
  };
}

function createFreshnessStep(options: {
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  savedAt: number | null;
}): SettingsMcpSavedConfigReadinessHandoffStep {
  if (!options.readinessSummary || !options.savedAt) {
    return {
      detail: 'Freshness can be checked after saving config and generating readiness in this Settings session.',
      id: 'readiness-freshness',
      label: 'Freshness',
      status: 'todo',
    };
  }

  const generatedAt = Date.parse(options.readinessSummary.generatedAt);
  if (!Number.isFinite(generatedAt) || generatedAt < options.savedAt) {
    return {
      detail: 'Readiness is older than the latest Settings save; regenerate saved-config readiness.',
      id: 'readiness-freshness',
      label: 'Freshness',
      status: 'warning',
    };
  }

  return {
    detail: 'Readiness was generated after the latest Settings save in this session.',
    id: 'readiness-freshness',
    label: 'Freshness',
    status: 'ready',
  };
}

function getOverallStatus(steps: SettingsMcpSavedConfigReadinessHandoffStep[]) {
  if (steps.some((step) => step.status === 'blocked')) {
    return 'blocked' as const;
  }

  if (steps.some((step) => step.status === 'warning')) {
    return 'warning' as const;
  }

  return steps.every((step) => step.status === 'ready') ? 'ready' as const : 'todo' as const;
}

function getNextAction(steps: SettingsMcpSavedConfigReadinessHandoffStep[]) {
  return steps.find((step) => step.status === 'blocked')?.detail
    || steps.find((step) => step.status === 'warning')?.detail
    || steps.find((step) => step.status === 'todo')?.detail
    || 'Saved-config readiness is fresh; review per-server soak commands next.';
}

export function createSettingsMcpSavedConfigReadinessHandoff(options: {
  configText: string;
  readinessSummary: SettingsMcpSoakReadinessSummaryResult | null;
  savedAt: number | null;
}): SettingsMcpSavedConfigReadinessHandoff {
  const candidateReview = createSettingsMcpExternalServerCandidateReview(options.configText);
  const candidateStep = createCandidateStep(candidateReview);
  const steps = [
    candidateStep,
    createSavedConfigStep(options.savedAt),
    createSavedReadinessStep(options.readinessSummary),
    createFreshnessStep({
      readinessSummary: options.readinessSummary,
      savedAt: options.savedAt,
    }),
  ];
  const status = getOverallStatus(steps);
  const readyForCommandReview = status === 'ready'
    && (options.readinessSummary?.totals.readyServers ?? 0) > 0;

  return {
    candidateCount: candidateReview.candidateCount,
    nextAction: getNextAction(steps),
    readyForCommandReview,
    savedAt: options.savedAt,
    status,
    steps,
    summaryText: `MCPSavedConfigReadinessHandoff status=${status} commandReview=${readyForCommandReview}`,
  };
}
