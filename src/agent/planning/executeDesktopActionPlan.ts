import { type AgentToolActionKind } from '../agentCapabilityTypes';
import { type AgentChatCommand } from '../agentChatCommand';
import {
  getToolCallStringInput,
  type AgentExecutionPlan,
  getToolCallTargetDescription,
  createPlanStep,
} from './agentPlanShared';

function getExecuteDesktopActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.desktopAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteDesktopAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'list_windows':
      return 'list_running_apps';
    case 'get_default_browser':
      return 'get_default_app_for_uri';
    case 'focus_browser_window':
      return 'focus_window';
    case 'resize_window':
    case 'snap_window':
    case 'maximize_window':
    case 'minimize_window':
    case 'restore_window':
      return 'control_window';
    case 'open_then_control_window':
    case 'launch_then_control_window':
    case 'focus_then_control_window':
      return 'open_or_focus_then_control_window';
    case 'open_then_move_window_to_display':
    case 'launch_then_move_window_to_display':
      return 'open_or_focus_then_move_window_to_display';
    case 'move_window':
    case 'move_window_to_screen':
    case 'move_window_to_monitor':
      return 'move_window_to_display';
    case 'close_app':
      return 'close_window';
    case 'open_url':
      return 'open_resource';
    case 'open_app':
      return 'launch_local_app';
    case 'invoke_ui':
    case 'invoke_control':
    case 'invoke_button':
    case 'click_window_ui':
      return 'invoke_window_ui';
    case 'ui_action':
    case 'uia_action':
    case 'interact_ui':
    case 'interact_control':
    case 'select_ui':
    case 'select_window_ui':
    case 'toggle_ui':
    case 'toggle_window_ui':
    case 'expand_ui':
    case 'expand_window_ui':
    case 'collapse_ui':
    case 'collapse_window_ui':
    case 'set_ui_value':
    case 'set_window_ui_value':
      return 'interact_window_ui';
    case 'list_running_apps':
    case 'get_default_app_for_uri':
    case 'get_active_window_info':
    case 'focus_window':
    case 'control_window':
    case 'open_or_focus_then_control_window':
    case 'open_or_focus_then_move_window_to_display':
    case 'move_window_to_display':
    case 'close_window':
    case 'open_resource':
    case 'launch_local_app':
    case 'interact_window_ui':
    case 'invoke_window_ui':
    case 'search_web':
      return normalizedValue;
    default:
      return '';
  }
}

function getWindowUiInteractionPlanKind(command: AgentChatCommand): AgentToolActionKind {
  const action = normalizeExecuteDesktopAction(getExecuteDesktopActionInput(command));
  const uiAction = getToolCallStringInput(command, [
    'uiAction',
    'uiaAction',
    'controlAction',
    'pattern',
  ]).trim().toLowerCase().replace(/[-\s]+/gu, '_');

  return action === 'interact_window_ui' && uiAction !== 'invoke'
    ? 'interact-window-ui'
    : 'invoke-window-ui';
}

function getWindowUiInteractionPlanLabel(kind: AgentToolActionKind) {
  return kind === 'interact-window-ui'
    ? 'Interact with a UI Automation control in a window'
    : 'Invoke a UI Automation control in a window';
}

export function buildExecuteDesktopActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteDesktopAction(getExecuteDesktopActionInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute desktop action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'list_running_apps':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:list-running-apps',
            'list-running-apps',
            targetDescription
              ? `List and filter running apps/windows: ${targetDescription}`
              : 'List current running apps/windows',
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_default_app_for_uri':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:get-default-app-for-uri',
            'get-default-app-for-uri',
            `Read OS default URI handler: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_active_window_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:get-active-window-info',
            'get-active-window-info',
            'Read the current foreground window',
            {
              requiresDesktopMode: true,
              targetDescription: 'current foreground window',
            },
          ),
        ],
      };

    case 'focus_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:focus-window',
            'focus-window',
            `Bring a matching existing window to the foreground: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'control_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:control-window',
            'control-window',
            `Control a matching existing window state or bounds: ${targetDescription || 'active or matching window'}`,
            {
              details: [
                'This can maximize, minimize, restore, snap, resize, or set window coordinates.',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'open_or_focus_then_control_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:open-or-focus-then-control-window',
            'open-or-focus-then-control-window',
            `Open or focus a target, then control the resulting window state or bounds: ${targetDescription}`,
            {
              details: [
                'This may open/focus an app or resource and then maximize, minimize, restore, snap, resize, or set window coordinates.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'open_or_focus_then_move_window_to_display':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:open-or-focus-then-move-window-to-display',
            'open-or-focus-then-move-window-to-display',
            `Open or focus a target, then move the resulting window to the requested display: ${targetDescription}`,
            {
              details: [
                'This may open/focus an app or resource and then change the resulting window bounds.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'move_window_to_display':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:move-window-to-display',
            'move-window-to-display',
            `Move a matching existing window to the requested display: ${targetDescription}`,
            {
              details: [
                'This changes only the window bounds and should preserve the window size unless requested otherwise.',
              ],
              requiresDesktopMode: true,
              reversible: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'close_window':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:close-window',
            'close-window',
            `Send a normal close request to a matching existing window: ${targetDescription}`,
            {
              details: [
                'This is not a forced kill. Apps with unsaved content may show their own confirmation dialog.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'open_resource':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:open-resource',
            'open-resource',
            `Ask the OS to open a URL, file, folder, or app target: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'launch_local_app':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:search-local-app',
            'search-local-app',
            `Find a local app, shortcut, pinned item, or remembered app: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
          createPlanStep(
            'execute-desktop-action:launch-local-app',
            'launch-local-app',
            `Focus an existing window first, or launch the app if needed: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'interact_window_ui':
    case 'invoke_window_ui': {
      const actionKind = getWindowUiInteractionPlanKind(command);
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            `execute-desktop-action:${action.replace(/_/gu, '-')}`,
            actionKind,
            `${getWindowUiInteractionPlanLabel(actionKind)}: ${targetDescription || 'matched window control'}`,
            {
              details: [
                'This triggers an in-app control through Windows UI Automation patterns such as Invoke, SelectionItem, Toggle, ExpandCollapse, or Value.',
                'Use only after read-only UI Automation or visual evidence identifies the intended control.',
              ],
              requiresDesktopMode: true,
              reversible: false,
              targetDescription,
            },
          ),
        ],
      };
    }

    case 'search_web':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-action:search-web',
            'search-web',
            `Open or reuse a browser to search the web: ${targetDescription}`,
            {
              details: [
                'If the target is a direct URL/domain, use action open_resource/open_url instead.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    default:
      return null;
  }
}
