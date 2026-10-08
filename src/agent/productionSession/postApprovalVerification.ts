import { type AgentRuntimeResult, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { runAgentVerificationExecution } from '../runtime/agentVerificationRuntime';
import { runAgentVerificationContinuation } from '../runtime/agentRuntimeContinuationDispatcher';
import { createAgentUnattemptedRequestedActionFinalRejection } from '../runtime/agentFinalAnswerRejectionSignals';
import { type AgentRequestedActionKind } from '../runtime/agentActionCoverage';
import { type evaluateAgentActionRuntime } from '../agentActionRuntime';
import { createAgentVisualRefinementCommand } from '../capabilities/agentVisualRefinementCapabilityAdapter';
import { isAgentTargetResolutionAvailable } from '../runtime/agentTargetResolutionRuntime';
import { getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER, isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested, resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus } from './executionTiming';
import { type createAgentProductionAutoRecoveryExecution } from './autoRecoveryExecution';

type RecoveryDependencies = Parameters<typeof createAgentProductionAutoRecoveryExecution>[0];
interface AgentProductionPostApprovalVerificationDependencies extends Pick<RecoveryDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'getTaskState'
  | 'toolExecutor' | 'cancellationSignal' | 'readOnlyToolCache' | 'timingTracker'
  | 'executeCommandWithCache' | 'getTimingDetail' | 'compactText' | 'commitToolResult'
  | 'onProgress' | 'createProgressSnapshot' | 'emitProgress' | 'appendTraceEvent'
  | 'createBudgetExceededResult' | 'createFinalResult' | 'resolveVisualActionApproval' | 'preparePendingApprovalResult'
  | 'getActionRuntimeDependencies' | 'actionCoverageDependencies' | 'recordRecoveryTriggerDecision'
  | 'executeVisualRefinementObservation' | 'executeInAppTargetLocateObservation' | 'createPostActionTerminalResultFromEvaluation'
> {
  executeAutoRecoveryLoop: ReturnType<typeof createAgentProductionAutoRecoveryExecution>['executeAutoRecoveryLoop'];
  recordActionRuntimeDecision: (options: {decision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null; source: 'post-approval-verification'}) => void;
}

export function createAgentProductionPostApprovalVerification(dependencies: AgentProductionPostApprovalVerificationDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, getActionRuntimeDependencies, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult, createPostActionTerminalResultFromEvaluation, recordActionRuntimeDecision, recordRecoveryTriggerDecision, executeVisualRefinementObservation, executeInAppTargetLocateObservation, executeAutoRecoveryLoop,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
  } = dependencies;

  const executePostApprovalVerification = async (
    latestEntry: AgentRuntimeToolResultEntry | null,
    triggerStepIndex: number,
  ): Promise<{ executed: boolean; finalResult: AgentRuntimeResult | null }> => {
    if (!toolExecutor) {
      return { executed: false, finalResult: null };
    }

    const verificationStepIndex = steps.length + 1;
    const verificationExecution = await runAgentVerificationExecution({
      actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
      appendTraceEvent,
      executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
        command,
        toolExecutor,
        readOnlyToolCache,
        cancellationSignal,
      ),
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      latestEntry,
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${verificationStepIndex} post-approval verification result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} post-approval verification:`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: verificationStepIndex,
      taskState: getTaskState(),
      timingTracker,
      toolResults,
      userGoal,
    });
    if (verificationExecution.kind === 'not-executed') {
      if (verificationExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped post-approval verification:`,
          `permission=${verificationExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (verificationExecution.kind === 'budget-exceeded') {
      return {
        executed: false,
        finalResult: createBudgetExceededResult(),
      };
    }
    if (verificationExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }

    const verificationEntry = verificationExecution.collected.entry;
    const verificationResult = verificationEntry.result;
    const continuationDispatch = await runAgentVerificationContinuation<AgentRuntimeResult>({
      actionRuntimeDependencies: getActionRuntimeDependencies(),
      adapters: {
        approval: ({ transition }) => {
          const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            verificationStepIndex,
            'visual-action approval after post-approval verification',
            null,
          );
          return {
            executed: visualApprovalResult.handled,
            finalResult: visualApprovalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: ({ latestEntry: continuationEntry, stepIndex }) => executeAutoRecoveryLoop(
          continuationEntry,
          stepIndex,
          'post-approval-verification',
        ),
        refine: ({ stepIndex }) => executeVisualRefinementObservation(
          getLatestAgentToolResult(toolResults),
          stepIndex,
        ),
        targetResolution: ({ latestEntry: continuationEntry, stepIndex }) => (
          executeInAppTargetLocateObservation(continuationEntry, stepIndex)
        ),
        terminal: ({ latestEntry: continuationEntry, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                continuationEntry,
                terminalEvaluation,
                verificationStepIndex,
                'post-approval-verification-result',
              ),
            };
          }
          return {
            executed: true,
            finalResult: createFinalResult({
              finalAnswer: 'Automatic recovery stopped because the latest verification evidence requires user input.',
              status: 'needs-user',
            }),
          };
        },
        verification: () => ({ executed: false, finalResult: null }),
      },
      latestEntry: verificationEntry,
      onTransition: (transition) => {
        const postApprovalActionRuntimeDecision = transition.actionDecision;
        recordActionRuntimeDecision({
          decision: postApprovalActionRuntimeDecision,
          latestEntry: verificationEntry,
          source: 'post-approval-verification',
        });
        historyLines.push([
          `Step ${verificationStepIndex} post-approval lifecycle decision:`,
          `status=${postApprovalActionRuntimeDecision.status}`,
          `reason=${postApprovalActionRuntimeDecision.reason}`,
          `postActionState=${postApprovalActionRuntimeDecision.postActionState}`,
        ].join('\n'));
        if (postApprovalActionRuntimeDecision.missingCoverage) {
          const missingPostApprovalActionCoverage = {
            attemptedCoverage: postApprovalActionRuntimeDecision.missingCoverage.attemptedCoverage as Set<AgentRequestedActionKind>,
            missingCoverage: postApprovalActionRuntimeDecision.missingCoverage.missingCoverage as AgentRequestedActionKind[],
            requestedCoverage: postApprovalActionRuntimeDecision.missingCoverage.requestedCoverage as Set<AgentRequestedActionKind>,
          };
          historyLines.push([
            `Step ${verificationStepIndex} incomplete action coverage after post-approval verification:`,
            createAgentUnattemptedRequestedActionFinalRejection({
              ...missingPostApprovalActionCoverage,
              decision: {
                action: 'final_answer',
                message: verificationResult.responseText,
              },
            }),
          ].join('\n'));
        }
        if (transition.recoveryDecision) {
          recordRecoveryTriggerDecision({
            actionDecision: postApprovalActionRuntimeDecision,
            latestEntry: verificationEntry,
            triggerDecision: transition.recoveryDecision,
          });
        }
      },
      refinementAvailable: Boolean(createAgentVisualRefinementCommand({
        latestEntry: verificationEntry,
        sourceText,
        toolResults,
        userGoal,
      })),
      resolveVisualApproval: (request) => resolveAgentSessionV2VisualActionApproval(request),
      sourceText,
      stepIndex: steps.length,
      targetResolutionAvailable: isAgentTargetResolutionAvailable({
        actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
        latestEntry: verificationEntry,
        sourceText,
        taskState: getTaskState(),
        toolResults,
        userGoal,
      }),
      toolResults,
      userGoal,
    });
    if (continuationDispatch.loopDecision.action === 'return-final') {
      return {
        executed: true,
        finalResult: continuationDispatch.loopDecision.finalResult,
      };
    }

    return { executed: true, finalResult: null };
  };

  return { executePostApprovalVerification };
}
