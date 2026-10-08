import { type AgentChatCommand } from './agentChatCommand';
import { type AgentExecutionPlan } from './planning/agentPlanShared';
import { buildDesktopActionToolPlan } from './planning/agentDesktopActionPlans';
import { buildDesktopObservationToolPlan } from './planning/agentDesktopObservationPlans';
import {
  buildDesktopOrganizationToolPlan,
  buildDesktopIconPlacementPlan,
  buildDesktopOrganizationPlan,
} from './planning/agentDesktopOrganizationPlans';
import {
  buildResourceToolPlan,
  buildAppLaunchPlan,
  buildAppAliasSavePlan,
  buildContextQueryPlan,
} from './planning/agentResourcePlans';
import { buildProductToolPlan } from './planning/agentProductPlans';
export type { AgentExecutionPlan, AgentExecutionPlanStep } from './planning/agentPlanShared';

function buildToolCallPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  switch (command.toolCall?.name) {
    case 'execute_desktop_action':
    case 'execute_desktop_input':
    case 'execute_desktop_sequence':
    case 'focus_window':
    case 'close_window':
      return buildDesktopActionToolPlan(command);

    case 'organize_desktop_icons':
    case 'place_desktop_icon':
      return buildDesktopOrganizationToolPlan(command);

    case 'observe_windows_and_apps':
    case 'execute_desktop_observation':
    case 'locate_screen_elements':
    case 'get_default_app_for_uri':
    case 'list_running_apps':
    case 'get_active_window_info':
    case 'list_capture_sources':
    case 'summarize_visual_snapshot':
    case 'analyze_game_screen':
    case 'manage_game_companion_loop':
    case 'get_cursor_position':
      return buildDesktopObservationToolPlan(command);

    case 'run_controlled_command':
    case 'control_browser':
    case 'execute_local_file_action':
    case 'execute_file_management_action':
    case 'execute_memory_action':
    case 'list_agent_skills':
    case 'execute_agent_skill':
    case 'list_mcp_tools':
    case 'call_mcp_tool':
    case 'open_resource':
    case 'search_web':
    case 'browser_search':
    case 'launch_local_app':
    case 'remember_local_app':
    case 'get_path_info':
    case 'list_directory':
    case 'search_files':
    case 'read_text_file':
    case 'inspect_local_project':
    case 'run_local_project_action':
      return buildResourceToolPlan(command);

    case 'get_system_info':
    case 'get_display_info':
    case 'get_pet_settings':
    case 'update_pet_settings':
    case 'get_voice_status':
    case 'switch_tts_provider':
    case 'warmup_local_voice':
    case 'set_voice_input':
    case 'start_voice_input_session':
    case 'stop_voice_input_session':
      return buildProductToolPlan(command);
    default: return null;
  }
}

export function buildAgentExecutionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  if (command.kind === 'tool-call') {
    return buildToolCallPlan(command);
  }

  if (command.kind === 'app-launch') {
    return buildAppLaunchPlan(command);
  }

  if (command.kind === 'app-alias-save') {
    return buildAppAliasSavePlan(command);
  }

  if (command.kind === 'context-query') {
    return buildContextQueryPlan(command);
  }

  if (command.kind === 'desktop-icon-placement') {
    return buildDesktopIconPlacementPlan(command);
  }

  if (command.kind === 'desktop-organization') {
    return buildDesktopOrganizationPlan(command);
  }

  return null;
}

export function shouldRequestAgentExecutionApproval(plan: AgentExecutionPlan | null) {
  if (!plan) {
    return false;
  }

  return plan.steps.some((step) => step.decision.mode === 'confirm' || step.decision.mode === 'blocked');
}

export function createAgentExecutionApprovalText(plan: AgentExecutionPlan) {
  const lines = [
    `Agent 准备执行：${plan.goal}`,
    '',
    '计划步骤：',
    ...plan.steps.map((step, index) => {
      const permissionLabel = step.decision.mode === 'silent'
        ? '自动'
        : step.decision.mode === 'notify'
          ? '提示'
          : step.decision.mode === 'confirm'
            ? '需要确认'
            : '禁止';
      const details = step.details?.length
        ? `\n   ${step.details.join('\n   ')}`
        : '';
      return `${index + 1}. [${permissionLabel}] ${step.summary}${details}`;
    }),
    '',
    '是否允许这次操作？',
  ];

  return lines.join('\n');
}
