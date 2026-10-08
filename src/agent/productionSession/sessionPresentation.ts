import { type AgentChatCommandResult } from '../agentChatCommand';
import {
  type AgentRuntimeTimingTrace as AgentProductionPresentationTimingTrace,
  type AgentRuntimeToolResultEntry as AgentProductionPresentationToolResultEntry,
  type AgentRuntimeStep as AgentProductionPresentationStep,
  type AgentRuntimeTraceEvent as AgentProductionPresentationTraceEvent,
  type AgentRuntimeStatus as AgentProductionPresentationStatus,
  type AgentRuntimePendingApproval as AgentProductionPresentationPendingApproval,
  type AgentRuntimeContinuation as AgentProductionPresentationContinuationState,
  type AgentRuntimeProgressHandler as AgentProductionPresentationProgressHandler,
  type AgentRuntimeProgressEvent as AgentProductionPresentationProgressEvent,
  type AgentRuntimeResult,
  type AgentRuntimeDiagnosticEnvelope,
  type AgentTaskRuntimeStateRecord,
} from '../runtime/agentRuntimeContract';
import { createAgentRuntimeDiagnostic, upsertAgentRuntimeDiagnostic } from '../runtime/agentRuntimeDiagnostics';
import { compactAgentTraceDetails } from '../runtime/agentTraceEvents';
import { type AgentTaskRuntimeV4SessionV2ShadowResult } from '../agentTaskRuntimeV4SessionV2ShadowAdapter';
import { type AgentSessionV3PilotShadowModeResult } from '../agentSessionV3PilotShadowMode';

export interface AgentProductionPresentationDebugInfo {
  v4TaskShadow?: AgentTaskRuntimeV4SessionV2ShadowResult | null;
  v3PilotShadow?: AgentSessionV3PilotShadowModeResult | null;
}

interface AgentProductionPresentationResult extends AgentRuntimeResult {
  debug?: AgentProductionPresentationDebugInfo | null;
}

