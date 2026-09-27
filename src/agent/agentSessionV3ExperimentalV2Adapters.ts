import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentToolCallName,
} from './agentChatCommand';
import {
  type AgentSessionV2Decision,
  createAgentSessionV2CoveredParallelToolResult,
  createAgentSessionV2ParallelToolExecutionPlan,
  type AgentSessionV2ModelCaller,
  type AgentSessionV2ModelRequest,
} from './agentProductionSessionImplementation';
import {
  type AgentRuntimeParallelToolExecutionPlan as AgentSessionV2ParallelToolExecutionPlan,
  type AgentRuntimeTimingEntry as AgentSessionV2TimingEntry,
  type AgentRuntimeTimingEntryKind as AgentSessionV2TimingEntryKind,
  type AgentRuntimeTimingEntryStatus as AgentSessionV2TimingEntryStatus,
  type AgentRuntimeToolExecutor as AgentSessionV2ToolExecutor,
  type AgentRuntimeToolResultEntry as AgentSessionV2ToolResultEntry,
  type AgentRuntimeTraceEventDraft as AgentRuntimeTraceEventDraft,
  type AgentTaskRuntimeModelIterationDecision,
} from './runtime/agentRuntimeContract';
import { buildAgentPermissionRoute, isAgentPermissionRouteSilentReadOnly } from './agentPermissionRouter';
import {
  parseAgentDecisionContract as parseAgentSessionV2DecisionContract,
  prepareAgentDecisionToolInput as prepareAgentSessionV2DecisionToolInput,
} from './runtime/agentDecisionContract';
import {
  type AgentModelDecisionTimingPort as AgentSessionV2ModelDecisionTimingPort,
  runAgentModelDecisionTurn as runAgentSessionV2ModelDecisionTurn,
} from './runtime/agentModelDecisionRuntime';
import { createAgentToolCommand } from './runtime/agentToolCommandFactory';
import {
  type AgentToolTransactionTimingPort as AgentToolTransactionTimingPort,
  runAgentToolTransaction,
} from './runtime/agentToolTransactionExecutor';
import {
  runAgentParallelToolTransaction,
} from './runtime/agentParallelToolTransactionExecutor';
import { listAgentToolNames } from './agentToolRegistry';
import {
  type AgentSessionV3ExperimentalSessionAdapters,
} from './agentSessionV3ExperimentalSession';
import {
  type AgentSessionV3RuntimeExecutedTransactionResult,
  type AgentSessionV3RuntimePreparedCommandResult,
} from './agentSessionV3RuntimeAdapters';
import { createAgentVisibleClickActionablePreflightCommand } from './agentVisibleClickPreflight';

export interface AgentSessionV3ExperimentalV2AdapterTimingPort {
  beginEntry: (
    kind: AgentSessionV2TimingEntryKind,
    label: string,
    stepIndex: number,
    detail?: string | null,
  ) => AgentSessionV2TimingEntry;
  finishEntry: (
    entry: AgentSessionV2TimingEntry,
    status: AgentSessionV2TimingEntryStatus,
    detail?: string | null,
  ) => AgentSessionV2TimingEntry;
}

export interface CreateAgentSessionV3ExperimentalV2AdaptersOptions {
  appendTraceEvent?: ((event: AgentRuntimeTraceEventDraft) => void) | null;
  approvedToolResult?: AgentSessionV2ToolResultEntry | null;
  authorizeModelIteration?: (() => AgentTaskRuntimeModelIterationDecision) | null;
  createModelRequest?: (() => AgentSessionV2ModelRequest) | null;
  isCancellationRequested?: (() => boolean) | null;
  modelCaller: AgentSessionV2ModelCaller;
  modelRequest: AgentSessionV2ModelRequest;
  onAcceptedDecision?: ((decision: AgentSessionV2Decision) => void) | null;
  repairRuns?: number | null;
  sourceText: string;
  stepIndex?: number | null;
  timingTracker?: AgentSessionV3ExperimentalV2AdapterTimingPort | null;
  toolExecutor?: AgentSessionV2ToolExecutor | null;
  userGoal: string;
}

