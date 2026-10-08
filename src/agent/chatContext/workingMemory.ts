import { type ChatAgentContext, type ChatMessage } from '../../types';
import {
  type AgentChatCommand,
  type AgentChatFollowUpAction,
} from '../agentChatCommand';

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
