import {
  hasMcpServerDraftContent,
  parseMcpConfigText,
  type SettingsMcpServerDraft,
} from './settingsMcpConfigFormUtils';
import {
  createSettingsMcpConfigPreflight,
  type SettingsMcpConfigPreflightStatus,
} from './settingsMcpConfigPreflight';
import {
  createSettingsMcpServerDraftPreflight,
  type SettingsMcpServerDraftPreflightCheck,
  type SettingsMcpServerDraftPreflightStatus,
} from './settingsMcpServerDraftPreflight';

export type SettingsMcpRealServerGuideStatus = 'blocked' | 'ready' | 'todo';

export interface SettingsMcpRealServerGuideStep {
  detail: string;
  id: string;
  label: string;
  status: SettingsMcpRealServerGuideStatus;
}

export interface SettingsMcpRealServerGuideResult {
  configStatus: SettingsMcpConfigPreflightStatus;
  draftStatus: SettingsMcpServerDraftPreflightStatus;
  readyForReadiness: boolean;
  status: SettingsMcpRealServerGuideStatus;
  steps: SettingsMcpRealServerGuideStep[];
  summaryText: string;
}

function firstDraftIssue(
  checks: SettingsMcpServerDraftPreflightCheck[],
  status: SettingsMcpServerDraftPreflightStatus,
) {
  return checks.find((check) => check.status === status);
}

function hasDraftCheck(checks: SettingsMcpServerDraftPreflightCheck[], id: string) {
  return checks.some((check) => check.id === id);
}

function createDraftSelectionStep(hasContent: boolean): SettingsMcpRealServerGuideStep {
  return hasContent ? {
    detail: 'A draft server is loaded for review.',
    id: 'draft-selected',
    label: 'Draft selected',
    status: 'ready',
  } : {
    detail: 'Load a template or select an existing server before preparing real soak.',
    id: 'draft-selected',
    label: 'Draft selected',
    status: 'todo',
  };
}

function createPlaceholderStep(options: {
  checks: SettingsMcpServerDraftPreflightCheck[];
  hasContent: boolean;
}): SettingsMcpRealServerGuideStep {
  if (!options.hasContent) {
    return {
      detail: 'Template values have not been reviewed yet.',
      id: 'replace-placeholders',
      label: 'Replace placeholders',
      status: 'todo',
    };
  }

  return hasDraftCheck(options.checks, 'placeholder-values') ? {
    detail: 'Replace template package names, script paths, and secrets before saving.',
    id: 'replace-placeholders',
    label: 'Replace placeholders',
    status: 'blocked',
  } : {
    detail: 'No obvious template placeholders remain in this draft.',
    id: 'replace-placeholders',
    label: 'Replace placeholders',
    status: 'ready',
  };
}

function createDraftPreflightStep(options: {
  hasContent: boolean;
  issue?: SettingsMcpServerDraftPreflightCheck;
  status: SettingsMcpServerDraftPreflightStatus;
}): SettingsMcpRealServerGuideStep {
  if (!options.hasContent) {
    return {
      detail: 'Draft preflight will run after a server draft is loaded.',
      id: 'draft-preflight',
      label: 'Draft preflight',
      status: 'todo',
    };
  }

  if (options.status === 'blocked') {
    return {
      detail: options.issue?.detail || 'Fix blocked draft checks before applying this server.',
      id: 'draft-preflight',
      label: 'Draft preflight',
      status: 'blocked',
    };
  }

  return {
    detail: options.status === 'ready'
      ? 'Draft checks are ready for applying to config JSON.'
      : options.issue?.detail || 'Review draft warnings before readiness.',
    id: 'draft-preflight',
    label: 'Draft preflight',
    status: options.status === 'ready' ? 'ready' : 'todo',
  };
}

function createApplyStep(options: {
  draft: SettingsMcpServerDraft;
  draftBlocked: boolean;
  serverInConfig: boolean;
}): SettingsMcpRealServerGuideStep {
  if (options.draftBlocked) {
    return {
      detail: 'Blocked drafts cannot be applied to the saved JSON path yet.',
      id: 'apply-to-config',
      label: 'Apply to config',
      status: 'blocked',
    };
  }

  return options.serverInConfig ? {
    detail: `Server ${options.draft.id.trim()} is present in the current config JSON.`,
    id: 'apply-to-config',
    label: 'Apply to config',
    status: 'ready',
  } : {
    detail: 'Apply the reviewed draft to JSON config before saving.',
    id: 'apply-to-config',
    label: 'Apply to config',
    status: 'todo',
  };
}

function createConfigStep(status: SettingsMcpConfigPreflightStatus): SettingsMcpRealServerGuideStep {
  if (status === 'blocked') {
    return {
      detail: 'Config preflight is blocked; readiness will not produce real-server candidates.',
      id: 'config-preflight',
      label: 'Config preflight',
      status: 'blocked',
    };
  }

  return {
    detail: status === 'ready'
      ? 'Config preflight is ready for saved-config readiness.'
      : 'Review config warnings before treating readiness as external soak evidence.',
    id: 'config-preflight',
    label: 'Config preflight',
    status: status === 'ready' ? 'ready' : 'todo',
  };
}

function createReadinessStep(configStatus: SettingsMcpConfigPreflightStatus): SettingsMcpRealServerGuideStep {
  return configStatus === 'ready' ? {
    detail: 'Save the config, generate readiness, then run generated per-server soak commands.',
    id: 'run-readiness',
    label: 'Run readiness',
    status: 'ready',
  } : {
    detail: 'Readiness should wait until config preflight is ready.',
    id: 'run-readiness',
    label: 'Run readiness',
    status: configStatus === 'blocked' ? 'blocked' : 'todo',
  };
}

function getOverallStatus(steps: SettingsMcpRealServerGuideStep[]) {
  if (steps.some((step) => step.status === 'blocked')) {
    return 'blocked' as const;
  }

  return steps.every((step) => step.status === 'ready') ? 'ready' as const : 'todo' as const;
}

export function createSettingsMcpRealServerConfigGuide(options: {
  configText: string;
  draft: SettingsMcpServerDraft;
}): SettingsMcpRealServerGuideResult {
  const draftPreflight = createSettingsMcpServerDraftPreflight(options.draft);
  const configPreflight = createSettingsMcpConfigPreflight(options.configText);
  const parsedConfig = parseMcpConfigText(options.configText);
  const hasContent = hasMcpServerDraftContent(options.draft);
  const draftIssue = firstDraftIssue(draftPreflight.checks, draftPreflight.status);
  const serverInConfig = parsedConfig.servers.some((server) => (
    Boolean(options.draft.id.trim()) && server.id === options.draft.id.trim()
  ));
  const steps = [
    createDraftSelectionStep(hasContent),
    createPlaceholderStep({ checks: draftPreflight.checks, hasContent }),
    createDraftPreflightStep({ hasContent, issue: draftIssue, status: draftPreflight.status }),
    createApplyStep({ draft: options.draft, draftBlocked: draftPreflight.status === 'blocked', serverInConfig }),
    createConfigStep(configPreflight.status),
    createReadinessStep(configPreflight.status),
  ];
  const status = getOverallStatus(steps);
  return {
    configStatus: configPreflight.status,
    draftStatus: draftPreflight.status,
    readyForReadiness: status === 'ready',
    status,
    steps,
    summaryText: `MCPRealServerConfigGuide status=${status} draft=${draftPreflight.status} config=${configPreflight.status}`,
  };
}
