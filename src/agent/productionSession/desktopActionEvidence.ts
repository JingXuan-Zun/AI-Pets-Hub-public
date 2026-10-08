import { type AgentChatCommand, type AgentToolCallName } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry as AgentProductionToolResultEntry } from '../runtime/agentRuntimeContract';
import { hasAgentDirectActionIntent } from '../runtime/agentActionCoverage';

interface AgentProductionDesktopActionEvidenceDependencies {
  normalizeToolActionName: (value: string) => string;
  hasDesktopOrganizationRequest: (text: string) => boolean;
  hasWindowMoveToDisplayRequest: (text: string) => boolean;
  isRecoverableUnverifiedToolResult: (entry: AgentProductionToolResultEntry | null) => boolean;
}

export function createAgentProductionDesktopActionEvidence(dependencies: AgentProductionDesktopActionEvidenceDependencies) {
  const {
    normalizeToolActionName: normalizeAgentSessionV2ToolActionName,
    hasDesktopOrganizationRequest: hasAgentSessionV2DesktopOrganizationRequest,
    hasWindowMoveToDisplayRequest: hasAgentSessionV2WindowMoveToDisplayRequest,
    isRecoverableUnverifiedToolResult: isAgentSessionV2RecoverableUnverifiedToolResult,
  } = dependencies;

  function getAgentProductionToolInputString(
    command: AgentChatCommand,
    key: string,
  ) {
    const value = command.toolCall?.input?.[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  function isAgentProductionDesktopItemObservationCommand(command: AgentChatCommand) {
    if (command.toolCall?.name !== 'execute_desktop_observation') {
      return false;
    }

    const action = getAgentProductionToolInputString(command, 'action')
      .toLowerCase()
      .replace(/[-\s]+/gu, '_');
    return action === 'list_desktop_items'
      || action === 'desktop_items'
      || action === 'desktop_icons'
      || action === 'list_desktop_icons'
      || action === 'diagnose_desktop_icons'
      || action === 'desktop_icon_diagnostics'
      || action === 'desktop_icon_status';
  }

  function isAgentProductionDesktopOrganizationPreviewCommand(command: AgentChatCommand) {
    if (command.kind === 'desktop-organization') {
      return command.desktopOrganization?.mode !== 'execute';
    }

    if (command.toolCall?.name !== 'organize_desktop_icons') {
      return false;
    }

    return command.toolCall.input?.mode !== 'execute';
  }

  const AGENT_PRODUCTION_TRANSITIONAL_DESKTOP_ACTIONS = new Set([
    'open_or_focus_then_control_window',
    'open_then_control_window',
    'launch_then_control_window',
    'focus_then_control_window',
    'open_or_focus_then_move_window_to_display',
    'open_then_move_window_to_display',
    'launch_then_move_window_to_display',
  ]);

  function getAgentProductionDesktopActionName(args: Record<string, unknown> | undefined) {
    const action = args?.action ?? args?.desktopAction ?? args?.operation;
    return typeof action === 'string'
      ? normalizeAgentSessionV2ToolActionName(action)
      : '';
  }

  function shouldRejectAgentProductionTransitionalDesktopAction(options: {
    args: Record<string, unknown> | undefined;
    toolName: AgentToolCallName;
  }) {
    return options.toolName === 'execute_desktop_action'
      && AGENT_PRODUCTION_TRANSITIONAL_DESKTOP_ACTIONS.has(getAgentProductionDesktopActionName(options.args));
  }

  function getAgentProductionDesktopSequenceSteps(command: AgentChatCommand) {
    if (command.toolCall?.name !== 'execute_desktop_sequence') {
      return [];
    }

    const stepsJson = getAgentProductionToolInputString(command, 'stepsJson');
    if (!stepsJson) {
      return [];
    }

    try {
      const parsed = JSON.parse(stepsJson) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getAgentProductionRecordString(
    input: Record<string, unknown>,
    key: string,
  ) {
    const value = input[key];
    return typeof value === 'string' ? value.trim() : '';
  }

  function isAgentProductionDisplayTargetArgs(args: Record<string, unknown>) {
    return Boolean(
      getAgentProductionRecordString(args, 'targetDisplay')
      || getAgentProductionRecordString(args, 'displayId')
      || getAgentProductionRecordString(args, 'display')
      || getAgentProductionRecordString(args, 'displayTarget')
      || getAgentProductionRecordString(args, 'screen')
      || getAgentProductionRecordString(args, 'screenTarget')
    );
  }

  function isAgentProductionMoveWindowSequenceStep(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const step = value as Record<string, unknown>;
    if (step.tool !== 'execute_desktop_action') {
      return false;
    }

    const rawArgs = step.args ?? step.input;
    if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
      return false;
    }

    const args = rawArgs as Record<string, unknown>;
    const action = normalizeAgentSessionV2ToolActionName(
      typeof args.action === 'string' ? args.action : '',
    );

    if (action === 'control_window') {
      return isAgentProductionDisplayTargetArgs(args);
    }

    return action === 'move_window'
      || action === 'open_or_focus_then_control_window'
      || action === 'open_then_control_window'
      || action === 'launch_then_control_window'
      || action === 'focus_then_control_window'
      || action === 'open_or_focus_then_move_window_to_display'
      || action === 'open_then_move_window_to_display'
      || action === 'launch_then_move_window_to_display'
      || action === 'move_window_to_display'
      || action === 'move_window_to_screen'
      || action === 'move_window_to_monitor';
  }

  function isAgentProductionMoveWindowToDisplayCommand(command: AgentChatCommand) {
    const sequenceSteps = getAgentProductionDesktopSequenceSteps(command);
    if (sequenceSteps.some(isAgentProductionMoveWindowSequenceStep)) {
      return true;
    }

    if (command.toolCall?.name !== 'execute_desktop_action') {
      return false;
    }

    const action = normalizeAgentSessionV2ToolActionName(getAgentProductionToolInputString(command, 'action'));
    if (action === 'control_window' || action === 'open_or_focus_then_control_window') {
      return Boolean(
        getAgentProductionToolInputString(command, 'targetDisplay')
        || getAgentProductionToolInputString(command, 'displayId')
        || getAgentProductionToolInputString(command, 'display')
        || getAgentProductionToolInputString(command, 'displayTarget')
        || getAgentProductionToolInputString(command, 'screen')
        || getAgentProductionToolInputString(command, 'screenTarget')
      );
    }

    return action === 'move_window'
      || action === 'open_or_focus_then_control_window'
      || action === 'open_then_control_window'
      || action === 'launch_then_control_window'
      || action === 'focus_then_control_window'
      || action === 'open_or_focus_then_move_window_to_display'
      || action === 'open_then_move_window_to_display'
      || action === 'launch_then_move_window_to_display'
      || action === 'move_window_to_display'
      || action === 'move_window_to_screen'
      || action === 'move_window_to_monitor';
  }

  function hasSuccessfulAgentProductionDesktopItemObservation(
    toolResults: AgentProductionToolResultEntry[],
  ) {
    return toolResults.some((entry) => (
      entry.result.ok !== false && isAgentProductionDesktopItemObservationCommand(entry.command)
    ));
  }

  function hasAgentProductionDesktopOrganizationPreview(
    toolResults: AgentProductionToolResultEntry[],
  ) {
    return toolResults.some((entry) => (
      entry.result.ok !== false && isAgentProductionDesktopOrganizationPreviewCommand(entry.command)
    ));
  }

  function hasAgentProductionDesktopOrganizationExecuteAttempt(
    toolResults: AgentProductionToolResultEntry[],
  ) {
    return toolResults.some((entry) => {
      const command = entry.command;
      if (command.kind === 'desktop-organization') {
        return command.desktopOrganization?.mode === 'execute';
      }

      return command.toolCall?.name === 'organize_desktop_icons'
        && command.toolCall.input?.mode === 'execute';
    });
  }

  function getLatestAgentProductionDesktopOrganizationExecuteAttempt(
    toolResults: AgentProductionToolResultEntry[],
  ) {
    return [...toolResults].reverse().find((entry) => {
      const command = entry.command;
      if (command.kind === 'desktop-organization') {
        return command.desktopOrganization?.mode === 'execute';
      }

      return command.toolCall?.name === 'organize_desktop_icons'
        && command.toolCall.input?.mode === 'execute';
    }) ?? null;
  }

  function hasAgentProductionMoveWindowToDisplayAttempt(
    toolResults: AgentProductionToolResultEntry[],
  ) {
    return toolResults.some((entry) => isAgentProductionMoveWindowToDisplayCommand(entry.command));
  }

  function shouldRejectAgentProductionPrematureDesktopOrganizationFinal(options: {
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    const text = `${options.userGoal} ${options.sourceText}`.trim().replace(/\s+/gu, ' ');
    if (
      !hasAgentSessionV2DesktopOrganizationRequest(text)
      || !hasAgentDirectActionIntent(options.sourceText, options.userGoal)
    ) {
      return false;
    }

    const latestExecuteAttempt = getLatestAgentProductionDesktopOrganizationExecuteAttempt(options.toolResults);
    if (latestExecuteAttempt && isAgentSessionV2RecoverableUnverifiedToolResult(latestExecuteAttempt)) {
      return true;
    }

    return (
        hasSuccessfulAgentProductionDesktopItemObservation(options.toolResults)
        || hasAgentProductionDesktopOrganizationPreview(options.toolResults)
      )
      && !hasAgentProductionDesktopOrganizationExecuteAttempt(options.toolResults);
  }

  function shouldRejectAgentProductionPrematureWindowMoveFinal(options: {
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    const text = `${options.userGoal} ${options.sourceText}`.trim().replace(/\s+/gu, ' ');
    return hasAgentSessionV2WindowMoveToDisplayRequest(text)
      && hasAgentDirectActionIntent(options.sourceText, options.userGoal)
      && !hasAgentProductionMoveWindowToDisplayAttempt(options.toolResults);
  }

  return {
    getAgentProductionDesktopActionName,
    shouldRejectAgentProductionTransitionalDesktopAction,
    shouldRejectAgentProductionPrematureDesktopOrganizationFinal,
    shouldRejectAgentProductionPrematureWindowMoveFinal,
  };
}
