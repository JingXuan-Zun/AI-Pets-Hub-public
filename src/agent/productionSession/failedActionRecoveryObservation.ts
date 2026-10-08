import { type AgentRuntimeResult, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS, type AgentRecoveryProposalDecision } from '../runtime/agentRecoveryController';
import { runAgentRecoveryExecution } from '../runtime/agentRecoveryExecutionRuntime';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested, resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus } from './executionTiming';
import { type createAgentProductionVisualObservationExecution } from './visualObservationExecution';

type ObservationDependencies = Parameters<typeof createAgentProductionVisualObservationExecution>[0];
interface AgentProductionFailedActionRecoveryDependencies extends Pick<ObservationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'getTaskState'
  | 'toolExecutor' | 'cancellationSignal' | 'readOnlyToolCache' | 'timingTracker'
  | 'executeCommandWithCache' | 'getTimingDetail' | 'compactText' | 'commitToolResult'
  | 'onProgress' | 'createProgressSnapshot' | 'emitProgress' | 'appendTraceEvent'
  | 'createBudgetExceededResult' | 'resolveVisualActionApproval' | 'preparePendingApprovalResult'
> {
  proposeRecovery: (kind: 'failed-action', latestEntry: AgentRuntimeToolResultEntry | null) => AgentRecoveryProposalDecision;
  authorizeRecovery: Parameters<typeof runAgentRecoveryExecution>[0]['authorizeRecovery'];
  createFinalResult: (options: {finalAnswer: string; status: 'cancelled' | 'needs-user'}) => AgentRuntimeResult;
}

export function createAgentProductionFailedActionRecoveryObservation(dependencies: AgentProductionFailedActionRecoveryDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, proposeRecovery, authorizeRecovery, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  } = dependencies;

  const executeFailedDesktopActionRecoveryObservation = async (
    latestEntry: AgentRuntimeToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
  ): Promise<{ executed: boolean; finalResult: AgentRuntimeResult | null }> => {
    const recoveryProposal = proposeRecovery('failed-action', latestEntry);
    const recoveryStepIndex = steps.length + 1;
    const recoveryExecution = await runAgentRecoveryExecution({
      appendTraceEvent,
      authorizeRecovery,
      executeCommand: toolExecutor
        ? (command) => executeAgentSessionV2ToolCommandWithCache(
            command,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      kind: 'failed-action',
      onAuthorization: (decision) => {
        historyLines.push([
          `Step ${triggerStepIndex} Task Runtime recovery authorization:`,
          'kind=failed-action',
          `allowed=${decision.allowed}`,
          `attempt=${decision.attempt}/${decision.limit}`,
          `reason=${decision.reason}`,
        ].join('\n'));
      },
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${recoveryStepIndex} failed desktop action recovery result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} failed desktop action recovery:`,
          `source=${sourceLabel}`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      proposal: recoveryProposal,
      reason: sourceLabel,
      requestedLimit: AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: recoveryStepIndex,
      taskState: getTaskState(),
      timingTracker,
      traceSource: sourceLabel,
      userGoal,
    });
    if (recoveryExecution.kind === 'not-executed') {
      if (recoveryExecution.stage === 'proposal' && recoveryProposal.status === 'rejected') {
        historyLines.push(`Step ${triggerStepIndex} failed-action recovery rejected: ${recoveryProposal.reason}`);
      }
      if (recoveryExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped failed desktop action recovery:`,
          `source=${sourceLabel}`,
          `permission=${recoveryExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (recoveryExecution.kind === 'authorization-denied') {
      return {
        executed: false,
        finalResult: createFinalResult({
          finalAnswer: `Automatic recovery stopped after ${recoveryExecution.authorization.limit} authorized attempt(s). Fresh user input is required before more recovery work.`,
          status: 'needs-user',
        }),
      };
    }
    if (recoveryExecution.kind === 'budget-exceeded') {
      return { executed: false, finalResult: createBudgetExceededResult() };
    }
    if (recoveryExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }
    const recoveryEntry = recoveryExecution.collected.entry;
    const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: recoveryEntry.command,
      result: recoveryEntry.result,
      sourceText,
      toolResults,
      userGoal,
    });
    const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
      visualActionApproval,
      recoveryStepIndex,
      'visual-action approval after failed desktop action recovery',
      null,
    );
    if (visualApprovalResult.result) {
      return { executed: true, finalResult: visualApprovalResult.result };
    }
    if (visualApprovalResult.handled) {
      return { executed: true, finalResult: null };
    }

    return { executed: true, finalResult: null };
  };

  return { executeFailedDesktopActionRecoveryObservation };
}
