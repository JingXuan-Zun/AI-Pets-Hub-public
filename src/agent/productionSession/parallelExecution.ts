import { type AgentChatCommand, type AgentChatCommandResult } from '../agentChatCommand';
import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { type AgentRuntimeResult, type AgentRuntimePendingApproval, type AgentRuntimeToolExecutor, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { evaluateAgentActionRuntime } from '../agentActionRuntime';
import { runAgentParallelToolTransaction, runAgentDeferredToolTransactions } from '../runtime/agentParallelToolTransactionExecutor';
import { runAgentToolOutcomeContinuation } from '../runtime/agentRuntimeContinuationDispatcher';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { createAgentVisualRefinementCommand } from '../capabilities/agentVisualRefinementCapabilityAdapter';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested, resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus } from './executionTiming';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionApprovedResultContinuation } from './approvedResultContinuation';
import { type createAgentProductionObservationReuse } from './observationReuse';
import { type createAgentProductionFinalEvidenceGuards } from './finalEvidenceGuards';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
type ObservationReuse = ReturnType<typeof createAgentProductionObservationReuse>;
type EvidenceGuards = ReturnType<typeof createAgentProductionFinalEvidenceGuards>;
interface AgentProductionParallelExecutionDependencies extends Pick<VerificationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'getActionRuntimeDependencies'
  | 'cancellationSignal' | 'readOnlyToolCache' | 'timingTracker' | 'appendTraceEvent'
  | 'executeCommandWithCache' | 'getTimingDetail' | 'onProgress' | 'createProgressSnapshot' | 'emitProgress'
  | 'createBudgetExceededResult' | 'resolveVisualActionApproval' | 'preparePendingApprovalResult'
  | 'createPostActionTerminalResultFromEvaluation' | 'executeVisualRefinementObservation'
> {
  createFinalResult: (options: {finalAnswer: string; status: 'cancelled' | 'needs-user'; historyLines?: string[]; sourceText?: string; steps?: VerificationDependencies['steps']; toolResults?: AgentRuntimeToolResultEntry[]; userGoal?: string}) => AgentRuntimeResult;
  commitToolResults: (entries: AgentRuntimeToolResultEntry[]) => unknown;
  recordActionRuntimeDecision: (options: {decision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null; source: 'unknown'}) => void;
  decideRecoveryTrigger: Parameters<typeof createAgentProductionApprovedResultContinuation>[0]['decideRecoveryTrigger'];
  createExecutionPlan: ObservationReuse['createAgentProductionParallelToolExecutionPlan'];
  createCoveredResult: ObservationReuse['createAgentProductionCoveredParallelToolResult'];
  isSilentReadOnlyToolResult: EvidenceGuards['isAgentProductionSilentReadOnlyToolResult'];
  canCompleteFromLatestReadOnlyObservations: EvidenceGuards['canAgentProductionCompleteFromLatestReadOnlyObservations'];
  resolveApprovalReadyFollowUp: (options: {command: AgentChatCommand; result: AgentChatCommandResult; sourceText: string; userGoal: string}) => AgentRuntimePendingApproval | null;
  createReadOnlyObservationTerminalResult: (entry: AgentRuntimeToolResultEntry, stepIndex: number, sourceLabel: string, batchEntries: AgentRuntimeToolResultEntry[]) => AgentRuntimeResult;
}

