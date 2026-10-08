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
import {
  diagnoseAgentCommandExplicitProhibition,
  type AgentRequestedActionKind,
} from './runtime/agentActionCoverage';

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

export interface AgentTaskScopedApprovalContinuationDecision {
  allowed: boolean;
  desktopSafe: boolean;
  duplicate: boolean;
  eligibleTool: boolean;
  freshApprovalRequired: boolean;
  hardGate: boolean;
  pendingGoal: string;
  pendingRouteSummary: string;
  pendingTool: string;
  pendingActionKinds: AgentRequestedActionKind[];
  prohibitedActionKinds: AgentRequestedActionKind[];
  prohibitionConflict: boolean;
  reason:
    | 'duplicate-command'
    | 'eligible'
    | 'hard-gate'
    | 'ineligible-tool'
    | 'no-permission-plan'
    | 'not-desktop-safe'
    | 'permission-blocked'
    | 'explicit-prohibition'
    | 'fresh-approval-required'
    | 'risk-escalation'
    | 'scope-mismatch';
  scopeMatched: boolean;
  withinRiskCeiling: boolean;
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

const AGENT_TASK_APPROVAL_CONTINUATION_TOOLS = new Set([
  'execute_desktop_sequence',
  'execute_desktop_action',
  'execute_desktop_input',
  'launch_local_app',
]);
// Handing an arbitrary file, folder or URL to the OS can run scripts and programs,
// so each one needs its own approval even inside an approved desktop task. The same
// applies to any step naming an explicit file path (launching a downloaded .exe).
const AGENT_FRESH_APPROVAL_ACTION_KINDS = new Set<string>(['open-resource']);
const AGENT_ABSOLUTE_PATH_PATTERN = /^\s*["']?(?:[a-z]:[\\/]|\\\\)/iu;

function hasAbsolutePathInput(value: unknown, depth = 0): boolean {
  if (typeof value === 'string') {
    return AGENT_ABSOLUTE_PATH_PATTERN.test(value);
  }
  if (depth >= 4 || !value || typeof value !== 'object') {
    return false;
  }
  return Object.values(value).some((entry) => hasAbsolutePathInput(entry, depth + 1));
}
const AGENT_TASK_SCOPE_TEMPLATE_LITERAL_PATTERN = /\{\s*(?:command\.|plan\.|toolCall\.|[^{}]*\bgoal\b)[^{}]*\}/iu;
const AGENT_TASK_SCOPE_MOJIBAKE_PATTERN = /(?:\uFFFD|(?:[\u00C2\u00C3\u00E2\u00F0]|[\u93B5\u9359\u942D\u95B8\u9429\u953B\u6D93\u7EFE\u7039\u6FEE\u7481\u935A\u59A4\u7F01\u93D4\u942C\u5A34\u9286]){2,})/u;
const AGENT_TASK_HARD_GATE_PATTERN = /(?:captcha|recaptcha|hcaptcha|verification\s*code|two[-\s]*factor|2fa|mfa|sms|qr\s*code|scan\s*qr|uac|admin|administrator|password\s*(?:empty|required)|empty\s*(?:password|credential)|\u9a8c\u8bc1\u7801|\u9a8c\u8bc1\u9875|\u6ed1\u5757|\u77ed\u4fe1|\u624b\u673a\u9a8c\u8bc1\u7801|\u4e8c\u6b21\u9a8c\u8bc1|\u53cc\u91cd\u9a8c\u8bc1|\u4e24\u6b65\u9a8c\u8bc1|\u626b\u7801|\u4e8c\u7ef4\u7801|\u7ba1\u7406\u5458|\u7528\u6237\u8d26\u6237\u63a7\u5236|\u8d26\u53f7\u4e3a\u7a7a|\u5bc6\u7801\u4e3a\u7a7a|\u9700\u8981\u8f93\u5165\u5bc6\u7801|\u8bf7\u8f93\u5165\u5bc6\u7801)/iu;

export function isValidAgentTaskScopeText(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  const text = value.trim();
  return Boolean(text)
    && !AGENT_TASK_SCOPE_TEMPLATE_LITERAL_PATTERN.test(text)
    && !AGENT_TASK_SCOPE_MOJIBAKE_PATTERN.test(text);
}

function normalizeAgentTaskScopeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/gu, ' ');
}

