import { createAgentRuntimeDesktopSequenceOutcome } from './sequenceOutcome';
import {
  createAgentRuntimeDesktopSequenceStaleClickResult,
  findAgentRuntimeDesktopSequenceStaleClick,
  findAgentRuntimeDesktopSequenceStaleClickByHwnd,
} from './sequenceClickTargetGuard';
import {
  type AgentChatCommandResult,
  type AgentDesktopActionEvidence,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolWindowEvidence,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  type AgentRuntimeExecutorContext,
} from '../agentRuntimeExecutor';
import {
  executeDesktopAction,
  executeDesktopInput,
} from '../agentRuntimeDesktopTools';
import {
  waitForDesktopActionWindowSettle,
} from '../agentRuntimeWindowTools';
import {
  prepareAgentToolInput,
} from '../agentToolInputSchema';
import {
  type AgentRuntimeDesktopSequenceStep,
  getToolStringInput,
  isAgentRuntimeDesktopSequenceToolName,
  isAgentRuntimeToolInputObject,
  getToolBooleanInput,
  isAgentRuntimeCancellationRequested,
  createAgentRuntimeCancelledResult,
  getAgentRuntimeSequenceStepAction,
  enrichDesktopSequenceNestedResult,
  getAgentRuntimeDesktopSequenceActionEvidence,
  inferAgentRuntimeToolResultOk,
  compactAgentRuntimeSequenceText,
  isAgentRuntimeDesktopSequenceAuxiliaryStep,
} from './sequenceResultEvidence';
import {
  refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange,
  isAgentRuntimeDesktopSequenceSurfaceChangingStep,
  isAgentRuntimeDesktopSequenceWindowDependentStep,
  createAgentRuntimeDesktopSequenceUnresolvedWindowResult,
  getAgentRuntimeDesktopSequenceRawTarget,
  createAgentRuntimeDesktopSequenceInputArgs,
  createAgentRuntimeDesktopSequenceActionArgs,
  getAgentRuntimeDesktopSequenceFinalWindow,
} from './sequenceWindowTarget';
import {
  executeDesktopSequencePostVerification,
} from './sequenceVerification';

const AGENT_RUNTIME_DESKTOP_SEQUENCE_MAX_STEPS = 8;

type AgentRuntimeDesktopSequenceParseResult =
  | {
      ok: true;
      steps: AgentRuntimeDesktopSequenceStep[];
    }
  | {
      error: string;
      ok: false;
    };

export function parseAgentRuntimeDesktopSequenceSteps(toolCall: AgentToolCallCommand): AgentRuntimeDesktopSequenceParseResult {
  const stepsJson = getToolStringInput(toolCall, ['stepsJson', 'sequenceJson']);
  if (!stepsJson) {
    return {
      error: 'execute_desktop_sequence needs stepsJson.',
      ok: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stepsJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      error: `execute_desktop_sequence stepsJson is not valid JSON: ${message}`,
      ok: false,
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      error: 'execute_desktop_sequence stepsJson must be a JSON array.',
      ok: false,
    };
  }

  if (parsed.length === 0) {
    return {
      error: 'execute_desktop_sequence needs at least one step.',
      ok: false,
    };
  }

  if (parsed.length > AGENT_RUNTIME_DESKTOP_SEQUENCE_MAX_STEPS) {
    return {
      error: `execute_desktop_sequence supports at most ${AGENT_RUNTIME_DESKTOP_SEQUENCE_MAX_STEPS} steps.`,
      ok: false,
    };
  }

  const steps: AgentRuntimeDesktopSequenceStep[] = [];
  for (const [index, value] of parsed.entries()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {
        error: `execute_desktop_sequence step ${index + 1} must be an object.`,
        ok: false,
      };
    }

    const source = value as Record<string, unknown>;
    if (!isAgentRuntimeDesktopSequenceToolName(source.tool)) {
      return {
        error: `execute_desktop_sequence step ${index + 1} must use execute_desktop_action or execute_desktop_input.`,
        ok: false,
      };
    }

    const rawArgs = source.args ?? source.input;
    if (!isAgentRuntimeToolInputObject(rawArgs)) {
      return {
        error: `execute_desktop_sequence step ${index + 1} needs object args.`,
        ok: false,
      };
    }

    const preparedInput = prepareAgentToolInput(source.tool, rawArgs);
    if (preparedInput.ok === false) {
      return {
        error: `execute_desktop_sequence step ${index + 1}: ${preparedInput.error}`,
        ok: false,
      };
    }

    steps.push({
      args: preparedInput.input,
      reason: typeof source.reason === 'string' ? source.reason.trim() : null,
      tool: source.tool,
    });
  }

  return {
    ok: true,
    steps,
  };
}

