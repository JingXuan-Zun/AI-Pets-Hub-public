import { type AgentChatCommand, type AgentChatCommandResult, type AgentToolCallName } from '../agentChatCommand';
import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { type AgentRuntimeResult } from '../runtime/agentRuntimeContract';
import { evaluateAgentActionRuntime } from '../agentActionRuntime';
import { getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { runAgentToolOutcomeContinuation } from '../runtime/agentRuntimeContinuationDispatcher';
import { createAgentVisualRefinementCommand } from '../capabilities/agentVisualRefinementCapabilityAdapter';
import { isAgentTargetResolutionAvailable } from '../runtime/agentTargetResolutionRuntime';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionApprovedResultContinuation } from './approvedResultContinuation';
import { type createAgentProductionParallelExecution } from './parallelExecution';
import { type createAgentProductionSingleToolExecution } from './singleToolExecution';
import { type createAgentProductionRetryEvidence } from './retryEvidence';
import { type createAgentProductionSessionPresentation } from './sessionPresentation';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
type ParallelDependencies = Parameters<typeof createAgentProductionParallelExecution>[0];
interface SingleToolResultContinuationDependencies extends Pick<VerificationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'getTaskState' | 'getActionRuntimeDependencies'
  | 'actionCoverageDependencies' | 'resolveVisualActionApproval' | 'preparePendingApprovalResult'
  | 'createPostActionTerminalResultFromEvaluation' | 'executeVisualRefinementObservation' | 'executeInAppTargetLocateObservation' | 'executeAutoRecoveryLoop' | 'compactText'
>, Pick<ParallelDependencies, 'recordActionRuntimeDecision' | 'decideRecoveryTrigger' | 'resolveApprovalReadyFollowUp' | 'isSilentReadOnlyToolResult' | 'canCompleteFromLatestReadOnlyObservations'> {
  createFinalResult: Parameters<typeof createAgentProductionSingleToolExecution>[0]['createFinalResult'];
  executeFailedDesktopActionRecoveryObservation: Parameters<typeof createAgentProductionApprovedResultContinuation>[0]['executeFailedDesktopActionRecoveryObservation'];
  createReadOnlyObservationTerminalResult: (entry: NonNullable<ReturnType<typeof getLatestAgentToolResult>>, stepIndex: number, sourceLabel: string) => AgentRuntimeResult;
  latestDecisionSpansSeveralGoals: () => boolean;
  countFailedToolCalls: ReturnType<typeof createAgentProductionRetryEvidence>['countFailedAgentProductionRetryToolCalls'];
  createRepeatedFailureAnswer: ReturnType<typeof createAgentProductionSessionPresentation>['createAgentProductionPresentationRepeatedFailureAnswer'];
  appendNeedsMorePlanning: (reason: string) => void;
}

