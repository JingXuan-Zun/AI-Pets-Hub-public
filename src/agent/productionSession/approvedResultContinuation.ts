import { type AgentRuntimeResult, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { evaluateAgentActionRuntime } from '../agentActionRuntime';
import { assessAgentCommandResult } from '../agentResultAssessment';
import { createAgentToolFinishedTraceDetails } from "../runtime/agentTraceEvents";
import { getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { formatAgentToolResultForModel } from '../runtime/agentToolResultSummary';
import { runAgentApprovedActionContinuation } from '../runtime/agentRuntimeContinuationDispatcher';
import { type AgentRecoveryTriggerDecision } from '../runtime/agentRecoveryController';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionFailedActionRecoveryObservation } from './failedActionRecoveryObservation';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
interface AgentProductionApprovedResultDependencies extends Pick<VerificationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'getTaskState'
  | 'getActionRuntimeDependencies' | 'appendTraceEvent' | 'commitToolResult'
  | 'resolveVisualActionApproval' | 'preparePendingApprovalResult' | 'createFinalResult'
  | 'createPostActionTerminalResultFromEvaluation' | 'executeInAppTargetLocateObservation' | 'executeAutoRecoveryLoop'
> {
  recordActionRuntimeDecision: (options: {decision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null; source: 'approved-tool-result'}) => void;
  decideRecoveryTrigger: (options: {actionDecision: ReturnType<typeof evaluateAgentActionRuntime>; latestEntry: AgentRuntimeToolResultEntry | null}) => AgentRecoveryTriggerDecision;
  executeFailedDesktopActionRecoveryObservation: ReturnType<typeof createAgentProductionFailedActionRecoveryObservation>['executeFailedDesktopActionRecoveryObservation'];
  executePostApprovalVerification: ReturnType<typeof createAgentProductionPostApprovalVerification>['executePostApprovalVerification'];
}

export function createAgentProductionApprovedResultContinuation(dependencies: AgentProductionApprovedResultDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, getTaskState, getActionRuntimeDependencies, appendTraceEvent, commitToolResult, createFinalResult, createPostActionTerminalResultFromEvaluation, executeInAppTargetLocateObservation, executeAutoRecoveryLoop, executeFailedDesktopActionRecoveryObservation, executePostApprovalVerification, recordActionRuntimeDecision, decideRecoveryTrigger,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  } = dependencies;

  const executeApprovedResultContinuation = async (approvedToolResult: AgentRuntimeToolResultEntry): Promise<AgentRuntimeResult | null> => {
    const result = assessAgentCommandResult(
      approvedToolResult.command,
      approvedToolResult.result,
    );
    appendTraceEvent({
      details: createAgentToolFinishedTraceDetails(
        approvedToolResult.command,
        result,
        approvedToolResult.timing ?? null,
        { source: 'approved-tool-result' },
      ),
      status: result.ok === false
        ? 'failed'
        : result.receipt?.status ?? 'approved-result',
      stepIndex: steps.length + 1,
      summary: `Received approved tool result for ${approvedToolResult.command.toolCall?.name ?? approvedToolResult.command.kind}.`,
      tool: approvedToolResult.command.toolCall?.name ?? approvedToolResult.command.kind,
      type: 'tool_finished',
    });
    commitToolResult({
      command: approvedToolResult.command,
      result,
    });
    historyLines.push([
      'Approved tool result:',
      formatAgentToolResultForModel(approvedToolResult.command, result),
    ].join('\n'));
    steps.push({
      action: 'tool_result',
      errorText: result.errorText ?? null,
      index: steps.length + 1,
      ok: result.ok !== false,
      summary: result.responseText,
      tool: approvedToolResult.command.toolCall?.name ?? approvedToolResult.command.kind,
    });

    const approvedEntry = getLatestAgentToolResult(toolResults);
    const approvedActionRuntimeDecision = evaluateAgentActionRuntime({
      dependencies: getActionRuntimeDependencies(),
      latestEntry: approvedEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: approvedActionRuntimeDecision,
      latestEntry: approvedEntry,
      source: 'approved-tool-result',
    });
    historyLines.push([
      'Approved tool lifecycle decision:',
      `status=${approvedActionRuntimeDecision.status}`,
      `reason=${approvedActionRuntimeDecision.reason}`,
      approvedActionRuntimeDecision.reason === 'missing-requested-coverage'
        ? 'taskFlow=continuation-required'
        : '',
      `postActionState=${approvedActionRuntimeDecision.postActionState}`,
    ].filter(Boolean).join('\n'));
    const approvedRecoveryTrigger = decideRecoveryTrigger({
      actionDecision: approvedActionRuntimeDecision,
      latestEntry: approvedEntry,
    });

    const approvedResultVisualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: approvedToolResult.command,
      result,
      sourceText,
      toolResults,
      userGoal,
    });
    const approvedContinuationDispatch = await runAgentApprovedActionContinuation<AgentRuntimeResult>({
      actionDecision: approvedActionRuntimeDecision,
      adapters: {
        approval: ({ stepIndex, transition }) => {
          const approvalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            stepIndex,
            'visual-action approval after approved tool result',
            null,
          );
          return {
            executed: approvalResult.handled,
            finalResult: approvalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: async ({ latestEntry, stepIndex, transition }) => {
          if (transition.recoveryDecision?.action === 'failed-action') {
            const failedRecovery = await executeFailedDesktopActionRecoveryObservation(
              latestEntry,
              stepIndex,
              'approved-tool-result:lifecycle-failed',
            );
            if (failedRecovery.finalResult || !failedRecovery.executed) {
              return failedRecovery;
            }
          } else {
            const waitingRecovery = await executeAutoRecoveryLoop(
              latestEntry,
              stepIndex,
              'approved-tool-result:lifecycle-waiting',
            );
            if (waitingRecovery.finalResult || !waitingRecovery.executed) {
              return waitingRecovery;
            }
          }
          return executeInAppTargetLocateObservation(
            getLatestAgentToolResult(toolResults),
            steps.length,
          );
        },
        refine: () => ({ executed: false, finalResult: null }),
        targetResolution: ({ latestEntry, stepIndex }) => (
          executeInAppTargetLocateObservation(latestEntry, stepIndex)
        ),
        terminal: ({ latestEntry, stepIndex, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                latestEntry,
                terminalEvaluation,
                stepIndex,
                'approved-tool-result',
              ),
            };
          }
          return {
            executed: true,
            finalResult: createFinalResult({
              finalAnswer: 'Automatic recovery stopped because the approved action evidence requires user input.',
              status: 'needs-user',
            }),
          };
        },
        verification: ({ latestEntry, stepIndex }) => executePostApprovalVerification(
          latestEntry,
          stepIndex,
        ),
      },
      approval: approvedResultVisualActionApproval,
      latestEntry: approvedEntry,
      onTransition: (transition) => {
        historyLines.push([
          'Approved action continuation decision:',
          `kind=${transition.kind}`,
          `reason=${transition.reason}`,
        ].join('\n'));
      },
      recoveryDecision: approvedRecoveryTrigger,
      stepIndex: steps.length,
      taskState: getTaskState(),
    });
    if (approvedContinuationDispatch.loopDecision.action === 'return-final') {
      return approvedContinuationDispatch.loopDecision.finalResult;
    }
    return null;
  };

  return { executeApprovedResultContinuation };
}
