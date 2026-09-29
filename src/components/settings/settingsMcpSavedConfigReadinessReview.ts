import {
  hasMcpServerDraftContent,
  parseMcpConfigText,
  type SettingsMcpServerDraft,
} from './settingsMcpConfigFormUtils';
import {
  createSettingsMcpConfigPreflight,
  type SettingsMcpConfigPreflightStatus,
} from './settingsMcpConfigPreflight';
import { createSettingsMcpServerDraftPreflight } from './settingsMcpServerDraftPreflight';

export type SettingsMcpSavedConfigReadinessReviewStatus = 'blocked' | 'ready' | 'warning';

export interface SettingsMcpSavedConfigReadinessReviewStep {
  detail: string;
  id: 'config-saveable' | 'draft-applied' | 'readiness-source' | 'risk-review' | 'server-candidates';
  label: string;
  status: SettingsMcpSavedConfigReadinessReviewStatus;
}

export interface SettingsMcpSavedConfigReadinessReview {
  canSaveConfig: boolean;
  configStatus: SettingsMcpConfigPreflightStatus;
  nextAction: string;
  readyForSavedConfigReadiness: boolean;
  serverCount: number;
  status: SettingsMcpSavedConfigReadinessReviewStatus;
  steps: SettingsMcpSavedConfigReadinessReviewStep[];
  summaryText: string;
}

function createConfigSaveableStep(error: string | null): SettingsMcpSavedConfigReadinessReviewStep {
  return error ? {
    detail: error,
    id: 'config-saveable',
    label: 'Config saveable',
    status: 'blocked',
  } : {
    detail: 'Current JSON can be saved as the MCP config file.',
    id: 'config-saveable',
    label: 'Config saveable',
    status: 'ready',
  };
}

function createServerCandidatesStep(options: {
  preflightStatus: SettingsMcpConfigPreflightStatus;
  serverCount: number;
}): SettingsMcpSavedConfigReadinessReviewStep {
  if (!options.serverCount) {
    return {
      detail: 'Add at least one real MCP server before saved-config readiness.',
      id: 'server-candidates',
      label: 'Server candidates',
      status: 'blocked',
    };
  }

  return {
    detail: `${options.serverCount} server(s) are present in the JSON config.`,
    id: 'server-candidates',
    label: 'Server candidates',
    status: options.preflightStatus === 'blocked' ? 'blocked' : 'ready',
  };
}

function createDraftAppliedStep(options: {
  draft: SettingsMcpServerDraft;
  serverInConfig: boolean;
}): SettingsMcpSavedConfigReadinessReviewStep {
  if (!hasMcpServerDraftContent(options.draft)) {
    return {
      detail: 'No pending server draft needs to be applied before saving.',
      id: 'draft-applied',
      label: 'Draft applied',
      status: 'ready',
    };
  }

  const draftPreflight = createSettingsMcpServerDraftPreflight(options.draft);
  if (options.serverInConfig) {
    return {
      detail: `Draft ${options.draft.id.trim()} is already present in the JSON config.`,
      id: 'draft-applied',
      label: 'Draft applied',
      status: draftPreflight.status === 'blocked' ? 'warning' : 'ready',
    };
  }

  return {
    detail: 'Current server form content is not in the JSON config; Apply it before saving if this is the server you intend to test.',
    id: 'draft-applied',
    label: 'Draft applied',
    status: 'warning',
  };
}

function createReadinessSourceStep(
  configStatus: SettingsMcpConfigPreflightStatus,
): SettingsMcpSavedConfigReadinessReviewStep {
  if (configStatus === 'ready') {
    return {
      detail: 'After saving, generate readiness from saved-config evidence rather than draft-config preview.',
      id: 'readiness-source',
      label: 'Readiness source',
      status: 'ready',
    };
  }

  return {
    detail: configStatus === 'blocked'
      ? 'Saved-config readiness should wait until config preflight blockers are fixed.'
      : 'Saved-config readiness can be generated, but warnings must be reviewed before external-soak claims.',
    id: 'readiness-source',
    label: 'Readiness source',
    status: configStatus,
  };
}

function createRiskReviewStep(
  configStatus: SettingsMcpConfigPreflightStatus,
): SettingsMcpSavedConfigReadinessReviewStep {
  if (configStatus === 'ready') {
    return {
      detail: 'No fixture, reference, placeholder, or static preflight blocker is visible in the current config.',
      id: 'risk-review',
      label: 'Risk review',
      status: 'ready',
    };
  }

  return {
    detail: configStatus === 'blocked'
      ? 'Fix blocked config checks before saving for readiness.'
      : 'Warnings such as fixture/reference servers do not support raising MCP foundation estimates.',
    id: 'risk-review',
    label: 'Risk review',
    status: configStatus,
  };
}

function getOverallStatus(steps: SettingsMcpSavedConfigReadinessReviewStep[]) {
  if (steps.some((step) => step.status === 'blocked')) {
    return 'blocked' as const;
  }

  return steps.some((step) => step.status === 'warning') ? 'warning' as const : 'ready' as const;
}

function getNextAction(steps: SettingsMcpSavedConfigReadinessReviewStep[]) {
  return steps.find((step) => step.status === 'blocked')?.detail
    || steps.find((step) => step.status === 'warning')?.detail
    || 'Save the config, then generate saved-config readiness evidence.';
}

export function createSettingsMcpSavedConfigReadinessReview(options: {
  configText: string;
  draft: SettingsMcpServerDraft;
}): SettingsMcpSavedConfigReadinessReview {
  const parsed = parseMcpConfigText(options.configText);
  const preflight = createSettingsMcpConfigPreflight(options.configText);
  const serverInConfig = parsed.servers.some((server) => (
    Boolean(options.draft.id.trim()) && server.id === options.draft.id.trim()
  ));
  const steps = [
    createConfigSaveableStep(parsed.error),
    createServerCandidatesStep({
      preflightStatus: preflight.status,
      serverCount: preflight.serverCount,
    }),
    createDraftAppliedStep({ draft: options.draft, serverInConfig }),
    createReadinessSourceStep(preflight.status),
    createRiskReviewStep(preflight.status),
  ];
  const status = getOverallStatus(steps);

  return {
    canSaveConfig: !parsed.error,
    configStatus: preflight.status,
    nextAction: getNextAction(steps),
    readyForSavedConfigReadiness: preflight.status === 'ready',
    serverCount: preflight.serverCount,
    status,
    steps,
    summaryText: `MCPSavedConfigReadinessReview status=${status} config=${preflight.status} servers=${preflight.serverCount}`,
  };
}