function getAgentTaskScopeTexts(command: AgentChatCommand, plan: AgentExecutionPlan) {
  return [
    command.sourceText,
    command.instruction,
    command.toolCall?.goal,
    plan.goal,
    plan.instruction,
  ].filter(isValidAgentTaskScopeText).map(normalizeAgentTaskScopeText);
}

function hasSameAgentTaskScope(options: {
  approvedCommand: AgentChatCommand;
  approvedPlan: AgentExecutionPlan;
  pendingCommand: AgentChatCommand;
  pendingPlan: AgentExecutionPlan;
}) {
  const approvedTexts = getAgentTaskScopeTexts(options.approvedCommand, options.approvedPlan);
  const pendingTexts = getAgentTaskScopeTexts(options.pendingCommand, options.pendingPlan);
  return approvedTexts.some((approvedText) => pendingTexts.some((pendingText) => (
    approvedText === pendingText
  )));
}

function getAgentTaskScopeSourceText(command: AgentChatCommand, plan: AgentExecutionPlan) {
  return [
    command.sourceText,
    command.instruction,
    command.toolCall?.goal,
    plan.goal,
    plan.instruction,
  ].filter(isValidAgentTaskScopeText).join('\n');
}

function createAgentApprovalCommandFingerprint(command: AgentChatCommand) {
  return command.toolCall
    ? JSON.stringify({ input: command.toolCall.input ?? null, name: command.toolCall.name })
    : JSON.stringify({ kind: command.kind, sourceText: command.sourceText });
}

function isSameAgentApprovalCommand(left: AgentChatCommand, right: AgentChatCommand) {
  return createAgentApprovalCommandFingerprint(left) === createAgentApprovalCommandFingerprint(right);
}

