import {
  isAgentPermissionRouteAutoContinuableObservation,
  buildAgentPermissionRoute,
} from '../agentPermissionRouter';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
} from '../agentChatCommand';
import { resolveAgentVisualExecutionStrategy } from '../agentExecutionStrategy';
import { type AgentExecutionPlan } from '../agentOrchestrator';
import { resolveAgentResultFollowUpActions } from '../agentResultAssessment';
import { type AgentRuntimeResult } from './agentRuntimeContract';

export interface AgentRuntimePendingFollowUpApproval {
  action?: Extract<AgentChatFollowUpAction, { kind: 'run-command' }> | null;
  command: AgentChatCommand;
  plan: AgentExecutionPlan;
  reason: string;
  routeSummary: string;
  source: 'result-follow-up' | 'visual-execution-strategy';
}

function isAgentRuntimeAlreadyWaitingApproval(result: AgentRuntimeResult) {
  return result.taskState
    ? result.taskState.state === 'waiting_approval'
    : result.status === 'needs-approval';
}

export function resolveAgentRuntimePendingFollowUpApproval(options: {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  runtimeResult: AgentRuntimeResult;
  sourceText: string;
  userGoal: string;
}): AgentRuntimePendingFollowUpApproval | null {
  if (isAgentRuntimeAlreadyWaitingApproval(options.runtimeResult) && options.runtimeResult.pendingApproval) {
    return null;
  }

  const visualDecision = resolveAgentVisualExecutionStrategy(options);
  if (visualDecision.command && visualDecision.kind !== 'none') {
    const route = buildAgentPermissionRoute(visualDecision.command);
    if (route.plan && !route.blockedStep && route.requiresApproval) {
      return {
        command: visualDecision.command,
        plan: route.plan,
        reason: visualDecision.reason,
        routeSummary: route.summary,
        source: 'visual-execution-strategy',
      };
    }
  }

  const action = resolveAgentResultFollowUpActions(options.result).find((candidate): candidate is Extract<AgentChatFollowUpAction, { kind: 'run-command' }> => {
    if (candidate.kind !== 'run-command') {
      return false;
    }
    const route = buildAgentPermissionRoute(candidate.command);
    return Boolean(
      route.plan
      && !isAgentPermissionRouteAutoContinuableObservation(route)
      && route.requiresApproval,
    );
  }) ?? null;
  if (!action) {
    return null;
  }

  const route = buildAgentPermissionRoute(action.command);
  return route.plan ? {
    action,
    command: action.command,
    plan: route.plan,
    reason: action.label,
    routeSummary: route.summary,
    source: 'result-follow-up',
  } : null;
}
