import { type AgentToolCallName } from '../agentChatCommand';
import type { AgentRuntimeCoreTaskPlan, AgentRuntimeCoreTaskStep, AgentRuntimeCoreStepKind, CreateAgentRuntimeCoreOpenMoveTaskPlanOptions, AgentRuntimeCoreDesktopSequenceInput } from '../agentRuntimeCore';

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
