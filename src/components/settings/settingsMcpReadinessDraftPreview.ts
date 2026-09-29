import {
  applyMcpServerDraftToConfigText,
  hasMcpServerDraftContent,
  type SettingsMcpServerDraft,
} from './settingsMcpConfigFormUtils';
import {
  createSettingsMcpConfigPreflight,
  type SettingsMcpConfigPreflightStatus,
} from './settingsMcpConfigPreflight';
import { createSettingsMcpServerDraftPreflight } from './settingsMcpServerDraftPreflight';

export type SettingsMcpReadinessDraftPreviewStatus = 'blocked' | 'ready' | 'todo' | 'warning';

export interface SettingsMcpReadinessDraftPreview {
  blocker: string;
  configStatus: SettingsMcpConfigPreflightStatus | 'not-applied';
  draftStatus: SettingsMcpReadinessDraftPreviewStatus;
  readyForReadiness: boolean;
  serverCount: number;
  status: SettingsMcpReadinessDraftPreviewStatus;
  summaryText: string;
}

function createTodoPreview(): SettingsMcpReadinessDraftPreview {
  return {
    blocker: 'Load or edit a server draft before previewing readiness.',
    configStatus: 'not-applied',
    draftStatus: 'todo',
    readyForReadiness: false,
    serverCount: 0,
    status: 'todo',
    summaryText: 'MCPReadinessDraftPreview status=todo draft=todo config=not-applied servers=0',
  };
}

function createBlockedPreview(options: {
  blocker: string;
  configStatus?: SettingsMcpConfigPreflightStatus | 'not-applied';
  draftStatus: SettingsMcpReadinessDraftPreviewStatus;
  serverCount?: number;
}): SettingsMcpReadinessDraftPreview {
  return {
    blocker: options.blocker,
    configStatus: options.configStatus ?? 'not-applied',
    draftStatus: options.draftStatus,
    readyForReadiness: false,
    serverCount: options.serverCount ?? 0,
    status: 'blocked',
    summaryText: [
      'MCPReadinessDraftPreview status=blocked',
      `draft=${options.draftStatus}`,
      `config=${options.configStatus ?? 'not-applied'}`,
      `servers=${options.serverCount ?? 0}`,
    ].join(' '),
  };
}

function createPreflightPreview(options: {
  configStatus: SettingsMcpConfigPreflightStatus;
  draftStatus: SettingsMcpReadinessDraftPreviewStatus;
  firstIssue: string;
  serverCount: number;
}): SettingsMcpReadinessDraftPreview {
  const readyForReadiness = options.configStatus === 'ready';
  const status = readyForReadiness
    ? 'ready'
    : options.configStatus === 'warning' ? 'warning' : 'blocked';

  return {
    blocker: readyForReadiness
      ? 'Draft-applied config is ready for saved/draft readiness generation.'
      : options.firstIssue || 'Draft-applied config still needs review before readiness.',
    configStatus: options.configStatus,
    draftStatus: options.draftStatus,
    readyForReadiness,
    serverCount: options.serverCount,
    status,
    summaryText: [
      `MCPReadinessDraftPreview status=${status}`,
      `draft=${options.draftStatus}`,
      `config=${options.configStatus}`,
      `servers=${options.serverCount}`,
    ].join(' '),
  };
}

export function createSettingsMcpReadinessDraftPreview(options: {
  configText: string;
  draft: SettingsMcpServerDraft;
}): SettingsMcpReadinessDraftPreview {
  if (!hasMcpServerDraftContent(options.draft)) {
    return createTodoPreview();
  }

  const draftPreflight = createSettingsMcpServerDraftPreflight(options.draft);
  if (draftPreflight.status === 'blocked') {
    const firstBlocker = draftPreflight.checks.find((check) => check.status === 'blocked');
    return createBlockedPreview({
      blocker: firstBlocker?.detail || 'Fix blocked draft preflight before readiness preview.',
      draftStatus: draftPreflight.status,
    });
  }

  const applied = applyMcpServerDraftToConfigText(options.configText, options.draft);
  if (applied.error) {
    return createBlockedPreview({
      blocker: applied.error,
      draftStatus: draftPreflight.status,
    });
  }

  const configPreflight = createSettingsMcpConfigPreflight(applied.rawText);
  const firstIssue = configPreflight.checks.find((check) => check.status === configPreflight.status);
  return createPreflightPreview({
    configStatus: configPreflight.status,
    draftStatus: draftPreflight.status,
    firstIssue: firstIssue?.detail || '',
    serverCount: configPreflight.serverCount,
  });
}
