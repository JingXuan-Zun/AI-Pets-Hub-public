import {
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentDesktopActionEvidence,
  type AgentDesktopActionOutcome,
  type AgentStructuredToolEvidence,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  type AgentRuntimeExecutorContext,
} from '../agentRuntimeExecutor';
import {
  type AgentActionLifecycleDecision,
} from '../agentActionLifecycle';
import {
  createAgentRuntimeCoreContext,
  parseAgentRuntimeCoreTaskPlanJson,
  resolveAgentRuntimeCoreSequenceOutcome,
} from '../agentRuntimeCore';
import {
  normalizeExecuteDesktopAction,
  normalizeExecuteDesktopInputAction,
} from '../agentRuntimeDesktopTools';

const AGENT_RUNTIME_CANCELLED_TEXT = 'Agent run cancelled by user.';

type AgentRuntimeDesktopSequenceToolName = 'execute_desktop_action' | 'execute_desktop_input';

export interface AgentRuntimeDesktopSequenceStep {
  args: Record<string, unknown>;
  reason?: string | null;
  tool: AgentRuntimeDesktopSequenceToolName;
}

export function isAgentRuntimeCancellationRequested(runtime: AgentRuntimeExecutorContext) {
  return Boolean(runtime.signal?.aborted);
}

export function createAgentRuntimeCancelledResult(target: AgentToolCallCommand | string): AgentChatCommandResult {
  const toolName = typeof target === 'string' ? target : target.name;
  return {
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  };
}

export function createAgentRuntimeResult(options: AgentChatCommandResult): AgentChatCommandResult {
  return {
    ...options,
    ok: options.ok ?? !options.errorText,
  };
}

export function attachAgentActionLifecycleDecision(
  result: AgentChatCommandResult,
  lifecycle: AgentActionLifecycleDecision,
): AgentChatCommandResult {
  const structuredEvidence = {
    ...(result.stateSummary?.structuredEvidence
      ?? result.receipt?.stateSummary?.structuredEvidence
      ?? {}),
    actionLifecycle: lifecycle,
  };
  const stateSummary = {
    ...(result.stateSummary ?? {}),
    recommendedRecovery: mergeAgentRuntimeDesktopSequenceLists(
      result.stateSummary?.recommendedRecovery,
      [`ActionLifecycle: ${lifecycle.status} | ${lifecycle.recommendedRecovery}`],
    ),
    structuredEvidence,
  };

  return {
    ...result,
    observations: mergeAgentRuntimeDesktopSequenceLists(
      result.observations,
      [
        `ActionLifecycle status: ${lifecycle.status}`,
        `ActionLifecycle reason: ${lifecycle.reason}`,
      ],
    ),
    receipt: result.receipt
      ? {
          ...result.receipt,
          evidenceLines: mergeAgentRuntimeDesktopSequenceLists(
            result.receipt.evidenceLines,
            [
              `ActionLifecycle status: ${lifecycle.status}`,
              `ActionLifecycle reason: ${lifecycle.reason}`,
            ],
          ),
          stateSummary: {
            ...(result.receipt.stateSummary ?? {}),
            recommendedRecovery: mergeAgentRuntimeDesktopSequenceLists(
              result.receipt.stateSummary?.recommendedRecovery,
              [`ActionLifecycle: ${lifecycle.status} | ${lifecycle.recommendedRecovery}`],
            ),
            structuredEvidence,
          },
          summaryLines: mergeAgentRuntimeDesktopSequenceLists(
            result.receipt.summaryLines,
            [`ActionLifecycle: ${lifecycle.status}`],
          ),
        }
      : result.receipt,
    stateSummary,
  };
}

export function inferAgentRuntimeToolResultOk(result: AgentChatCommandResult) {
  if (typeof result.ok === 'boolean') {
    return result.ok;
  }

  if (result.errorText) {
    return false;
  }

  return !/(?:failed|not\s+found|missing|unavailable|cannot|unable|error|blocked|unverified)/iu.test(result.responseText);
}

function createAgentRuntimeObservation(toolCall: AgentToolCallCommand) {
  const goalText = toolCall.goal?.trim();
  const inputKeys = Object.keys(toolCall.input ?? {}).filter((key) => toolCall.input[key] !== undefined);
  return [
    `Tool: ${toolCall.name}`,
    goalText ? `Goal: ${goalText}` : '',
    inputKeys.length ? `Input keys: ${inputKeys.join(', ')}` : '',
  ].filter(Boolean).join(' | ');
}