export function createAgentProductionSessionPresentation(dependencies: {
  compactSessionText: (value: unknown, maxLength?: number) => string;
}) {
  const { compactSessionText: compactAgentSessionText } = dependencies;

  function createAgentProductionPresentationBudgetExceededAnswer(timing: AgentProductionPresentationTimingTrace) {
    const elapsedSeconds = Math.max(1, Math.round(timing.elapsedMs / 1000));
    switch (timing.stopReason) {
      case 'max-duration':
        return `This Agent run reached the time budget after ${elapsedSeconds} seconds, so I stopped to avoid looping.`;
      case 'max-model-calls':
        return `This Agent run reached the model-call budget (${timing.modelCallCount}/${timing.maxModelCalls}), so I stopped to avoid looping.`;
      case 'max-tool-calls':
        return `This Agent run reached the tool-call budget (${timing.toolCallCount}/${timing.maxToolCalls}), so I stopped to avoid looping.`;
      default:
        return 'This Agent run reached its execution budget, so I stopped to avoid getting stuck.';
    }
  }


  function resolveLastAgentProductionPresentationFailure(toolResults: AgentProductionPresentationToolResultEntry[]) {
    return [...toolResults].reverse().find((entry) => entry.result.ok === false) ?? null;
  }

  function createAgentProductionPresentationRepeatedFailureAnswer(
    toolName: string,
    result: AgentChatCommandResult,
  ) {
    const detail = compactAgentSessionText(
      result.errorText
        || result.verification
        || result.responseText
        || result.followUp
        || 'No additional error detail.',
      260,
    );

    return `The same tool "${toolName}" failed repeatedly with the same arguments, so I stopped to avoid looping. Last error: ${detail}`;
  }

  function createAgentProductionPresentationMaxStepsAnswer(
    maxSteps: number,
    toolResults: AgentProductionPresentationToolResultEntry[],
  ) {
    const lastFailure = resolveLastAgentProductionPresentationFailure(toolResults);
    if (!lastFailure) {
      return `Agent processed ${maxSteps} steps and stopped to avoid looping.`;
    }

    const toolName = lastFailure.command.toolCall?.name ?? lastFailure.command.kind;
    const detail = compactAgentSessionText(
      lastFailure.result.errorText
        || lastFailure.result.verification
        || lastFailure.result.responseText
        || lastFailure.result.followUp
        || 'No additional error detail.',
      260,
    );

    return `Agent processed ${maxSteps} steps and stopped to avoid looping. Last blocked tool: ${toolName}. Detail: ${detail}`;
  }

  function createAgentProductionPresentationBudgetExceededResult(options: {
    debug?: AgentProductionPresentationDebugInfo | null;
    diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
    finalAnswer: string;
    historyLines: string[];
    sourceText: string;
    steps: AgentProductionPresentationStep[];
    taskState?: AgentTaskRuntimeStateRecord | null;
    timing: AgentProductionPresentationTimingTrace;
    traceEvents: AgentProductionPresentationTraceEvent[];
    toolResults: AgentProductionPresentationToolResultEntry[];
    userGoal: string;
  }): AgentProductionPresentationResult {
    return createAgentProductionPresentationFinalResult({
      debug: options.debug,
      diagnostics: options.diagnostics,
      finalAnswer: options.finalAnswer,
      historyLines: options.historyLines,
      sourceText: options.sourceText,
      status: 'budget-exceeded',
      steps: options.steps,
      taskState: options.taskState,
      timing: options.timing,
      traceEvents: options.traceEvents,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    });
  }

  function createAgentProductionPresentationFinalResult(options: {
    debug?: AgentProductionPresentationDebugInfo | null;
    diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
    finalAnswer: string;
    historyLines: string[];
    pendingApproval?: AgentProductionPresentationPendingApproval | null;
    sourceText: string;
    status: AgentProductionPresentationStatus;
    steps: AgentProductionPresentationStep[];
    taskState?: AgentTaskRuntimeStateRecord | null;
    timing?: AgentProductionPresentationTimingTrace | null;
    traceEvents: AgentProductionPresentationTraceEvent[];
    toolResults: AgentProductionPresentationToolResultEntry[];
    userGoal: string;
  }): AgentProductionPresentationResult {
    const runtimeShadowSummary = options.debug?.v4TaskShadow
      ? (() => {
          switch (options.debug.v4TaskShadow.classification) {
            case 'outer_dispatch_only':
              return 'V4 task shadow: only the outer app/window action ran; no in-app dispatch/click was executed.';
            case 'target_resolved_without_dispatch':
              return 'V4 task shadow: target was found, but no in-app dispatch/click was executed.';
            case 'input_dispatched_unverified':
              return 'V4 task shadow: input was dispatched, but the outcome was not verified.';
            case 'approval_pending':
              return 'V4 task shadow: execution is waiting for approval.';
            case 'verified_success':
              return options.debug.v4TaskShadow.notes.some((note) => /read-only task completed/iu.test(note))
                ? 'V4 task shadow: verified read-only observation completed; no dispatch was required.'
                : 'V4 task shadow: verified evidence indicates task success.';
            case 'read_only_observation_only':
              return 'V4 task shadow: only read-only observation ran; no side-effect action was executed.';
            default:
              return `V4 task shadow classified ${options.debug.v4TaskShadow.classification}.`;
          }
        })()
      : null;
    const slowestToolTiming = options.toolResults
      .map((entry) => ({
        durationMs: entry.timing?.durationMs ?? 0,
        toolName: entry.command.toolCall?.name ?? entry.command.kind,
      }))
      .sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;
    let diagnostics = [...(options.diagnostics ?? [])];
    if (options.debug?.v4TaskShadow) {
      diagnostics = upsertAgentRuntimeDiagnostic(diagnostics, createAgentRuntimeDiagnostic({
        category: 'runtime-shadow',
        details: compactAgentTraceDetails({
          classification: options.debug.v4TaskShadow.classification,
          eventKinds: options.debug.v4TaskShadow.events.map((event) => event.kind).join(' -> '),
          lastBlocker: options.debug.v4TaskShadow.context.lastBlocker,
          lastTargetSummary: options.debug.v4TaskShadow.context.lastTargetSummary,
          localRecoveryCount: options.debug.v4TaskShadow.context.localRecoveryCount,
          notes: options.debug.v4TaskShadow.notes.join(' | '),
          slowestToolDurationMs: slowestToolTiming?.durationMs,
          slowestToolName: slowestToolTiming?.toolName,
          state: options.debug.v4TaskShadow.context.currentState,
          totalElapsedMs: options.timing?.elapsedMs,
          toolResultCount: options.toolResults.length,
          transitionCount: options.debug.v4TaskShadow.context.transitionCount,
        }),
        source: 'v4-task-shadow',
        status: options.debug.v4TaskShadow.classification,
        summary: runtimeShadowSummary ?? `V4 task shadow classified ${options.debug.v4TaskShadow.classification}.`,
      }));
    }
    if (options.debug?.v3PilotShadow) {
      diagnostics = upsertAgentRuntimeDiagnostic(diagnostics, createAgentRuntimeDiagnostic({
        category: 'runtime-pilot',
        details: { pilot: options.debug.v3PilotShadow },
        source: 'v3-pilot-shadow',
        summary: 'V3 pilot shadow diagnostics were collected for this run.',
      }));
    }
    const traceEvents = options.traceEvents.filter((event) => event.type !== 'runtime_shadow');
    return {
      continuation: {
        diagnostics,
        historyLines: [...options.historyLines],
        sourceText: options.sourceText,
        steps: [...options.steps],
        taskState: options.taskState ?? null,
        timing: options.timing ?? null,
        traceEvents,
        toolResults: [...options.toolResults],
        userGoal: options.userGoal,
      },
      ...(options.debug ? { debug: options.debug } : {}),
      diagnostics,
      finalAnswer: options.finalAnswer.trim() || 'No usable reply was generated, so I stopped.',
      pendingApproval: options.pendingApproval ?? null,
      sourceText: options.sourceText,
      status: options.status,
      steps: options.steps,
      taskState: options.taskState ?? null,
      timing: options.timing ?? null,
      traceEvents,
      toolResults: options.toolResults,
    };
  }

  function createAgentProductionPresentationContinuationSnapshot(options: {
    diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
    historyLines: string[];
    sourceText: string;
    steps: AgentProductionPresentationStep[];
    taskState?: AgentTaskRuntimeStateRecord | null;
    timing?: AgentProductionPresentationTimingTrace | null;
    traceEvents: AgentProductionPresentationTraceEvent[];
    toolResults: AgentProductionPresentationToolResultEntry[];
    userGoal: string;
  }): AgentProductionPresentationContinuationState {
    return {
      diagnostics: [...(options.diagnostics ?? [])],
      historyLines: [...options.historyLines],
      sourceText: options.sourceText,
      steps: [...options.steps],
      taskState: options.taskState ?? null,
      timing: options.timing ?? null,
      traceEvents: [...options.traceEvents],
      toolResults: [...options.toolResults],
      userGoal: options.userGoal,
    };
  }

  function emitAgentProductionPresentationProgress(
    onProgress: AgentProductionPresentationProgressHandler | undefined,
    event: Omit<AgentProductionPresentationProgressEvent, 'continuation'>,
    snapshot: {
      diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
      historyLines: string[];
      sourceText: string;
      steps: AgentProductionPresentationStep[];
      taskState?: AgentTaskRuntimeStateRecord | null;
      timing?: AgentProductionPresentationTimingTrace | null;
      traceEvents: AgentProductionPresentationTraceEvent[];
      toolResults: AgentProductionPresentationToolResultEntry[];
      userGoal: string;
    },
  ) {
    if (!onProgress) {
      return;
    }

    try {
      onProgress({
        ...event,
        continuation: createAgentProductionPresentationContinuationSnapshot(snapshot),
      });
    } catch {
      // Progress updates should not affect the Agent loop.
    }
  }

  return {
    createAgentProductionPresentationBudgetExceededAnswer,
    createAgentProductionPresentationRepeatedFailureAnswer,
    createAgentProductionPresentationMaxStepsAnswer,
    createAgentProductionPresentationBudgetExceededResult,
    createAgentProductionPresentationFinalResult,
    emitAgentProductionPresentationProgress,
  };
}
