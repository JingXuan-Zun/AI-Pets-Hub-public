import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteAutoContinuableObservation,
  isAgentPermissionRouteSilentReadOnly,
  shouldRequestAgentPermissionRouteApproval,
  type AgentPermissionRoute,
} from './agentPermissionRouter';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
  type AgentChatResultAssessment,
  type AgentPlannerCommandStep,
  type AgentToolCallName,
  type AgentToolStateSummary,
} from './agentChatCommand';
import {
  type AgentExecutionPlan,
  type AgentExecutionPlanStep,
} from './agentOrchestrator';
import {
  hasAgentReadOnlyObservationActionCompletionEvidence,
  isAgentReadOnlyObservationForDirectActionRequest,
  isAgentReadOnlyObservationForVisualLocateRequest,
} from './agentReadOnlyActionCompletionEvidence';
import {
  getAgentToolLifecycleMetadata,
  isAgentToolName,
} from './agentToolRegistry';
import {
  getAgentToolInputParamRawValue,
  getAgentToolInputParamSpecs,
  prepareAgentToolInput,
} from './agentToolInputSchema';

export type AgentChatCommandHandler = (
  command: AgentChatCommand,
) => AgentChatCommandResult | Promise<AgentChatCommandResult>;

type AgentRunnableFollowUpAction = Extract<AgentChatFollowUpAction, { kind: 'run-command' }>;

export const AGENT_CORE_RUN_LOOP_MAX_ROUNDS = 3;
export const AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS = 3;
export const AGENT_CORE_REPLAN_MAX_DEPTH = 2;

interface AgentCorePlannerStepRoute {
  command: AgentChatCommand;
  plan: AgentExecutionPlan | null;
  route: AgentPermissionRoute;
  step: AgentPlannerCommandStep;
}

export const AGENT_CORE_PHASES = [
  'understand-goal',
  'observe-context',
  'plan-tools',
  'route-permission',
  'execute-tools',
  'verify-result',
  'recover-or-finish',
] as const;

export type AgentCorePhase = typeof AGENT_CORE_PHASES[number];

export type AgentCorePlanStatus =
  | 'no-plan'
  | 'ready'
  | 'needs-approval'
  | 'blocked';

export interface AgentCorePlan {
  blockedStep: AgentExecutionPlanStep | null;
  command: AgentChatCommand;
  executionPlan: AgentExecutionPlan | null;
  goal: string | null;
  observationSteps: AgentExecutionPlanStep[];
  permissionRoute: AgentPermissionRoute;
  phaseIds: AgentCorePhase[];
  plannerSteps: AgentPlannerCommandStep[];
  requiresApproval: boolean;
  selectedToolName: string | null;
  status: AgentCorePlanStatus;
  taskSteps: AgentCoreTaskStep[];
  taskSummary: string;
}

export interface AgentCoreTaskStep {
  args: Record<string, unknown>;
  index: number;
  phase: AgentPlannerCommandStep['phase'];
  permissionStatus: AgentPermissionRoute['status'];
  reason?: string | null;
  requiresApproval: boolean;
  risk: AgentPermissionRoute['maxRisk'];
  selected: boolean;
  tool: AgentPlannerCommandStep['tool'];
}

export interface AgentCoreAutoContinuationCandidate {
  action: AgentRunnableFollowUpAction;
  plan: AgentExecutionPlan;
}

export interface AgentCoreAutoContinuationStartEvent {
  action: AgentRunnableFollowUpAction;
  initialResult: AgentChatCommandResult;
  plan: AgentExecutionPlan;
}

export interface AgentCoreRunLoopApprovalPause {
  action: AgentRunnableFollowUpAction;
  plan: AgentExecutionPlan;
  reason: string;
}

export type AgentCoreRunLoopRoundStatus =
  | 'completed'
  | 'auto-continued'
  | 'awaiting-approval'
  | 'needs-user'
  | 'unverified'
  | 'failed'
  | 'blocked'
  | 'max-rounds';

export interface AgentCoreRunLoopRound {
  actionLabel: string;
  assessmentSummary?: string | null;
  commandKind: AgentChatCommand['kind'];
  index: number;
  planGoal?: string | null;
  resultText?: string | null;
  status: AgentCoreRunLoopRoundStatus;
  stopReason: string;
  verification?: string | null;
}

export interface AgentCoreReplanRequest {
  corePlan: AgentCorePlan;
  currentCommand: AgentChatCommand;
  currentResult: AgentChatCommandResult;
  observationSummary: string;
  originalCommand: AgentChatCommand;
  remainingPlannerSteps: AgentPlannerCommandStep[];
  roundIndex: number;
  stateSummary: AgentToolStateSummary | null;
}

export interface AgentCoreRecoveryRequest {
  corePlan: AgentCorePlan;
  currentCommand: AgentChatCommand;
  currentResult: AgentChatCommandResult;
  originalCommand: AgentChatCommand;
  resultSummary: string;
  roundIndex: number;
  stateSummary: AgentToolStateSummary | null;
}

export interface AgentCoreReplanDecision {
  command: AgentChatCommand;
  reason?: string | null;
}

export type AgentCoreRecoveryDecision = AgentCoreReplanDecision;

export type AgentCoreReplanHandler = (
  request: AgentCoreReplanRequest,
) => AgentCoreReplanDecision | AgentChatCommand | null | Promise<AgentCoreReplanDecision | AgentChatCommand | null>;

export type AgentCoreRecoveryHandler = (
  request: AgentCoreRecoveryRequest,
) => AgentCoreRecoveryDecision | AgentChatCommand | null | Promise<AgentCoreRecoveryDecision | AgentChatCommand | null>;

export interface AgentCoreRunLoopExecution {
  autoContinuationEvents: AgentCoreAutoContinuationStartEvent[];
  finalCommand: AgentChatCommand;
  finalResult: AgentChatCommandResult;
  pause: AgentCoreRunLoopApprovalPause | null;
  rounds: AgentCoreRunLoopRound[];
}

const AGENT_FALLBACK_HELP_TEXT = 'Agent 会先理解请求，再按需要规划、申请确认、调用本机工具并回执结果。当前工具包括读取电脑/屏幕信息、桌面图标整理、本机应用启动、用户提供路径记忆、只读项目分析和运行分析出的候选动作。';

function resolveAgentCorePlanStatus(options: {
  blockedStep: AgentExecutionPlanStep | null;
  executionPlan: AgentExecutionPlan | null;
  requiresApproval: boolean;
}): AgentCorePlanStatus {
  if (!options.executionPlan) {
    return 'no-plan';
  }

  if (options.blockedStep) {
    return 'blocked';
  }

  if (options.requiresApproval) {
    return 'needs-approval';
  }

  return 'ready';
}

function resolveAgentCoreObservationSteps(plan: AgentExecutionPlan | null) {
  return plan?.steps.filter((step) => step.action.risk === 'read' || step.action.risk === 'visual') ?? [];
}

function createCommandFromPlannerStep(
  sourceCommand: AgentChatCommand,
  step: AgentPlannerCommandStep,
): AgentChatCommand {
  return {
    capabilityId: sourceCommand.capabilityId,
    instruction: sourceCommand.instruction,
    kind: 'tool-call',
    sourceText: sourceCommand.sourceText,
    toolCall: {
      goal: sourceCommand.toolCall?.goal ?? sourceCommand.instruction,
      input: step.args,
      name: step.tool,
    },
  };
}

function createPlannerStepRoute(
  sourceCommand: AgentChatCommand,
  step: AgentPlannerCommandStep,
): AgentCorePlannerStepRoute {
  const command = createCommandFromPlannerStep(sourceCommand, step);
  const route = buildAgentPermissionRoute(command);
  return {
    command,
    plan: route.plan,
    route,
    step,
  };
}

function createPlannerStepRoutes(corePlan: AgentCorePlan): AgentCorePlannerStepRoute[] {
  return corePlan.plannerSteps.map((step) => createPlannerStepRoute(corePlan.command, step));
}

function createPlannerStepAction(route: AgentCorePlannerStepRoute): AgentRunnableFollowUpAction {
  const label = route.step.reason?.trim() || `Run planner step ${route.step.index}: ${route.step.tool}`;
  return {
    command: route.command,
    kind: 'run-command',
    label,
    requiresApproval: !isAgentPermissionRouteAutoContinuableObservation(route.route),
  };
}

