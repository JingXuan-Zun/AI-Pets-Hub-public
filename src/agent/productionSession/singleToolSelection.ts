import { type AgentToolCallName } from '../agentChatCommand';
import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { bindAgentToolDisplayTargetToExplicitIntent } from '../runtime/agentDisplayTargetIntent';
import { prepareAgentDecisionToolInput } from '../runtime/agentDecisionContract';
import { createAgentCompatibilityToolRejection } from '../runtime/agentCompatibilityToolRejection';
import { createAgentVideoSummarySearchRejection } from '../runtime/agentDecisionRejectionSignals';
import { createAgentUnavailableToolRejectedTraceSummary } from '../runtime/agentDecisionTraceSummary';
import { createAgentUnavailableToolRepairText, createAgentInvalidToolInputRepairText } from '../runtime/agentDecisionRepairSignal';
import { type createAgentProductionParallelPreparation } from './parallelPreparation';
import { type createAgentProductionDesktopRequestRouting } from './desktopRequestRouting';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';

type ParallelDependencies = Parameters<typeof createAgentProductionParallelPreparation>[0];
type Routing = ReturnType<typeof createAgentProductionDesktopRequestRouting>;
interface AgentProductionSingleToolSelectionDependencies extends Pick<ParallelDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'appendTraceEvent'
  | 'toolNames' | 'primaryToolNames' | 'isPrimaryToolName' | 'maxModelOutputRepairRuns'
  | 'getModelOutputRepairRuns' | 'incrementModelOutputRepairRuns' | 'rejectVideoSummarySearch'
  | 'shouldRedirectDisplayInfoToDesktopItems' | 'shouldRedirectReadOnlyDesktopActionToObservation'
  | 'createDesktopItemObservationRedirectArgs' | 'createReadOnlyDesktopActionObservationRedirectArgs'
> {
  compactText: Parameters<typeof createAgentProductionPostApprovalVerification>[0]['compactText'];
  createOpenMoveSequenceRedirect: Routing['createAgentProductionOpenMoveSequenceRedirect'];
  getOpenWindowTarget: Routing['getAgentProductionOpenWindowTarget'];
  inferDisplayTargetFromText: Routing['inferAgentProductionDisplayTargetFromText'];
}

type SingleToolSelectionResult =
  | {kind: 'continue'}
  | {kind: 'ready'; effectiveToolName: AgentToolCallName; effectiveArgs: Record<string, unknown>};

