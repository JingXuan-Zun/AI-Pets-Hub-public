import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { type AgentRuntimeResult, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { resolveAgentWindowTargetBeforeDispatch } from '../runtime/agentWindowTargetResolutionRuntime';
import { createAgentVisibleClickActionablePreflightCommand } from '../agentVisibleClickPreflight';
import { createAgentTransitionalDesktopActionRejection, createAgentRepeatedFailedToolCallRejection } from '../runtime/agentDecisionRejectionSignals';
import { type createAgentProductionSingleToolSelection } from './singleToolSelection';
import { type createAgentProductionRetryEvidence } from './retryEvidence';
import { type createAgentProductionDesktopActionEvidence } from './desktopActionEvidence';
import { type createAgentProductionSessionPresentation } from './sessionPresentation';

type SelectionDependencies = Parameters<typeof createAgentProductionSingleToolSelection>[0];
type RetryEvidence = ReturnType<typeof createAgentProductionRetryEvidence>;
interface AgentProductionExecutionPreflightDependencies extends Pick<SelectionDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'appendTraceEvent' | 'compactText'
  | 'maxModelOutputRepairRuns' | 'getModelOutputRepairRuns' | 'incrementModelOutputRepairRuns'
> {
  toolResults: AgentRuntimeToolResultEntry[];
  findLatestFailedToolCall: RetryEvidence['findLatestFailedAgentProductionRetryToolCall'];
  countRepeatedFailedToolCallRejections: RetryEvidence['countAgentProductionRetryRepeatedFailedToolCallRejections'];
  rejectTransitionalDesktopAction: ReturnType<typeof createAgentProductionDesktopActionEvidence>['shouldRejectAgentProductionTransitionalDesktopAction'];
  createRepeatedFailureAnswer: ReturnType<typeof createAgentProductionSessionPresentation>['createAgentProductionPresentationRepeatedFailureAnswer'];
  createFinalResult: (options: Pick<AgentRuntimeResult, 'finalAnswer' | 'status'> & {historyLines?: string[]; sourceText?: string; steps?: SelectionDependencies['steps']; toolResults?: AgentRuntimeToolResultEntry[]; userGoal?: string}) => AgentRuntimeResult;
}

type ExecutionPreflightResult =
  | {kind: 'continue'}
  | {kind: 'final'; finalResult: AgentRuntimeResult}
  | {kind: 'ready'; effectiveToolName: AgentToolCallName; effectiveArgs: Record<string, unknown>};

export function createAgentProductionExecutionPreflight(dependencies: AgentProductionExecutionPreflightDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, maxModelOutputRepairRuns, getModelOutputRepairRuns, incrementModelOutputRepairRuns, createFinalResult,
    compactText: compactAgentSessionText,
    findLatestFailedToolCall: findLatestFailedAgentSessionV2ToolCall,
    countRepeatedFailedToolCallRejections: countAgentSessionV2RepeatedFailedToolCallRejections,
    rejectTransitionalDesktopAction: shouldRejectAgentSessionV2TransitionalDesktopAction,
    createRepeatedFailureAnswer: createAgentSessionV2RepeatedFailureAnswer,
  } = dependencies;

  const prepareExecutionPreflight = (options: {effectiveToolName: AgentToolCallName; effectiveArgs: Record<string, unknown>; decision: AgentModelDecision; stepIndex: number; onRepeatedFailure: () => void}): ExecutionPreflightResult => {
    let {effectiveToolName, effectiveArgs} = options;
    const {decision, stepIndex, onRepeatedFailure} = options;
    const windowTargetResolution = resolveAgentWindowTargetBeforeDispatch({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      toolResults,
      userGoal,
    });
    if (windowTargetResolution.kind === 'observe' && windowTargetResolution.command.toolCall) {
      historyLines.push([
        `Step ${stepIndex} converted unresolved window action to silent identity preflight:`,
        windowTargetResolution.reason,
        `requestedTool=${effectiveToolName}`,
        `requestedArgs=${compactAgentSessionText(effectiveArgs, 360)}`,
      ].join('\n'));
      effectiveToolName = windowTargetResolution.command.toolCall.name;
      effectiveArgs = windowTargetResolution.command.toolCall.input;
    } else if (windowTargetResolution.kind === 'ready') {
      effectiveArgs = windowTargetResolution.args;
      historyLines.push([
        `Step ${stepIndex} bound window action to observed identity:`,
        windowTargetResolution.reason,
        `hwnd=${String(effectiveArgs.hwnd ?? '')}`,
        `pid=${String(effectiveArgs.pid ?? '')}`,
        `processName=${String(effectiveArgs.processName ?? '')}`,
        `title=${String(effectiveArgs.title ?? '')}`,
      ].join('\n'));
    } else if (windowTargetResolution.kind === 'repair') {
      appendTraceEvent({
        action: decision.action,
        details: {
          args: effectiveArgs,
          reason: windowTargetResolution.reason,
        },
        status: 'window-target-unresolved',
        stepIndex,
        summary: 'Window action was rejected until one live HWND/PID identity is selected.',
        tool: effectiveToolName,
        type: 'decision_rejected',
      });
      historyLines.push([
        `Step ${stepIndex} rejected unresolved window action before approval:`,
        windowTargetResolution.reason,
      ].join('\n'));
      if (getModelOutputRepairRuns() < maxModelOutputRepairRuns) {
        incrementModelOutputRepairRuns();
        return { kind: 'continue' };
      }
      return { kind: 'final', finalResult: createFinalResult({
        finalAnswer: windowTargetResolution.reason,
        status: 'needs-user',
      }) };
    }

    const visibleClickPreflightCommand = createAgentVisibleClickActionablePreflightCommand({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    if (visibleClickPreflightCommand?.toolCall) {
      historyLines.push([
        `Step ${stepIndex} converted unresolved visible click to silent actionable preflight:`,
        `app=${String(effectiveArgs.app ?? '')}`,
        `target=${String(effectiveArgs.target ?? '')}`,
      ].join('\n'));
      effectiveToolName = visibleClickPreflightCommand.toolCall.name;
      effectiveArgs = visibleClickPreflightCommand.toolCall.input;
    }

    if (shouldRejectAgentSessionV2TransitionalDesktopAction({
      args: effectiveArgs,
      toolName: effectiveToolName,
    })) {
      const errorText = createAgentTransitionalDesktopActionRejection(effectiveArgs);
      historyLines.push([
        `Step ${stepIndex} rejected transitional desktop action:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      return { kind: 'continue' };
    }

    const previousFailedToolCall = findLatestFailedAgentSessionV2ToolCall(
      toolResults,
      effectiveToolName,
      effectiveArgs,
    );
    if (previousFailedToolCall) {
      const errorText = createAgentRepeatedFailedToolCallRejection({
        args: effectiveArgs,
        previousFailure: previousFailedToolCall,
        toolName: effectiveToolName,
      });
      if (
        countAgentSessionV2RepeatedFailedToolCallRejections(
          steps,
          effectiveToolName,
          effectiveArgs,
        ) >= 1
      ) {
        historyLines.push([
          `Step ${stepIndex} loop guard:`,
          `Repeated rejected failed tool call: ${effectiveToolName}`,
          `args=${compactAgentSessionText(effectiveArgs)}`,
          `previousFailure=${compactAgentSessionText(previousFailedToolCall.result.errorText ?? previousFailedToolCall.result.responseText ?? '')}`,
        ].join('\n'));

        onRepeatedFailure();
        return { kind: 'final', finalResult: createFinalResult({
          finalAnswer: createAgentSessionV2RepeatedFailureAnswer(
            effectiveToolName,
            previousFailedToolCall.result,
          ),
          historyLines,
          sourceText,
          status: 'failed',
          steps,
          toolResults,
          userGoal,
        }) };
      }

      historyLines.push([
        `Step ${stepIndex} rejected repeated failed tool call before execution:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        args: effectiveArgs,
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      return { kind: 'continue' };
    }

    return {kind: 'ready', effectiveToolName, effectiveArgs};
  };

  return { prepareExecutionPreflight };
}
