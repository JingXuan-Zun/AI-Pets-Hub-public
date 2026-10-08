export {
  type AgentWorkingMemoryEntry,
  type AgentWorkingMemorySnapshot,
  createAgentWorkingMemorySnapshot,
} from './chatContext/workingMemory';

import { type ChatAgentContext, type ChatMessage } from '../types';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
} from './agentChatCommand';

function resolveResultFollowUpActions(result: AgentChatCommandResult) {
  return result.followUpActions?.length
    ? result.followUpActions
    : result.followUpAction
      ? [result.followUpAction]
      : [];
}

function getToolStringInput(
  command: AgentChatCommand,
  keys: string[],
) {
  const input = command.toolCall?.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function getToolBooleanInput(command: AgentChatCommand, key: string) {
  const value = command.toolCall?.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getToolDesktopOrganization(command: AgentChatCommand) {
  if (command.desktopOrganization) {
    return command.desktopOrganization;
  }

  if (command.toolCall?.name !== 'organize_desktop_icons') {
    return null;
  }

  const input = command.toolCall.input;
  const displayTarget = input.targetDisplay === 'primary'
    || input.targetDisplay === 'secondary'
    || input.targetDisplay === 'current'
    || input.targetDisplay === 'all'
    ? input.targetDisplay
    : input.displayTarget === 'primary'
      || input.displayTarget === 'secondary'
      || input.displayTarget === 'current'
      || input.displayTarget === 'all'
      ? input.displayTarget
      : undefined;
  const sourceDisplay = input.sourceDisplay === 'primary'
    || input.sourceDisplay === 'secondary'
    || input.sourceDisplay === 'current'
    || input.sourceDisplay === 'all'
    ? input.sourceDisplay
    : undefined;
  const scope = input.sourceScope === 'all-icons' || input.sourceScope === 'display-icons'
    ? input.sourceScope
    : input.scope === 'all-icons' || input.scope === 'display-icons'
      ? input.scope
      : undefined;
  return {
    displayTarget,
    groupBy: input.groupBy === 'none'
      || input.groupBy === 'kind'
      || input.groupBy === 'category'
      || input.groupBy === 'extension'
      ? input.groupBy
      : undefined,
    mode: input.mode === 'preview' || input.mode === 'execute'
      ? input.mode
      : undefined,
    scope,
    sourceDisplay,
    sourceScope: scope,
    targetDisplay: displayTarget,
  } satisfies NonNullable<AgentChatCommand['desktopOrganization']>;
}

function inferContextKind(command: AgentChatCommand): ChatAgentContext['kind'] {
  if (command.kind === 'context-query') {
    return 'context-query';
  }

  if (command.kind === 'desktop-organization' || command.toolCall?.name === 'organize_desktop_icons') {
    return 'desktop-organization';
  }

  if (command.kind === 'desktop-icon-placement' || command.toolCall?.name === 'place_desktop_icon') {
    return 'desktop-icon-placement';
  }

  if (command.kind === 'app-launch' || command.toolCall?.name === 'launch_local_app') {
    return 'app-launch';
  }

  if (command.toolCall?.name === 'inspect_local_project' || command.toolCall?.name === 'run_local_project_action') {
    return 'local-project';
  }

  if (command.toolCall?.name === 'get_display_info' || command.toolCall?.name === 'get_system_info') {
    return 'system-info';
  }

  return 'generic-tool';
}

function createContextId(command: AgentChatCommand) {
  return [
    'agent-context',
    command.kind,
    command.toolCall?.name ?? 'direct',
    Date.now().toString(36),
  ].join(':');
}

function extractLocalProjectPath(command: AgentChatCommand) {
  return getToolStringInput(command, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
}

function extractAppLaunchQuery(command: AgentChatCommand) {
  if (command.appLaunch?.appName) {
    return command.appLaunch.appName;
  }

  return getToolStringInput(command, ['query', 'appName', 'name']);
}

export function createAgentContextFromResult(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): ChatAgentContext {
  const actions = resolveResultFollowUpActions(result);
  const kind = inferContextKind(command);
  const organization = getToolDesktopOrganization(command);
  const context: ChatAgentContext = {
    actions: actions.length ? actions : null,
    createdAt: Date.now(),
    id: createContextId(command),
    kind,
    sourceCommand: command,
    stateSummary: result.stateSummary ?? null,
    summary: result.assessment?.summary ?? result.verification ?? result.followUp ?? result.responseText ?? null,
  };

  if (organization) {
    context.desktopOrganization = {
      displayTarget: organization.displayTarget,
      groupBy: organization.groupBy,
      hasPreviewPlan: Boolean(
        organization.mode !== 'execute'
        && actions.some((action) => action.kind === 'run-command' && action.command.desktopOrganization?.mode === 'execute'),
      ),
      mode: organization.mode,
      observationStats: result.observationStats ?? null,
      previewSummaryLines: result.previewSummaryLines,
      previewWarning: result.previewWarning ?? null,
      scope: organization.scope,
      sourceDisplay: organization.sourceDisplay,
      sourceScope: organization.sourceScope,
      targetDisplay: organization.targetDisplay,
    };
  }

  if (kind === 'local-project') {
    context.localProject = {
      actionCount: actions.filter((action) => action.kind === 'run-command').length,
      path: extractLocalProjectPath(command),
    };
  }

  if (kind === 'app-launch') {
    context.appLaunch = {
      forceNew: command.appLaunch?.forceNew ?? getToolBooleanInput(command, 'forceNew'),
      query: extractAppLaunchQuery(command),
    };
  }

  return context;
}

export interface LatestAgentContextMessage {
  command: AgentChatCommand;
  context: ChatAgentContext | null;
  followUpAction: AgentChatFollowUpAction | null;
  followUpActions: AgentChatFollowUpAction[] | null;
  followUpText?: string | null;
  status: string;
}

export interface LatestDesktopObservationContext {
  command: AgentChatCommand;
  context: ChatAgentContext;
  message: ChatMessage;
  status: string;
}

export function findLatestAgentContextMessage(messages: ChatMessage[]): LatestAgentContextMessage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const run = message?.agentRun ?? null;
    if ((run?.context || run?.followUpAction || run?.followUpText) && run.command) {
      return {
        command: run.context?.sourceCommand ?? run.command,
        context: run.context ?? null,
        followUpAction: run.followUpAction ?? null,
        followUpActions: run.context?.actions?.length
          ? run.context.actions
          : run.followUpActions ?? null,
        followUpText: run.followUpText,
        status: run.status,
      };
    }

    const approval = message?.agentApproval ?? null;
    if ((approval?.context || approval?.followUpAction || approval?.followUpText) && approval.command) {
      return {
        command: approval.context?.sourceCommand ?? approval.command,
        context: approval.context ?? null,
        followUpAction: approval.followUpAction ?? null,
        followUpActions: approval.context?.actions?.length
          ? approval.context.actions
          : approval.followUpActions ?? null,
        followUpText: approval.followUpText,
        status: approval.status,
      };
    }
  }

  return null;
}

export function findLatestDesktopObservationContext(messages: ChatMessage[]): LatestDesktopObservationContext | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const run = message?.agentRun ?? null;
    if (run?.context?.kind === 'desktop-organization' && run.context.desktopOrganization?.previewSummaryLines?.length) {
      return {
        command: run.context.sourceCommand ?? run.command,
        context: run.context,
        message,
        status: run.status,
      };
    }

    const approval = message?.agentApproval ?? null;
    if (approval?.context?.kind === 'desktop-organization' && approval.context.desktopOrganization?.previewSummaryLines?.length) {
      return {
        command: approval.context.sourceCommand ?? approval.command,
        context: approval.context,
        message,
        status: approval.status,
      };
    }
  }

  return null;
}

