import { type PetConfig } from '../types';
import { type AgentWorkingMemorySnapshot } from './agentChatContext';
import { buildAgentPermissionRoute, isAgentPermissionRouteSilentReadOnly } from './agentPermissionRouter';
import {
  findAgentSessionV2MissingRequestedActionCoverage,
  AGENT_SESSION_V2_SYSTEM_INSTRUCTION,
  type AgentSessionV2Decision,
  createAgentSessionV2PlanningContext,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ModelRequest,
} from './agentProductionSessionImplementation';
import {
  type AgentRuntimeContinuation as AgentSessionV2ContinuationState,
  type AgentRuntimeDiagnosticEnvelope,
  type AgentRuntimeProgressHandler as AgentSessionV2ProgressHandler,
  type AgentRuntimeResult as AgentSessionV2Result,
  type AgentRuntimeStatus as AgentSessionV2Status,
  type AgentRuntimeStep as AgentSessionV2Step,
  type AgentRuntimeTimingEntry as AgentSessionV2TimingEntry,
  type AgentRuntimeTimingTrace as AgentSessionV2TimingTrace,
  type AgentRuntimeToolExecutor as AgentSessionV2ToolExecutor,
  type AgentRuntimeToolResultEntry as AgentSessionV2ToolResultEntry,
  type AgentRuntimeTraceEvent as AgentSessionV2TraceEvent,
  type AgentRuntimeTraceEventDraft,
  type AgentTaskRuntimeStateRecord,
  type AgentTaskRuntimeModelIterationAuthorizer,
  type AgentTaskRuntimeRecoveryAuthorizer,
} from './runtime/agentRuntimeContract';
import { hasAgentEffectiveDirectActionIntent } from './runtime/agentActionCoverage';
import {
  evaluateAgentEvidenceTerminal,
  resolveAgentEvidencePostActionState,
} from './runtime/agentEvidenceEngine';
import { createAgentModelInput } from './runtime/agentPlanningContextRuntime';
import { createAgentGuardedWorkingMemoryText } from './runtime/agentWorkingMemoryBias';
import {
  createAgentPendingApprovalAssembly,
} from './runtime/agentPendingApprovalAssembly';
import {
  createAgentTraceRecorder,
} from './runtime/agentTraceEvents';
import {
  createAgentSessionV3ExperimentalV2Adapters,
  type AgentSessionV3ExperimentalV2AdapterTimingPort,
} from './agentSessionV3ExperimentalV2Adapters';
import {
  runAgentSessionV3ExperimentalSession,
  type AgentSessionV3ExperimentalSessionResult,
} from './agentSessionV3ExperimentalSession';
import { type AgentChatCommand } from './agentChatCommand';
import { type AgentSessionV3PilotState } from './agentSessionV3PilotStateMachine';

export interface RunAgentSessionV3ExperimentalChatRunnerOptions {
  approvedToolResult?: AgentSessionV2ToolResultEntry | null;
  authorizeModelIteration?: AgentTaskRuntimeModelIterationAuthorizer | null;
  authorizeRecovery?: AgentTaskRuntimeRecoveryAuthorizer | null;
  cancellationSignal?: AbortSignal | null;
  continuation?: AgentSessionV2ContinuationState | null;
  maxTransitions?: number | null;
  modelCaller: AgentSessionV2ModelCaller;
  onProgress?: AgentSessionV2ProgressHandler | null;
  settings: PetConfig['settings'];
  sourceText: string;
  toolExecutor?: AgentSessionV2ToolExecutor | null;
  userGoal: string;
  workingMemory?: AgentWorkingMemorySnapshot | null;
  workingMemoryText?: string | null;
}

const AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_DURATION_MS = 30_000;
const AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_MODEL_CALLS = 2;
const AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_TOOL_CALLS = 2;