export interface AgentSessionV3ExperimentalV2AdapterState {
  approvedToolResult: AgentSessionV2ToolResultEntry | null;
  command: AgentChatCommand | null;
  decision: AgentSessionV2Decision | null;
  latestToolResult: AgentSessionV2ToolResultEntry | null;
  parallelPlan: AgentSessionV2ParallelToolExecutionPlan | null;
  parallelToolResults: AgentSessionV2ToolResultEntry[];
}

export interface AgentSessionV3ExperimentalV2AdaptersResult {
  adapters: AgentSessionV3ExperimentalSessionAdapters;
  state: AgentSessionV3ExperimentalV2AdapterState;
}

const AGENT_SESSION_V3_EXPERIMENTAL_V2_TOOL_NAMES = new Set<AgentToolCallName>(listAgentToolNames());

function isAgentSessionV3ExperimentalV2ToolName(toolName: string | null | undefined): toolName is AgentToolCallName {
  return Boolean(toolName && AGENT_SESSION_V3_EXPERIMENTAL_V2_TOOL_NAMES.has(toolName as AgentToolCallName));
}

function createAgentSessionV3ExperimentalV2DefaultTimingPort(): AgentSessionV3ExperimentalV2AdapterTimingPort {
  let timingIndex = 0;
  return {
    beginEntry: (
      kind: AgentSessionV2TimingEntryKind,
      label: string,
      stepIndex: number,
      detail?: string | null,
    ) => {
      timingIndex += 1;
      return {
        detail,
        id: `v3-experimental-${kind}-${timingIndex}`,
        kind,
        label,
        startedAt: Date.now(),
        status: 'running',
        stepIndex,
      } satisfies AgentSessionV2TimingEntry;
    },
    finishEntry: (
      entry: AgentSessionV2TimingEntry,
      status: AgentSessionV2TimingEntryStatus,
      detail?: string | null,
    ) => ({
      ...entry,
      detail: detail ?? entry.detail ?? null,
      durationMs: Math.max(0, Date.now() - entry.startedAt),
      endedAt: Date.now(),
      status,
    }),
  };
}

function getAgentSessionV3ExperimentalV2TimingToolDetail(command: AgentChatCommand) {
  const action = command.toolCall?.input?.action;
  return typeof action === 'string' && action.trim()
    ? action.trim()
    : command.toolCall?.name ?? command.kind;
}

function resolveAgentSessionV3ExperimentalV2ToolTimingStatus(
  result: AgentChatCommandResult,
  isCancellationRequested: () => boolean,
): AgentSessionV2TimingEntryStatus {
  if (isCancellationRequested()) {
    return 'cancelled';
  }

  return result.ok === false ? 'failed' : 'success';
}

function createAgentSessionV3ExperimentalV2Unavailable(reason: string): AgentSessionV3RuntimePreparedCommandResult {
  return {
    reason,
    status: 'unavailable',
  };
}

function asAgentSessionV2ModelDecisionTimingPort(
  timingTracker: AgentSessionV3ExperimentalV2AdapterTimingPort,
): AgentSessionV2ModelDecisionTimingPort {
  return {
    beginEntry: (kind, label, stepIndex, detail) => timingTracker.beginEntry(kind, label, stepIndex, detail),
    finishEntry: (...args) => timingTracker.finishEntry(...args),
  };
}

function asAgentSessionV2ToolExecutionTimingPort(
  timingTracker: AgentSessionV3ExperimentalV2AdapterTimingPort,
): AgentToolTransactionTimingPort {
  return {
    beginEntry: (kind, label, stepIndex, detail) => timingTracker.beginEntry(kind, label, stepIndex, detail),
    finishEntry: (...args) => timingTracker.finishEntry(...args),
  };
}