function createPlannerStepApprovalPause(
  route: AgentCorePlannerStepRoute,
  reason?: string,
): AgentCoreRunLoopApprovalPause | null {
  if (!route.plan) {
    return null;
  }

  const action = createPlannerStepAction(route);
  return {
    action: {
      ...action,
      requiresApproval: true,
    },
    plan: route.plan,
    reason: reason ?? `Planner step "${action.label}" requires approval before execution.`,
  };
}

function hasRunnablePlannerStepBeforeApproval(corePlan: AgentCorePlan) {
  const firstRoute = createPlannerStepRoutes(corePlan)[0] ?? null;
  return Boolean(firstRoute && isAgentPermissionRouteAutoContinuableObservation(firstRoute.route));
}

function createAgentCoreTaskSteps(command: AgentChatCommand): AgentCoreTaskStep[] {
  const selectedToolName = command.toolCall?.name ?? null;
  return (command.plannerSteps ?? []).map((step) => {
    const route = buildAgentPermissionRoute(createCommandFromPlannerStep(command, step));
    return {
      args: step.args,
      index: step.index,
      phase: step.phase,
      permissionStatus: route.status,
      reason: step.reason ?? null,
      requiresApproval: route.requiresApproval,
      risk: route.maxRisk,
      selected: step.tool === selectedToolName,
      tool: step.tool,
    };
  });
}

function createAgentCoreTaskSummary(taskSteps: AgentCoreTaskStep[]) {
  if (!taskSteps.length) {
    return 'Planner did not provide a multi-step task plan; Agent Core will use the selected tool plan.';
  }

  const stepText = taskSteps.slice(0, 4).map((step) => {
    const approvalText = step.requiresApproval ? 'approval' : step.permissionStatus;
    return `${step.index}:${step.phase}:${step.tool}:${approvalText}`;
  }).join(' | ');
  const extraCount = taskSteps.length > 4 ? ` | +${taskSteps.length - 4} more` : '';
  return `Planner task steps: ${stepText}${extraCount}`;
}

export function createAgentCorePlan(command: AgentChatCommand): AgentCorePlan {
  const permissionRoute = buildAgentPermissionRoute(command);
  const executionPlan = permissionRoute.plan;
  const blockedStep = permissionRoute.blockedStep;
  const requiresApproval = shouldRequestAgentPermissionRouteApproval(permissionRoute);
  const taskSteps = createAgentCoreTaskSteps(command);

  return {
    blockedStep,
    command,
    executionPlan,
    goal: executionPlan?.goal ?? command.toolCall?.goal ?? command.instruction ?? null,
    observationSteps: resolveAgentCoreObservationSteps(executionPlan),
    permissionRoute,
    phaseIds: [...AGENT_CORE_PHASES],
    plannerSteps: command.plannerSteps ?? [],
    requiresApproval,
    selectedToolName: command.toolCall?.name ?? null,
    status: resolveAgentCorePlanStatus({
      blockedStep,
      executionPlan,
      requiresApproval,
    }),
    taskSteps,
    taskSummary: createAgentCoreTaskSummary(taskSteps),
  };
}

export function shouldRequestAgentCoreApproval(corePlan: AgentCorePlan) {
  return corePlan.requiresApproval && !hasRunnablePlannerStepBeforeApproval(corePlan);
}

function createFallbackAgentChatCommandResult(command: AgentChatCommand): AgentChatCommandResult {
  if (command.kind === 'unsupported' && command.plannerMessage) {
    return {
      errorText: command.plannerMessage,
      ok: false,
      responseText: command.plannerMessage,
    };
  }

  if (command.kind === 'help') {
    return {
      observations: ['Returned fallback Agent help text.'],
      ok: true,
      responseText: AGENT_FALLBACK_HELP_TEXT,
    };
  }

  const responseText = `这个指令暂时还没有接入。${AGENT_FALLBACK_HELP_TEXT}`;
  return {
    errorText: responseText,
    ok: false,
    responseText,
  };
}

export function resolveAgentResultFollowUpActions(result: AgentChatCommandResult) {
  return result.followUpActions?.length
    ? result.followUpActions
    : result.followUpAction
      ? [result.followUpAction]
      : [];
}