function isAgentSessionV3ExperimentalToolResultUnverified(
  entry: AgentSessionV2ToolResultEntry | null | undefined,
) {
  return Boolean(
    entry?.result.receipt?.status === 'unverified'
      || entry?.result.assessment?.status === 'unverified'
      || entry?.result.stateSummary?.structuredEvidence?.status === 'unverified'
      || entry?.result.stateSummary?.missingEvidence?.length
      || entry?.result.stateSummary?.recommendedRecovery?.length
      || /(?:launched-unverified|no-window-match|unverified|not\s+(?:verified|confirmed)|no\s+(?:focusable|matching)\s+window)/iu.test([
        entry?.result.responseText,
        entry?.result.verification,
        entry?.result.receipt?.verification,
        ...(entry?.result.observations ?? []),
        ...(entry?.result.receipt?.evidenceLines ?? []),
      ].filter(Boolean).join(' ')),
  );
}

function createAgentSessionV3ExperimentalChatRunnerTimingTrace(
  entries: AgentSessionV2TimingEntry[],
): AgentSessionV2TimingTrace {
  const startedAt = entries[0]?.startedAt ?? Date.now();
  const updatedAt = Date.now();
  const modelEntries = entries.filter((entry) => entry.kind === 'model');
  const toolEntries = entries.filter((entry) => entry.kind === 'tool');
  const durationSum = (items: AgentSessionV2TimingEntry[]) => items.reduce(
    (sum, entry) => sum + Math.max(0, entry.durationMs ?? 0),
    0,
  );

  return {
    elapsedMs: Math.max(0, updatedAt - startedAt),
    entries: [...entries],
    maxDurationMs: AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_DURATION_MS,
    maxModelCalls: AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_MODEL_CALLS,
    maxToolCalls: AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_TOOL_CALLS,
    modelCallCount: modelEntries.length,
    modelDurationMs: durationSum(modelEntries),
    startedAt,
    toolCallCount: toolEntries.length,
    toolDurationMs: durationSum(toolEntries),
    updatedAt,
  };
}

function createAgentSessionV3ExperimentalChatRunnerTimingPort(
  entries: AgentSessionV2TimingEntry[],
): AgentSessionV3ExperimentalV2AdapterTimingPort {
  let timingIndex = entries.length;
  return {
    beginEntry: (kind, label, stepIndex, detail) => {
      timingIndex += 1;
      const entry: AgentSessionV2TimingEntry = {
        detail,
        id: `v3-chat-${kind}-${timingIndex}`,
        kind,
        label,
        startedAt: Date.now(),
        status: 'running',
        stepIndex,
      };
      entries.push(entry);
      return entry;
    },
    finishEntry: (entry, status, detail) => {
      const finished: AgentSessionV2TimingEntry = {
        ...entry,
        detail: detail ?? entry.detail ?? null,
        durationMs: Math.max(0, Date.now() - entry.startedAt),
        endedAt: Date.now(),
        status,
      };
      const index = entries.findIndex((candidate) => candidate.id === entry.id);
      if (index >= 0) {
        entries.splice(index, 1, finished);
      } else {
        entries.push(finished);
      }
      return finished;
    },
  };
}

function appendAgentSessionV3ExperimentalChatTraceEvent(
  traceRecorder: ReturnType<typeof createAgentTraceRecorder>,
  event: AgentRuntimeTraceEventDraft,
) {
  return traceRecorder.append(event);
}