function prepareAgentSessionV3ExperimentalV2ParallelPlan(options: {
  decision: AgentSessionV2Decision;
  sourceText: string;
  userGoal: string;
}): {
  plan: AgentSessionV2ParallelToolExecutionPlan;
  reason?: string | null;
} | {
  reason: string;
  status: 'unavailable';
} {
  const requestedTools = options.decision.tools ?? [];
  if (!requestedTools.length) {
    return {
      reason: 'Parallel tool_calls did not include any tools.',
      status: 'unavailable',
    };
  }

  const commands: AgentChatCommand[] = [];
  const rejectedLines: string[] = [];

  for (const requestedTool of requestedTools.slice(0, 6)) {
    if (!isAgentSessionV3ExperimentalV2ToolName(requestedTool.tool)) {
      rejectedLines.push(`tool=${requestedTool.tool}: unavailable`);
      continue;
    }

    const preparedInput = prepareAgentSessionV2DecisionToolInput({
      args: requestedTool.args,
      toolName: requestedTool.tool,
    });
    if (preparedInput.ok === false) {
      rejectedLines.push(`tool=${requestedTool.tool}: invalid input (${preparedInput.error})`);
      continue;
    }

    const command = createAgentToolCommand({
      args: preparedInput.args,
      sourceText: options.sourceText,
      toolName: preparedInput.toolName,
      userGoal: options.userGoal,
    });
    const route = buildAgentPermissionRoute(command);
    if (!isAgentPermissionRouteSilentReadOnly(route)) {
      rejectedLines.push(`tool=${preparedInput.toolName}: not silent read-only (${route.summary})`);
      continue;
    }

    commands.push(command);
  }

  if (!commands.length || rejectedLines.length) {
    return {
      reason: [
        'Experimental v3 parallel tool_calls can only run silent read-only tools.',
        ...rejectedLines,
      ].join('\n'),
      status: 'unavailable',
    };
  }

  return {
    plan: createAgentSessionV2ParallelToolExecutionPlan(commands),
    reason: rejectedLines.length
      ? `${options.decision.reason ?? 'Parallel read-only batch prepared.'}\nRejected: ${rejectedLines.join(' | ')}`
      : options.decision.reason,
  };
}

function prepareAgentSessionV3ExperimentalV2SingleToolFromBatch(options: {
  decision: AgentSessionV2Decision;
  sourceText: string;
  userGoal: string;
}): {
  command: AgentChatCommand;
  reason?: string | null;
} | null {
  const requestedTools = options.decision.tools ?? [];
  if (requestedTools.length !== 1) {
    return null;
  }

  const requestedTool = requestedTools[0];
  if (!isAgentSessionV3ExperimentalV2ToolName(requestedTool?.tool)) {
    return null;
  }

  const preparedInput = prepareAgentSessionV2DecisionToolInput({
    args: requestedTool.args,
    toolName: requestedTool.tool,
  });
  if (preparedInput.ok === false) {
    return null;
  }

  return {
    command: createAgentToolCommand({
      args: preparedInput.args,
      sourceText: options.sourceText,
      toolName: preparedInput.toolName,
      userGoal: options.userGoal,
    }),
    reason: options.decision.reason
      ? `${options.decision.reason}\nSingle tool_calls batch downgraded to a sequential tool_call.`
      : 'Single tool_calls batch downgraded to a sequential tool_call.',
  };
}

