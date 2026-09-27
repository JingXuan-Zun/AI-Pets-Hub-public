import { type ChatAgentContext, type ChatMessage } from '../types';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
} from './agentChatCommand';

const AGENT_WORKING_MEMORY_MAX_ITEMS = 4;
const AGENT_WORKING_MEMORY_MAX_LINE_LENGTH = 260;

export interface AgentWorkingMemoryEntry {
  actionLabels: string[];
  command: AgentChatCommand;
  context: ChatAgentContext | null;
  createdAt: number;
  resultText?: string | null;
  status: string;
  summary: string;
  toolName: string;
}

export interface AgentWorkingMemorySnapshot {
  entries: AgentWorkingMemoryEntry[];
  latestEntry: AgentWorkingMemoryEntry | null;
  summaryText: string;
}

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

function compactAgentContextLine(value: string | null | undefined, maxLength = AGENT_WORKING_MEMORY_MAX_LINE_LENGTH) {
  const normalizedValue = value?.trim().replace(/\s+/gu, ' ') ?? '';
  if (!normalizedValue) {
    return '';
  }

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, maxLength - 1)}...`
    : normalizedValue;
}

function resolveAgentContextToolName(command: AgentChatCommand) {
  return command.toolCall?.name ?? command.kind;
}

function resolveAgentContextStatusText(status: string) {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'awaiting-approval' || status === 'pending') {
    return 'awaiting approval';
  }
  if (status === 'failed' || status === 'blocked' || status === 'denied') {
    return status;
  }

  return status || 'unknown';
}

function formatAgentContextDetailLines(context: ChatAgentContext | null) {
  if (!context) {
    return [];
  }

  const lines: string[] = [];
  const stateSummary = context.stateSummary;
  if (stateSummary) {
    lines.push(...[
      stateSummary.observedState?.length ? `observedState=${stateSummary.observedState.slice(0, 3).join(' | ')}` : '',
      stateSummary.changedState?.length ? `changedState=${stateSummary.changedState.slice(0, 3).join(' | ')}` : '',
      stateSummary.verificationEvidence?.length ? `verificationEvidence=${stateSummary.verificationEvidence.slice(0, 3).join(' | ')}` : '',
      stateSummary.missingEvidence?.length ? `missingEvidence=${stateSummary.missingEvidence.slice(0, 3).join(' | ')}` : '',
      stateSummary.recommendedRecovery?.length ? `recommendedRecovery=${stateSummary.recommendedRecovery.slice(0, 3).join(' | ')}` : '',
      stateSummary.structuredEvidence ? `structuredEvidence=${JSON.stringify(stateSummary.structuredEvidence)}` : '',
    ].filter(Boolean));
  }

  const organization = context.desktopOrganization;
  if (organization) {
    const stats = organization.observationStats;
    lines.push([
      organization.mode ? `mode=${organization.mode}` : '',
      organization.displayTarget ? `display=${organization.displayTarget}` : '',
      organization.targetDisplay ? `targetDisplay=${organization.targetDisplay}` : '',
      organization.sourceDisplay ? `sourceDisplay=${organization.sourceDisplay}` : '',
      organization.groupBy ? `groupBy=${organization.groupBy}` : '',
      organization.scope ? `scope=${organization.scope}` : '',
      organization.sourceScope ? `sourceScope=${organization.sourceScope}` : '',
      typeof stats?.displayCount === 'number' ? `displays=${stats.displayCount}` : '',
      typeof stats?.totalIconCount === 'number' ? `totalIcons=${stats.totalIconCount}` : '',
      typeof stats?.targetIconCount === 'number' ? `targetIcons=${stats.targetIconCount}` : '',
      typeof stats?.selectedIconCount === 'number' ? `selectedIcons=${stats.selectedIconCount}` : '',
      typeof stats?.movableIconCount === 'number' ? `movableIcons=${stats.movableIconCount}` : '',
      typeof stats?.selectedMovableIconCount === 'number' ? `selectedMovableIcons=${stats.selectedMovableIconCount}` : '',
      typeof stats?.willMoveAcrossDisplays === 'boolean' ? `crossDisplay=${stats.willMoveAcrossDisplays}` : '',
    ].filter(Boolean).join(', '));
    if (stats?.displayIconCounts?.length) {
      lines.push(`displayOwnership=${stats.displayIconCounts.map((display) => (
        `${display.label}:${display.iconCount}/selected:${display.selectedIconCount ?? 0}`
      )).join(' | ')}`);
    }
    if (stats?.classificationGroups?.length) {
      lines.push(`classification=${stats.classificationGroups.map((group) => (
        `${group.label}:${group.count}`
      )).join(' | ')}`);
    }
    if (stats?.arrangementGroupLayouts?.length) {
      lines.push(`groupLayout=${stats.arrangementGroupLayouts.map((group) => (
        `${group.groupLabel}:${group.count}:rows${group.startRow + 1}-${group.endRow + 1}`
      )).join(' | ')}`);
    }
    lines.push(...(organization.previewSummaryLines ?? []).slice(0, 3));
    if (organization.previewWarning) {
      lines.push(`warning=${organization.previewWarning}`);
    }
  }

  if (context.localProject) {
    lines.push([
      context.localProject.path ? `path=${context.localProject.path}` : '',
      typeof context.localProject.actionCount === 'number' ? `candidateActions=${context.localProject.actionCount}` : '',
    ].filter(Boolean).join(', '));
  }

  if (context.appLaunch) {
    lines.push([
      context.appLaunch.query ? `query=${context.appLaunch.query}` : '',
      typeof context.appLaunch.forceNew === 'boolean' ? `forceNew=${context.appLaunch.forceNew}` : '',
    ].filter(Boolean).join(', '));
  }

  return lines.filter(Boolean);
}

function createAgentWorkingMemoryEntry(options: {
  command: AgentChatCommand;
  context: ChatAgentContext | null;
  followUpActions: AgentChatFollowUpAction[] | null;
  resultText?: string | null;
  status: string;
}): AgentWorkingMemoryEntry {
  const actionLabels = (options.context?.actions?.length ? options.context.actions : options.followUpActions ?? [])
    .map((action) => action.label.trim())
    .filter(Boolean)
    .slice(0, 4);
  const detailLines = formatAgentContextDetailLines(options.context);
  const summaryParts = [
    options.context?.summary,
    ...detailLines,
    actionLabels.length ? `availableActions=${actionLabels.join(' | ')}` : '',
  ]
    .map((line) => compactAgentContextLine(line))
    .filter(Boolean);

  return {
    actionLabels,
    command: options.context?.sourceCommand ?? options.command,
    context: options.context,
    createdAt: options.context?.createdAt ?? Date.now(),
    resultText: compactAgentContextLine(options.resultText, 220) || null,
    status: options.status,
    summary: summaryParts.join(' ; ') || compactAgentContextLine(options.resultText) || 'No compact Agent result summary was saved.',
    toolName: resolveAgentContextToolName(options.context?.sourceCommand ?? options.command),
  };
}

function getAgentWorkingMemoryEntryFromMessage(message: ChatMessage): AgentWorkingMemoryEntry | null {
  const run = message.agentRun ?? null;
  if (run?.command && (run.context || run.followUpActions?.length || run.followUpAction || run.resultText)) {
    return createAgentWorkingMemoryEntry({
      command: run.context?.sourceCommand ?? run.command,
      context: run.context ?? null,
      followUpActions: run.context?.actions?.length
        ? run.context.actions
        : run.followUpActions?.length
          ? run.followUpActions
          : run.followUpAction
            ? [run.followUpAction]
            : null,
      resultText: run.resultText ?? run.followUpText ?? null,
      status: run.status,
    });
  }

  const approval = message.agentApproval ?? null;
  if (approval?.command && (approval.context || approval.followUpActions?.length || approval.followUpAction || approval.resultText)) {
    return createAgentWorkingMemoryEntry({
      command: approval.context?.sourceCommand ?? approval.command,
      context: approval.context ?? null,
      followUpActions: approval.context?.actions?.length
        ? approval.context.actions
        : approval.followUpActions?.length
          ? approval.followUpActions
          : approval.followUpAction
            ? [approval.followUpAction]
            : null,
      resultText: approval.resultText ?? approval.followUpText ?? null,
      status: approval.status,
    });
  }

  return null;
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

export function createAgentWorkingMemorySnapshot(
  messages: ChatMessage[],
  options: {
    maxEntries?: number;
  } = {},
): AgentWorkingMemorySnapshot {
  const maxEntries = Math.max(1, Math.trunc(options.maxEntries ?? AGENT_WORKING_MEMORY_MAX_ITEMS));
  const entries: AgentWorkingMemoryEntry[] = [];
  const seenIds = new Set<string>();

  for (let index = messages.length - 1; index >= 0 && entries.length < maxEntries; index -= 1) {
    const entry = getAgentWorkingMemoryEntryFromMessage(messages[index]);
    if (!entry) {
      continue;
    }

    const entryId = entry.context?.id ?? `${entry.toolName}:${entry.createdAt}:${entry.status}`;
    if (seenIds.has(entryId)) {
      continue;
    }

    seenIds.add(entryId);
    entries.unshift(entry);
  }

  const summaryText = entries.length
    ? entries.map((entry, index) => {
        const actionText = entry.actionLabels.length
          ? ` actions=${entry.actionLabels.join(' | ')}`
          : '';
        return [
          `${index + 1}. tool=${entry.toolName}`,
          `status=${resolveAgentContextStatusText(entry.status)}`,
          `createdAt=${entry.createdAt}`,
          `summary=${compactAgentContextLine(entry.summary, 520)}`,
          actionText,
        ].filter(Boolean).join(' ; ');
      }).join('\n')
    : 'none';

  return {
    entries,
    latestEntry: entries[entries.length - 1] ?? null,
    summaryText,
  };
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