export function createAgentProductionSingleToolResultContinuation(dependencies: SingleToolResultContinuationDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, getActionRuntimeDependencies, recordActionRuntimeDecision, decideRecoveryTrigger, createFinalResult, createPostActionTerminalResultFromEvaluation, executeVisualRefinementObservation, executeInAppTargetLocateObservation, executeAutoRecoveryLoop, executeFailedDesktopActionRecoveryObservation, createReadOnlyObservationTerminalResult, latestDecisionSpansSeveralGoals,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    resolveApprovalReadyFollowUp: resolveAgentSessionV2ApprovalReadyFollowUp,
    isSilentReadOnlyToolResult: isAgentSessionV2SilentReadOnlyToolResult,
    canCompleteFromLatestReadOnlyObservations: canAgentSessionV2CompleteFromLatestReadOnlyObservations,
    countFailedToolCalls: countFailedAgentSessionV2ToolCalls,
    createRepeatedFailureAnswer: createAgentSessionV2RepeatedFailureAnswer,
    compactText: compactAgentSessionText, appendNeedsMorePlanning: appendV3PilotShadowNeedsMorePlanning,
  } = dependencies;
  const executeSingleToolResultContinuation = async (options: {command: AgentChatCommand; result: AgentChatCommandResult; effectiveToolName: AgentToolCallName; effectiveArgs: Record<string, unknown>; decision: AgentModelDecision; stepIndex: number; onRepeatedFailure: () => void}): Promise<AgentRuntimeResult | null> => {
    const {command, result, effectiveToolName, effectiveArgs, decision, stepIndex, onRepeatedFailure} = options;
    const latestToolEntry = getLatestAgentToolResult(toolResults);
    if (!latestToolEntry) {
      appendV3PilotShadowNeedsMorePlanning('The latest single-tool result was unavailable after transaction commit.');
      return null;
    }
    const toolActionDecision = evaluateAgentActionRuntime({
      dependencies: getActionRuntimeDependencies(),
      latestEntry: latestToolEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: toolActionDecision,
      latestEntry: latestToolEntry,
      source: 'unknown',
    });
    const toolRecoveryTrigger = decideRecoveryTrigger({
      actionDecision: toolActionDecision,
      latestEntry: latestToolEntry,
    });
    const immediateVisualActionApproval = resolveAgentSessionV2VisualActionApproval({
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
    const toolContinuationDispatch = await runAgentToolOutcomeContinuation<AgentRuntimeResult>({
      actionDecision: toolActionDecision,
      adapters: {
        approval: ({ transition }) => {
          const approvalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            stepIndex,
            'approvalSource' in transition && transition.approvalSource === 'approval-ready'
              ? 'approval-ready follow-up'
              : 'visual-action approval before refinement or recovery',
            decision.understanding ?? null,
          );
          return {
            executed: approvalResult.handled,
            finalResult: approvalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: ({ latestEntry, stepIndex: continuationStepIndex, transition }) => (
          'recoveryMode' in transition && transition.recoveryMode === 'failed-action'
            ? executeFailedDesktopActionRecoveryObservation(
                latestEntry,
                continuationStepIndex,
                'single-tool-result',
              )
            : executeAutoRecoveryLoop(
                latestEntry,
                continuationStepIndex,
                'single-tool-result',
              )
        ),
        refine: ({ latestEntry, stepIndex: continuationStepIndex }) => (
          executeVisualRefinementObservation(latestEntry, continuationStepIndex)
        ),
        targetResolution: ({ latestEntry, stepIndex: continuationStepIndex }) => (
          executeInAppTargetLocateObservation(latestEntry, continuationStepIndex)
        ),
        terminal: ({ latestEntry, stepIndex: continuationStepIndex, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                latestEntry,
                terminalEvaluation,
                continuationStepIndex,
                'single-tool-result',
                ),
              };
            }
            if (
              transition.kind === 'terminal'
              && transition.actionDecision.status === 'completed'
              && transition.actionDecision.reason === 'terminal-completed'
              && toolResults.every(isAgentSessionV2SilentReadOnlyToolResult)
            ) {
              if (
                !canAgentSessionV2CompleteFromLatestReadOnlyObservations(steps, toolResults, 1)
                || latestDecisionSpansSeveralGoals()
              ) {
                // Earlier evidence or remaining planned goals need the model.
                return { executed: false, finalResult: null };
              }
              return {
                executed: true,
                finalResult: createReadOnlyObservationTerminalResult(
                  latestEntry,
                  continuationStepIndex,
                  'single-tool-result',
                ),
              };
            }
            const userInputDetail = latestEntry.result.responseText?.trim()
              || latestEntry.result.verification?.trim()
              || '';
            return {
            executed: true,
            finalResult: createFinalResult({
              finalAnswer: userInputDetail
                ? `Automatic recovery stopped because the latest tool evidence requires user input: ${userInputDetail}`
                : 'Automatic recovery stopped because the latest tool evidence requires user input.',
              status: 'needs-user',
            }),
          };
        },
        verification: () => ({ executed: false, finalResult: null }),
      },
      approvalReadyApproval: approvalReadyFollowUp,
      latestEntry: latestToolEntry,
      onTransition: (transition) => {
        historyLines.push([
          `Step ${stepIndex} tool outcome continuation decision:`,
          `kind=${transition.kind}`,
          `reason=${transition.reason}`,
        ].join('\n'));
      },
      recoveryDecision: toolRecoveryTrigger,
      recoveryEnabled: true,
      refinementAvailable: Boolean(createAgentVisualRefinementCommand({
        latestEntry: latestToolEntry,
        sourceText,
        toolResults,
        userGoal,
      })),
      stepIndex: steps.length,
      targetResolutionAvailable: isAgentTargetResolutionAvailable({
        actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
        latestEntry: latestToolEntry,
        sourceText,
        taskState: getTaskState(),
        toolResults,
        userGoal,
      }),
      visualApproval: immediateVisualActionApproval,
    });
    const toolLoopDecision = toolContinuationDispatch.loopDecision;
    if (toolLoopDecision.action === 'return-final') {
      return toolLoopDecision.finalResult;
    }
    if (toolLoopDecision.action === 'continue-runtime') {
      if (toolLoopDecision.continuationKind === 'refine') {
        appendV3PilotShadowNeedsMorePlanning('Visual refinement produced additional evidence for the next model decision.');
      } else if (toolLoopDecision.continuationKind === 'recovery') {
        appendV3PilotShadowNeedsMorePlanning('Runtime recovery produced additional evidence for the next model decision.');
      }
      return null;
    }

    if (
      result.ok === false
      && countFailedAgentSessionV2ToolCalls(
        toolResults,
        effectiveToolName,
        effectiveArgs,
      ) >= 2
    ) {
      historyLines.push([
        `Step ${stepIndex} loop guard:`,
        `Repeated failed tool call: ${effectiveToolName}`,
        `args=${compactAgentSessionText(effectiveArgs)}`,
        `lastError=${compactAgentSessionText(result.errorText ?? result.responseText ?? result.verification ?? '')}`,
      ].join('\n'));

      onRepeatedFailure();
      return createFinalResult({
        finalAnswer: createAgentSessionV2RepeatedFailureAnswer(effectiveToolName, result),
        historyLines,
        sourceText,
        status: 'failed',
        steps,
        toolResults,
        userGoal,
      });
    }

    appendV3PilotShadowNeedsMorePlanning('AgentSessionV2 continued planning after the latest single-tool result.');
    return null;
  };
  return { executeSingleToolResultContinuation };
}
