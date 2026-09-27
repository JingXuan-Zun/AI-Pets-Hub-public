import { resolveAgentCharacterAnimationSkillCommand } from '../agentCharacterSkillIntent';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import {
  type AgentRuntimePendingApproval,
  type AgentRuntimeStep,
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';

export interface AgentDeterministicSkillRoute {
  approval: AgentRuntimePendingApproval | null;
  handled: boolean;
  historyLine?: string;
  step?: AgentRuntimeStep;
}

export interface ResolveAgentDeterministicSkillRouteOptions {
  approvedToolResult?: AgentRuntimeToolResultEntry | null;
  stepIndex: number;
  steps: AgentRuntimeStep[];
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}

function formatCompactJson(value: unknown, maxLength = 360) {
  const text = JSON.stringify(value);
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

export function resolveAgentDeterministicSkillRoute(
  options: ResolveAgentDeterministicSkillRouteOptions,
): AgentDeterministicSkillRoute {
  if (options.steps.length > 0 || options.toolResults.length > 0 || options.approvedToolResult) {
    return { approval: null, handled: false };
  }

  const command = resolveAgentCharacterAnimationSkillCommand(options.userGoal);
  if (!command) return { approval: null, handled: false };

  const toolName = command.toolCall?.name ?? command.kind;
  const permissionRoute = buildAgentPermissionRoute(command);
  const step: AgentRuntimeStep = {
    action: 'tool_call',
    args: command.toolCall?.input ?? {},
    index: options.stepIndex,
    reason: 'Matched a direct character animation Skill intent before model planning.',
    summary: `Selected deterministic tool ${toolName}.`,
    tool: toolName,
  };
  const historyLine = [
    `Step ${options.stepIndex} deterministic character skill route:`,
    `tool=${toolName}`,
    `args=${formatCompactJson(command.toolCall?.input ?? {})}`,
    `permission=${permissionRoute.summary}`,
  ].join('\n');

  if (permissionRoute.blockedStep || !permissionRoute.plan) {
    return { approval: null, handled: true, historyLine, step };
  }

  return {
    approval: {
      command,
      plan: permissionRoute.plan,
      reason: `Character animation Skill needs approval: ${options.userGoal}`,
      routeSummary: permissionRoute.summary,
    },
    handled: true,
    historyLine,
    step,
  };
}