export function createAgentProductionParallelExecution(dependencies: AgentProductionParallelExecutionDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getActionRuntimeDependencies, cancellationSignal, readOnlyToolCache, timingTracker, appendTraceEvent, onProgress, createProgressSnapshot, createBudgetExceededResult, createFinalResult, commitToolResults, recordActionRuntimeDecision, decideRecoveryTrigger, createPostActionTerminalResultFromEvaluation, executeVisualRefinementObservation, createReadOnlyObservationTerminalResult,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail, emitProgress: emitAgentSessionV2Progress,
    createExecutionPlan: createAgentSessionV2ParallelToolExecutionPlan, createCoveredResult: createAgentSessionV2CoveredParallelToolResult,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval, preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    resolveApprovalReadyFollowUp: resolveAgentSessionV2ApprovalReadyFollowUp,
    isSilentReadOnlyToolResult: isAgentSessionV2SilentReadOnlyToolResult,
    canCompleteFromLatestReadOnlyObservations: canAgentSessionV2CompleteFromLatestReadOnlyObservations,
  } = dependencies;

  const executeParallelBatch = async (options: {
    runnableCommands: AgentChatCommand[]; deferredCommands: AgentChatCommand[]; rejectedParallelToolLines: string[];
    decision: AgentModelDecision; traceAction: 'tool_calls'; stepIndex: number; toolExecutor: AgentRuntimeToolExecutor;
    onPrepared: () => void;
    onTransaction: (transaction: Awaited<ReturnType<typeof runAgentParallelToolTransaction>>) => void;
  }): Promise<AgentRuntimeResult | null> => {
    const {runnableCommands, deferredCommands, rejectedParallelToolLines, decision, traceAction, stepIndex, toolExecutor, onPrepared, onTransaction} = options;
      const parallelExecutionPlan = createAgentSessionV2ParallelToolExecutionPlan(runnableCommands);
      onPrepared();
      const parallelBudgetStopReason = timingTracker.getBudgetStopReason(
        parallelExecutionPlan.runCommands.length + parallelExecutionPlan.coveredCommands.length,
      );
      if (parallelBudgetStopReason) {
        timingTracker.markStopReason(parallelBudgetStopReason);
        return createBudgetExceededResult();
      }

      emitAgentSessionV2Progress(
        onProgress,
        {
          commands: parallelExecutionPlan.runCommands,
          message: parallelExecutionPlan.runCommands.length > 1
            ? `Agent is running ${parallelExecutionPlan.runCommands.length} read-only observations in parallel.`
            : 'Agent is running a read-only observation.',
          stepIndex,
          type: 'tools-running',
        },
        createProgressSnapshot(),
      );

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
        executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
          command,
          toolExecutor,
          readOnlyToolCache,
          cancellationSignal,
        ),
        getTimingDetail: getAgentSessionV2TimingToolDetail,
        plan: parallelExecutionPlan,
        resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
        stepIndex,
        timingTracker,
        traceAction,
      });

      if (isAgentSessionV2CancellationRequested(cancellationSignal)) {
        return createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          historyLines,
          sourceText,
          status: 'cancelled',
          steps,
          toolResults,
          userGoal,
        });
      }
      const deferredBudgetStopReason = timingTracker.getBudgetStopReason(deferredCommands.length);
      if (deferredBudgetStopReason) {
        timingTracker.markStopReason(deferredBudgetStopReason);
        return createBudgetExceededResult();
      }
      const deferredResults = await runAgentDeferredToolTransactions({
        appendTraceEvent,
        commands: deferredCommands,
        executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
          command,
          toolExecutor,
          readOnlyToolCache,
          cancellationSignal,
        ),
        getTimingDetail: getAgentSessionV2TimingToolDetail,
        resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
        stepIndex,
        timingTracker,
        traceAction,
      });


      const allParallelResults = [
        ...parallelTransaction.allResults,
        ...deferredResults,
      ];
      onTransaction(parallelTransaction);

      commitToolResults(allParallelResults);
      historyLines.push([
        `Step ${stepIndex} parallel tool results:`,
        rejectedParallelToolLines.length ? `rejected=${rejectedParallelToolLines.join(' | ')}` : '',
        parallelExecutionPlan.coveredCommands.length
          ? `deduped=${parallelExecutionPlan.coveredCommands.map((covered) => (
            `${covered.command.toolCall?.name ?? covered.command.kind}<=${covered.coveredByCommand.toolCall?.name ?? covered.coveredByCommand.kind}: ${covered.reason}`
          )).join(' | ')}`
          : '',
        ...allParallelResults.map(({ command, result }) => formatAgentToolResultForModel(command, result)),
      ].filter(Boolean).join('\n\n'));

      for (const { command, result, timing } of allParallelResults) {
        steps.push({
          action: 'tool_result',
          errorText: result.errorText ?? null,
          index: steps.length + 1,
          ok: result.ok !== false,
          summary: result.responseText,
          timing,
          tool: command.toolCall?.name ?? command.kind,
          understanding: decision.understanding ?? null,
        });
        emitAgentSessionV2Progress(
          onProgress,
          {
            command,
            message: result.ok === false
              ? `Agent received a failed result from ${command.toolCall?.name ?? command.kind}.`
              : `Agent received a result from ${command.toolCall?.name ?? command.kind}.`,
            stepIndex: steps.length,
            type: 'tool-result',
          },
          createProgressSnapshot(),
        );

        const parallelEntry = { command, result, timing };
        const parallelActionDecision = evaluateAgentActionRuntime({
          dependencies: getActionRuntimeDependencies(),
          latestEntry: parallelEntry,
          sourceText,
          toolResults,
          userGoal,
        });
        recordActionRuntimeDecision({
          decision: parallelActionDecision,
          latestEntry: parallelEntry,
          source: 'unknown',
        });
        const parallelRecoveryTrigger = decideRecoveryTrigger({
          actionDecision: parallelActionDecision,
          latestEntry: parallelEntry,
        });
        const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
          command,
          result,
          sourceText,
          toolResults,
          userGoal,
        });
        const approvalReadyFollowUp = resolveAgentSessionV2ApprovalReadyFollowUp({
          command,
          result,
          sourceText,
          userGoal,
        });
        const parallelContinuationDispatch = await runAgentToolOutcomeContinuation<AgentRuntimeResult>({
          actionDecision: parallelActionDecision,
          adapters: {
            approval: ({ transition }) => {
              const approvalResult = prepareAgentSessionV2PendingApprovalResult(
                transition.approval,
                stepIndex,
                'approvalSource' in transition && transition.approvalSource === 'approval-ready'
                  ? 'approval-ready follow-up'
                  : 'visual-action approval',
                decision.understanding ?? null,
              );
              return {
                executed: approvalResult.handled,
                finalResult: approvalResult.result,
              };
            },
            planning: () => ({ executed: false, finalResult: null }),
            recovery: () => ({ executed: false, finalResult: null }),
            refine: ({ latestEntry, stepIndex: continuationStepIndex }) => (
              executeVisualRefinementObservation(latestEntry, continuationStepIndex)
            ),
            targetResolution: () => ({ executed: false, finalResult: null }),
            terminal: ({ latestEntry, stepIndex: continuationStepIndex, transition }) => {
              const terminalEvaluation = transition.actionDecision.terminalEvaluation;
              if (transition.kind === 'terminal' && terminalEvaluation) {
                return {
                  executed: true,
                  finalResult: createPostActionTerminalResultFromEvaluation(
                    latestEntry,
                    terminalEvaluation,
                    continuationStepIndex,
                    'parallel-tool-result',
                  ),
                };
              }
              if (
                transition.kind === 'terminal'
                && transition.actionDecision.status === 'completed'
                && transition.actionDecision.reason === 'terminal-completed'
                && toolResults.every(isAgentSessionV2SilentReadOnlyToolResult)
              ) {
                if (!canAgentSessionV2CompleteFromLatestReadOnlyObservations(steps, toolResults, allParallelResults.length)) {
                  // The batch alone cannot answer the task; keep planning.
                  return { executed: false, finalResult: null };
                }
                return {
                  executed: true,
                  finalResult: createReadOnlyObservationTerminalResult(
                    latestEntry,
                    continuationStepIndex,
                    'parallel-tool-result',
                    allParallelResults,
                  ),
                };
              }
              return {
                executed: true,
                finalResult: createFinalResult({
                  finalAnswer: 'Parallel read-only evidence requires user input before the task can continue.',
                  status: 'needs-user',
                }),
              };
            },
            verification: () => ({ executed: false, finalResult: null }),
          },
          approvalReadyApproval: approvalReadyFollowUp,
          latestEntry: parallelEntry,
          onTransition: (transition) => {
            historyLines.push([
              `Step ${stepIndex} parallel tool outcome continuation decision:`,
              `kind=${transition.kind}`,
              `reason=${transition.reason}`,
            ].join('\n'));
          },
          recoveryDecision: parallelRecoveryTrigger,
          recoveryEnabled: false,
          refinementAvailable: Boolean(createAgentVisualRefinementCommand({
            latestEntry: parallelEntry,
            sourceText,
            toolResults,
            userGoal,
          })),
          stepIndex: steps.length,
          visualApproval: visualActionApproval,
        });
        const parallelLoopDecision = parallelContinuationDispatch.loopDecision;
        if (parallelLoopDecision.action === 'return-final') {
          return parallelLoopDecision.finalResult;
        }
        if (
          parallelLoopDecision.action === 'continue-runtime'
          && parallelLoopDecision.continuationKind === 'refine'
        ) {
          break;
        }
      }

    return null;
  };

  return { executeParallelBatch };
}
