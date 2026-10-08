import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentExecutionPlan, getToolCallTargetDescription, createPlanStep } from './agentPlanShared';
import { buildExecuteDesktopObservationPlan } from './executeDesktopObservationPlan';

function buildObserveWindowsAndAppsPlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || 'Observe current windows and app launch surfaces',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'observe-windows-and-apps',
        'observe-windows-and-apps',
        targetDescription
          ? `Observe apps/windows/taskbar/display ownership: ${targetDescription}`
          : 'Observe installed apps, taskbar pinned apps, running windows, active window, and display ownership',
        {
          requiresDesktopMode: true,
          targetDescription,
        },
      ),
    ],
  };
}

function buildLocateScreenElementsPlan(command: AgentChatCommand): AgentExecutionPlan {
  const targetDescription = getToolCallTargetDescription(command);
  return {
    commandKind: command.kind,
    goal: command.toolCall?.goal?.trim() || 'Locate visible screen elements with vision',
    instruction: command.instruction,
    steps: [
      createPlanStep(
        'locate-screen-elements',
        'locate-screen-elements',
        targetDescription
          ? `Capture and locate visible text/elements: ${targetDescription}`
          : 'Capture and locate visible text/elements',
        {
          details: [
            'v1 returns approximate vision evidence, not pixel-perfect OCR coordinates.',
          ],
          requiresDesktopMode: true,
          targetDescription,
        },
      ),
    ],
  };
}
export function buildDesktopObservationToolPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) return null;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {
    case 'observe_windows_and_apps':
      return buildObserveWindowsAndAppsPlan(command);

    case 'execute_desktop_observation':
      return buildExecuteDesktopObservationPlan(command);

    case 'locate_screen_elements':
      return buildLocateScreenElementsPlan(command);

    case 'get_default_app_for_uri':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `读取默认 URI 处理应用：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-default-app-for-uri',
            'get-default-app-for-uri',
            `读取系统默认应用关联：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_running_apps':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '观察当前运行中的应用和窗口',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-running-apps',
            'list-running-apps',
            targetDescription
              ? `列出并筛选当前窗口/进程：${targetDescription}`
              : '列出当前可见窗口和运行应用',
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
        goal: explicitGoal || '读取当前活动窗口信息',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-active-window-info',
            'get-active-window-info',
            '只读读取当前前台窗口的进程、标题和路径',
            {
              requiresDesktopMode: true,
              targetDescription: '当前活动窗口',
            },
          ),
        ],
      };

    case 'list_capture_sources':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '列出当前可捕获的屏幕和窗口源',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-capture-sources',
            'list-capture-sources',
            '读取可用屏幕/窗口捕获源列表',
            {
              details: [
                '可能包含屏幕或窗口缩略图可用性，因此按视觉观察处理。',
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
        goal: explicitGoal || 'Summarize visible content from one screen or window snapshot',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'capture-screen-context',
            'capture-screen-context',
            targetDescription
              ? `Capture and summarize one visual source: ${targetDescription}`
              : 'Capture and summarize one screen/window visual snapshot',
            {
              details: [
                'The runtime returns a concise text summary to AgentSessionV2 and does not put raw image data into the Agent loop.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'analyze_game_screen':
      return {
        commandKind: command.kind,
        goal: explicitGoal || 'Analyze visible gameplay content from one game screen or window snapshot',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'observe-game-window',
            'observe-game-window',
            targetDescription
              ? `Capture and analyze one game visual source: ${targetDescription}`
              : 'Capture and analyze one game screen/window snapshot',
            {
              details: [
                'The runtime returns text evidence about visible game content, HUD, player situation, and uncertainty; it does not put raw image data into the Agent loop.',
                'This is a single observation step, not continuous companion mode.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'manage_game_companion_loop': {
      const action = command.toolCall?.input?.action;
      const actionSummary = action === 'stop'
        ? 'Stop the low-frequency game companion loop'
        : action === 'status'
          ? 'Read the current game companion loop status'
          : 'Start the low-frequency game companion loop';
      return {
        commandKind: command.kind,
        goal: explicitGoal || actionSummary,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'manage-game-companion-loop',
            'manage-game-companion-loop',
            actionSummary,
            {
              details: [
                'The runtime may capture game screen/window thumbnails at a low frequency and send short companion comments.',
                'It does not read game memory, inject into the game process, or perform gameplay input.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };
    }

    case 'get_cursor_position':
      return {
        commandKind: command.kind,
        goal: explicitGoal || '读取当前鼠标光标位置',
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-cursor-position',
            'get-cursor-position',
            '只读读取当前鼠标光标的屏幕坐标',
            {
              requiresDesktopMode: true,
              targetDescription: '鼠标光标位置',
            },
          ),
        ],
      };
    default: return null;
  }
}