function createAgentSessionV3ExperimentalChatContinuation(options: {
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  historyLines: string[];
  sourceText: string;
  steps: AgentSessionV2Step[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  timing: AgentSessionV2TimingTrace;
  traceEvents: AgentSessionV2TraceEvent[];
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentSessionV2ContinuationState {
  return {
    diagnostics: [...(options.diagnostics ?? [])],
    historyLines: [...options.historyLines],
    sourceText: options.sourceText,
    steps: [...options.steps],
    taskState: options.taskState ?? null,
    timing: options.timing,
    traceEvents: [...options.traceEvents],
    toolResults: [...options.toolResults],
    userGoal: options.userGoal,
  };
}

function createAgentSessionV3ExperimentalChatResult(options: {
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  finalAnswer: string;
  historyLines: string[];
  pendingApproval?: AgentSessionV2Result['pendingApproval'];
  sourceText: string;
  status: AgentSessionV2Status;
  steps: AgentSessionV2Step[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  timing: AgentSessionV2TimingTrace;
  traceEvents: AgentSessionV2TraceEvent[];
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentSessionV2Result {
  const continuation = createAgentSessionV3ExperimentalChatContinuation(options);
  return {
    continuation,
    diagnostics: [...(options.diagnostics ?? [])],
    finalAnswer: options.finalAnswer.trim() || 'Agent v3 runtime stopped without a usable answer.',
    pendingApproval: options.pendingApproval ?? null,
    sourceText: options.sourceText,
    status: options.status,
    steps: options.steps,
    taskState: options.taskState ?? null,
    timing: options.timing,
    traceEvents: options.traceEvents,
    toolResults: options.toolResults,
  };
}

function createAgentSessionV3ExperimentalChatToolResultStep(
  entry: AgentSessionV2ToolResultEntry,
  stepIndex: number,
): AgentSessionV2Step {
  return {
    action: 'tool_result',
    errorText: entry.result.errorText ?? null,
    index: stepIndex,
    ok: entry.result.ok !== false,
    summary: entry.result.responseText,
    timing: entry.timing ?? null,
    tool: entry.command.toolCall?.name ?? entry.command.kind,
  };
}

function createAgentSessionV3ExperimentalChatResultStatus(
  runtime: AgentSessionV3ExperimentalSessionResult,
): AgentSessionV2Status {
  if (
    runtime.status === 'waiting'
    && runtime.runtime.state.phase === 'recover'
  ) {
    return 'needs-user';
  }

  if (
    runtime.status === 'failed'
    && runtime.runtime.state.phase === 'recover'
    && runtime.runtime.state.lastEvent === 'command-unavailable'
  ) {
    return 'needs-user';
  }

  switch (runtime.status) {
    case 'cancelled':
      return 'cancelled';
    case 'completed':
      return 'completed';
    case 'needs-approval':
      return 'needs-approval';
    case 'needs-user':
      return 'needs-user';
    case 'transition-limit':
      return 'max-steps';
    default:
      return 'failed';
  }
}

function getAgentSessionV3ExperimentalChatRecoveryReason(
  runtime: AgentSessionV3ExperimentalSessionResult,
) {
  const lastTransition = runtime.runtime.transitions[runtime.runtime.transitions.length - 1] ?? null;
  return runtime.runtime.transition?.reason
    ?? lastTransition?.reason
    ?? runtime.runtime.reason
    ?? 'The requested v3 command is not available in the staged runtime route.';
}

function createAgentSessionV3ExperimentalChatFinalAnswer(
  runtime: AgentSessionV3ExperimentalSessionResult,
) {
  if (
    runtime.status === 'failed'
    && runtime.runtime.state.phase === 'recover'
    && runtime.runtime.state.lastEvent === 'command-unavailable'
  ) {
    const reason = getAgentSessionV3ExperimentalChatRecoveryReason(runtime);
    return [
      'Agent v3 runtime could not safely prepare that command.',
      reason,
      'Switch back to v2 fallback or adjust the request so the staged runtime can continue.',
    ].join('\n');
  }

  if (
    runtime.status === 'waiting'
    && runtime.runtime.state.phase === 'recover'
  ) {
    const reason = getAgentSessionV3ExperimentalChatRecoveryReason(runtime);
    return [
      'Agent v3 runtime could not safely prepare that command.',
      reason,
      'Switch back to v2 fallback or adjust the request so the staged runtime can continue.',
    ].join('\n');
  }

  return runtime.finalAnswer;
}

function isAgentSessionV3ExperimentalReadOnlyToolResult(entry: AgentSessionV2ToolResultEntry) {
  const route = buildAgentPermissionRoute(entry.command);
  return isAgentPermissionRouteSilentReadOnly(route);
}

function shouldBlockAgentSessionV3ExperimentalReadOnlyCompletion(options: {
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  return hasAgentEffectiveDirectActionIntent(options.sourceText, options.userGoal)
    && options.toolResults.length > 0
    && options.toolResults.every(isAgentSessionV3ExperimentalReadOnlyToolResult);
}

function createAgentSessionV3ExperimentalReadOnlyIncompleteAnswer(
  latestToolResult: AgentSessionV2ToolResultEntry | null,
) {
  const latestToolName = latestToolResult?.command.toolCall?.name ?? latestToolResult?.command.kind ?? 'read-only tool';
  return [
    `The staged v3 runtime only completed read-only observation (${latestToolName}).`,
    'It has not executed the requested action yet, so I will not mark this task as complete.',
    'Use the v2 fallback route or continue with an approval-required action step.',
  ].join('\n');
}

function appendAgentSessionV3ExperimentalChatToolResults(options: {
  entries: AgentSessionV2ToolResultEntry[];
  historyLines: string[];
  steps: AgentSessionV2Step[];
  toolResults: AgentSessionV2ToolResultEntry[];
}) {
  if (!options.entries.length) {
    return;
  }

  const newEntries = options.entries.filter((entry) => !options.toolResults.some((existing) => (
    existing === entry
    || (
      existing.command === entry.command
      && existing.result === entry.result
    )
    || (
      Boolean(existing.timing?.id)
      && existing.timing?.id === entry.timing?.id
    )
  )));
  if (!newEntries.length) {
    return;
  }

  options.toolResults.push(...newEntries);
  for (const entry of newEntries) {
    options.steps.push(createAgentSessionV3ExperimentalChatToolResultStep(
      entry,
      options.steps.length + 1,
    ));
  }
  options.historyLines.push([
    newEntries.length > 1
      ? 'Experimental v3 tool results:'
      : 'Experimental v3 tool result:',
    ...newEntries.map((entry) => [
      `tool=${entry.command.toolCall?.name ?? entry.command.kind}`,
      `result=${entry.result.responseText}`,
    ].join('\n')),
  ].join('\n'));
}

function appendAgentSessionV3ExperimentalChatDecisionStep(options: {
  decision: AgentSessionV2Decision;
  entries: AgentSessionV2TimingEntry[];
  steps: AgentSessionV2Step[];
}) {
  options.steps.push({
    action: options.decision.action,
    args: options.decision.args,
    index: options.steps.length + 1,
    reason: options.decision.reason ?? null,
    summary: options.decision.message
      ?? options.decision.reason
      ?? `Experimental v3 selected ${options.decision.action}.`,
    timing: options.entries.filter((entry) => entry.kind === 'model').at(-1) ?? null,
    tool: options.decision.tool ?? null,
    understanding: options.decision.understanding ?? null,
  });
}

function createAgentSessionV3ExperimentalChatPendingApprovalFallbackPlan(command: AgentChatCommand) {
  return {
    commandKind: command.kind,
    goal: command.instruction,
    instruction: command.instruction,
    steps: [],
  };
}

function createAgentSessionV3ExperimentalChatPendingApproval(
  command: AgentChatCommand,
  stepIndex: number,
) {
  const route = buildAgentPermissionRoute(command);
  const reason = route.summary || `Approval required for ${command.toolCall?.name ?? command.kind}.`;
  return createAgentPendingApprovalAssembly({
    approval: {
      command,
      plan: route.plan ?? createAgentSessionV3ExperimentalChatPendingApprovalFallbackPlan(command),
      reason,
      routeSummary: route.summary,
    },
    label: 'v3 experimental command',
    stepIndex,
  });
}

function createAgentSessionV3ExperimentalChatInitialState(
  options: RunAgentSessionV3ExperimentalChatRunnerOptions,
): AgentSessionV3PilotState | null {
  if (!options.approvedToolResult) {
    return null;
  }

  return {
    lastEvent: 'approval-granted',
    phase: 'execute_transaction',
    recoveryCount: 0,
    revision: Math.max(3, options.continuation?.steps.length ?? 0),
    terminal: null,
  };
}

export async function runAgentSessionV3ExperimentalChatRunner(
  options: RunAgentSessionV3ExperimentalChatRunnerOptions,
): Promise<AgentSessionV2Result> {
  const entries: AgentSessionV2TimingEntry[] = [...(options.continuation?.timing?.entries ?? [])];
  const steps: AgentSessionV2Step[] = [...(options.continuation?.steps ?? [])];
  const toolResults: AgentSessionV2ToolResultEntry[] = [...(options.continuation?.toolResults ?? [])];
  const historyLines: string[] = [...(options.continuation?.historyLines ?? [])];
  const traceEvents: AgentSessionV2TraceEvent[] = [...(options.continuation?.traceEvents ?? [])];
  const diagnostics = [...(options.continuation?.diagnostics ?? [])];
  let taskState = options.continuation?.taskState ?? null;
  const traceRecorder = createAgentTraceRecorder(traceEvents);
  const timingPort = createAgentSessionV3ExperimentalChatRunnerTimingPort(entries);
  const createModelRequest = (): AgentSessionV2ModelRequest => {
    const planningContext = createAgentSessionV2PlanningContext({
      sourceText: options.sourceText,
      steps,
      toolResults,
      traceEvents,
      userGoal: options.userGoal,
      workingMemory: options.workingMemory ?? null,
      workingMemoryText: options.workingMemoryText ?? '',
    });
    return {
      settings: options.settings,
      signal: options.cancellationSignal ?? null,
      systemInstruction: AGENT_SESSION_V2_SYSTEM_INSTRUCTION,
      userInput: createAgentModelInput({
        formatWorkingMemory: createAgentGuardedWorkingMemoryText,
        historyLines,
        planningContext,
        sourceText: options.sourceText,
        userGoal: options.userGoal,
      }),
    };
  };
  const adapterResult = createAgentSessionV3ExperimentalV2Adapters({
    appendTraceEvent: (event) => appendAgentSessionV3ExperimentalChatTraceEvent(traceRecorder, event),
    approvedToolResult: options.approvedToolResult ?? null,
    authorizeModelIteration: options.authorizeModelIteration
      ? () => {
          const decision = options.authorizeModelIteration?.({
            cancellationRequested: options.cancellationSignal?.aborted === true,
            requestedLimit: AGENT_SESSION_V3_EXPERIMENTAL_CHAT_RUNNER_MAX_MODEL_CALLS,
            sourceText: options.sourceText,
            taskState,
            userGoal: options.userGoal,
          });
          if (!decision) {
            throw new Error('Task Runtime model-iteration authorizer returned no decision.');
          }
          taskState = decision.taskState;
          return decision;
        }
      : null,
    createModelRequest,
    isCancellationRequested: () => options.cancellationSignal?.aborted === true,
    modelCaller: options.modelCaller,
    modelRequest: createModelRequest(),
    onAcceptedDecision: (decision) => appendAgentSessionV3ExperimentalChatDecisionStep({
      decision,
      entries,
      steps,
    }),
    sourceText: options.sourceText,
    timingTracker: timingPort,
    toolExecutor: options.toolExecutor ?? null,
    userGoal: options.userGoal,
  });
  const runtime = await runAgentSessionV3ExperimentalSession({
    adapters: {
      ...adapterResult.adapters,
      evaluate: () => {
        const evaluationToolResults = adapterResult.state.parallelToolResults.length
          ? adapterResult.state.parallelToolResults
          : adapterResult.state.latestToolResult
            ? [adapterResult.state.latestToolResult]
            : [];
        appendAgentSessionV3ExperimentalChatToolResults({
          entries: evaluationToolResults,
          historyLines,
          steps,
          toolResults,
        });
        if (shouldBlockAgentSessionV3ExperimentalReadOnlyCompletion({
          sourceText: options.sourceText,
          toolResults: evaluationToolResults,
          userGoal: options.userGoal,
        })) {
          historyLines.push(createAgentSessionV3ExperimentalReadOnlyIncompleteAnswer(
            adapterResult.state.latestToolResult,
          ));
          return null;
        }

        const missingActionCoverage = findAgentSessionV2MissingRequestedActionCoverage({
          sourceText: options.sourceText,
          toolResults,
          userGoal: options.userGoal,
        });
        if (missingActionCoverage) {
          historyLines.push([
            'Experimental v3 action coverage is incomplete after the latest tool result.',
            `missingCoverage=${missingActionCoverage.missingCoverage.join(',')}`,
            'Continue through v2 fallback instead of marking the user-level task complete.',
          ].join('\n'));
          return null;
        }

        const latestToolResult = adapterResult.state.latestToolResult;
        const evidenceEvaluation = evaluateAgentEvidenceTerminal({
          coverageComplete: true,
          directActionIntent: hasAgentEffectiveDirectActionIntent(
            options.sourceText,
            options.userGoal,
          ),
          latestEntry: latestToolResult,
          postActionState: resolveAgentEvidencePostActionState(latestToolResult),
          readOnlyOnly: false,
        });
        return {
          finalAnswer: adapterResult.state.latestToolResult?.result.responseText
            ?? 'Experimental v3 runtime finished evaluation.',
          kind: evidenceEvaluation.status === 'completed' ? 'launched' : 'blocked-manual-gate',
          postActionState: evidenceEvaluation.postActionState || 'unverified',
          status: evidenceEvaluation.status === 'completed' ? 'completed' : 'needs-user',
          stepAction: 'final_answer',
          stepReason: evidenceEvaluation.reason,
        };
      },
      recover: () => ({
        kind: 'waiting',
        reason: 'Staged v3 runtime could not safely recover from the current phase event; v2 fallback should continue the task.',
      }),
    },
    initialState: createAgentSessionV3ExperimentalChatInitialState(options),
    isCancellationRequested: () => options.cancellationSignal?.aborted === true,
    maxTransitions: options.maxTransitions ?? null,
    startReason: 'Begin experimental v3 chat runner session.',
  });

  if (adapterResult.state.latestToolResult) {
    const newToolResults = adapterResult.state.parallelToolResults.length
      ? adapterResult.state.parallelToolResults
      : [adapterResult.state.latestToolResult];
    appendAgentSessionV3ExperimentalChatToolResults({
      entries: newToolResults,
      historyLines,
      steps,
      toolResults,
    });
  }

  const timing = createAgentSessionV3ExperimentalChatRunnerTimingTrace(entries);
  const pendingApproval = runtime.status === 'needs-approval' && adapterResult.state.command
    ? createAgentSessionV3ExperimentalChatPendingApproval(adapterResult.state.command, Math.max(1, steps.length + 1))
    : null;
  if (pendingApproval) {
    traceRecorder.append(pendingApproval.traceEvent);
    historyLines.push(pendingApproval.historyLine);
  }
  const finalAnswer = pendingApproval?.finalAnswer ?? createAgentSessionV3ExperimentalChatFinalAnswer(runtime);

  options.onProgress?.({
    continuation: createAgentSessionV3ExperimentalChatContinuation({
      diagnostics,
      historyLines,
      sourceText: options.sourceText,
      steps,
      taskState,
      timing,
      traceEvents,
      toolResults,
      userGoal: options.userGoal,
    }),
    message: finalAnswer,
    stepIndex: Math.max(1, steps.length),
    type: runtime.status === 'needs-approval' ? 'model-decision' : 'tool-result',
  });

  return createAgentSessionV3ExperimentalChatResult({
    diagnostics,
    finalAnswer,
    historyLines,
    pendingApproval: pendingApproval?.pendingApproval ?? null,
    sourceText: options.sourceText,
    status: createAgentSessionV3ExperimentalChatResultStatus(runtime),
    steps,
    taskState,
    timing,
    traceEvents,
    toolResults,
    userGoal: options.userGoal,
  });
}
