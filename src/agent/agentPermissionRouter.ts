import {
  buildAgentExecutionPlan,
  shouldRequestAgentExecutionApproval,
  type AgentExecutionPlan,
  type AgentExecutionPlanStep,
} from './agentOrchestrator';
import { type AgentActionRisk, type AgentApprovalMode } from './agentCapabilityTypes';
import { type AgentChatCommand } from './agentChatCommand';
import {
  buildAgentModeRoute,
  type AgentModeRoute,
  type AgentModeRouteMode,
} from './agentModeRouter';

export type AgentPermissionRouteMode = AgentModeRouteMode;

export type AgentPermissionRouteStatus =
  | 'no-plan'
  | 'silent'
  | 'notify'
  | 'needs-approval'
  | 'blocked';

export interface AgentPermissionRoute {
  blockedStep: AgentExecutionPlanStep | null;
  command: AgentChatCommand;
  dominantApprovalMode: AgentApprovalMode | null;
  maxRisk: AgentActionRisk | null;
  modeRoute: AgentModeRoute;
  plan: AgentExecutionPlan | null;
  requiresApproval: boolean;
  routeMode: AgentPermissionRouteMode;
  status: AgentPermissionRouteStatus;
  summary: string;
}

const APPROVAL_MODE_PRIORITY: Record<AgentApprovalMode, number> = {
  silent: 0,
  notify: 1,
  confirm: 2,
  blocked: 3,
};

const RISK_PRIORITY: Record<AgentActionRisk, number> = {
  read: 0,
  visual: 1,
  'reversible-write': 2,
  launch: 2,
  destructive: 3,
  blocked: 4,
};

function resolveDominantApprovalMode(plan: AgentExecutionPlan | null): AgentApprovalMode | null {
  if (!plan?.steps.length) {
    return null;
  }

  return plan.steps.reduce<AgentApprovalMode>((current, step) => (
    APPROVAL_MODE_PRIORITY[step.decision.mode] > APPROVAL_MODE_PRIORITY[current]
      ? step.decision.mode
      : current
  ), 'silent');
}

function resolveMaxRisk(plan: AgentExecutionPlan | null): AgentActionRisk | null {
  if (!plan?.steps.length) {
    return null;
  }

  return plan.steps.reduce<AgentActionRisk>((current, step) => (
    RISK_PRIORITY[step.action.risk] > RISK_PRIORITY[current]
      ? step.action.risk
      : current
  ), 'read');
}

function resolveBlockedStep(plan: AgentExecutionPlan | null) {
  return plan?.steps.find((step) => (
    !step.decision.allowed || step.decision.mode === 'blocked'
  )) ?? null;
}

function resolveRouteStatus(
  plan: AgentExecutionPlan | null,
  blockedStep: AgentExecutionPlanStep | null,
  dominantApprovalMode: AgentApprovalMode | null,
): AgentPermissionRouteStatus {
  if (!plan) {
    return 'no-plan';
  }

  if (blockedStep || dominantApprovalMode === 'blocked') {
    return 'blocked';
  }

  if (dominantApprovalMode === 'confirm') {
    return 'needs-approval';
  }

  if (dominantApprovalMode === 'notify') {
    return 'notify';
  }

  return 'silent';
}

function createRouteSummary(route: Omit<AgentPermissionRoute, 'summary'>) {
  if (!route.plan) {
    return 'No local Agent tool plan is required.';
  }

  const stepCount = route.plan.steps.length;
  const modeText = route.dominantApprovalMode ?? 'silent';
  const riskText = route.maxRisk ?? 'read';
  if (route.blockedStep) {
    return `Blocked by permission policy at step "${route.blockedStep.summary}" (${riskText}).`;
  }

  if (route.requiresApproval) {
    return `Requires user approval before ${stepCount} planned step(s); max risk ${riskText}, permission mode ${modeText}.`;
  }

  return `Allowed as ${modeText} for ${stepCount} planned step(s); max risk ${riskText}.`;
}

export function buildAgentPermissionRoute(command: AgentChatCommand): AgentPermissionRoute {
  const plan = buildAgentExecutionPlan(command);
  const blockedStep = resolveBlockedStep(plan);
  const dominantApprovalMode = resolveDominantApprovalMode(plan);
  const maxRisk = resolveMaxRisk(plan);
  const requiresApproval = Boolean(plan && !blockedStep && shouldRequestAgentExecutionApproval(plan));
  const modeRoute = buildAgentModeRoute(command, plan);
  const routeMode = modeRoute.mode;
  const status = resolveRouteStatus(plan, blockedStep, dominantApprovalMode);
  const routeWithoutSummary = {
    blockedStep,
    command,
    dominantApprovalMode,
    maxRisk,
    modeRoute,
    plan,
    requiresApproval,
    routeMode,
    status,
  };

  return {
    ...routeWithoutSummary,
    summary: createRouteSummary(routeWithoutSummary),
  };
}
