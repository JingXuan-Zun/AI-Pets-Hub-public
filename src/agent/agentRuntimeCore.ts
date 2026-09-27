import {
  type AgentChatCommandResult,
  type AgentToolCallName,
} from './agentChatCommand';

export type AgentRuntimeCoreTaskKind =
  | 'open_target_and_move_window';

export type AgentRuntimeCoreStepKind =
  | 'open_web_or_search'
  | 'open_app_or_resource'
  | 'move_window'
  | 'verify_window_on_display';

export type AgentRuntimeCoreEventType =
  | 'task_started'
  | 'step_started'
  | 'step_completed'
  | 'step_failed'
  | 'task_completed'
  | 'task_failed';

export interface AgentRuntimeCoreEvent {
  recoverable?: boolean;
  result?: string;
  reason?: string;
  stepId?: string;
  stepKind?: AgentRuntimeCoreStepKind;
  summary: string;
  taskId: string;
  type: AgentRuntimeCoreEventType;
  verified?: boolean;
}

export interface AgentRuntimeCoreTaskStep {
  action: 'launch_local_app' | 'open_resource' | 'search_web' | 'move_window_to_display' | 'observe_windows_and_apps';
  id: string;
  kind: AgentRuntimeCoreStepKind;
  summary: string;
  tool: 'execute_desktop_action' | 'observe_windows_and_apps';
}

export interface AgentRuntimeCoreTaskPlan {
  events: AgentRuntimeCoreEvent[];
  kind: AgentRuntimeCoreTaskKind;
  steps: AgentRuntimeCoreTaskStep[];
  taskId: string;
  target: string;
  targetDisplay: string;
  version: 1;
}

export interface AgentRuntimeCoreStepState {
  attempts: number;
  completedAt?: number | null;
  id: string;
  kind: AgentRuntimeCoreStepKind;
  lastResult?: string | null;
  startedAt?: number | null;
  status: 'pending' | 'running' | 'completed' | 'failed';
  verified?: boolean | null;
}

export interface AgentRuntimeCoreContext {
  createdAt: number;
  currentStepId?: string | null;
  events: AgentRuntimeCoreEvent[];
  lastEvidence?: string | null;
  plan: AgentRuntimeCoreTaskPlan;
  retryCount: number;
  stepStates: AgentRuntimeCoreStepState[];
  target: string;
  targetDisplay: string;
  taskId: string;
  updatedAt: number;
}

export interface CreateAgentRuntimeCoreOpenMoveTaskPlanOptions {
  forceNew?: boolean;
  sourceText: string;
  target: string;
  targetDisplay: string;
  toolName?: AgentToolCallName;
}

export interface AgentRuntimeCoreDesktopSequenceInput extends Record<string, unknown> {
  postVerify: true;
  postVerifyQuery: string;
  postVerifyVisualQuery: '';
  runtimeCorePlanJson: string;
  stepsJson: string;
}

export interface AgentRuntimeCoreSequenceOutcome {
  completed: boolean;
  context: AgentRuntimeCoreContext;
  events: AgentRuntimeCoreEvent[];
  failedStepId?: string | null;
  reason?: string | null;
  verified: boolean;
}

function nowAgentRuntimeCoreTimestamp() {
  return Date.now();
}

function uniqueAgentRuntimeCoreStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value.trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(text);
  }

  return result;
}

export function createAgentRuntimeCoreWindowTargetCandidates(options: {
  openAction?: string | null;
  target: string;
}) {
  const browserCandidates = options.openAction === 'search_web' || shouldAgentRuntimeCoreTargetOpenAsResource(options.target)
    ? ['browser', 'web browser']
    : [];

  return uniqueAgentRuntimeCoreStrings([
    options.target,
    ...browserCandidates,
  ]).slice(0, 8);
}

function createAgentRuntimeCoreMoveQueryCandidates(plan: AgentRuntimeCoreTaskPlan) {
  return createAgentRuntimeCoreWindowTargetCandidates({
    openAction: plan.steps[0]?.action,
    target: plan.target,
  });
}

