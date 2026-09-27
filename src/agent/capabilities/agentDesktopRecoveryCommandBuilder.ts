import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import {
  type AgentRuntimeToolResultEntry as AgentDesktopToolResultEntry,
} from '../runtime/agentRuntimeContract';
import {
  compactAgentText as compactAgentDesktopPlanningSignalText,
  getAgentStructuredEvidence as getAgentDesktopStructuredEvidence,
} from '../runtime/agentToolEvidence';
import { createAgentToolCommand as createAgentDesktopToolCommand } from '../runtime/agentToolCommandFactory';

export const AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER = 'AgentSessionV2 failed desktop action recovery';

export function resolveAgentDesktopAutoRecoveryQuery(options: {
  latestEntry: AgentDesktopToolResultEntry;
  recoveryArgs?: Record<string, unknown> | null;
  sourceText: string;
  userGoal: string;
}) {
  const input = options.latestEntry.command.toolCall?.input ?? {};
  const evidence = getAgentDesktopStructuredEvidence(options.latestEntry);
  const candidates = [
    options.recoveryArgs?.query,
    options.recoveryArgs?.target,
    options.recoveryArgs?.name,
    options.recoveryArgs?.title,
    options.recoveryArgs?.processName,
    options.recoveryArgs?.targetText,
    options.recoveryArgs?.targetDescription,
    input.postVerifyVisualQuery,
    input.visualVerifyQuery,
    input.visualQuery,
    input.postVerifyQuery,
    input.verifyQuery,
    input.query,
    input.target,
    input.name,
    input.title,
    input.processName,
    evidence?.targetMatched,
    evidence?.finalWindow?.title,
    evidence?.finalWindow?.processName,
    options.userGoal,
    options.sourceText,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

export function isAgentDesktopFailedDesktopActionRecoveryCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  const input = command.toolCall?.input ?? {};
  return (
    toolName === 'execute_desktop_observation'
    || toolName === 'observe_windows_and_apps'
  ) && (
    (
      typeof input.question === 'string'
      && input.question.includes(AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER)
    )
    || (
      typeof input.recoveryReason === 'string'
      && input.recoveryReason.includes(AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER)
    )
  );
}

export function countAgentDesktopFailedDesktopActionRecoveryRuns(
  toolResults: AgentDesktopToolResultEntry[],
) {
  return toolResults.filter((entry) => (
    isAgentDesktopFailedDesktopActionRecoveryCommand(entry.command)
  )).length;
}

function isAgentDesktopFailedDesktopActionRecoverySource(
  entry: AgentDesktopToolResultEntry | null,
) {
  if (!entry) {
    return false;
  }

  const toolName = entry.command.toolCall?.name;
  if (isAgentDesktopFailedDesktopActionRecoveryCommand(entry.command)) {
    return false;
  }

  const isDesktopActionTool = toolName === 'execute_desktop_action'
    || toolName === 'execute_desktop_input'
    || toolName === 'execute_desktop_sequence';
  if (!isDesktopActionTool) {
    return false;
  }

  return entry.result.ok === false
    || entry.result.receipt?.status === 'unverified'
    || entry.result.assessment?.status === 'unverified'
    || Boolean(entry.result.stateSummary?.missingEvidence?.length)
    || Boolean(entry.result.stateSummary?.recommendedRecovery?.length);
}

function getAgentDesktopFailedDesktopActionEvidenceText(result: AgentChatCommandResult) {
  return [
    result.errorText,
    result.responseText,
    result.verification,
    ...(result.observations ?? []),
    ...(result.stateSummary?.missingEvidence ?? []),
    ...(result.stateSummary?.recommendedRecovery ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC').toLowerCase();
}

function shouldInspectWindowUiForAgentDesktopFailedDesktopAction(
  entry: AgentDesktopToolResultEntry,
) {
  const toolName = entry.command.toolCall?.name;
  if (toolName === 'execute_desktop_input' || toolName === 'execute_desktop_sequence') {
    return true;
  }

  const inputText = JSON.stringify(entry.command.toolCall?.input ?? '').normalize('NFKC').toLowerCase();
  const evidenceText = getAgentDesktopFailedDesktopActionEvidenceText(entry.result);

  return /(?:click|coordinate|cursor|button|control|invoke|type|keyboard|hotkey|drag|focus|input|ui\s*automation|\u5750\u6807|\u5149\u6807|\u6309\u94ae|\u63a7\u4ef6|\u8f93\u5165|\u952e\u76d8|\u62d6\u62fd|\u805a\u7126)/iu.test(`${inputText}\n${evidenceText}`);
}

export function createAgentDesktopFailedDesktopActionRecoveryCommand(options: {
  latestEntry: AgentDesktopToolResultEntry | null;
  sourceText: string;
  toolResults: AgentDesktopToolResultEntry[];
  userGoal: string;
}): AgentChatCommand | null {
  const { latestEntry, sourceText, toolResults, userGoal } = options;
  if (
    !isAgentDesktopFailedDesktopActionRecoverySource(latestEntry)
    || !latestEntry
    || isAgentDesktopFailedDesktopActionRecoveryCommand(latestEntry.command)
    || countAgentDesktopFailedDesktopActionRecoveryRuns(toolResults) >= 1
  ) {
    return null;
  }

  const failedToolName = latestEntry.command.toolCall?.name ?? latestEntry.command.kind;
  const query = resolveAgentDesktopAutoRecoveryQuery({
    latestEntry,
    sourceText,
    userGoal,
  });
  const errorText = latestEntry.result.errorText
    || latestEntry.result.responseText
    || latestEntry.result.verification
    || '';

  if (shouldInspectWindowUiForAgentDesktopFailedDesktopAction(latestEntry)) {
    return createAgentDesktopToolCommand({
      args: {
        action: 'inspect_window_ui',
        forceRefresh: true,
        limit: 80,
        maxDepth: 6,
        question: [
          AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER,
          `The previous desktop action tool is incomplete or unverified: ${failedToolName}.`,
          query ? `Target/window/content query: ${query}.` : '',
          errorText ? `Incomplete-action evidence: ${compactAgentDesktopPlanningSignalText(errorText, 280)}.` : '',
          'Use read-only UI Automation to inspect the active or named app window for controls, buttons, text, enabled/offscreen state, bounds, and supported actions.',
          'Return targetCandidates/actionCandidates, elementCenter or elementBounds, targetMatched, primaryAction, relation, and visualActionReadiness when possible.',
          'Do not click, invoke, type, focus, move, or change anything.',
        ].filter(Boolean).join(' '),
        ...(query ? { query, targetDescription: query, targetText: query } : {}),
      },
      sourceText,
      toolName: 'execute_desktop_observation',
      userGoal,
    });
  }

  return createAgentDesktopToolCommand({
    args: {
      forceRefresh: true,
      includeActiveWindow: true,
      includeDisplays: true,
      includeInstalledApps: false,
      includeRunningApps: true,
      includeTaskbarPinned: false,
      limit: 30,
      ...(query ? { query } : {}),
      recoveryReason: [
        AGENT_DESKTOP_FAILED_DESKTOP_ACTION_RECOVERY_MARKER,
        `The previous desktop action tool is incomplete or unverified: ${failedToolName}.`,
        'Read current window/app/display ownership before retrying, inspecting the launcher UI, or asking the user.',
      ].join(' '),
    },
    sourceText,
    toolName: 'observe_windows_and_apps',
    userGoal,
  });
}
