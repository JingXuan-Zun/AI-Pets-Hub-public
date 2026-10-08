import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentExecutionPlan, getToolCallTargetDescription, createPlanStep } from './agentPlanShared';

function getExecuteDesktopObservationInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.observationAction ?? input.desktopObservation ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteDesktopObservationAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'display_info':
    case 'screen_info':
    case 'list_displays':
      return 'get_display_info';
    case 'system_info':
    case 'computer_info':
      return 'get_system_info';
    case 'active_window':
    case 'foreground_window':
      return 'get_active_window_info';
    case 'window_ui':
    case 'ui_automation':
    case 'inspect_controls':
    case 'inspect_window_controls':
      return 'inspect_window_ui';
    case 'running_apps':
    case 'list_windows':
      return 'list_running_apps';
    case 'desktop_items':
    case 'desktop_icons':
    case 'list_desktop_icons':
      return 'list_desktop_items';
    case 'desktop_icon_diagnostics':
    case 'desktop_icon_status':
      return 'diagnose_desktop_icons';
    case 'capture_sources':
    case 'screen_sources':
      return 'list_capture_sources';
    case 'visual_snapshot':
    case 'screen_snapshot':
    case 'window_snapshot':
    case 'summarize_screen':
      return 'summarize_visual_snapshot';
    case 'wait_for_ui_state':
    case 'wait_then_observe':
    case 'wait_and_observe':
      return 'wait_and_observe';
    case 'cursor_position':
      return 'get_cursor_position';
    case 'get_display_info':
    case 'get_system_info':
    case 'get_active_window_info':
    case 'inspect_window_ui':
    case 'list_desktop_items':
    case 'diagnose_desktop_icons':
    case 'list_running_apps':
    case 'list_capture_sources':
    case 'summarize_visual_snapshot':
    case 'get_cursor_position':
      return normalizedValue;
    default:
      return '';
  }
}

export function buildExecuteDesktopObservationPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteDesktopObservationAction(getExecuteDesktopObservationInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute desktop observation: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'get_display_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:get-display-info',
            'read-display-info',
            'Read current display count, bounds, work areas, and scale factors',
            {
              requiresDesktopMode: true,
              targetDescription: 'display information',
            },
          ),
        ],
      };

    case 'get_system_info': {
      const includeDisplays = command.toolCall?.input?.includeDisplays !== false;
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:read-system-info',
            'read-system-info',
            'Read current OS, CPU, memory, GPU, and runtime summary',
            {
              requiresDesktopMode: true,
              targetDescription: 'system information',
            },
          ),
          ...(includeDisplays ? [
            createPlanStep(
              'execute-desktop-observation:read-display-info',
              'read-display-info',
              'Read current display information with the system summary',
              {
                requiresDesktopMode: true,
                targetDescription: 'display information',
              },
            ),
          ] : []),
        ],
      };
    }

    case 'get_active_window_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:get-active-window-info',
            'get-active-window-info',
            'Read the current foreground window process, title, pid, and path',
            {
              requiresDesktopMode: true,
              targetDescription: 'current foreground window',
            },
          ),
        ],
      };

    case 'list_desktop_items':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:list-desktop-items',
            'list-desktop-icons',
            targetDescription
              ? `List and classify desktop items: ${targetDescription}`
              : 'List and classify desktop items/icons',
            {
              requiresDesktopMode: true,
              targetDescription: targetDescription || 'desktop items',
            },
          ),
        ],
      };

    case 'diagnose_desktop_icons':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:diagnose-desktop-icons',
            'list-desktop-icons',
            'Diagnose desktop icon reader source, movable coordinates, and display ownership',
            {
              requiresDesktopMode: true,
              targetDescription: targetDescription || 'desktop icon diagnostics',
            },
          ),
        ],
      };

    case 'list_running_apps':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:list-running-apps',
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

    case 'list_capture_sources':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:list-capture-sources',
            'list-capture-sources',
            targetDescription
              ? `List available visual capture sources: ${targetDescription}`
              : 'List available screen/window capture sources',
            {
              details: [
                'This is visual context and may include screen/window thumbnail availability.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'summarize_visual_snapshot':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:summarize-visual-snapshot',
            'capture-screen-context',
            targetDescription
              ? `Capture and summarize one visual source: ${targetDescription}`
              : 'Capture and summarize one screen/window visual snapshot',
            {
              details: [
                'The runtime returns text evidence to the Agent loop and does not store raw image data in AgentSessionV2 history.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'get_cursor_position':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:get-cursor-position',
            'get-cursor-position',
            'Read the current mouse cursor DIP coordinates',
            {
              requiresDesktopMode: true,
              targetDescription: 'mouse cursor position',
            },
          ),
        ],
      };

    case 'inspect_window_ui':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:inspect-window-ui',
            'inspect-window-ui',
            targetDescription
              ? `Inspect UI Automation controls in a window: ${targetDescription}`
              : 'Inspect UI Automation controls in the active or named window',
            {
              details: [
                'This is read-only UI structure evidence for controls, labels, supported actions, and screen bounds.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'wait_and_observe': {
      const waitMs = typeof command.toolCall?.input?.waitMs === 'number'
        ? command.toolCall.input.waitMs
        : typeof command.toolCall?.input?.waitMs === 'string'
          ? Number(command.toolCall.input.waitMs)
          : null;
      const includeVisual = command.toolCall?.input?.includeVisual === true;
      const waitText = Number.isFinite(Number(waitMs)) ? `${Math.round(Number(waitMs))}ms` : 'a short interval';
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-desktop-observation:wait-and-observe',
            'observe-windows-and-apps',
            `Wait ${waitText}, then refresh current windows/apps/displays`,
            {
              details: [
                'This is a delayed read-only observation used after loading, updating, or uncertain UI transitions.',
              ],
              requiresDesktopMode: true,
              targetDescription: targetDescription || 'current desktop state after waiting',
            },
          ),
          ...(includeVisual ? [
            createPlanStep(
              'execute-desktop-observation:wait-and-observe-visual',
              'capture-screen-context',
              'Capture one visual snapshot after the wait to summarize visible UI state',
              {
                details: [
                  'The runtime returns text evidence to the Agent loop and does not store raw image data in AgentSessionV2 history.',
                ],
                requiresDesktopMode: true,
                targetDescription: targetDescription || 'visible UI state after waiting',
              },
            ),
          ] : []),
        ],
      };
    }

    default:
      return null;
  }
}
