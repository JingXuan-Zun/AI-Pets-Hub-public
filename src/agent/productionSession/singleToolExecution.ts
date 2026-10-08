import { type AgentChatCommand, type AgentToolCallName } from '../agentChatCommand';
import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { type AgentRuntimeResult } from '../runtime/agentRuntimeContract';
import { runAgentCommandExecution, type AgentCommandExecutionCollected } from '../runtime/agentCommandExecutionRuntime';
import { createAgentApprovalRequiredToolReason } from '../runtime/agentApprovalReasonSignals';
import { createAgentApprovalRequiredTraceSummary, createAgentPermissionRoutedTraceSummary } from '../runtime/agentDecisionTraceSummary';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested, resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus } from './executionTiming';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionApprovalResult } from './approvalResult';
import { type createAgentProductionSessionPresentation } from './sessionPresentation';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
type ApprovalResult = ReturnType<typeof createAgentProductionApprovalResult>;
type FinalResultOptions = Parameters<ReturnType<typeof createAgentProductionSessionPresentation>['createAgentProductionPresentationFinalResult']>[0];
interface AgentProductionSingleToolExecutionDependencies extends Pick<VerificationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'getTaskState' | 'toolExecutor'
  | 'cancellationSignal' | 'readOnlyToolCache' | 'timingTracker' | 'appendTraceEvent' | 'commitToolResult'
  | 'executeCommandWithCache' | 'getTimingDetail' | 'onProgress' | 'createProgressSnapshot' | 'emitProgress' | 'createBudgetExceededResult'
> {
  refreshTaskStateFromLatestEvidence: () => void;
  rejectRepeatedUnverifiedActionRetry: ApprovalResult['rejectRepeatedUnverifiedActionRetry'];
  createProhibitedApprovalRejection: ApprovalResult['createAgentProductionProhibitedApprovalRejection'];
  createFinalResult: (options: Partial<FinalResultOptions> & Pick<FinalResultOptions, 'finalAnswer' | 'status'>) => AgentRuntimeResult;
}

type SingleToolExecutionResult =
  | {kind: 'continue'}
  | {kind: 'final'; finalResult: AgentRuntimeResult}
  | {kind: 'executed'; collected: AgentCommandExecutionCollected};

export function createAgentProductionSingleToolExecution(dependencies: AgentProductionSingleToolExecutionDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, appendTraceEvent, commitToolResult, onProgress, createProgressSnapshot, createBudgetExceededResult, createFinalResult, refreshTaskStateFromLatestEvidence, rejectRepeatedUnverifiedActionRetry,
    createProhibitedApprovalRejection: createAgentSessionV2ProhibitedApprovalRejection,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail, emitProgress: emitAgentSessionV2Progress,
  } = dependencies;

  const executeSingleToolCommand = async (options: {command: AgentChatCommand; effectiveToolName: AgentToolCallName; decision: AgentModelDecision; stepIndex: number; onPrepared: (options: {reason: string | null; route: 'approval' | 'execute'}) => void}): Promise<SingleToolExecutionResult> => {
    const {command, effectiveToolName, decision, stepIndex, onPrepared} = options;
    refreshTaskStateFromLatestEvidence();
    const commandExecution = await runAgentCommandExecution({
      appendTraceEvent,
      approvalReason: (route) => createAgentApprovalRequiredToolReason({
        decisionReason: decision.reason,
        permissionSummary: route.summary,
      }),
      command,
      executeCommand: toolExecutor
        ? (selectedCommand) => executeAgentSessionV2ToolCommandWithCache(
            selectedCommand,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${stepIndex} tool result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push({
          ...step,
          index: steps.length + 1,
        });
        emitAgentSessionV2Progress(
          onProgress,
          {
            ...progressEvent,
            stepIndex: steps.length,
          },
          createProgressSnapshot(),
        );
      },
      onStarted: ({ progressEvent }) => {
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      permissionTraceSummary: createAgentPermissionRoutedTraceSummary({
        toolName: effectiveToolName,
      }),
      resolveTimingStatus: (toolResult) => resolveAgentSessionV2ToolTimingStatus(toolResult, cancellationSignal),
      stepIndex,
      taskState: getTaskState(),
      timingTracker,
      traceAction: decision.action,
      understanding: decision.understanding ?? null,
    });

    if (commandExecution.kind === 'permission-blocked' || commandExecution.kind === 'target-stale') {
      historyLines.push([
        `Step ${stepIndex} ${commandExecution.kind} result:`,
        commandExecution.errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText: commandExecution.errorText,
        index: steps.length + 1,
        ok: false,
        summary: commandExecution.errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      return {kind: 'continue'};
    }

    if (commandExecution.kind === 'approval-required') {
      const prohibitedApprovalResult = createAgentSessionV2ProhibitedApprovalRejection(
        command,
        stepIndex,
        'initial model-selected approval',
      );
      if (prohibitedApprovalResult) {
        return {kind: 'final', finalResult: prohibitedApprovalResult };
      }

      const repeatedRetry = rejectRepeatedUnverifiedActionRetry(
        command,
        stepIndex,
        decision.understanding ?? null,
      );
      if (repeatedRetry.finalResult) {
        return {kind: 'final', finalResult: repeatedRetry.finalResult };
      }
      if (repeatedRetry.rejected) {
        return {kind: 'continue'};
      }

      const reason = commandExecution.approval.reason;
      historyLines.push([
        `Step ${stepIndex} selected approval-required tool:`,
        `tool=${effectiveToolName}`,
        `reason=${reason}`,
        `permission=${commandExecution.route.summary}`,
      ].join('\n'));
      appendTraceEvent({
        action: decision.action,
        details: {
          args: command.toolCall?.input ?? {},
          reason,
          routeSummary: commandExecution.route.summary,
        },
        status: 'needs-approval',
        stepIndex,
        summary: createAgentApprovalRequiredTraceSummary({
          toolName: effectiveToolName,
        }),
        tool: effectiveToolName,
        type: 'approval_required',
      });
      onPrepared({reason, route: 'approval'});

      return {kind: 'final', finalResult: createFinalResult({
        finalAnswer: reason,
        historyLines,
        pendingApproval: commandExecution.approval,
        sourceText,
        status: 'needs-approval',
        steps,
        toolResults,
        userGoal,
      }) };
    }

    if (commandExecution.kind === 'executor-unavailable') {
      historyLines.push([
        `Step ${stepIndex} tool execution failed:`,
        commandExecution.errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText: commandExecution.errorText,
        index: steps.length + 1,
        ok: false,
        summary: commandExecution.errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      return {kind: 'continue'};
    }

    if (commandExecution.kind === 'budget-exceeded') {
      onPrepared({reason: decision.reason ?? null, route: 'execute'});
      return {kind: 'final', finalResult: createBudgetExceededResult() };
    }

    if (commandExecution.kind === 'cancelled') {
      return {kind: 'final', finalResult: createFinalResult({
        finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
        historyLines,
        sourceText,
        status: 'cancelled',
        steps,
        toolResults,
        userGoal,
      }) };
    }

    return {kind: 'executed', collected: commandExecution.collected};
  };

  return { executeSingleToolCommand };
}