export function formatDesktopObservationContextAnswer(context: ChatAgentContext) {
  const organization = context.desktopOrganization;
  const stats = organization?.observationStats ?? null;
  const lines = organization?.previewSummaryLines?.length
    ? organization.previewSummaryLines
    : context.summary
      ? [context.summary]
      : [];
  const targetLabel = stats?.targetDisplayLabel ?? (
    organization?.displayTarget === 'secondary'
      ? '副屏'
      : organization?.displayTarget === 'primary'
        ? '主屏'
        : '目标屏幕'
  );
  const countLine = stats
    ? [
        typeof stats.displayCount === 'number' ? `显示器 ${stats.displayCount} 个` : '',
        typeof stats.totalIconCount === 'number' ? `桌面图标总数 ${stats.totalIconCount} 个` : '',
        typeof stats.targetIconCount === 'number' ? `${targetLabel}范围内 ${stats.targetIconCount} 个图标` : '',
        typeof stats.selectedIconCount === 'number' ? `计划处理 ${stats.selectedIconCount} 个` : '',
      ].filter(Boolean).join('；')
    : '';
  const moveReadinessLine = typeof stats?.selectedMovableIconCount === 'number'
    ? `selected movable icons: ${stats.selectedMovableIconCount}/${stats.selectedIconCount ?? '?'}`
    : '';
  const displayOwnershipLine = stats?.displayIconCounts?.length
    ? `display ownership: ${stats.displayIconCounts.map((display) => (
      `${display.label} ${display.iconCount}, selected ${display.selectedIconCount ?? 0}`
    )).join(' | ')}`
    : '';
  const classificationLine = stats?.classificationGroups?.length
    ? `classification: ${stats.classificationGroups.map((group) => (
      `${group.label} ${group.count}`
    )).join(' | ')}`
    : '';
  const groupLayoutLine = stats?.arrangementGroupLayouts?.length
    ? `group layout: ${stats.arrangementGroupLayouts.map((group) => (
      `${group.groupLabel} ${group.count} rows ${group.startRow + 1}-${group.endRow + 1}`
    )).join(' | ')}`
    : '';
  const moveLine = typeof stats?.willMoveAcrossDisplays === 'boolean'
    ? stats.willMoveAcrossDisplays
      ? '这份计划会跨屏移动图标。'
      : '这份计划不会移动其他屏幕上的图标。'
    : '';
  const answerLines = [
    '我按刚才那次桌面观察记录回答：',
    countLine,
    moveReadinessLine,
    displayOwnershipLine,
    classificationLine,
    groupLayoutLine,
    ...lines.slice(0, 5),
    moveLine,
    organization?.previewWarning ?? '',
  ].filter(Boolean);

  return answerLines.join('\n');
}