export function enrichDesktopSequenceNestedResult(
  toolCall: AgentToolCallCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const ok = inferAgentRuntimeToolResultOk(result);
  return createAgentRuntimeResult({
    ...result,
    errorText: ok ? result.errorText ?? null : result.errorText ?? result.responseText,
    observations: [
      createAgentRuntimeObservation(toolCall),
      ...(result.observations ?? []),
    ].filter(Boolean),
    ok,
  });
}

export function getToolStringInput(toolCall: Pick<AgentToolCallCommand, 'input' | 'name'>, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getAgentRuntimeDesktopSequenceCorePlan(toolCall: AgentToolCallCommand) {
  return parseAgentRuntimeCoreTaskPlanJson(getToolStringInput(toolCall, ['runtimeCorePlanJson']));
}

export function createAgentRuntimeDesktopSequenceCoreEventLines(result: AgentChatCommandResult, toolCall: AgentToolCallCommand) {
  const plan = getAgentRuntimeDesktopSequenceCorePlan(toolCall);
  if (!plan) {
    return [];
  }

  const outcome = resolveAgentRuntimeCoreSequenceOutcome(
    createAgentRuntimeCoreContext(plan),
    result,
  );

  return [
    `RuntimeCore: task=${plan.taskId}`,
    `RuntimeCore: verified=${outcome.verified} completed=${outcome.completed}`,
    ...outcome.events.map((event) => [
      `RuntimeCore: event=${event.type}`,
      event.stepKind ? `step=${event.stepKind}` : '',
      event.verified !== undefined ? `verified=${event.verified}` : '',
      event.reason ? `reason=${compactAgentRuntimeSequenceText(event.reason, 180)}` : '',
    ].filter(Boolean).join(' | ')),
  ];
}

export function isAgentRuntimeToolInputObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isAgentRuntimeDesktopSequenceToolName(value: unknown): value is AgentRuntimeDesktopSequenceToolName {
  return value === 'execute_desktop_action' || value === 'execute_desktop_input';
}

export function compactAgentRuntimeSequenceText(value: unknown, maxLength = 220) {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
  if (!text) {
    return '';
  }

  if (/^(?:open|opened|launched|running|started|complete|completed)$/iu.test(text)) {
    return 'launched';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export function getAgentRuntimeSequenceStepAction(step: AgentRuntimeDesktopSequenceStep) {
  const rawAction = getToolStringInput({
    input: step.args,
    name: step.tool,
  }, ['action', 'desktopAction', 'operation']);

  return step.tool === 'execute_desktop_action'
    ? normalizeExecuteDesktopAction(rawAction)
    : normalizeExecuteDesktopInputAction(rawAction);
}

export function getAgentRuntimeSequenceStepTarget(step: AgentRuntimeDesktopSequenceStep) {
  const target = getToolStringInput({
    input: step.args,
    name: step.tool,
  }, ['query', 'target', 'title', 'processName', 'name']);

  if (!target || /^(?:https?:\/\/|file:\/\/)/iu.test(target) || /^[^\s]+\.[a-z0-9]{2,}(?:[/?#].*)?$/iu.test(target)) {
    return '';
  }

  return target;
}

export function getAgentRuntimeSequenceStepNumber(step: AgentRuntimeDesktopSequenceStep, key: string) {
  const value = step.args[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : null;
}

export function getAgentRuntimeSequenceStepString(step: AgentRuntimeDesktopSequenceStep, keys: string[]) {
  return getToolStringInput({
    input: step.args,
    name: step.tool,
  }, keys);
}

export function mergeAgentRuntimeDesktopSequenceLists(
  ...lists: Array<Array<string | null | undefined> | null | undefined>
) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const list of lists) {
    for (const item of list ?? []) {
      const text = typeof item === 'string' ? item.trim() : '';
      if (!text || seen.has(text)) {
        continue;
      }

      seen.add(text);
      merged.push(text);
    }
  }

  return merged;
}

export function mergeAgentRuntimeDesktopSequenceStructuredEvidence(
  latestStructuredEvidence: AgentStructuredToolEvidence | null,
  verificationResult: AgentChatCommandResult | null,
) {
  const verificationStructuredEvidence = verificationResult?.stateSummary?.structuredEvidence
    ?? verificationResult?.receipt?.stateSummary?.structuredEvidence
    ?? null;

  if (!latestStructuredEvidence && !verificationStructuredEvidence) {
    return null;
  }

  return {
    ...(latestStructuredEvidence ?? {}),
    ...(verificationStructuredEvidence ?? {}),
  } satisfies AgentStructuredToolEvidence;
}

export function isAgentRuntimeDesktopSequenceAuxiliaryStep(step: AgentRuntimeDesktopSequenceStep) {
  return step.tool === 'execute_desktop_action'
    && getAgentRuntimeSequenceStepAction(step) === 'focus_window';
}

export function getAgentRuntimeDesktopSequenceActionEvidence(
  result: AgentChatCommandResult,
) {
  return result.stateSummary?.actionEvidence
    ?? result.receipt?.stateSummary?.actionEvidence
    ?? null;
}

function getAgentRuntimeDesktopSequenceActionOutcome(
  status: AgentChatExecutionReceipt['status'],
  stepEvidences: AgentDesktopActionEvidence[],
  verificationResult: AgentChatCommandResult | null,
): AgentDesktopActionOutcome {
  if (status === 'failed' || stepEvidences.some((evidence) => evidence.outcome === 'blocked')) {
    return 'blocked';
  }

  if (stepEvidences.some((evidence) => evidence.outcome === 'no-op')) {
    return 'no-op';
  }

  if (
    status === 'unverified'
    || stepEvidences.some((evidence) => evidence.outcome === 'uncertain')
    || verificationResult?.receipt?.status === 'unverified'
  ) {
    return 'uncertain';
  }

  return 'changed';
}

function getAgentRuntimeDesktopSequenceActionConfidence(outcome: AgentDesktopActionOutcome) {
  switch (outcome) {
    case 'changed':
      return 0.74;
    case 'no-op':
      return 0.7;
    case 'blocked':
      return 0.78;
    case 'uncertain':
    default:
      return 0.4;
  }
}

function getAgentRuntimeDesktopSequenceSnapshotProfile(options: {
  stepEvidences: AgentDesktopActionEvidence[];
  verificationResult: AgentChatCommandResult | null;
}): AgentDesktopActionEvidence['snapshotProfile'] {
  if (
    options.verificationResult
    || options.stepEvidences.some((evidence) => evidence.snapshotProfile === 'heavy')
  ) {
    return 'heavy';
  }

  if (options.stepEvidences.some((evidence) => evidence.snapshotProfile === 'replay')) {
    return 'replay';
  }

  return 'light';
}

export function createAgentRuntimeDesktopSequenceActionEvidence(options: {
  completedCount: number;
  evidenceLines: string[];
  failedStepIndex: number | null;
  status: AgentChatExecutionReceipt['status'];
  stepCount: number;
  stepEvidences: AgentDesktopActionEvidence[];
  verificationResult: AgentChatCommandResult | null;
}): AgentDesktopActionEvidence {
  const outcome = getAgentRuntimeDesktopSequenceActionOutcome(
    options.status,
    options.stepEvidences,
    options.verificationResult,
  );
  const firstEvidence = options.stepEvidences[0] ?? null;
  const latestEvidence = options.stepEvidences.at(-1) ?? null;
  const verificationState = options.verificationResult?.stateSummary;
  const changed = outcome === 'changed'
    ? true
    : outcome === 'no-op'
      ? false
      : null;

  return {
    action: 'sequence',
    after: verificationState?.observedState?.length
      ? {
          observedState: verificationState.observedState.slice(0, 12),
          targetWindow: verificationState.structuredEvidence?.finalWindow ?? null,
        }
      : latestEvidence?.after ?? null,
    before: firstEvidence?.before ?? null,
    confidence: getAgentRuntimeDesktopSequenceActionConfidence(outcome),
    diff: {
      changed,
      signals: [
        `stepsCompleted=${options.completedCount}/${options.stepCount}`,
        options.failedStepIndex ? `failedStep=${options.failedStepIndex}` : '',
        options.verificationResult?.receipt?.status ? `verificationReceipt=${options.verificationResult.receipt.status}` : '',
        ...options.stepEvidences.map((evidence, index) => `step${index + 1}=${evidence.outcome}`),
      ].filter(Boolean),
      summary: outcome === 'changed'
        ? 'Desktop sequence completed and available evidence supports a state change.'
        : outcome === 'no-op'
          ? 'Desktop sequence completed, but at least one action step reported no visible state change.'
          : outcome === 'blocked'
            ? 'Desktop sequence was blocked or failed before a verified final state.'
            : 'Desktop sequence ran, but available evidence is insufficient to verify the requested state change.',
    },
    outcome,
    snapshotProfile: getAgentRuntimeDesktopSequenceSnapshotProfile({
      stepEvidences: options.stepEvidences,
      verificationResult: options.verificationResult,
    }),
    targetRef: latestEvidence?.targetRef ?? firstEvidence?.targetRef ?? null,
    timestamp: Date.now(),
    tool: 'execute_desktop_sequence',
  };
}