function isAgentCommandHardGate(command: AgentChatCommand, plan: AgentExecutionPlan) {
  const text = [
    plan.goal,
    plan.instruction,
    ...plan.steps.flatMap((step) => [
      step.id,
      step.summary,
      step.action.label,
      step.action.targetDescription,
      step.decision.reason,
      ...(step.details ?? []),
    ]),
    command.instruction,
    command.sourceText,
    command.toolCall?.goal,
    command.toolCall?.name,
    command.toolCall?.input ? JSON.stringify(command.toolCall.input) : '',
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join('\n');
  return AGENT_TASK_HARD_GATE_PATTERN.test(text);
}

function isAgentPendingApprovalWithinApprovedRiskCeiling(options: {
  approvedPlan: AgentExecutionPlan;
  pendingPlan: AgentExecutionPlan;
}) {
  const approvedMaxRisk = resolveMaxRisk(options.approvedPlan);
  const pendingMaxRisk = resolveMaxRisk(options.pendingPlan);
  return (pendingMaxRisk ? RISK_PRIORITY[pendingMaxRisk] : -1)
    <= (approvedMaxRisk ? RISK_PRIORITY[approvedMaxRisk] : -1);
}

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

export function diagnoseAgentTaskScopedApprovalContinuation(options: {
  approvedCommand: AgentChatCommand;
  approvedPlan: AgentExecutionPlan;
  pendingCommand: AgentChatCommand;
  pendingPlan: AgentExecutionPlan;
}): AgentTaskScopedApprovalContinuationDecision {
  const { approvedCommand, approvedPlan, pendingCommand, pendingPlan } = options;
  const pendingTool = pendingCommand.toolCall?.name ?? pendingCommand.kind;
  const route = buildAgentPermissionRoute(pendingCommand);
  const duplicate = isSameAgentApprovalCommand(approvedCommand, pendingCommand);
  const eligibleTool = AGENT_TASK_APPROVAL_CONTINUATION_TOOLS.has(pendingTool);
  const hardGate = isAgentCommandHardGate(pendingCommand, pendingPlan);
  const freshApprovalRequired = hasAbsolutePathInput(pendingCommand.toolCall?.input)
    || [pendingPlan, route.plan].some((plan) => (
      plan?.steps.some((step) => AGENT_FRESH_APPROVAL_ACTION_KINDS.has(step.action.kind)) ?? false
    ));
  const scopeMatched = hasSameAgentTaskScope(options);
  const prohibition = diagnoseAgentCommandExplicitProhibition({
    command: pendingCommand,
    sourceText: getAgentTaskScopeSourceText(approvedCommand, approvedPlan),
    userGoal: approvedPlan.goal,
  });
  const pendingActionCoverage = new Set(prohibition.commandActionKinds);
  const prohibitedActionCoverage = new Set(prohibition.prohibitedActionKinds);
  const prohibitionConflict = prohibition.prohibitionConflict;
  const withinRiskCeiling = isAgentPendingApprovalWithinApprovedRiskCeiling({
    approvedPlan,
    pendingPlan,
  });
  const desktopSafe = Boolean(route.plan?.steps.length)
    && !route.blockedStep
    && route.plan!.steps.every((step) => (
      step.decision.allowed
      && step.action.requiresDesktopMode
      && step.action.risk !== 'destructive'
      && step.action.risk !== 'blocked'
    ));
  const allowed = !duplicate
    && eligibleTool
    && !hardGate
    && !freshApprovalRequired
    && !prohibitionConflict
    && scopeMatched
    && withinRiskCeiling
    && Boolean(route.plan)
    && !route.blockedStep
    && desktopSafe;
  const reason: AgentTaskScopedApprovalContinuationDecision['reason'] = duplicate
    ? 'duplicate-command'
    : !eligibleTool
      ? 'ineligible-tool'
      : hardGate
        ? 'hard-gate'
        : freshApprovalRequired
          ? 'fresh-approval-required'
        : prohibitionConflict
          ? 'explicit-prohibition'
        : !scopeMatched
          ? 'scope-mismatch'
          : !withinRiskCeiling
            ? 'risk-escalation'
            : !route.plan
              ? 'no-permission-plan'
              : route.blockedStep
                ? 'permission-blocked'
                : !desktopSafe
                  ? 'not-desktop-safe'
                  : 'eligible';

  return {
    allowed,
    desktopSafe,
    duplicate,
    eligibleTool,
    freshApprovalRequired,
    hardGate,
    pendingGoal: pendingPlan.goal,
    pendingRouteSummary: route.summary,
    pendingTool,
    pendingActionKinds: [...pendingActionCoverage],
    prohibitedActionKinds: [...prohibitedActionCoverage],
    prohibitionConflict,
    reason,
    scopeMatched,
    withinRiskCeiling,
  };
}

export function isAgentTaskScopedApprovalContinuationAllowed(options: {
  approvedCommand: AgentChatCommand;
  approvedPlan: AgentExecutionPlan;
  pendingCommand: AgentChatCommand;
  pendingPlan: AgentExecutionPlan;
}) {
  return diagnoseAgentTaskScopedApprovalContinuation(options).allowed;
}

export function shouldRequestAgentPermissionRouteApproval(route: AgentPermissionRoute) {
  return route.requiresApproval;
}

export function isAgentPermissionRouteSilentReadOnly(route: AgentPermissionRoute) {
  return Boolean(
    route.plan?.steps.length
    && route.plan.steps.every((step) => (
      step.action.risk === 'read'
      && step.decision.allowed
      && step.decision.mode === 'silent'
    )),
  );
}

export function isAgentPermissionRouteAutoContinuableObservation(route: AgentPermissionRoute) {
  return Boolean(
    route.plan?.steps.length
    && !route.blockedStep
    && !route.requiresApproval
    && route.plan.steps.every((step) => (
      (step.action.risk === 'read' || step.action.risk === 'visual')
      && step.decision.allowed
      && (step.decision.mode === 'silent' || step.decision.mode === 'notify')
    )),
  );
}
