import type { AgentChatCommand } from '../../agentChatCommand';
import type { AgentRequestedActionKind } from '../agentActionCoverage';
import { addAgentActionCoverage, createAgentExplicitlyProhibitedActionCoverage } from './requestedActionCoverage';

const AGENT_URL_LIKE_TARGET_PATTERN = /^(?:https?:\/\/|www\.|[\w-]+(?:\.[\w-]+)+(?:[/:?#]|$))/iu;

export function normalizeAgentToolActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
}

export function getAgentToolInputString(
  command: AgentChatCommand,
  key: string,
) {
  const value = command.toolCall?.input?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function isAgentProbablyUrlTarget(value: unknown) {
  return typeof value === 'string' && AGENT_URL_LIKE_TARGET_PATTERN.test(value.trim());
}

export function addAgentDesktopInputCoverage(
  coverage: Set<AgentRequestedActionKind>,
) {
  addAgentActionCoverage(coverage, 'desktop-input');
}

export function addAgentDesktopActionCoverageFromArgs(
  coverage: Set<AgentRequestedActionKind>,
  args: Record<string, unknown>,
) {
  const action = normalizeAgentToolActionName(
    typeof args.action === 'string'
      ? args.action
      : typeof args.operation === 'string'
        ? args.operation
        : typeof args.desktopAction === 'string'
          ? args.desktopAction
          : '',
  );
  const resourceType = typeof args.resourceType === 'string'
    ? normalizeAgentToolActionName(args.resourceType)
    : '';

  if (
    action === 'launch_local_app'
    || action === 'open_resource'
    || action === 'focus_window'
    || action === 'open_app'
    || action === 'start_app'
  ) {
    addAgentActionCoverage(coverage, 'open-or-launch');
  }

  if (
    action === 'control_window'
    || action === 'move_window'
    || action === 'move_window_to_display'
    || action === 'move_window_to_screen'
    || action === 'move_window_to_monitor'
  ) {
    addAgentActionCoverage(coverage, 'window-move-or-control');
  }

  if (action === 'close_window') {
    addAgentActionCoverage(coverage, 'close-window');
  }

  if (
    action === 'search_web'
    || action === 'open_url'
    || resourceType === 'url'
    || isAgentProbablyUrlTarget(args.target)
    || isAgentProbablyUrlTarget(args.url)
    || isAgentProbablyUrlTarget(args.query)
  ) {
    addAgentActionCoverage(coverage, 'browser-navigation');
  }

  if (
    action === 'interact_window_ui'
    || action === 'invoke_window_ui'
    || action === 'click'
    || action === 'double_click'
    || action === 'right_click'
    || action === 'type_text'
    || action === 'send_keys'
    || action === 'hotkey'
    || action === 'drag'
  ) {
    addAgentDesktopInputCoverage(coverage);
  }
}

export function addAgentFileManagementCoverageFromArgs(
  coverage: Set<AgentRequestedActionKind>,
  args: Record<string, unknown>,
) {
  const action = normalizeAgentToolActionName(typeof args.action === 'string' ? args.action : '');
  const mode = normalizeAgentToolActionName(typeof args.mode === 'string' ? args.mode : '');
  const isPreview = action === 'preview' || mode === 'preview' || args.dryRun === true;
  if (!isPreview && action) {
    addAgentActionCoverage(coverage, 'file-management-execute');
  }
}

export function getAgentDesktopSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return [];
  }

  const stepsJson = getAgentToolInputString(command, 'stepsJson');
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

export function addAgentSequenceStepCoverage(
  coverage: Set<AgentRequestedActionKind>,
  step: unknown,
) {
  if (!step || typeof step !== 'object' || Array.isArray(step)) {
    return;
  }

  const record = step as Record<string, unknown>;
  const tool = typeof record.tool === 'string' ? record.tool.trim() : '';
  const rawArgs = record.args ?? record.input;
  const args = rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
    ? rawArgs as Record<string, unknown>
    : {};

  if (tool === 'execute_desktop_input') {
    addAgentDesktopInputCoverage(coverage);
    return;
  }

  if (tool === 'execute_desktop_action') {
    addAgentDesktopActionCoverageFromArgs(coverage, args);
  }
}

export function createAgentCommandActionCoverage(command: AgentChatCommand) {
  const coverage = new Set<AgentRequestedActionKind>();
  const toolName = command.toolCall?.name ?? null;
  const input = command.toolCall?.input ?? {};

  if (toolName === 'execute_desktop_sequence') {
    for (const step of getAgentDesktopSequenceSteps(command)) {
      addAgentSequenceStepCoverage(coverage, step);
    }
  } else if (toolName === 'execute_desktop_input') {
    addAgentDesktopInputCoverage(coverage);
  } else if (toolName === 'execute_desktop_action') {
    addAgentDesktopActionCoverageFromArgs(coverage, input);
  } else if (toolName === 'launch_local_app' || toolName === 'open_resource' || toolName === 'focus_window') {
    addAgentActionCoverage(coverage, 'open-or-launch');
  } else if (toolName === 'close_window') {
    addAgentActionCoverage(coverage, 'close-window');
  } else if (toolName === 'search_web' || toolName === 'browser_search' || toolName === 'control_browser') {
    addAgentActionCoverage(coverage, 'browser-navigation');
  } else if (toolName === 'execute_file_management_action') {
    addAgentFileManagementCoverageFromArgs(coverage, input);
  } else if (toolName === 'organize_desktop_icons' && input.mode === 'execute') {
    addAgentActionCoverage(coverage, 'desktop-organization-execute');
  }

  return coverage;
}

export function diagnoseAgentCommandExplicitProhibition(options: {
  command: AgentChatCommand;
  sourceText: string;
  userGoal: string;
}) {
  const commandActionCoverage = createAgentCommandActionCoverage(options.command);
  const prohibitedActionCoverage = createAgentExplicitlyProhibitedActionCoverage({
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const conflictingActionKinds = [...commandActionCoverage].filter((kind) => (
    prohibitedActionCoverage.has(kind)
  ));

  return {
    commandActionKinds: [...commandActionCoverage],
    conflictingActionKinds,
    prohibitedActionKinds: [...prohibitedActionCoverage],
    prohibitionConflict: conflictingActionKinds.length > 0,
  };
}
