import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import {
  type AgentRuntimeCoveredParallelToolCommand,
  type AgentRuntimeParallelToolExecutionPlan,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTraceEventDraft,
} from './agentRuntimeContract';
import {
  createAgentToolTransactionFinishedTraceDetails,
  runAgentToolTransaction,
  type AgentToolTransactionTimingPort,
} from './agentToolTransactionExecutor';

export interface AgentParallelToolTransactionEntry {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  timing: AgentRuntimeTimingEntry;
}

export interface AgentParallelToolTransactionResult {
  allResults: AgentParallelToolTransactionEntry[];
  coveredResults: AgentParallelToolTransactionEntry[];
  runResults: AgentParallelToolTransactionEntry[];
}

export interface RunAgentDeferredToolTransactionsOptions {
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  commands: AgentChatCommand[];
  executeCommand: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
  getTimingDetail: (command: AgentChatCommand) => string;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  stepIndex: number;
  timingTracker: AgentToolTransactionTimingPort;
  traceAction?: 'tool_calls' | null;
}

export interface RunAgentParallelToolTransactionOptions {
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => void;
  createCoveredResult: (covered: AgentRuntimeCoveredParallelToolCommand & {
    coveringResult: AgentChatCommandResult;
  }) => AgentChatCommandResult;
  executeCommand: (command: AgentChatCommand) => Promise<AgentChatCommandResult>;
  getTimingDetail: (command: AgentChatCommand) => string;
  plan: AgentRuntimeParallelToolExecutionPlan;
  resolveTimingStatus: (result: AgentChatCommandResult) => AgentRuntimeTimingEntryStatus;
  stepIndex: number;
  timingTracker: AgentToolTransactionTimingPort;
  traceAction?: 'tool_calls' | null;
}

function getAgentParallelTransactionToolName(command: AgentChatCommand) {
  return command.toolCall?.name ?? command.kind;
}

/**
 * Execute commands that were deferred by the permission/observation router.
 * They stay sequential so each fresh visual result can feed the next turn.
 */
export async function runAgentDeferredToolTransactions(
  options: RunAgentDeferredToolTransactionsOptions,
): Promise<AgentParallelToolTransactionEntry[]> {
  const results: AgentParallelToolTransactionEntry[] = [];
  for (const command of options.commands) {
    results.push(await runAgentToolTransaction({
      appendTraceEvent: options.appendTraceEvent,
      command,
      executeCommand: options.executeCommand,
      getTimingDetail: options.getTimingDetail,
      resolveTimingStatus: options.resolveTimingStatus,
      source: 'deferred-visual-observation',
      stepIndex: options.stepIndex,
      timingTracker: options.timingTracker,
      traceAction: options.traceAction ?? null,
    }));
  }
  return results;
}

export async function runAgentParallelToolTransaction(
  options: RunAgentParallelToolTransactionOptions,
): Promise<AgentParallelToolTransactionResult> {
  const runResults = await Promise.all(options.plan.runCommands.map((command) => (
    runAgentToolTransaction({
      appendTraceEvent: options.appendTraceEvent,
      command,
      executeCommand: options.executeCommand,
      getTimingDetail: options.getTimingDetail,
      resolveTimingStatus: options.resolveTimingStatus,
      stepIndex: options.stepIndex,
      timingTracker: options.timingTracker,
      traceAction: options.traceAction ?? null,
    })
  )));

  const runResultByCommand = new Map<AgentChatCommand, AgentChatCommandResult>(
    runResults.map(({ command, result }) => [command, result]),
  );

  const coveredResults = await Promise.all(options.plan.coveredCommands.map(async (covered) => {
    const coveringResult = runResultByCommand.get(covered.coveredByCommand);
    const coveringResultFailed = !coveringResult
      || coveringResult.ok === false
      || coveringResult.receipt?.status === 'failed'
      || coveringResult.receipt?.status === 'blocked'
      || Boolean(coveringResult.errorText);
    if (coveringResultFailed) {
      return runAgentToolTransaction({
        appendTraceEvent: options.appendTraceEvent,
        command: covered.command,
        executeCommand: options.executeCommand,
        getTimingDetail: options.getTimingDetail,
        resolveTimingStatus: options.resolveTimingStatus,
        stepIndex: options.stepIndex,
        timingTracker: options.timingTracker,
        traceAction: options.traceAction ?? null,
        traceDetails: {
          coveredByTool: getAgentParallelTransactionToolName(covered.coveredByCommand),
          coverageFallback: true,
          coverageReason: covered.reason,
        },
      });
    }

    const toolName = getAgentParallelTransactionToolName(covered.command);
    const dedupeTiming = options.timingTracker.beginEntry(
      'tool',
      toolName,
      options.stepIndex,
      options.getTimingDetail(covered.command),
    );
    const result = options.createCoveredResult({
      ...covered,
      coveringResult,
    });
    const finishedTiming = options.timingTracker.finishEntry(
      {
        ...dedupeTiming,
        label: toolName,
      },
      'deduped',
      covered.reason,
    );
    options.appendTraceEvent({
      action: options.traceAction ?? null,
      details: createAgentToolTransactionFinishedTraceDetails(
        covered.command,
        result,
        finishedTiming,
        {
          coveredByTool: getAgentParallelTransactionToolName(covered.coveredByCommand),
          coverageReason: covered.reason,
        },
      ),
      status: 'deduped',
      stepIndex: options.stepIndex,
      summary: `Skipped ${toolName}; covered by ${getAgentParallelTransactionToolName(covered.coveredByCommand)}.`,
      tool: toolName,
      type: 'tool_finished',
    });

    return {
      command: covered.command,
      result,
      timing: finishedTiming,
    };
  }));

  return {
    allResults: [...runResults, ...coveredResults],
    coveredResults,
    runResults,
  };
}