export function createAgentProductionSingleToolSelection(dependencies: AgentProductionSingleToolSelectionDependencies) {
  const {sourceText, userGoal, historyLines, steps, appendTraceEvent, maxModelOutputRepairRuns, getModelOutputRepairRuns, incrementModelOutputRepairRuns,
    toolNames: AGENT_SESSION_V2_TOOL_NAMES, primaryToolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
    isPrimaryToolName: isAgentSessionV2PrimaryToolName, compactText: compactAgentSessionText,
    rejectVideoSummarySearch: shouldRejectAgentSessionV2VideoSummarySearch,
    shouldRedirectDisplayInfoToDesktopItems: shouldRedirectAgentSessionV2DisplayInfoToDesktopItems,
    shouldRedirectReadOnlyDesktopActionToObservation: shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation,
    createDesktopItemObservationRedirectArgs: createAgentSessionV2DesktopItemObservationRedirectArgs,
    createReadOnlyDesktopActionObservationRedirectArgs: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs,
    createOpenMoveSequenceRedirect: createAgentSessionV2OpenMoveSequenceRedirect,
    getOpenWindowTarget: getAgentSessionV2OpenWindowTarget,
    inferDisplayTargetFromText: inferAgentSessionV2DisplayTargetFromText,
  } = dependencies;

  const prepareSingleToolSelection = (decision: AgentModelDecision, stepIndex: number): SingleToolSelectionResult => {
    const toolName = decision.tool;
    if (!toolName || !AGENT_SESSION_V2_TOOL_NAMES.has(toolName as AgentToolCallName)) {
      appendTraceEvent({
        action: decision.action,
        details: {
          selectedTool: toolName,
        },
        status: 'unavailable-tool',
        stepIndex,
          summary: createAgentUnavailableToolRejectedTraceSummary(),
        tool: toolName ?? null,
        type: 'decision_rejected',
      });
      if (getModelOutputRepairRuns() < maxModelOutputRepairRuns) {
        incrementModelOutputRepairRuns();
        historyLines.push([
          `Step ${stepIndex} rejected unavailable tool selection:`,
          createAgentUnavailableToolRepairText({
            allowedPrimaryToolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
            toolName,
          }),
        ].join('\n'));
        return { kind: 'continue' };
      }

      const errorText = `Tool "${toolName ?? 'unknown'}" is not available in AgentSessionV2. Available tools: ${[...AGENT_SESSION_V2_TOOL_NAMES].join(', ')}.`;
      historyLines.push([
        `Step ${stepIndex} rejected tool call:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: toolName ?? null,
        understanding: decision.understanding ?? null,
      });
      return { kind: 'continue' };
    }

    let effectiveToolName = toolName as AgentToolCallName;
    let effectiveArgs = bindAgentToolDisplayTargetToExplicitIntent({
      args: decision.args ?? {},
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    if (shouldRedirectAgentSessionV2DisplayInfoToDesktopItems({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    })) {
      effectiveToolName = 'execute_desktop_observation';
      effectiveArgs = createAgentSessionV2DesktopItemObservationRedirectArgs({
        args: effectiveArgs,
        sourceText,
        userGoal,
      });
      historyLines.push([
        `Step ${stepIndex} redirected desktop item inventory observation:`,
        'The user asked about desktop items/icons, so display-only metrics are insufficient.',
        'Using execute_desktop_observation action=list_desktop_items instead.',
        `args=${compactAgentSessionText(effectiveArgs, 360)}`,
      ].join('\n'));
    }
    if (shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation({
      args: effectiveArgs,
      toolName: effectiveToolName,
    })) {
      effectiveToolName = 'execute_desktop_observation';
      effectiveArgs = createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs({
        args: effectiveArgs,
      });
      historyLines.push([
        `Step ${stepIndex} redirected read-only desktop action:`,
        'The requested desktop action only reads local state, so it should not enter the action lifecycle.',
        'Using execute_desktop_observation instead.',
        `args=${compactAgentSessionText(effectiveArgs, 360)}`,
      ].join('\n'));
    }

    if (!isAgentSessionV2PrimaryToolName(effectiveToolName)) {
      const errorText = createAgentCompatibilityToolRejection(effectiveToolName);
      historyLines.push([
        `Step ${stepIndex} rejected compatibility-only tool call:`,
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

    if (shouldRejectAgentSessionV2VideoSummarySearch({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    })) {
      const errorText = createAgentVideoSummarySearchRejection();
      historyLines.push([
        `Step ${stepIndex} rejected video summary search:`,
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

    const openMoveSequenceRedirect = createAgentSessionV2OpenMoveSequenceRedirect({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    if (openMoveSequenceRedirect) {
      effectiveToolName = 'execute_desktop_sequence';
      effectiveArgs = openMoveSequenceRedirect;
      historyLines.push([
        `Step ${stepIndex} composed open/move desktop sequence:`,
        `target=${getAgentSessionV2OpenWindowTarget(openMoveSequenceRedirect) || 'from sequence'}`,
        `display=${String(openMoveSequenceRedirect.targetDisplay ?? '') || inferAgentSessionV2DisplayTargetFromText(`${sourceText} ${userGoal}`) || 'unknown'}`,
      ].join('\n'));
    }

    const preparedToolInput = prepareAgentDecisionToolInput({
      args: effectiveArgs,
      toolName: effectiveToolName,
    });
    if (preparedToolInput.ok === false) {
      const errorText = preparedToolInput.error;
      appendTraceEvent({
        action: decision.action,
        details: {
          args: effectiveArgs,
          error: errorText,
          issue: preparedToolInput.issue,
        },
        status: 'invalid-tool-input',
        stepIndex,
        summary: `Decision contract rejected tool input for ${effectiveToolName}.`,
        tool: effectiveToolName,
        type: 'decision_rejected',
      });
      if (getModelOutputRepairRuns() < maxModelOutputRepairRuns) {
        incrementModelOutputRepairRuns();
        historyLines.push([
          `Step ${stepIndex} rejected invalid tool input:`,
          createAgentInvalidToolInputRepairText({
            args: effectiveArgs,
            error: errorText,
            toolName: effectiveToolName,
          }),
        ].join('\n'));
        return { kind: 'continue' };
      }

      historyLines.push([
        `Step ${stepIndex} rejected tool call:`,
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
    effectiveToolName = preparedToolInput.toolName;
    effectiveArgs = preparedToolInput.args;

    return { kind: 'ready', effectiveToolName, effectiveArgs };
  };

  return { prepareSingleToolSelection };
}