function compactAgentFollowUpActions(actions: AgentChatFollowUpAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.kind === 'run-command'
      ? `${action.kind}:${action.command.kind}:${action.command.toolCall?.name ?? ''}:${action.label}`
      : `${action.kind}:${action.label}:${action.prompt}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).slice(0, 4);
}

function createAgentRetryCommand(
  sourceText: string,
  command: AgentChatCommand,
): AgentChatCommand {
  if (command.kind === 'tool-call' && command.toolCall) {
    return {
      ...command,
      instruction: `重新执行并复查：${command.instruction}`,
      sourceText,
      toolCall: {
        ...command.toolCall,
        goal: command.toolCall.goal
          ? `重新执行并复查：${command.toolCall.goal}`
          : `重新执行并复查：${command.instruction}`,
      },
    };
  }

  return {
    ...command,
    instruction: `重新执行并复查：${command.instruction}`,
    sourceText,
  };
}

function createAgentReobserveCommand(
  sourceText: string,
  command: AgentChatCommand,
): AgentChatCommand | null {
  if (command.kind === 'desktop-organization' || command.toolCall?.name === 'organize_desktop_icons') {
    const organization = command.desktopOrganization ?? {
      displayTarget: typeof command.toolCall?.input.targetDisplay === 'string'
        ? command.toolCall.input.targetDisplay as NonNullable<AgentChatCommand['desktopOrganization']>['displayTarget']
        : typeof command.toolCall?.input.displayTarget === 'string'
          ? command.toolCall.input.displayTarget as NonNullable<AgentChatCommand['desktopOrganization']>['displayTarget']
          : undefined,
      sourceDisplay: typeof command.toolCall?.input.sourceDisplay === 'string'
        ? command.toolCall.input.sourceDisplay as NonNullable<AgentChatCommand['desktopOrganization']>['sourceDisplay']
        : undefined,
      groupBy: typeof command.toolCall?.input.groupBy === 'string'
        ? command.toolCall.input.groupBy as NonNullable<AgentChatCommand['desktopOrganization']>['groupBy']
        : undefined,
      scope: typeof command.toolCall?.input.sourceScope === 'string'
        ? command.toolCall.input.sourceScope as NonNullable<AgentChatCommand['desktopOrganization']>['scope']
        : typeof command.toolCall?.input.scope === 'string'
          ? command.toolCall.input.scope as NonNullable<AgentChatCommand['desktopOrganization']>['scope']
          : undefined,
      targetDisplay: typeof command.toolCall?.input.targetDisplay === 'string'
        ? command.toolCall.input.targetDisplay as NonNullable<AgentChatCommand['desktopOrganization']>['targetDisplay']
        : undefined,
    };
    const displayTarget = organization.targetDisplay ?? organization.displayTarget;
    const sourceScope = organization.sourceScope ?? organization.scope;

    return {
      capabilityId: 'desktop-organization',
      desktopOrganization: {
        displayTarget,
        groupBy: organization.groupBy,
        mode: 'preview',
        scope: sourceScope,
        sourceDisplay: organization.sourceDisplay,
        sourceScope,
        targetDisplay: displayTarget,
      },
      instruction: '重新观察桌面并生成整理计划',
      kind: 'desktop-organization',
      sourceText,
    };
  }

  if (command.kind === 'desktop-icon-placement' || command.toolCall?.name === 'place_desktop_icon') {
    return createAgentRetryCommand(sourceText, command);
  }

  if (command.toolCall?.name === 'inspect_local_project' || command.toolCall?.name === 'run_local_project_action') {
    const input = command.toolCall.input ?? {};
    const localPath = input.path ?? input.projectPath ?? input.folderPath ?? input.filePath ?? input.query;
    if (typeof localPath !== 'string' || !localPath.trim()) {
      return null;
    }

    return {
      capabilityId: 'local-project-inspector',
      instruction: '重新只读分析本机项目',
      kind: 'tool-call',
      sourceText,
      toolCall: {
        goal: '重新只读分析本机项目',
        input: {
          path: localPath,
          question: sourceText,
        },
        name: 'inspect_local_project',
      },
    };
  }

  if (command.toolCall?.name === 'get_display_info' || command.toolCall?.name === 'get_system_info') {
    return createAgentRetryCommand(sourceText, command);
  }

  if (command.kind === 'app-launch' || command.toolCall?.name === 'launch_local_app') {
    return createAgentRetryCommand(sourceText, command);
  }

  return null;
}

function isDesktopOrganizationExecuteCommand(command: AgentChatCommand) {
  return command.kind === 'desktop-organization'
    ? command.desktopOrganization?.mode === 'execute'
    : command.toolCall?.name === 'organize_desktop_icons'
      && command.toolCall.input?.mode === 'execute';
}

function shouldOfferRunCommandRecovery(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  if (result.ok === false && isDesktopOrganizationExecuteCommand(command)) {
    return false;
  }

  return true;
}

export function createAgentRecoveryFollowUpActions(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatFollowUpAction[] {
  const assessmentStatus = result.assessment?.status;
  if (assessmentStatus === 'completed') {
    return [];
  }

  const actions = [...resolveAgentResultFollowUpActions(result)];
  const sourceText = result.assessment?.nextStep ?? result.followUp ?? command.sourceText;
  const shouldRetry = assessmentStatus === 'unverified' || assessmentStatus === 'failed';
  const shouldAskUser = assessmentStatus === 'needs-user'
    || (result.ok === false && Boolean(result.followUp || result.errorText));
  const canOfferRunCommandRecovery = shouldOfferRunCommandRecovery(command, result);
  const reobserveCommand = createAgentReobserveCommand(`继续：重新观察/复查 ${command.sourceText}`, command);

  if (shouldRetry && reobserveCommand && canOfferRunCommandRecovery) {
    actions.push({
      command: reobserveCommand,
      kind: 'run-command',
      label: command.kind === 'app-launch' || command.toolCall?.name === 'launch_local_app'
        ? '重新查找窗口'
        : '重新观察/复查',
    });
  }

  if (shouldRetry && !reobserveCommand && canOfferRunCommandRecovery) {
    actions.push({
      command: createAgentRetryCommand(`继续：重试 ${command.sourceText}`, command),
      kind: 'run-command',
      label: '重试一次',
      requiresApproval: command.kind !== 'tool-call'
        || command.toolCall?.name === 'run_local_project_action'
        || command.toolCall?.name === 'launch_local_app',
    });
  }

  if (shouldAskUser) {
    actions.push({
      kind: 'ask-user',
      label: '补充信息',
      prompt: result.followUp || result.errorText || result.assessment?.nextStep || '请补充更具体的信息，我再继续处理。',
    });
  }

  if (assessmentStatus === 'can-continue' && !actions.length && result.followUp) {
    actions.push({
      kind: 'ask-user',
      label: '继续说明',
      prompt: result.followUp,
    });
  }

  return compactAgentFollowUpActions(actions).map((action) => (
    action.kind === 'run-command'
      ? {
          ...action,
          command: {
            ...action.command,
            sourceText: action.command.sourceText || sourceText,
          },
        }
      : action
  ));
}

export function createAgentDecisionSummary(result: AgentChatCommandResult, followUpActions: AgentChatFollowUpAction[]) {
  const status = result.assessment?.status ?? 'unverified';
  if (status === 'completed') {
    return '结果已验证，可以交给角色回复';
  }

  if (status === 'can-continue') {
    return followUpActions.length
      ? `发现可继续动作：${followUpActions.map((action) => action.label).join('、')}`
      : '结果可继续，但没有生成可直接点击的动作';
  }

  if (status === 'needs-user') {
    return followUpActions.length
      ? `需要用户补充或确认：${followUpActions.map((action) => action.label).join('、')}`
      : '需要用户补充信息后才能继续';
  }

  if (status === 'failed') {
    return followUpActions.length
      ? `执行失败，已给出恢复选项：${followUpActions.map((action) => action.label).join('、')}`
      : '执行失败，暂时没有可靠恢复动作';
  }

  return followUpActions.length
    ? `结果未完全复核，已给出复查选项：${followUpActions.map((action) => action.label).join('、')}`
    : '结果未完全复核，等待用户决定是否继续';
}

function enrichAgentResultWithRecoveryActions(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const followUpActions = createAgentRecoveryFollowUpActions(command, result);
  const nextStep = result.followUp
    ?? result.assessment?.nextStep
    ?? (followUpActions.length ? createAgentDecisionSummary(result, followUpActions) : null);

  return {
    ...result,
    followUp: nextStep,
    followUpAction: followUpActions[0] ?? result.followUpAction ?? null,
    followUpActions: followUpActions.length ? followUpActions : result.followUpActions ?? null,
  };
}

export function resolveAgentAutoContinuationCandidate(
  result: AgentChatCommandResult,
): AgentCoreAutoContinuationCandidate | null {
  const status = result.assessment?.status;
  if (status !== 'unverified' && status !== 'failed' && status !== 'can-continue') {
    return null;
  }

  const action = resolveAgentResultFollowUpActions(result).find((candidate): candidate is AgentRunnableFollowUpAction => (
    candidate.kind === 'run-command' && !candidate.requiresApproval
  )) ?? null;
  if (!action) {
    return null;
  }

  const route = buildAgentPermissionRoute(action.command);
  const plan = route.plan;
  if (!plan || !isAgentPermissionRouteAutoContinuableObservation(route)) {
    return null;
  }

  return {
    action,
    plan,
  };
}

export function resolveAgentApprovalPauseCandidate(
  result: AgentChatCommandResult,
): AgentCoreRunLoopApprovalPause | null {
  if (result.ok === false || result.assessment?.status === 'failed' || result.assessment?.status === 'needs-user') {
    return null;
  }

  const action = resolveAgentResultFollowUpActions(result).find((candidate): candidate is AgentRunnableFollowUpAction => {
    if (candidate.kind !== 'run-command') {
      return false;
    }

    if (candidate.requiresApproval) {
      return true;
    }

    const route = buildAgentPermissionRoute(candidate.command);
    return shouldRequestAgentPermissionRouteApproval(route);
  }) ?? null;
  if (!action) {
    return null;
  }

  const plan = buildAgentPermissionRoute(action.command).plan;
  if (!plan) {
    return null;
  }

  return {
    action,
    plan,
    reason: `后续动作「${action.label}」需要用户确认。`,
  };
}

function resolveAgentRoundStatus(
  result: AgentChatCommandResult,
  options: {
    autoContinued?: boolean;
    blocked?: boolean;
    maxRounds?: boolean;
    paused?: boolean;
  } = {},
): AgentCoreRunLoopRound['status'] {
  if (options.blocked) {
    return 'blocked';
  }

  if (options.paused) {
    return 'awaiting-approval';
  }

  if (options.autoContinued) {
    return 'auto-continued';
  }

  if (options.maxRounds) {
    return 'max-rounds';
  }

  const assessmentStatus = result.assessment?.status;
  if (assessmentStatus === 'needs-user') {
    return 'needs-user';
  }

  if (assessmentStatus === 'failed') {
    return 'failed';
  }

  if (assessmentStatus === 'unverified') {
    return 'unverified';
  }

  if (result.ok === false) {
    return 'failed';
  }

  return 'completed';
}

function createAgentRunLoopRound(options: {
  actionLabel?: string;
  autoContinued?: boolean;
  blocked?: boolean;
  command: AgentChatCommand;
  index: number;
  maxRounds?: boolean;
  paused?: boolean;
  plan?: AgentExecutionPlan | null;
  result: AgentChatCommandResult;
  stopReason: string;
}): AgentCoreRunLoopRound {
  const {
    actionLabel,
    autoContinued,
    blocked,
    command,
    index,
    maxRounds,
    paused,
    plan,
    result,
    stopReason,
  } = options;

  return {
    actionLabel: actionLabel ?? plan?.goal ?? command.instruction,
    assessmentSummary: result.assessment?.summary ?? null,
    commandKind: command.kind,
    index,
    planGoal: plan?.goal ?? null,
    resultText: result.responseText,
    status: resolveAgentRoundStatus(result, {
      autoContinued,
      blocked,
      maxRounds,
      paused,
    }),
    stopReason,
    verification: result.verification ?? null,
  };
}

function appendAgentRunLoopSummary(
  result: AgentChatCommandResult,
  _rounds: AgentCoreRunLoopRound[],
): AgentChatCommandResult {
  return result;
}

function compactAgentAssessmentEvidence(lines: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return lines
    .map((line) => line?.trim() ?? '')
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .slice(0, 6);
}

function compactAgentCoreText(value: string | null | undefined, maxLength = 900) {
  const normalizedValue = value?.replace(/\s+/gu, ' ').trim() ?? '';
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, Math.max(0, maxLength - 3))}...`;
}

