import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  type AgentRuntimeExecutorContext,
} from './agentRuntimeExecutor';
import {
  executeBrowserSearch,
} from './agentRuntimeBrowserTools';
import {
  executeAppLaunch,
  executeOpenResource,
} from './agentRuntimeDesktopLaunchTools';
import {
  executeGetActiveWindowInfo,
  executeGetDefaultAppForUri,
  executeListRunningApps,
} from './agentRuntimeDesktopObservationTools';
import {
  executeCloseWindow,
  executeControlWindow,
  executeFocusWindow,
  executeMoveWindowToDisplay,
} from './agentRuntimeWindowTools';
import {
  executeOpenOrFocusThenControlWindow,
  executeOpenOrFocusThenMoveWindowToDisplay,
} from './agentRuntimeWindowWorkflowTools';
import {
  getToolStringInput,
  normalizeExecuteDesktopAction,
  getDesktopActionTargetInput,
  getToolBooleanInput,
  getToolNumberInput,
} from './desktopTools/desktopToolInput';
import {
  annotateDesktopActionResult,
} from './desktopTools/desktopActionEvidence';
import {
  executeWindowUiInteraction,
} from './desktopTools/windowUiInteraction';
export {
  executeAppLaunch,
  executeOpenResource,
} from './agentRuntimeDesktopLaunchTools';
export {
  executeCloseWindow,
  executeControlWindow,
  executeFocusWindow,
  executeMoveWindowToDisplay,
  waitForDesktopActionWindowSettle,
} from './agentRuntimeWindowTools';
export {
  executeOpenOrFocusThenControlWindow,
  executeOpenOrFocusThenMoveWindowToDisplay,
} from './agentRuntimeWindowWorkflowTools';
export { normalizeExecuteDesktopAction, normalizeExecuteDesktopInputAction } from './desktopTools/desktopToolInput';
export { executeDesktopInput } from './desktopTools/desktopInputExecution';

export async function executeDesktopAction(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'desktopAction', 'operation']);
  const action = normalizeExecuteDesktopAction(rawAction);
  const target = getDesktopActionTargetInput(toolCall);

  if (!action) {
    return {
      errorText: 'Unsupported execute_desktop_action action.',
      observations: [
        rawAction ? `Unsupported desktop action: ${rawAction}` : 'Missing desktop action.',
      ],
      ok: false,
      responseText: 'execute_desktop_action needs a supported primitive action such as list_running_apps, focus_window, control_window, move_window_to_display, close_window, open_resource, launch_local_app, interact_window_ui, invoke_window_ui, or search_web. For multi-step desktop operations, use execute_desktop_sequence.',
    };
  }

  switch (action) {
    case 'list_running_apps':
      return annotateDesktopActionResult(
        action,
        await executeListRunningApps(
          getToolStringInput(toolCall, ['query', 'target', 'name', 'processName', 'title']),
          getToolBooleanInput(toolCall, 'includeWindows'),
        ),
      );

    case 'get_default_app_for_uri':
      return annotateDesktopActionResult(
        action,
        await executeGetDefaultAppForUri(
          getToolStringInput(toolCall, ['uriScheme', 'scheme', 'protocol']) || 'https',
        ),
      );

    case 'get_active_window_info':
      return annotateDesktopActionResult(action, await executeGetActiveWindowInfo());

    case 'focus_window':
      if (!target && !getToolNumberInput(toolCall, 'pid') && !getToolNumberInput(toolCall, 'hwnd') && !getToolNumberInput(toolCall, 'windowHandle')) {
        return {
          errorText: 'Missing focus_window target.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'focus_window needs a process name, app name, window title, PID, or hwnd target.',
        };
      }

      return annotateDesktopActionResult(action, await executeFocusWindow(toolCall));

    case 'control_window':
      return annotateDesktopActionResult(action, await executeControlWindow(toolCall));

    case 'open_or_focus_then_control_window':
      return annotateDesktopActionResult(action, await executeOpenOrFocusThenControlWindow(context, toolCall));

    case 'open_or_focus_then_move_window_to_display':
      return annotateDesktopActionResult(action, await executeOpenOrFocusThenMoveWindowToDisplay(context, toolCall));

    case 'move_window_to_display':
      return annotateDesktopActionResult(action, await executeMoveWindowToDisplay(toolCall));

    case 'close_window':
      return annotateDesktopActionResult(action, await executeCloseWindow(toolCall));

    case 'open_resource': {
      if (!target) {
        return {
          errorText: 'Missing open_resource target.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'open_resource needs a URL, file, folder, or app target.',
        };
      }

      const rawNormalizedAction = rawAction.trim().toLowerCase().replace(/[-\s]+/gu, '_');
      return annotateDesktopActionResult(
        action,
        await executeOpenResource(
          target,
          getToolStringInput(toolCall, ['resourceType']) || (rawNormalizedAction === 'open_url' ? 'url' : undefined),
          getToolBooleanInput(toolCall, 'forceNew'),
        ),
      );
    }

    case 'launch_local_app':
      if (!target) {
        return {
          errorText: 'Missing launch_local_app target.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'launch_local_app needs an app name, executable path, or remembered alias target.',
        };
      }

      return annotateDesktopActionResult(
        action,
        await executeAppLaunch(target, getToolBooleanInput(toolCall, 'forceNew')),
      );

    case 'interact_window_ui':
    case 'invoke_window_ui':
      return annotateDesktopActionResult(action, await executeWindowUiInteraction(toolCall, action));

    case 'search_web':
      if (!target) {
        return {
          errorText: 'Missing search_web query.',
          observations: [`Desktop action: ${action}`],
          ok: false,
          responseText: 'search_web needs a search query.',
        };
      }

      return annotateDesktopActionResult(
        action,
        await executeBrowserSearch(context, target, getToolBooleanInput(toolCall, 'forceNewPage')),
      );

    default:
      return {
        errorText: 'Unsupported execute_desktop_action action.',
        observations: [`Unsupported desktop action: ${rawAction}`],
        ok: false,
        responseText: `execute_desktop_action does not support action "${rawAction}".`,
      };
  }
}