function normalizeAgentRuntimeCoreIdPart(value: string) {
  return value.trim().replace(/\s+/gu, '-').replace(/[^\p{L}\p{N}_-]+/gu, '').slice(0, 48) || 'task';
}

function createAgentRuntimeCoreTaskId(options: CreateAgentRuntimeCoreOpenMoveTaskPlanOptions) {
  return [
    'runtime-core-v0-1',
    normalizeAgentRuntimeCoreIdPart(options.target),
    normalizeAgentRuntimeCoreIdPart(options.targetDisplay),
  ].join(':');
}

export function shouldAgentRuntimeCoreTargetOpenAsResource(target: string) {
  return /^(?:https?:\/\/|file:\/\/)/iu.test(target)
    || /^[^\s]+\.[a-z0-9]{2,}(?:[/?#].*)?$/iu.test(target);
}

export function resolveAgentRuntimeCoreOpenAction(options: {
  target: string;
  toolName?: AgentToolCallName;
}): 'launch_local_app' | 'open_resource' | 'search_web' {
  if (options.toolName === 'browser_search' || options.toolName === 'search_web') {
    return 'search_web';
  }

  return shouldAgentRuntimeCoreTargetOpenAsResource(options.target)
    ? 'open_resource'
    : 'launch_local_app';
}

export function createAgentRuntimeCoreOpenMoveTaskPlan(
  options: CreateAgentRuntimeCoreOpenMoveTaskPlanOptions,
): AgentRuntimeCoreTaskPlan {
  const target = options.target.trim();
  const targetDisplay = options.targetDisplay.trim();
  const taskId = createAgentRuntimeCoreTaskId({
    ...options,
    target,
    targetDisplay,
  });
  const openAction = resolveAgentRuntimeCoreOpenAction({
    target,
    toolName: options.toolName,
  });
  const openKind: AgentRuntimeCoreStepKind = openAction === 'search_web'
    ? 'open_web_or_search'
    : 'open_app_or_resource';

  return {
    events: [
      {
        summary: `Start task: open ${target} and move its window to ${targetDisplay}.`,
        taskId,
        type: 'task_started',
      },
    ],
    kind: 'open_target_and_move_window',
    steps: [
      {
        action: openAction,
        id: `${taskId}:open`,
        kind: openKind,
        summary: openAction === 'search_web'
          ? `Open/search ${target}.`
          : `Open or focus ${target}.`,
        tool: 'execute_desktop_action',
      },
      {
        action: 'move_window_to_display',
        id: `${taskId}:move`,
        kind: 'move_window',
        summary: `Move the matching window to ${targetDisplay}.`,
        tool: 'execute_desktop_action',
      },
      {
        action: 'observe_windows_and_apps',
        id: `${taskId}:verify`,
        kind: 'verify_window_on_display',
        summary: `Verify ${target} is on ${targetDisplay}.`,
        tool: 'observe_windows_and_apps',
      },
    ],
    target,
    targetDisplay,
    taskId,
    version: 1,
  };
}

export function createAgentRuntimeCoreContext(
  plan: AgentRuntimeCoreTaskPlan,
  options: {
    now?: number;
  } = {},
): AgentRuntimeCoreContext {
  const now = options.now ?? nowAgentRuntimeCoreTimestamp();
  return {
    createdAt: now,
    currentStepId: null,
    events: [...plan.events],
    lastEvidence: null,
    plan,
    retryCount: 0,
    stepStates: plan.steps.map((step) => ({
      attempts: 0,
      id: step.id,
      kind: step.kind,
      status: 'pending',
      verified: null,
    })),
    target: plan.target,
    targetDisplay: plan.targetDisplay,
    taskId: plan.taskId,
    updatedAt: now,
  };
}

function getAgentRuntimeCoreStep(plan: AgentRuntimeCoreTaskPlan, stepId: string) {
  return plan.steps.find((step) => step.id === stepId) ?? null;
}

function getAgentRuntimeCoreResultStatus(result: AgentChatCommandResult) {
  return result.receipt?.status
    ?? result.stateSummary?.structuredEvidence?.status
    ?? null;
}

function getAgentRuntimeCoreResultEvidenceText(result: AgentChatCommandResult) {
  return [
    result.verification,
    result.responseText,
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.stateSummary?.verificationEvidence ?? []),
    ...(result.stateSummary?.missingEvidence ?? []),
  ].filter(Boolean).join(' | ').trim();
}

function getAgentRuntimeCoreFailureReason(result: AgentChatCommandResult) {
  const missingEvidence = result.stateSummary?.missingEvidence?.find((line) => line.trim());
  return result.errorText
    || missingEvidence
    || result.assessment?.summary
    || result.verification
    || result.responseText
    || 'Runtime sequence did not produce verified completion evidence.';
}

function isAgentRuntimeCoreSequenceVerified(result: AgentChatCommandResult) {
  const status = getAgentRuntimeCoreResultStatus(result);
  const actionOutcome = (
    result.stateSummary?.actionEvidence
      ?? result.receipt?.stateSummary?.actionEvidence
  )?.outcome;

  return result.ok !== false
    && status === 'success'
    && actionOutcome !== 'blocked'
    && actionOutcome !== 'no-op'
    && actionOutcome !== 'uncertain';
}

function isAgentRuntimeCoreSequenceBlocked(result: AgentChatCommandResult) {
  return result.ok === false
    || getAgentRuntimeCoreResultStatus(result) === 'failed'
    || (
      result.stateSummary?.actionEvidence?.outcome
        ?? result.receipt?.stateSummary?.actionEvidence?.outcome
    ) === 'blocked';
}

function getAgentRuntimeCoreStepIdsForSequenceResult(context: AgentRuntimeCoreContext) {
  return context.plan.steps
    .filter((step) => step.kind !== 'verify_window_on_display')
    .map((step) => step.id);
}

function getAgentRuntimeCoreVerifyStepId(context: AgentRuntimeCoreContext) {
  return context.plan.steps.find((step) => step.kind === 'verify_window_on_display')?.id ?? null;
}

function isAgentRuntimeCoreTaskStep(value: unknown): value is AgentRuntimeCoreTaskStep {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const step = value as Partial<AgentRuntimeCoreTaskStep>;
  return typeof step.id === 'string'
    && typeof step.summary === 'string'
    && (
      step.kind === 'open_web_or_search'
      || step.kind === 'open_app_or_resource'
      || step.kind === 'move_window'
      || step.kind === 'verify_window_on_display'
    )
    && (
      step.action === 'launch_local_app'
      || step.action === 'open_resource'
      || step.action === 'search_web'
      || step.action === 'move_window_to_display'
      || step.action === 'observe_windows_and_apps'
    )
    && (
      step.tool === 'execute_desktop_action'
      || step.tool === 'observe_windows_and_apps'
    );
}

export function isAgentRuntimeCoreTaskPlan(value: unknown): value is AgentRuntimeCoreTaskPlan {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const plan = value as Partial<AgentRuntimeCoreTaskPlan>;
  return plan.version === 1
    && plan.kind === 'open_target_and_move_window'
    && typeof plan.taskId === 'string'
    && typeof plan.target === 'string'
    && typeof plan.targetDisplay === 'string'
    && Array.isArray(plan.steps)
    && plan.steps.length > 0
    && plan.steps.every(isAgentRuntimeCoreTaskStep)
    && Array.isArray(plan.events);
}

export function parseAgentRuntimeCoreTaskPlanJson(value: string) {
  if (!value.trim()) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    return isAgentRuntimeCoreTaskPlan(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createAgentRuntimeCoreStepStartedEvent(
  context: AgentRuntimeCoreContext,
  stepId: string,
): AgentRuntimeCoreEvent {
  const step = getAgentRuntimeCoreStep(context.plan, stepId);
  return {
    stepId,
    stepKind: step?.kind,
    summary: step ? `Start step: ${step.summary}` : `Start step: ${stepId}.`,
    taskId: context.taskId,
    type: 'step_started',
  };
}

export function createAgentRuntimeCoreStepCompletedEvent(
  context: AgentRuntimeCoreContext,
  stepId: string,
  options: {
    result?: string | null;
    verified?: boolean | null;
  } = {},
): AgentRuntimeCoreEvent {
  const step = getAgentRuntimeCoreStep(context.plan, stepId);
  const verified = options.verified ?? step?.kind === 'verify_window_on_display';
  return {
    result: options.result ?? 'completed',
    stepId,
    stepKind: step?.kind,
    summary: step ? `Completed step: ${step.summary}` : `Completed step: ${stepId}.`,
    taskId: context.taskId,
    type: 'step_completed',
    verified,
  };
}

export function createAgentRuntimeCoreStepFailedEvent(
  context: AgentRuntimeCoreContext,
  stepId: string,
  options: {
    reason: string;
    recoverable?: boolean | null;
  },
): AgentRuntimeCoreEvent {
  const step = getAgentRuntimeCoreStep(context.plan, stepId);
  return {
    reason: options.reason,
    recoverable: options.recoverable ?? true,
    stepId,
    stepKind: step?.kind,
    summary: step ? `Failed step: ${step.summary}` : `Failed step: ${stepId}.`,
    taskId: context.taskId,
    type: 'step_failed',
    verified: false,
  };
}

export function createAgentRuntimeCoreTaskCompletedEvent(
  context: AgentRuntimeCoreContext,
  options: {
    summary?: string | null;
    verified?: boolean | null;
  } = {},
): AgentRuntimeCoreEvent {
  return {
    summary: options.summary ?? `Task completed: ${context.target} is on ${context.targetDisplay}.`,
    taskId: context.taskId,
    type: 'task_completed',
    verified: options.verified ?? true,
  };
}

export function createAgentRuntimeCoreTaskFailedEvent(
  context: AgentRuntimeCoreContext,
  options: {
    reason: string;
    recoverable?: boolean | null;
  },
): AgentRuntimeCoreEvent {
  return {
    reason: options.reason,
    recoverable: options.recoverable ?? true,
    summary: `Task failed: ${context.target} could not be confirmed on ${context.targetDisplay}.`,
    taskId: context.taskId,
    type: 'task_failed',
    verified: false,
  };
}

export function resolveAgentRuntimeCoreSequenceOutcome(
  context: AgentRuntimeCoreContext,
  result: AgentChatCommandResult,
): AgentRuntimeCoreSequenceOutcome {
  let nextContext = context;
  const events: AgentRuntimeCoreEvent[] = [];
  const append = (event: AgentRuntimeCoreEvent) => {
    events.push(event);
    nextContext = appendAgentRuntimeCoreEvent(nextContext, event);
  };
  const resultText = getAgentRuntimeCoreResultEvidenceText(result);
  const mutatingStepIds = getAgentRuntimeCoreStepIdsForSequenceResult(context);
  const verifyStepId = getAgentRuntimeCoreVerifyStepId(context);
  const verified = isAgentRuntimeCoreSequenceVerified(result);
  const blocked = isAgentRuntimeCoreSequenceBlocked(result);

  for (const stepId of mutatingStepIds) {
    append(createAgentRuntimeCoreStepStartedEvent(nextContext, stepId));
    append(createAgentRuntimeCoreStepCompletedEvent(nextContext, stepId, {
      result: resultText || 'Sequence step executed.',
      verified: verified ? true : null,
    }));
  }

  if (verifyStepId) {
    append(createAgentRuntimeCoreStepStartedEvent(nextContext, verifyStepId));

    if (verified) {
      append(createAgentRuntimeCoreStepCompletedEvent(nextContext, verifyStepId, {
        result: resultText || 'Sequence final state verified.',
        verified: true,
      }));
      append(createAgentRuntimeCoreTaskCompletedEvent(nextContext, {
        summary: `Task completed and verified: ${context.target} is on ${context.targetDisplay}.`,
        verified: true,
      }));

      return {
        completed: true,
        context: nextContext,
        events,
        failedStepId: null,
        verified: true,
      };
    }

    const reason = getAgentRuntimeCoreFailureReason(result);
    append(createAgentRuntimeCoreStepFailedEvent(nextContext, verifyStepId, {
      reason,
      recoverable: !blocked,
    }));
    append(createAgentRuntimeCoreTaskFailedEvent(nextContext, {
      reason,
      recoverable: !blocked,
    }));

    return {
      completed: false,
      context: nextContext,
      events,
      failedStepId: verifyStepId,
      reason,
      verified: false,
    };
  }

  const reason = verified
    ? null
    : getAgentRuntimeCoreFailureReason(result);
  append(verified
    ? createAgentRuntimeCoreTaskCompletedEvent(nextContext, {
        summary: `Task completed and verified: ${context.target} is on ${context.targetDisplay}.`,
        verified: true,
      })
    : createAgentRuntimeCoreTaskFailedEvent(nextContext, {
        reason: reason ?? 'Runtime sequence did not include a verification step.',
        recoverable: !blocked,
      }));

  return {
    completed: verified,
    context: nextContext,
    events,
    failedStepId: null,
    reason,
    verified,
  };
}

export function appendAgentRuntimeCoreEvent(
  context: AgentRuntimeCoreContext,
  event: AgentRuntimeCoreEvent,
  options: {
    now?: number;
  } = {},
): AgentRuntimeCoreContext {
  const now = options.now ?? nowAgentRuntimeCoreTimestamp();
  const stepStates = context.stepStates.map((stepState) => {
    if (!event.stepId || stepState.id !== event.stepId) {
      return stepState;
    }

    if (event.type === 'step_started') {
      return {
        ...stepState,
        attempts: stepState.attempts + 1,
        startedAt: now,
        status: 'running' as const,
      };
    }

    if (event.type === 'step_completed') {
      return {
        ...stepState,
        completedAt: now,
        lastResult: event.result ?? null,
        status: 'completed' as const,
        verified: event.verified ?? stepState.verified ?? null,
      };
    }

    if (event.type === 'step_failed') {
      return {
        ...stepState,
        completedAt: now,
        lastResult: event.reason ?? event.result ?? null,
        status: 'failed' as const,
        verified: false,
      };
    }

    return stepState;
  });

  return {
    ...context,
    currentStepId: event.type === 'step_started'
      ? event.stepId ?? context.currentStepId ?? null
      : context.currentStepId,
    events: [...context.events, event],
    lastEvidence: event.result ?? event.reason ?? context.lastEvidence ?? null,
    retryCount: event.type === 'step_failed' && event.recoverable ? context.retryCount + 1 : context.retryCount,
    stepStates,
    updatedAt: now,
  };
}

export function createAgentRuntimeCoreOpenMoveSequenceInput(
  options: CreateAgentRuntimeCoreOpenMoveTaskPlanOptions,
): AgentRuntimeCoreDesktopSequenceInput {
  const plan = createAgentRuntimeCoreOpenMoveTaskPlan(options);
  const openStep = plan.steps[0];
  const moveStep = plan.steps[1];

  return {
    postVerify: true,
    postVerifyQuery: `${plan.target} on ${plan.targetDisplay} display`,
    postVerifyVisualQuery: '',
    runtimeCorePlanJson: JSON.stringify(plan),
    stepsJson: JSON.stringify([
      {
        args: {
          action: openStep.action,
          forceNew: options.forceNew,
          query: openStep.action === 'search_web' ? plan.target : undefined,
          target: plan.target,
        },
        reason: openStep.summary,
        tool: openStep.tool,
      },
      {
        args: {
          action: moveStep.action,
          fallbackToActiveWindow: true,
          preserveSize: true,
          target: plan.target,
          queryCandidates: createAgentRuntimeCoreMoveQueryCandidates(plan),
          targetDisplay: plan.targetDisplay,
        },
        reason: moveStep.summary,
        tool: moveStep.tool,
      },
    ]),
  };
}