export async function runAgentRuntimeDesktopSequenceSteps(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  steps: AgentRuntimeDesktopSequenceStep[],
  options?: {
    observationPrefix?: string;
    postVerify?: boolean;
    postVerifyHwnd?: number | null;
    postVerifyQuery?: string;
    postVerifyRequired?: boolean;
    postVerifyRequireSameHwnd?: boolean;
    postVerifySourceQuery?: string;
    postVerifyVisualQuery?: string;
    stopOnError?: boolean;
    summaryLabel?: string;
  },
): Promise<AgentChatCommandResult> {
  const stopOnError = options?.stopOnError ?? getToolBooleanInput(toolCall, 'stopOnError') !== false;
  const postVerify = options?.postVerify ?? getToolBooleanInput(toolCall, 'postVerify') !== false;
  const postVerifyRequired = options?.postVerifyRequired ?? getToolBooleanInput(toolCall, 'postVerifyRequired') === true;
  const postVerifyQuery = options?.postVerifyQuery ?? getToolStringInput(toolCall, ['postVerifyQuery', 'verifyQuery', 'query', 'target']);
  const postVerifyVisualQuery = options?.postVerifyVisualQuery ?? getToolStringInput(toolCall, ['postVerifyVisualQuery', 'visualVerifyQuery', 'visualQuery']);
  const summaryLabel = options?.summaryLabel ?? 'execute_desktop_sequence';
  const evidenceLines: string[] = [];
  const observations: string[] = [
    options?.observationPrefix ?? '',
    `Desktop sequence step count: ${steps.length}`,
    `Desktop sequence stopOnError: ${stopOnError}`,
    `Desktop sequence postVerify: ${postVerify}`,
    `Desktop sequence postVerifyRequired: ${postVerifyRequired}`,
    postVerifyQuery ? `Desktop sequence postVerify query: ${postVerifyQuery}` : '',
    postVerifyVisualQuery ? `Desktop sequence visual postVerify query: ${postVerifyVisualQuery}` : '',
  ].filter(Boolean);
  let completedCount = 0;
  let failedStepIndex: number | null = null;
  let failedStepText: string | null = null;
  let auxiliaryStepFailure = false;
  let hasUnverifiedStep = false;
  let latestStructuredEvidence: AgentStructuredToolEvidence | null = null;
  let latestFocusedWindow: AgentStructuredToolWindowEvidence | null = null;
  const stepActionEvidences: AgentDesktopActionEvidence[] = [];

  for (const [index, step] of steps.entries()) {
    if (isAgentRuntimeCancellationRequested(context)) {
      return createAgentRuntimeCancelledResult(toolCall);
    }

    const previousStep = index > 0 ? steps[index - 1] : null;
    const previousAction = previousStep ? getAgentRuntimeSequenceStepAction(previousStep) : '';
    let preStepObservation: Awaited<ReturnType<typeof refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange>> = null;
    if (
      previousStep
      && isAgentRuntimeDesktopSequenceSurfaceChangingStep(previousStep)
      && isAgentRuntimeDesktopSequenceWindowDependentStep(step)
    ) {
      preStepObservation = await refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange(
        context,
        previousStep,
        step,
        latestFocusedWindow,
      );
      latestFocusedWindow = preStepObservation?.window ?? null;
      if (preStepObservation?.result.stateSummary?.structuredEvidence) {
        latestStructuredEvidence = preStepObservation.result.stateSummary.structuredEvidence;
      }
    }
    const preStepBlockedResult = (
      previousStep
      && isAgentRuntimeDesktopSequenceSurfaceChangingStep(previousStep)
      && isAgentRuntimeDesktopSequenceWindowDependentStep(step)
      && !latestFocusedWindow
    )
      ? createAgentRuntimeDesktopSequenceUnresolvedWindowResult(
          preStepObservation?.target || getAgentRuntimeDesktopSequenceRawTarget(previousStep),
          getAgentRuntimeSequenceStepAction(step) || step.tool,
        )
      : null;
    const stepArgs = step.tool === 'execute_desktop_input'
      ? createAgentRuntimeDesktopSequenceInputArgs(step.args, latestFocusedWindow)
      : createAgentRuntimeDesktopSequenceActionArgs(step.args, latestFocusedWindow, previousStep);
    const nestedToolCall: AgentToolCallCommand = {
      goal: step.reason || `execute_desktop_sequence step ${index + 1}`,
      input: stepArgs,
      name: step.tool,
    };
    // An approved coordinate click must still fall inside the focused target window.
    const staleClick = step.tool === 'execute_desktop_input'
      ? findAgentRuntimeDesktopSequenceStaleClick(stepArgs, latestFocusedWindow)
        ?? await findAgentRuntimeDesktopSequenceStaleClickByHwnd(step.args)
      : null;
    const staleClickResult = staleClick ? createAgentRuntimeDesktopSequenceStaleClickResult(staleClick) : null;
    let result = preStepBlockedResult
      ?? staleClickResult
      ?? (step.tool === 'execute_desktop_action'
        ? await executeDesktopAction(context, nestedToolCall)
        : await executeDesktopInput(nestedToolCall));
    let windowReadyRetryCount = 0;
    const currentAction = typeof step.args.action === 'string'
      ? step.args.action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
      : '';
    const followsWindowCreation = [
      'launch_local_app',
      'open_resource',
      'search_web',
    ].includes(previousAction);
    while (
      step.tool === 'execute_desktop_action'
      && currentAction === 'move_window_to_display'
      && followsWindowCreation
      && result.ok === false
      && /no-window-match/iu.test(`${result.errorText ?? ''}\n${result.responseText ?? ''}\n${result.verification ?? ''}`)
      && windowReadyRetryCount < 3
    ) {
      windowReadyRetryCount += 1;
      await waitForDesktopActionWindowSettle(400 * windowReadyRetryCount);
      if (isAgentRuntimeCancellationRequested(context)) {
        return createAgentRuntimeCancelledResult(toolCall);
      }
      result = await executeDesktopAction(context, nestedToolCall);
    }
    const enrichedResult = enrichDesktopSequenceNestedResult(nestedToolCall, result);
    const stepStructuredEvidence = enrichedResult.stateSummary?.structuredEvidence
      ?? enrichedResult.receipt?.stateSummary?.structuredEvidence
      ?? null;
    if (stepStructuredEvidence) {
      latestStructuredEvidence = stepStructuredEvidence;
    }
    if (step.tool === 'execute_desktop_action') {
      const stepAction = getAgentRuntimeSequenceStepAction(step);
      const focusedWindow = getAgentRuntimeDesktopSequenceFinalWindow(enrichedResult);
      if (focusedWindow?.hwnd || focusedWindow?.title || focusedWindow?.processName) {
        latestFocusedWindow = focusedWindow;
      } else if (['launch_local_app', 'open_resource', 'search_web'].includes(stepAction)) {
        latestFocusedWindow = null;
      }
    }
    const stepActionEvidence = getAgentRuntimeDesktopSequenceActionEvidence(enrichedResult);
    if (stepActionEvidence) {
      stepActionEvidences.push(stepActionEvidence);
    }
    if (
      enrichedResult.receipt?.status === 'unverified'
      || stepStructuredEvidence?.status === 'unverified'
      || stepStructuredEvidence?.captureTrusted === false
      || stepStructuredEvidence?.inputReplayPreview?.uiChanged === false
      || stepActionEvidence?.outcome === 'no-op'
      || stepActionEvidence?.outcome === 'uncertain'
      || (
        stepStructuredEvidence?.inputReplayPreview?.coordinateClosureStatus
        && stepStructuredEvidence.inputReplayPreview.coordinateClosureStatus !== 'coordinate_closure_ok'
      )
    ) {
      hasUnverifiedStep = true;
    }
    const stepOk = inferAgentRuntimeToolResultOk(enrichedResult);
    const compactResponse = compactAgentRuntimeSequenceText(enrichedResult.responseText);
    const compactError = compactAgentRuntimeSequenceText(enrichedResult.errorText);
    const receiptEvidence = enrichedResult.receipt?.evidenceLines?.length
      ? compactAgentRuntimeSequenceText(enrichedResult.receipt.evidenceLines.join(' | '))
      : '';
    const inputBackendEvidence = enrichedResult.receipt?.evidenceLines
      ?.filter((line) => /^(?:Input backend|Input attempt|Input foreground|Input diagnostic|Input stage)/iu.test(line))
      .slice(0, 8)
      .map((line) => compactAgentRuntimeSequenceText(line, 360))
      .join(' || ') ?? '';
    const inputReplayChanged = typeof stepStructuredEvidence?.inputReplayPreview?.uiChanged === 'boolean'
      ? `inputReplayChanged=${stepStructuredEvidence.inputReplayPreview.uiChanged}`
      : '';
    const inputReplayClosure = stepStructuredEvidence?.inputReplayPreview?.coordinateClosureStatus
      ? `inputReplayClosure=${stepStructuredEvidence.inputReplayPreview.coordinateClosureStatus}`
      : '';
    const actionEvidenceOutcome = stepActionEvidence?.outcome
      ? `actionOutcome=${stepActionEvidence.outcome}`
      : '';
    const stepLine = [
      `Step ${index + 1}/${steps.length}`,
      `tool=${step.tool}`,
      `status=${stepOk ? 'ok' : 'failed'}`,
      preStepObservation ? `postCreationWindow=${preStepObservation.window ? 'resolved' : 'unresolved'}` : '',
      step.reason ? `reason=${step.reason}` : '',
      inputReplayChanged,
      inputReplayClosure,
      actionEvidenceOutcome,
      windowReadyRetryCount > 0 ? `windowReadyRetries=${windowReadyRetryCount}` : '',
      compactResponse ? `response=${compactResponse}` : '',
      compactError && compactError !== compactResponse ? `error=${compactError}` : '',
      inputBackendEvidence ? `inputBackendEvidence=${inputBackendEvidence}` : '',
      receiptEvidence ? `evidence=${receiptEvidence}` : '',
    ].filter(Boolean).join(' | ');

    evidenceLines.push(stepLine);
    observations.push(stepLine);

    if (staleClickResult) {
      failedStepIndex = index + 1;
      failedStepText = staleClickResult.errorText || 'The click target changed after it was located.';
      break;
    }

    if (preStepBlockedResult) {
      failedStepIndex = index + 1;
      failedStepText = preStepBlockedResult.errorText
        || preStepBlockedResult.responseText
        || `Step ${index + 1} target resolution failed.`;
      break;
    }

    if (stepOk) {
      completedCount += 1;
      continue;
    }

    if (isAgentRuntimeDesktopSequenceAuxiliaryStep(step)) {
      auxiliaryStepFailure = true;
      observations.push(
        `Step ${index + 1} focus warning: focus_window did not complete; continuing because focus is auxiliary and the next action may still activate the target window.`,
      );
      continue;
    }

    failedStepIndex = index + 1;
    failedStepText = enrichedResult.errorText || enrichedResult.responseText || `Step ${index + 1} failed.`;
    if (stopOnError) {
      break;
    }
  }

  const failed = failedStepIndex !== null;
  const verificationResult = failed
    ? null
    : await executeDesktopSequencePostVerification(context, steps, {
        enabled: postVerify,
        query: postVerifyQuery,
        requireSameHwnd: options?.postVerifyRequireSameHwnd,
        sourceHwnd: options?.postVerifyHwnd,
        sourceQuery: options?.postVerifySourceQuery,
        visualQuery: postVerifyVisualQuery,
      });
  const verificationResultOk = verificationResult ? inferAgentRuntimeToolResultOk(verificationResult) : null;
  if (verificationResult) {
    const verificationEvidence = [
      `Post-sequence verification: ${verificationResultOk ? 'ok' : 'failed'}`,
      verificationResult.responseText ? `response=${compactAgentRuntimeSequenceText(verificationResult.responseText, 420)}` : '',
      verificationResult.errorText ? `error=${compactAgentRuntimeSequenceText(verificationResult.errorText, 260)}` : '',
      verificationResult.receipt?.evidenceLines?.length
        ? `evidence=${compactAgentRuntimeSequenceText(verificationResult.receipt.evidenceLines.join(' | '), 520)}`
        : '',
    ].filter(Boolean).join(' | ');

    evidenceLines.push(verificationEvidence);
    observations.push('Desktop sequence post-verification requested.');
    observations.push(...(verificationResult.observations ?? []).map((line) => `Post-verification ${line}`));
  }
  return createAgentRuntimeDesktopSequenceOutcome({
    failed,
    stepActionEvidences,
    verificationResultOk,
    hasUnverifiedStep,
    auxiliaryStepFailure,
    completedCount,
    evidenceLines,
    failedStepIndex,
    steps,
    verificationResult,
    latestStructuredEvidence,
    failedStepText,
    observations,
    summaryLabel,
    postVerifyRequired,
    toolCall,
  });
}