export function createAgentSessionV3ExperimentalV2Adapters(
  options: CreateAgentSessionV3ExperimentalV2AdaptersOptions,
): AgentSessionV3ExperimentalV2AdaptersResult {
  const state: AgentSessionV3ExperimentalV2AdapterState = {
    approvedToolResult: options.approvedToolResult ?? null,
    command: null,
    decision: null,
    latestToolResult: null,
    parallelPlan: null,
    parallelToolResults: [],
  };
  const stepIndex = Math.max(1, options.stepIndex ?? 1);
  const timingTracker = options.timingTracker ?? createAgentSessionV3ExperimentalV2DefaultTimingPort();
  const appendTraceEvent = options.appendTraceEvent ?? (() => undefined);
  const isCancellationRequested = options.isCancellationRequested ?? (() => false);

  return {
    adapters: {
      executeTransaction: async (): Promise<AgentSessionV3RuntimeExecutedTransactionResult> => {
        if (state.approvedToolResult) {
          state.command = state.approvedToolResult.command;
          state.latestToolResult = state.approvedToolResult;
          return {
            kind: 'tool-transaction',
            transaction: {
              command: state.approvedToolResult.command,
              result: state.approvedToolResult.result,
              timing: state.approvedToolResult.timing ?? timingTracker.finishEntry(
                timingTracker.beginEntry(
                  'tool',
                  state.approvedToolResult.command.toolCall?.name ?? state.approvedToolResult.command.kind,
                  stepIndex,
                  getAgentSessionV3ExperimentalV2TimingToolDetail(state.approvedToolResult.command),
                ),
                state.approvedToolResult.result.ok === false ? 'failed' : 'success',
                'approved-tool-result',
              ),
            },
          };
        }

        if (!state.command) {
          if (!state.parallelPlan) {
            throw new Error('Experimental v3 v2 adapter has no prepared command to execute.');
          }
        }

        if (!options.toolExecutor) {
          throw new Error('Experimental v3 v2 adapter has no tool executor.');
        }

        if (state.parallelPlan) {
          const parallelTransaction = await runAgentParallelToolTransaction({
            appendTraceEvent,
            createCoveredResult: ({ command, coveredByCommand, coveringResult, reason }) => (
              createAgentSessionV2CoveredParallelToolResult({
                command,
                coveredByCommand,
                coveringResult,
                reason,
              })
            ),
            executeCommand: async (command) => options.toolExecutor?.(command, {
              signal: options.modelRequest.signal ?? null,
            }) ?? {
              errorText: 'No tool executor is available.',
              ok: false,
              responseText: 'No tool executor is available.',
            },
            getTimingDetail: getAgentSessionV3ExperimentalV2TimingToolDetail,
            plan: state.parallelPlan,
            resolveTimingStatus: (result) => resolveAgentSessionV3ExperimentalV2ToolTimingStatus(
              result,
              isCancellationRequested,
            ),
            stepIndex,
            timingTracker: asAgentSessionV2ToolExecutionTimingPort(timingTracker),
            traceAction: state.decision?.action === 'tool_calls' ? 'tool_calls' : null,
          });
          state.parallelToolResults = parallelTransaction.allResults.map((entry) => ({
            command: entry.command,
            result: entry.result,
            timing: entry.timing,
          }));
          state.latestToolResult = state.parallelToolResults[state.parallelToolResults.length - 1] ?? null;
          state.parallelPlan = null;
          state.command = null;

          return {
            kind: 'parallel-tool-transaction',
            transaction: parallelTransaction,
          };
        }

        if (!state.command) {
          throw new Error('Experimental v3 v2 adapter has no prepared command to execute.');
        }

        const transaction = await runAgentToolTransaction({
          appendTraceEvent,
          command: state.command,
          executeCommand: async (command) => options.toolExecutor?.(command, {
            signal: options.modelRequest.signal ?? null,
          }) ?? {
            errorText: 'No tool executor is available.',
            ok: false,
            responseText: 'No tool executor is available.',
          },
          getTimingDetail: getAgentSessionV3ExperimentalV2TimingToolDetail,
          resolveTimingStatus: (result) => resolveAgentSessionV3ExperimentalV2ToolTimingStatus(
            result,
            isCancellationRequested,
          ),
          source: 'v3-experimental-v2-adapter',
          stepIndex,
          timingTracker: asAgentSessionV2ToolExecutionTimingPort(timingTracker),
          traceAction: state.decision?.action === 'tool_call' ? 'tool_call' : null,
        });
        state.latestToolResult = transaction;
        state.command = null;
        state.parallelPlan = null;

        return {
          kind: 'tool-transaction',
          transaction,
        };
      },
      modelDecision: async () => {
        const authorization = options.authorizeModelIteration?.();
        if (authorization && authorization.action !== 'run-iteration') {
          const modelTiming = timingTracker.beginEntry('model', 'decision', stepIndex);
          const timing = timingTracker.finishEntry(
            modelTiming,
            authorization.action === 'stop-cancelled' ? 'cancelled' : 'budget-exceeded',
            authorization.reason,
          );
          const traceEvents: AgentRuntimeTraceEventDraft[] = [{
            details: {
              iteration: authorization.iteration,
              limit: authorization.limit,
            },
            status: timing.status,
            stepIndex,
            summary: authorization.reason,
            type: 'model_output',
          }];
          if (authorization.action === 'stop-cancelled') {
            return {
              modelResponse: '',
              timing,
              traceEvents,
              type: 'cancelled-after-output',
            };
          }
          return {
            errorText: authorization.reason,
            step: {
              action: 'final_answer',
              errorText: authorization.reason,
              index: stepIndex,
              summary: authorization.reason,
              timing,
            },
            timing,
            traceEvents,
            type: 'model-failed',
          };
        }
        const modelRequest = options.createModelRequest?.() ?? options.modelRequest;
        const outcome = await runAgentSessionV2ModelDecisionTurn({
          isCancellationRequested,
          modelCaller: options.modelCaller,
          modelRequest,
          parseDecision: parseAgentSessionV2DecisionContract,
          repairRuns: options.repairRuns ?? 0,
          stepIndex,
          timingTracker: asAgentSessionV2ModelDecisionTimingPort(timingTracker),
        });
        for (const traceEvent of outcome.traceEvents) {
          appendTraceEvent(traceEvent);
        }
        state.decision = outcome.type === 'accepted' ? outcome.decision : null;
        if (state.decision) {
          options.onAcceptedDecision?.(state.decision);
        }
        return outcome;
      },
      prepareCommand: (): AgentSessionV3RuntimePreparedCommandResult => {
        const decision = state.decision;
        if (!decision) {
          return createAgentSessionV3ExperimentalV2Unavailable('No accepted model decision is available.');
        }

        if (decision.action === 'tool_calls') {
          const singleToolFallback = prepareAgentSessionV3ExperimentalV2SingleToolFromBatch({
            decision,
            sourceText: options.sourceText,
            userGoal: options.userGoal,
          });
          if (singleToolFallback) {
            state.command = singleToolFallback.command;
            state.parallelPlan = null;
            return {
              reason: singleToolFallback.reason ?? decision.reason,
              route: 'execute',
              status: 'prepared',
            };
          }

          const parallelPreparation = prepareAgentSessionV3ExperimentalV2ParallelPlan({
            decision,
            sourceText: options.sourceText,
            userGoal: options.userGoal,
          });
          if ('status' in parallelPreparation) {
            return createAgentSessionV3ExperimentalV2Unavailable(parallelPreparation.reason);
          }

          state.command = null;
          state.parallelPlan = parallelPreparation.plan;
          return {
            reason: parallelPreparation.reason ?? decision.reason,
            route: 'execute',
            status: 'prepared',
          };
        }

        if (decision.action !== 'tool_call') {
          return createAgentSessionV3ExperimentalV2Unavailable(
            `Experimental v3 v2 adapter supports tool_call preparation first; received ${decision.action}.`,
          );
        }

        if (!isAgentSessionV3ExperimentalV2ToolName(decision.tool)) {
          return createAgentSessionV3ExperimentalV2Unavailable(
            `Tool "${decision.tool ?? 'unknown'}" is not available.`,
          );
        }

        const preparedInput = prepareAgentSessionV2DecisionToolInput({
          args: decision.args,
          toolName: decision.tool,
        });
        if (preparedInput.ok === false) {
          return createAgentSessionV3ExperimentalV2Unavailable(preparedInput.error);
        }

        const command = createAgentVisibleClickActionablePreflightCommand({
          args: preparedInput.args,
          sourceText: options.sourceText,
          toolName: preparedInput.toolName,
          userGoal: options.userGoal,
        }) ?? createAgentToolCommand({
          args: preparedInput.args,
          sourceText: options.sourceText,
          toolName: preparedInput.toolName,
          userGoal: options.userGoal,
        });
        const permissionRoute = buildAgentPermissionRoute(command);
        if (permissionRoute.blockedStep) {
          return createAgentSessionV3ExperimentalV2Unavailable(
            `Permission blocked tool call: ${permissionRoute.summary}`,
          );
        }

        state.command = command;
        return {
          reason: decision.reason ?? permissionRoute.summary,
          route: permissionRoute.requiresApproval ? 'approval' : 'execute',
          status: 'prepared',
        };
      },
    },
    state,
  };
}