function compactAgentToolStateItems(
  lines: Array<string | null | undefined>,
  options: {
    maxItems?: number;
    maxLength?: number;
  } = {},
) {
  const maxItems = options.maxItems ?? 8;
  const maxLength = options.maxLength ?? 220;
  const seen = new Set<string>();

  return lines
    .map((line) => compactAgentCoreText(line, maxLength))
    .filter(Boolean)
    .filter((line) => {
      if (seen.has(line)) {
        return false;
      }

      seen.add(line);
      return true;
    })
    .slice(0, maxItems);
}

function createOptionalAgentToolStateItems(lines: Array<string | null | undefined>) {
  const items = compactAgentToolStateItems(lines);
  return items.length ? items : undefined;
}

function resolveAgentCommandToolName(command: AgentChatCommand) {
  if (command.toolCall?.name) {
    return command.toolCall.name;
  }

  if (command.kind === 'app-launch') {
    return 'launch_local_app';
  }

  if (command.kind === 'app-alias-save') {
    return 'remember_local_app';
  }

  if (command.kind === 'desktop-organization') {
    return 'organize_desktop_icons';
  }

  if (command.kind === 'desktop-icon-placement') {
    return 'place_desktop_icon';
  }

  return null;
}

function hasAgentResultEvidence(result: AgentChatCommandResult) {
  return Boolean(
    result.verification
    || result.receipt?.verification
    || result.receipt?.status === 'success'
    || result.receipt?.evidenceLines?.length
    || result.observations?.length
    || result.stateSummary?.observedState?.length
    || result.stateSummary?.verificationEvidence?.length
    || result.receipt?.stateSummary?.observedState?.length
    || result.receipt?.stateSummary?.verificationEvidence?.length,
  );
}

function resolveAgentToolStateSummaryStatus(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  if (result.assessment?.status) {
    return result.assessment.status;
  }

  if (result.ok === false) {
    return 'failed';
  }

  if (result.receipt?.status === 'failed' || result.receipt?.status === 'blocked') {
    return 'failed';
  }

  if (result.receipt?.status === 'unverified') {
    return 'unverified';
  }

  if (
    (isAgentReadOnlyObservationForDirectActionRequest(command)
      || isAgentReadOnlyObservationForVisualLocateRequest(command))
    && !hasAgentReadOnlyObservationActionCompletionEvidence(result)
  ) {
    return 'unverified';
  }

  return hasAgentResultEvidence(result) ? 'completed' : 'unverified';
}

function didAgentCommandMutateState(command: AgentChatCommand, result: AgentChatCommandResult) {
  if (result.ok === false || !hasAgentResultEvidence(result)) {
    return false;
  }

  const route = buildAgentPermissionRoute(command);
  return Boolean(route.plan?.steps.some((step) => (
    step.decision.allowed
    && (
      step.action.risk === 'reversible-write'
      || step.action.risk === 'launch'
      || step.action.risk === 'destructive'
    )
  )));
}

