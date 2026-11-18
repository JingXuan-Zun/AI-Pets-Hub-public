import { type AgentChatCommand } from './agentChatCommand';
import { type AgentExecutionPlan } from './planning/agentPlanShared';
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

    case 'organize_desktop_icons':
      return buildDesktopOrganizationToolPlan(command);
    case 'manage_game_companion_loop':
      return buildDesktopObservationToolPlan(command);

    case 'run_controlled_command':
    case 'control_browser':
    case 'execute_memory_action':
    case 'list_agent_skills':
    case 'execute_agent_skill':
    case 'list_mcp_tools':
    case 'call_mcp_tool':
    case 'remember_local_app':
    case 'inspect_local_project':
    case 'run_local_project_action':
      return buildResourceToolPlan(command);

    case 'get_system_info':
    case 'get_pet_settings':
    case 'update_pet_settings':
    case 'use_platform_capability':
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