export function createAgentToolStateSummary(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentToolStateSummary | null {
  const toolName = resolveAgentCommandToolName(command);
  const lifecycle = toolName ? getAgentToolLifecycleMetadata(toolName) : null;
  const existing = result.stateSummary ?? {};
  const receiptState = result.receipt?.stateSummary ?? {};
  const hasExplicitObservedState = Boolean(
    existing.observedState?.length
    || receiptState.observedState?.length
    || result.observations?.length
    || result.receipt?.evidenceLines?.length,
  );
  const observedState = createOptionalAgentToolStateItems([
    ...(existing.observedState ?? []),
    ...(receiptState.observedState ?? []),
    ...(result.observations ?? []),
    ...(result.receipt?.evidenceLines ?? []),
    !hasExplicitObservedState ? result.responseText : null,
  ]);
  const verificationEvidence = createOptionalAgentToolStateItems([
    ...(existing.verificationEvidence ?? []),
    ...(receiptState.verificationEvidence ?? []),
    result.verification,
    result.receipt?.verification,
    result.receipt?.status ? `receipt-status:${result.receipt.status}` : null,
  ]);
  const changedState = createOptionalAgentToolStateItems([
    ...(existing.changedState ?? []),
    ...(receiptState.changedState ?? []),
    ...(lifecycle && didAgentCommandMutateState(command, {
      ...result,
      stateSummary: {
        ...existing,
        observedState,
        verificationEvidence,
      },
    })
      ? lifecycle.mutates
      : []),
  ]);
  const status = resolveAgentToolStateSummaryStatus(
    command,
    {
      ...result,
      stateSummary: {
        ...existing,
        changedState,
        observedState,
        verificationEvidence,
      },
    },
  );
  const shouldRecommendRecovery = status === 'failed'
    || status === 'needs-user'
    || status === 'unverified'
    || result.ok === false;
  const shouldRecoverWithVisualLocate = shouldRecommendRecovery
    && isAgentReadOnlyObservationForVisualLocateRequest(command);
  const missingEvidence = createOptionalAgentToolStateItems([
    ...(existing.missingEvidence ?? []),
    ...(receiptState.missingEvidence ?? []),
    ...(shouldRecoverWithVisualLocate
      ? ['missing:visual-element-location-evidence']
      : []),
    ...(lifecycle && shouldRecommendRecovery && (status === 'unverified' || !verificationEvidence?.length)
      ? lifecycle.verifies.map((item) => `missing:${item}`)
      : []),
    ...(!lifecycle && shouldRecommendRecovery && !verificationEvidence?.length
      ? ['missing:verification-evidence']
      : []),
    ...(!lifecycle && result.ok === false
      ? ['missing:successful-tool-result']
      : []),
  ]);
  const recommendedRecovery = createOptionalAgentToolStateItems([
    ...(existing.recommendedRecovery ?? []),
    ...(receiptState.recommendedRecovery ?? []),
    ...(shouldRecoverWithVisualLocate ? ['tool:locate_screen_elements'] : []),
    ...(lifecycle && shouldRecommendRecovery
      ? lifecycle.recoversWith.map((name) => `tool:${name}`)
      : []),
    ...(!lifecycle && shouldRecommendRecovery && result.followUp
      ? [`follow-up:${result.followUp}`]
      : []),
  ]);
  const summary: AgentToolStateSummary = {
    actionEvidence: existing.actionEvidence ?? receiptState.actionEvidence ?? null,
    changedState,
    missingEvidence,
    observedState,
    recommendedRecovery,
    structuredEvidence: existing.structuredEvidence ?? receiptState.structuredEvidence ?? null,
    verificationEvidence,
  };
  const hasSummary = Object.values(summary).some((items) => (
    Array.isArray(items) ? items.length > 0 : Boolean(items)
  ));

  return hasSummary ? summary : null;
}

function createAgentToolStateSummaryLines(stateSummary?: AgentToolStateSummary | null) {
  if (!stateSummary) {
    return [];
  }

  return [
    stateSummary.observedState?.length ? `observedState=${stateSummary.observedState.join(' | ')}` : '',
    stateSummary.changedState?.length ? `changedState=${stateSummary.changedState.join(' | ')}` : '',
    stateSummary.verificationEvidence?.length ? `verificationEvidence=${stateSummary.verificationEvidence.join(' | ')}` : '',
    stateSummary.missingEvidence?.length ? `missingEvidence=${stateSummary.missingEvidence.join(' | ')}` : '',
    stateSummary.recommendedRecovery?.length ? `recommendedRecovery=${stateSummary.recommendedRecovery.join(' | ')}` : '',
    stateSummary.actionEvidence ? `actionEvidence=${compactAgentCoreText(JSON.stringify(stateSummary.actionEvidence), 700)}` : '',
    stateSummary.structuredEvidence ? `structuredEvidence=${compactAgentCoreText(JSON.stringify(stateSummary.structuredEvidence), 700)}` : '',
  ].filter(Boolean);
}

function createAgentCoreObservationSummary(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  return [
    `tool=${command.toolCall?.name ?? command.kind}`,
    `status=${result.assessment?.status ?? (result.ok === false ? 'failed' : 'completed')}`,
    ...createAgentToolStateSummaryLines(result.stateSummary),
    result.verification ? `verification=${compactAgentCoreText(result.verification, 260)}` : '',
    result.responseText ? `result=${compactAgentCoreText(result.responseText, 520)}` : '',
    ...(result.observations ?? []).slice(0, 4).map((observation) => (
      `observation=${compactAgentCoreText(observation, 220)}`
    )),
  ].filter(Boolean).join('\n');
}

function normalizeAgentCoreReplanDecision(
  decision: AgentCoreReplanDecision | AgentChatCommand | null,
): AgentCoreReplanDecision | null {
  if (!decision) {
    return null;
  }

  if ('command' in decision) {
    return decision;
  }

  return {
    command: decision,
  };
}

function parseAgentRecoveryToolName(value: string): AgentToolCallName | null {
  const normalizedValue = value.trim().replace(/^tool:/iu, '');
  return isAgentToolName(normalizedValue) ? normalizedValue : null;
}

function isAgentInputRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeAgentRecoveryInput(
  target: Record<string, unknown>,
  source: Record<string, unknown> | null | undefined,
) {
  if (!source) {
    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (
      target[key] === undefined
      && value !== undefined
      && value !== null
      && !(typeof value === 'string' && !value.trim())
    ) {
      target[key] = value;
    }
  }
}

function extractAgentStateKeyValuePairs(lines: Array<string | null | undefined>) {
  const input: Record<string, unknown> = {};
  for (const line of lines) {
    const match = line?.match(/\b([A-Za-z][A-Za-z0-9_-]{1,40})\s*=\s*([^|,;]+)/u);
    if (!match?.[1] || !match[2]) {
      continue;
    }

    const value = match[2].trim();
    if (value) {
      input[match[1]] = value;
    }
  }

  return input;
}

function createAgentRecoveryStateInput(request: AgentCoreRecoveryRequest) {
  return extractAgentStateKeyValuePairs([
    ...(request.stateSummary?.observedState ?? []),
    ...(request.stateSummary?.changedState ?? []),
    ...(request.stateSummary?.verificationEvidence ?? []),
    ...(request.stateSummary?.missingEvidence ?? []),
  ]);
}

function createAgentCoreRecoveryToolInput(
  request: AgentCoreRecoveryRequest,
  toolName: AgentToolCallName,
): Record<string, unknown> | null {
  const candidateInput: Record<string, unknown> = {};
  const currentInput = request.currentCommand.toolCall?.input;
  const originalInput = request.originalCommand.toolCall?.input;
  const currentPlannerStep = request.currentCommand.plannerSteps
    ?.find((step) => step.tool === toolName);
  const originalPlannerStep = request.originalCommand.plannerSteps
    ?.find((step) => step.tool === toolName);

  mergeAgentRecoveryInput(candidateInput, isAgentInputRecord(currentInput) ? currentInput : null);
  mergeAgentRecoveryInput(candidateInput, isAgentInputRecord(originalInput) ? originalInput : null);
  mergeAgentRecoveryInput(candidateInput, currentPlannerStep?.args);
  mergeAgentRecoveryInput(candidateInput, originalPlannerStep?.args);
  mergeAgentRecoveryInput(candidateInput, createAgentRecoveryStateInput(request));

  const filteredInput: Record<string, unknown> = {};
  for (const spec of getAgentToolInputParamSpecs(toolName)) {
    const rawValue = getAgentToolInputParamRawValue(candidateInput, spec);
    if (rawValue !== undefined) {
      filteredInput[spec.key] = rawValue;
    }
  }

  const preparedInput = prepareAgentToolInput(toolName, filteredInput);
  return preparedInput.ok ? preparedInput.input : null;
}

function resolveAgentCoreRecoveryCapabilityId(
  toolName: AgentToolCallName,
  fallbackCapabilityId: AgentChatCommand['capabilityId'],
): AgentChatCommand['capabilityId'] {
  if (toolName === 'get_pet_settings' || toolName === 'update_pet_settings') {
    return 'pet-settings';
  }

  if (toolName === 'get_display_info' || toolName === 'get_system_info') {
    return 'system-inspector';
  }

  if (
    toolName === 'get_voice_status'
    || toolName === 'set_voice_input'
    || toolName === 'start_voice_input_session'
    || toolName === 'stop_voice_input_session'
    || toolName === 'switch_tts_provider'
    || toolName === 'warmup_local_voice'
  ) {
    return 'voice-control';
  }

  if (
    toolName === 'execute_desktop_observation'
    || toolName === 'get_active_window_info'
    || toolName === 'observe_windows_and_apps'
    || toolName === 'list_capture_sources'
    || toolName === 'summarize_visual_snapshot'
    || toolName === 'locate_screen_elements'
    || toolName === 'get_cursor_position'
  ) {
    return 'desktop-observation';
  }

  if (toolName === 'analyze_game_screen' || toolName === 'manage_game_companion_loop') {
    return 'game-companion';
  }

  if (toolName === 'inspect_local_project' || toolName === 'run_local_project_action') {
    return 'local-project-inspector';
  }

  if (
    toolName === 'execute_local_file_action'
    || toolName === 'execute_file_management_action'
    || toolName === 'get_path_info'
    || toolName === 'list_directory'
    || toolName === 'search_files'
    || toolName === 'read_text_file'
  ) {
    return 'local-file-system';
  }

  if (toolName === 'execute_memory_action') {
    return 'agent-memory';
  }

  if (
    toolName === 'organize_desktop_icons'
    || toolName === 'place_desktop_icon'
  ) {
    return 'desktop-organization';
  }

  if (
    toolName === 'launch_local_app'
    || toolName === 'execute_desktop_action'
    || toolName === 'execute_desktop_input'
    || toolName === 'control_browser'
    || toolName === 'remember_local_app'
  ) {
    return 'app-launcher';
  }

  if (toolName === 'run_controlled_command') {
    return 'system-inspector';
  }

  return fallbackCapabilityId;
}

function createAgentCoreStructuredRecoveryCommand(
  request: AgentCoreRecoveryRequest,
): AgentCoreRecoveryDecision | null {
  const toolNames = (request.stateSummary?.recommendedRecovery ?? [])
    .map(parseAgentRecoveryToolName)
    .filter((toolName): toolName is AgentToolCallName => Boolean(toolName));

  for (const toolName of toolNames) {
    if (toolName === request.currentCommand.toolCall?.name) {
      continue;
    }

    const input = createAgentCoreRecoveryToolInput(request, toolName);
    if (!input) {
      continue;
    }

    const command: AgentChatCommand = {
      capabilityId: resolveAgentCoreRecoveryCapabilityId(toolName, request.currentCommand.capabilityId),
      instruction: `Structured recovery: ${toolName}`,
      kind: 'tool-call',
      plannerSteps: request.currentCommand.plannerSteps,
      sourceText: request.originalCommand.sourceText,
      toolCall: {
        goal: `Recover missing evidence with ${toolName}`,
        input,
        name: toolName,
      },
    };
    const route = buildAgentPermissionRoute(command);
    if (isAgentPermissionRouteAutoContinuableObservation(route)) {
      return {
        command,
        reason: `Structured state recovery selected ${toolName} for missing evidence.`,
      };
    }

    if (!route.blockedStep && route.plan?.steps.length) {
      return {
        command,
        reason: `Structured state recovery prepared ${toolName}; user approval is required before execution.`,
      };
    }
  }

  return null;
}

function shouldRequestAgentCoreRecovery(options: {
  currentResult: AgentChatCommandResult;
  roundIndex: number;
}) {
  if (options.roundIndex >= AGENT_CORE_RUN_LOOP_MAX_ROUNDS) {
    return false;
  }

  const status = options.currentResult.assessment?.status;
  return options.currentResult.ok === false
    || status === 'failed'
    || status === 'needs-user'
    || status === 'unverified';
}

function createAgentCoreResultSummary(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  return [
    `tool=${command.toolCall?.name ?? command.kind}`,
    `status=${result.assessment?.status ?? (result.ok === false ? 'failed' : 'completed')}`,
    result.ok === false ? 'ok=false' : 'ok=true',
    result.assessment?.summary ? `assessment=${compactAgentCoreText(result.assessment.summary, 360)}` : '',
    result.assessment?.nextStep ? `nextStep=${compactAgentCoreText(result.assessment.nextStep, 260)}` : '',
    ...createAgentToolStateSummaryLines(result.stateSummary),
    result.verification ? `verification=${compactAgentCoreText(result.verification, 260)}` : '',
    result.errorText ? `error=${compactAgentCoreText(result.errorText, 260)}` : '',
    result.responseText ? `result=${compactAgentCoreText(result.responseText, 520)}` : '',
    ...(result.observations ?? []).slice(0, 4).map((observation) => (
      `observation=${compactAgentCoreText(observation, 220)}`
    )),
    followUpActions.length
      ? `availableActions=${followUpActions.map((action) => action.label).join(' | ')}`
      : '',
  ].filter(Boolean).join('\n');
}

function shouldRequestAgentCoreReplan(options: {
  currentResult: AgentChatCommandResult;
  nextRoute: AgentCorePlannerStepRoute | null;
  replanDepth: number;
  remainingPlannerSteps: AgentPlannerCommandStep[];
}) {
  if (options.replanDepth >= AGENT_CORE_REPLAN_MAX_DEPTH) {
    return false;
  }

  if (!options.remainingPlannerSteps.length) {
    return false;
  }

  if (shouldStopPlannerScheduleAfterResult(options.currentResult)) {
    return false;
  }

  if (!options.nextRoute) {
    return false;
  }

  return !isAgentPermissionRouteAutoContinuableObservation(options.nextRoute.route);
}

function createAgentResultAssessment(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatResultAssessment {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const askUserAction = followUpActions.find((action) => action.kind === 'ask-user') ?? null;
  const runCommandAction = followUpActions.find((action) => action.kind === 'run-command') ?? null;
  const nextStep = result.followUp ?? askUserAction?.prompt ?? runCommandAction?.label ?? null;
  const hasEvidence = hasAgentResultEvidence(result);
  const readOnlyActionObservation = isAgentReadOnlyObservationForDirectActionRequest(command);
  const readOnlyVisualLocateObservation = isAgentReadOnlyObservationForVisualLocateRequest(command);
  const readOnlyActionVerified = !(readOnlyActionObservation || readOnlyVisualLocateObservation)
    || hasAgentReadOnlyObservationActionCompletionEvidence(result);
  const failed = result.ok === false
    || result.receipt?.status === 'failed'
    || result.receipt?.status === 'blocked';
  const receiptUnverified = result.receipt?.status === 'unverified';
  const needsUser = Boolean(askUserAction || (failed && nextStep));
  const canContinue = Boolean(!failed && (runCommandAction || result.followUp));

  const status: AgentChatResultAssessment['status'] = failed
    ? needsUser ? 'needs-user' : 'failed'
    : needsUser
      ? 'needs-user'
      : receiptUnverified
        ? 'unverified'
      : canContinue
        ? 'can-continue'
        : hasEvidence && readOnlyActionVerified
          ? 'completed'
          : 'unverified';

  const summary = (() => {
    if (status === 'needs-user') {
      return nextStep ? `需要用户补充或确认：${nextStep}` : '需要用户补充信息后才能继续';
    }

    if (status === 'failed') {
      return result.errorText ?? '执行失败，且没有可自动继续的下一步';
    }

    if (status === 'can-continue') {
      return nextStep ? `当前步骤已完成，可继续：${nextStep}` : '当前步骤已完成，并提供了后续动作';
    }

    if (status === 'unverified') {
      return '工具返回完成，但没有额外复查信号';
    }

    return result.verification ?? '当前步骤已完成，并有工具返回的验证信号';
  })();

  return {
    evidence: compactAgentAssessmentEvidence([
      command.toolCall?.name ? `工具：${command.toolCall.name}` : `指令类型：${command.kind}`,
      result.verification ? `验证：${result.verification}` : null,
      result.errorText ? `错误：${result.errorText}` : null,
      result.responseText ? `结果：${result.responseText}` : null,
      result.followUp ? `下一步：${result.followUp}` : null,
      ...(result.observations ?? []).map((observation) => `观察：${observation}`),
      ...(result.stateSummary?.observedState ?? []).map((item) => `observedState:${item}`),
      ...(result.stateSummary?.changedState ?? []).map((item) => `changedState:${item}`),
      ...(result.stateSummary?.verificationEvidence ?? []).map((item) => `verificationEvidence:${item}`),
      ...(result.stateSummary?.missingEvidence ?? []).map((item) => `missingEvidence:${item}`),
      ...(result.stateSummary?.recommendedRecovery ?? []).map((item) => `recommendedRecovery:${item}`),
    ]),
    nextStep,
    status,
    summary,
  };
}

export function assessAgentCommandResult(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const statefulResult = {
    ...result,
    stateSummary: createAgentToolStateSummary(command, result),
  };
  const assessedResult = {
    ...statefulResult,
    assessment: statefulResult.assessment ?? createAgentResultAssessment(command, statefulResult),
  };
  const assessedStatefulResult = {
    ...assessedResult,
    stateSummary: createAgentToolStateSummary(command, assessedResult),
  };

  return enrichAgentResultWithRecoveryActions(command, assessedStatefulResult);
}

export function findBlockedAgentPlanStep(plan: AgentExecutionPlan | null) {
  return plan?.steps.find((step) => (
    !step.decision.allowed || step.decision.mode === 'blocked'
  )) ?? null;
}

export function createBlockedAgentCommandResult(blockedStep: AgentExecutionPlanStep): AgentChatCommandResult {
  const responseText = `我先停下。这次操作里的「${blockedStep.summary}」没有通过权限策略：${blockedStep.decision.reason}`;
  return {
    errorText: blockedStep.decision.reason,
    observations: [`Blocked action: ${blockedStep.summary}`],
    ok: false,
    responseText,
  };
}

async function resolveAgentChatCommandResult(
  command: AgentChatCommand,
  handler?: AgentChatCommandHandler,
) {
  if (!handler) {
    return createFallbackAgentChatCommandResult(command);
  }

  try {
    return await handler(command);
  } catch (error) {
    const responseText = `Agent 指令执行失败：${error instanceof Error ? error.message : String(error)}`;
    return {
      errorText: responseText,
      ok: false,
      responseText,
    };
  }
}

function createCommandApprovalPause(
  command: AgentChatCommand,
  plan: AgentExecutionPlan | null,
  reason: string,
): AgentCoreRunLoopApprovalPause | null {
  if (!plan) {
    return null;
  }

  return {
    action: {
      command,
      kind: 'run-command',
      label: plan.goal || command.instruction,
      requiresApproval: true,
    },
    plan,
    reason,
  };
}

function createApprovalPauseResult(pause: AgentCoreRunLoopApprovalPause): AgentChatCommandResult {
  return {
    followUp: pause.reason,
    followUpAction: pause.action,
    followUpActions: [pause.action],
    ok: true,
    responseText: pause.reason,
  };
}

function shouldStopPlannerScheduleAfterResult(result: AgentChatCommandResult) {
  const status = result.assessment?.status;
  return result.ok === false
    || status === 'failed'
    || status === 'needs-user'
    || status === 'unverified';
}

async function executeAgentCorePlannerStepSchedule(options: {
  corePlan: AgentCorePlan;
  onAgentCoreReplan?: AgentCoreReplanHandler;
  onAgentChatCommand?: AgentChatCommandHandler;
  replanDepth?: number;
  rounds: AgentCoreRunLoopRound[];
}): Promise<AgentCoreRunLoopExecution | null> {
  const {
    corePlan,
    onAgentCoreReplan,
    onAgentChatCommand,
    replanDepth = 0,
    rounds,
  } = options;
  const stepRoutes = createPlannerStepRoutes(corePlan);
  const firstRoute = stepRoutes[0] ?? null;
  if (!firstRoute || !isAgentPermissionRouteAutoContinuableObservation(firstRoute.route)) {
    return null;
  }

  const autoContinuationEvents: AgentCoreAutoContinuationStartEvent[] = [];
  let currentCommand: AgentChatCommand = corePlan.command;
  let currentPlan = corePlan.executionPlan;
  let currentResult: AgentChatCommandResult | null = null;

  for (
    let routeIndex = 0;
    routeIndex < stepRoutes.length && routeIndex < AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS;
    routeIndex += 1
  ) {
    const route = stepRoutes[routeIndex];
    if (!route) {
      break;
    }

    if (route.route.blockedStep) {
      const blockedResult = assessAgentCommandResult(
        route.command,
        createBlockedAgentCommandResult(route.route.blockedStep),
      );
      rounds.push(createAgentRunLoopRound({
        blocked: true,
        command: route.command,
        index: rounds.length + 1,
        plan: route.plan,
        result: blockedResult,
        stopReason: 'Planner step blocked by permission policy before execution.',
      }));

      return {
        autoContinuationEvents,
        finalCommand: route.command,
        finalResult: appendAgentRunLoopSummary(blockedResult, rounds),
        pause: null,
        rounds,
      };
    }

    if (!isAgentPermissionRouteAutoContinuableObservation(route.route)) {
      const pause = createPlannerStepApprovalPause(route);
      if (!pause) {
        return null;
      }

      const pauseResult = assessAgentCommandResult(route.command, createApprovalPauseResult(pause));
      rounds.push(createAgentRunLoopRound({
        command: currentResult ? currentCommand : route.command,
        index: rounds.length + 1,
        paused: true,
        plan: currentResult ? currentPlan : route.plan,
        result: currentResult ?? pauseResult,
        stopReason: pause.reason,
      }));

      return {
        autoContinuationEvents,
        finalCommand: currentResult ? currentCommand : route.command,
        finalResult: appendAgentRunLoopSummary(currentResult ?? pauseResult, rounds),
        pause,
        rounds,
      };
    }

    const rawResult = await resolveAgentChatCommandResult(route.command, onAgentChatCommand);
    currentCommand = route.command;
    currentPlan = route.plan;
    currentResult = assessAgentCommandResult(route.command, rawResult);

    const nextRoute = stepRoutes[routeIndex + 1] ?? null;
    if (shouldStopPlannerScheduleAfterResult(currentResult)) {
      rounds.push(createAgentRunLoopRound({
        command: route.command,
        index: rounds.length + 1,
        plan: route.plan,
        result: currentResult,
        stopReason: createAgentDecisionSummary(currentResult, resolveAgentResultFollowUpActions(currentResult)),
      }));

      return {
        autoContinuationEvents,
        finalCommand: route.command,
        finalResult: appendAgentRunLoopSummary(currentResult, rounds),
        pause: null,
        rounds,
      };
    }

    if (nextRoute?.route.blockedStep) {
      rounds.push(createAgentRunLoopRound({
        command: route.command,
        index: rounds.length + 1,
        plan: route.plan,
        result: currentResult,
        stopReason: `Next planner step is blocked: ${nextRoute.route.blockedStep.summary}`,
      }));

      return {
        autoContinuationEvents,
        finalCommand: route.command,
        finalResult: appendAgentRunLoopSummary(currentResult, rounds),
        pause: null,
        rounds,
      };
    }

    const remainingPlannerSteps = corePlan.plannerSteps.filter((step) => step.index > route.step.index);
    if (
      onAgentCoreReplan
      && shouldRequestAgentCoreReplan({
        currentResult,
        nextRoute,
        replanDepth,
        remainingPlannerSteps,
      })
    ) {
      const replanDecision = normalizeAgentCoreReplanDecision(await onAgentCoreReplan({
        corePlan,
        currentCommand: route.command,
        currentResult,
        observationSummary: createAgentCoreObservationSummary(route.command, currentResult),
        originalCommand: corePlan.command,
        remainingPlannerSteps,
        roundIndex: rounds.length + 1,
        stateSummary: currentResult.stateSummary ?? null,
      }));

      if (replanDecision) {
        const nextCorePlan = createAgentCorePlan(replanDecision.command);
        const nextRoute = nextCorePlan.permissionRoute;
        if (nextRoute.blockedStep) {
          rounds.push(createAgentRunLoopRound({
            command: route.command,
            index: rounds.length + 1,
            plan: route.plan,
            result: currentResult,
            stopReason: `Replan blocked by permission policy: ${nextRoute.blockedStep.summary}`,
          }));

          return {
            autoContinuationEvents,
            finalCommand: route.command,
            finalResult: appendAgentRunLoopSummary(currentResult, rounds),
            pause: null,
            rounds,
          };
        }

        if (!isAgentPermissionRouteAutoContinuableObservation(nextRoute)) {
          const pause = createCommandApprovalPause(
            replanDecision.command,
            nextRoute.plan,
            replanDecision.reason ?? 'Replanned next action requires user approval before execution.',
          );
          if (pause) {
            rounds.push(createAgentRunLoopRound({
              command: route.command,
              index: rounds.length + 1,
              paused: true,
              plan: route.plan,
              result: currentResult,
              stopReason: pause.reason,
            }));

            return {
              autoContinuationEvents,
              finalCommand: route.command,
              finalResult: appendAgentRunLoopSummary(currentResult, rounds),
              pause,
              rounds,
            };
          }
        }

        rounds.push(createAgentRunLoopRound({
          command: route.command,
          index: rounds.length + 1,
          plan: route.plan,
          result: currentResult,
          stopReason: replanDecision.reason ?? 'Observation completed; Agent Core replanned the next action.',
        }));

        const replanScheduleResult = await executeAgentCorePlannerStepSchedule({
          corePlan: nextCorePlan,
          onAgentCoreReplan,
          onAgentChatCommand,
          replanDepth: replanDepth + 1,
          rounds,
        });
        if (replanScheduleResult) {
          return replanScheduleResult;
        }

        const rawReplanResult = await resolveAgentChatCommandResult(replanDecision.command, onAgentChatCommand);
        const assessedReplanResult = assessAgentCommandResult(replanDecision.command, rawReplanResult);
        rounds.push(createAgentRunLoopRound({
          command: replanDecision.command,
          index: rounds.length + 1,
          plan: nextRoute.plan,
          result: assessedReplanResult,
          stopReason: replanDecision.reason ?? 'Replanned silent read-only action completed.',
        }));

        return {
          autoContinuationEvents,
          finalCommand: replanDecision.command,
          finalResult: appendAgentRunLoopSummary(assessedReplanResult, rounds),
          pause: null,
          rounds,
        };
      }
    }

    if (nextRoute && !isAgentPermissionRouteAutoContinuableObservation(nextRoute.route)) {
      const pause = createPlannerStepApprovalPause(nextRoute);
      if (pause) {
        rounds.push(createAgentRunLoopRound({
          command: route.command,
          index: rounds.length + 1,
          paused: true,
          plan: route.plan,
          result: currentResult,
          stopReason: pause.reason,
        }));

        return {
          autoContinuationEvents,
          finalCommand: route.command,
          finalResult: appendAgentRunLoopSummary(currentResult, rounds),
          pause,
          rounds,
        };
      }
    }

    const approvalPause = resolveAgentApprovalPauseCandidate(currentResult);
    if (!nextRoute && approvalPause) {
      rounds.push(createAgentRunLoopRound({
        command: route.command,
        index: rounds.length + 1,
        paused: true,
        plan: route.plan,
        result: currentResult,
        stopReason: approvalPause.reason,
      }));

      return {
        autoContinuationEvents,
        finalCommand: route.command,
        finalResult: appendAgentRunLoopSummary(currentResult, rounds),
        pause: approvalPause,
        rounds,
      };
    }

    if (!nextRoute) {
      rounds.push(createAgentRunLoopRound({
        command: route.command,
        index: rounds.length + 1,
        plan: route.plan,
        result: currentResult,
        stopReason: createAgentDecisionSummary(currentResult, resolveAgentResultFollowUpActions(currentResult)),
      }));

      return {
        autoContinuationEvents,
        finalCommand: route.command,
        finalResult: appendAgentRunLoopSummary(currentResult, rounds),
        pause: null,
        rounds,
      };
    }

    rounds.push(createAgentRunLoopRound({
      command: route.command,
      index: rounds.length + 1,
      plan: route.plan,
      result: currentResult,
      stopReason: `Planner step ${route.step.index} completed; next silent read-only step can continue.`,
    }));
  }

  if (currentResult) {
    const reachedCap = stepRoutes.length > AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS;
    const cappedResult = reachedCap
      ? assessAgentCommandResult(currentCommand, {
          ...currentResult,
          followUp: `Reached ${AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS} planner auto-run step limit; waiting for user confirmation before continuing.`,
          responseText: [
            currentResult.responseText,
            '',
            `Reached ${AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS} planner auto-run step limit; Agent Core paused the scheduler.`,
          ].join('\n'),
        })
      : currentResult;

    if (reachedCap && rounds.length) {
      rounds[rounds.length - 1] = createAgentRunLoopRound({
        command: currentCommand,
        index: rounds.length,
        maxRounds: true,
        plan: currentPlan,
        result: cappedResult,
        stopReason: `Reached ${AGENT_CORE_TASK_STEP_MAX_AUTO_RUNS} planner auto-run step limit.`,
      });
    }

    return {
      autoContinuationEvents,
      finalCommand: currentCommand,
      finalResult: appendAgentRunLoopSummary(cappedResult, rounds),
      pause: null,
      rounds,
    };
  }

  return null;
}

export async function executeAgentCoreRunLoop(options: {
  approved?: boolean;
  command: AgentChatCommand;
  corePlan?: AgentCorePlan;
  onAgentCoreRecovery?: AgentCoreRecoveryHandler;
  onAgentCoreReplan?: AgentCoreReplanHandler;
  onAgentChatCommand?: AgentChatCommandHandler;
}): Promise<AgentCoreRunLoopExecution> {
  const {
    approved = false,
    command,
    corePlan = createAgentCorePlan(command),
    onAgentCoreRecovery,
    onAgentCoreReplan,
    onAgentChatCommand,
  } = options;
  const initialPlan = corePlan.executionPlan;
  const blockedStep = corePlan.blockedStep;
  const rounds: AgentCoreRunLoopRound[] = [];
  const autoContinuationEvents: AgentCoreAutoContinuationStartEvent[] = [];

  if (blockedStep) {
    const blockedResult = assessAgentCommandResult(command, createBlockedAgentCommandResult(blockedStep));
    rounds.push(createAgentRunLoopRound({
      blocked: true,
      command,
      index: 1,
      plan: initialPlan,
      result: blockedResult,
      stopReason: '权限策略拦截，未执行工具。',
    }));

    return {
      autoContinuationEvents,
      finalCommand: command,
      finalResult: appendAgentRunLoopSummary(blockedResult, rounds),
      pause: null,
      rounds,
    };
  }

  if (corePlan.requiresApproval && !approved && !hasRunnablePlannerStepBeforeApproval(corePlan)) {
    const approvalPause = createCommandApprovalPause(
      command,
      initialPlan,
      'This Agent action requires user approval before execution.',
    );
    if (approvalPause) {
      const pauseResult = assessAgentCommandResult(command, createApprovalPauseResult(approvalPause));
      rounds.push(createAgentRunLoopRound({
        command,
        index: 1,
        paused: true,
        plan: initialPlan,
        result: pauseResult,
        stopReason: approvalPause.reason,
      }));

      return {
        autoContinuationEvents,
        finalCommand: command,
        finalResult: appendAgentRunLoopSummary(pauseResult, rounds),
        pause: approvalPause,
        rounds,
      };
    }
  }

  if (!approved) {
    const plannerScheduleResult = await executeAgentCorePlannerStepSchedule({
      corePlan,
      onAgentCoreReplan,
      onAgentChatCommand,
      rounds,
    });
    if (plannerScheduleResult) {
      return plannerScheduleResult;
    }
  }

  let currentCommand = command;
  let currentPlan = initialPlan;
  let currentResult: AgentChatCommandResult | null = null;

  for (let roundIndex = 1; roundIndex <= AGENT_CORE_RUN_LOOP_MAX_ROUNDS; roundIndex += 1) {
    const rawResult = await resolveAgentChatCommandResult(currentCommand, onAgentChatCommand);
    currentResult = assessAgentCommandResult(currentCommand, rawResult);

    if (
      onAgentCoreRecovery
      && shouldRequestAgentCoreRecovery({
        currentResult,
        roundIndex,
      })
    ) {
      const recoveryRequest: AgentCoreRecoveryRequest = {
        corePlan,
        currentCommand,
        currentResult,
        originalCommand: command,
        resultSummary: createAgentCoreResultSummary(currentCommand, currentResult),
        roundIndex,
        stateSummary: currentResult.stateSummary ?? null,
      };
      const recoveryDecision = normalizeAgentCoreReplanDecision(await onAgentCoreRecovery(recoveryRequest))
        ?? createAgentCoreStructuredRecoveryCommand(recoveryRequest);

      if (recoveryDecision) {
        const recoveryCorePlan = createAgentCorePlan(recoveryDecision.command);
        const recoveryRoute = recoveryCorePlan.permissionRoute;
        if (recoveryRoute.blockedStep) {
          rounds.push(createAgentRunLoopRound({
            command: currentCommand,
            index: roundIndex,
            plan: currentPlan,
            result: currentResult,
            stopReason: `Recovery blocked by permission policy: ${recoveryRoute.blockedStep.summary}`,
          }));

          return {
            autoContinuationEvents,
            finalCommand: currentCommand,
            finalResult: appendAgentRunLoopSummary(currentResult, rounds),
            pause: null,
            rounds,
          };
        }

        if (!isAgentPermissionRouteAutoContinuableObservation(recoveryRoute)) {
          const pause = createCommandApprovalPause(
            recoveryDecision.command,
            recoveryRoute.plan,
            recoveryDecision.reason ?? 'Recovery action requires user approval before execution.',
          );
          if (pause) {
            rounds.push(createAgentRunLoopRound({
              command: currentCommand,
              index: roundIndex,
              paused: true,
              plan: currentPlan,
              result: currentResult,
              stopReason: pause.reason,
            }));

            return {
              autoContinuationEvents,
              finalCommand: currentCommand,
              finalResult: appendAgentRunLoopSummary(currentResult, rounds),
              pause,
              rounds,
            };
          }
        }

        autoContinuationEvents.push({
          action: {
            command: recoveryDecision.command,
            kind: 'run-command',
            label: recoveryDecision.reason ?? 'Agent Core recovery action',
          },
          initialResult: currentResult,
          plan: recoveryRoute.plan ?? recoveryCorePlan.executionPlan ?? currentPlan ?? {
            commandKind: recoveryDecision.command.kind,
            goal: recoveryDecision.command.instruction,
            instruction: recoveryDecision.command.instruction,
            steps: [],
          },
        });
        rounds.push(createAgentRunLoopRound({
          actionLabel: recoveryDecision.reason ?? 'Agent Core recovery action',
          autoContinued: true,
          command: currentCommand,
          index: roundIndex,
          plan: currentPlan,
          result: currentResult,
          stopReason: recoveryDecision.reason ?? 'Agent Core selected a read-only recovery action after result assessment.',
        }));

        currentCommand = recoveryDecision.command;
        currentPlan = recoveryRoute.plan;
        continue;
      }
    }

    const approvalPause = resolveAgentApprovalPauseCandidate(currentResult);
    if (approvalPause) {
      rounds.push(createAgentRunLoopRound({
        command: currentCommand,
        index: roundIndex,
        paused: true,
        plan: currentPlan,
        result: currentResult,
        stopReason: approvalPause.reason,
      }));

      return {
        autoContinuationEvents,
        finalCommand: currentCommand,
        finalResult: appendAgentRunLoopSummary(currentResult, rounds),
        pause: approvalPause,
        rounds,
      };
    }

    const autoContinuation = resolveAgentAutoContinuationCandidate(currentResult);
    if (!autoContinuation) {
      rounds.push(createAgentRunLoopRound({
        command: currentCommand,
        index: roundIndex,
        plan: currentPlan,
        result: currentResult,
        stopReason: createAgentDecisionSummary(currentResult, resolveAgentResultFollowUpActions(currentResult)),
      }));

      return {
        autoContinuationEvents,
        finalCommand: currentCommand,
        finalResult: appendAgentRunLoopSummary(currentResult, rounds),
        pause: null,
        rounds,
      };
    }

    autoContinuationEvents.push({
      action: autoContinuation.action,
      initialResult: currentResult,
      plan: autoContinuation.plan,
    });
    rounds.push(createAgentRunLoopRound({
      actionLabel: autoContinuation.action.label,
      autoContinued: true,
      command: currentCommand,
      index: roundIndex,
      plan: currentPlan,
      result: currentResult,
      stopReason: `自动进入下一轮只读复查：${autoContinuation.action.label}`,
    }));

    if (roundIndex === AGENT_CORE_RUN_LOOP_MAX_ROUNDS) {
      const cappedResult = assessAgentCommandResult(autoContinuation.action.command, {
        ...currentResult,
        followUp: `已达到 ${AGENT_CORE_RUN_LOOP_MAX_ROUNDS} 轮上限，需要你确认是否继续。`,
        responseText: [
          currentResult.responseText,
          '',
          `已达到 ${AGENT_CORE_RUN_LOOP_MAX_ROUNDS} 轮自动处理上限，我先停下，避免 Agent 自己无限继续。`,
        ].join('\n'),
      });
      rounds[rounds.length - 1] = createAgentRunLoopRound({
        actionLabel: autoContinuation.action.label,
        command: currentCommand,
        index: roundIndex,
        maxRounds: true,
        plan: currentPlan,
        result: cappedResult,
        stopReason: `达到 ${AGENT_CORE_RUN_LOOP_MAX_ROUNDS} 轮上限，等待用户决定。`,
      });

      return {
        autoContinuationEvents,
        finalCommand: currentCommand,
        finalResult: appendAgentRunLoopSummary(cappedResult, rounds),
        pause: null,
        rounds,
      };
    }

    currentCommand = autoContinuation.action.command;
    currentPlan = autoContinuation.plan;
  }

  const fallbackResult = currentResult ?? assessAgentCommandResult(command, {
    ok: false,
    responseText: 'Agent 循环没有拿到执行结果。',
  });

  return {
    autoContinuationEvents,
    finalCommand: currentCommand,
    finalResult: appendAgentRunLoopSummary(fallbackResult, rounds),
    pause: null,
    rounds,
  };
}
