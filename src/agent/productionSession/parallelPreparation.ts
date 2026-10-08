import { type AgentChatCommand, type AgentToolCallName } from '../agentChatCommand';
import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { type AgentRuntimeResult, type AgentRuntimeToolExecutor } from '../runtime/agentRuntimeContract';
import { bindAgentToolDisplayTargetToExplicitIntent } from '../runtime/agentDisplayTargetIntent';
import { buildAgentPermissionRoute, isAgentPermissionRouteSilentReadOnly } from '../agentPermissionRouter';
import { createAgentToolCommand } from '../runtime/agentToolCommandFactory';
import { prepareAgentDecisionToolInput } from '../runtime/agentDecisionContract';
import { createAgentCompatibilityToolRejection } from '../runtime/agentCompatibilityToolRejection';
import { createAgentRepeatedFailedToolCallRejection, createAgentVideoSummarySearchRejection } from '../runtime/agentDecisionRejectionSignals';
import { prepareAgentParallelToolCommands } from '../runtime/agentParallelToolPreparation';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionApprovalPreparation } from './approvalPreparation';
import { type createAgentProductionRetryEvidence } from './retryEvidence';
import { type createAgentProductionDesktopRequestRouting } from './desktopRequestRouting';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
type Routing = ReturnType<typeof createAgentProductionDesktopRequestRouting>;
interface AgentProductionParallelPreparationDependencies extends Pick<VerificationDependencies,
  'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'toolExecutor' | 'appendTraceEvent' | 'preparePendingApprovalResult'
> {
  toolNames: ReadonlySet<AgentToolCallName>; primaryToolNames: readonly string[];
  isPrimaryToolName: (tool: string | null | undefined) => tool is AgentToolCallName;
  maxModelOutputRepairRuns: number; getModelOutputRepairRuns: () => number; incrementModelOutputRepairRuns: () => void;
  createParallelApprovalBatch: ReturnType<typeof createAgentProductionApprovalPreparation>['createAgentProductionParallelApprovalBatch'];
  rejectVideoSummarySearch: Parameters<typeof createAgentProductionApprovalPreparation>[0]['rejectVideoSummarySearch'];
  findLatestFailedToolCall: ReturnType<typeof createAgentProductionRetryEvidence>['findLatestFailedAgentProductionRetryToolCall'];
  shouldRedirectDisplayInfoToDesktopItems: Routing['shouldRedirectAgentProductionDisplayInfoToDesktopItems'];
  shouldRedirectReadOnlyDesktopActionToObservation: Routing['shouldRedirectAgentProductionReadOnlyDesktopActionToObservation'];
  createDesktopItemObservationRedirectArgs: Routing['createAgentProductionDesktopItemObservationRedirectArgs'];
  createReadOnlyDesktopActionObservationRedirectArgs: Routing['createAgentProductionReadOnlyDesktopActionObservationRedirectArgs'];
}

type ParallelPreparationResult =
  | {kind: 'continue'}
  | {kind: 'final'; finalResult: AgentRuntimeResult}
  | {kind: 'ready'; runnableCommands: AgentChatCommand[]; deferredCommands: AgentChatCommand[]; rejectedParallelToolLines: string[]; toolExecutor: AgentRuntimeToolExecutor};

export function createAgentProductionParallelPreparation(dependencies: AgentProductionParallelPreparationDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, toolExecutor, appendTraceEvent, maxModelOutputRepairRuns, getModelOutputRepairRuns, incrementModelOutputRepairRuns,
    toolNames: AGENT_SESSION_V2_TOOL_NAMES, primaryToolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
    isPrimaryToolName: isAgentSessionV2PrimaryToolName,
    createParallelApprovalBatch: createAgentSessionV2ParallelApprovalBatch,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    rejectVideoSummarySearch: shouldRejectAgentSessionV2VideoSummarySearch,
    findLatestFailedToolCall: findLatestFailedAgentSessionV2ToolCall,
    shouldRedirectDisplayInfoToDesktopItems: shouldRedirectAgentSessionV2DisplayInfoToDesktopItems,
    shouldRedirectReadOnlyDesktopActionToObservation: shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation,
    createDesktopItemObservationRedirectArgs: createAgentSessionV2DesktopItemObservationRedirectArgs,
    createReadOnlyDesktopActionObservationRedirectArgs: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs,
  } = dependencies;

  const prepareParallelSelection = (decision: AgentModelDecision, stepIndex: number): ParallelPreparationResult => {
      const requestedTools = (decision.tools ?? []).map((requestedTool) => {
        const args = requestedTool.args ?? {};
        const normalizedArgs = bindAgentToolDisplayTargetToExplicitIntent({
          args,
          sourceText,
          toolName: requestedTool.tool,
          userGoal,
        });
        return normalizedArgs === args
          ? requestedTool
          : { ...requestedTool, args: normalizedArgs };
      });
      if (!requestedTools.length) {
        const errorText = 'Parallel tool_calls did not include any valid tools.';
        historyLines.push([
          `Step ${stepIndex} rejected parallel tool calls:`,
          errorText,
        ].join('\n'));
        steps.push({
          action: 'tool_result',
          errorText,
          index: steps.length + 1,
          ok: false,
          summary: errorText,
          tool: null,
          understanding: decision.understanding ?? null,
        });
        return { kind: 'continue' };
      }

      if (!toolExecutor) {
        const errorText = 'No local tool executor is available.';
        historyLines.push([
          `Step ${stepIndex} parallel tool execution failed:`,
          errorText,
        ].join('\n'));
        steps.push({
          action: 'tool_result',
          errorText,
          index: steps.length + 1,
          ok: false,
          summary: errorText,
          tool: requestedTools.map((toolCall) => toolCall.tool).join(', '),
          understanding: decision.understanding ?? null,
        });
        return { kind: 'continue' };
      }

      const parallelApprovalBatch = createAgentSessionV2ParallelApprovalBatch({
        reason: decision.reason,
        sourceText,
        tools: requestedTools,
        userGoal,
      });
      const parallelApprovalBatchResult = prepareAgentSessionV2PendingApprovalResult(
        parallelApprovalBatch,
        stepIndex,
        'merged approval-required tool_calls',
        decision.understanding ?? null,
      );
      if (parallelApprovalBatchResult.result) {
        return { kind: 'final', finalResult: parallelApprovalBatchResult.result };
      }
      if (parallelApprovalBatchResult.handled) {
        return { kind: 'continue' };
      }

      const parallelPreparation = prepareAgentParallelToolCommands({
        dependencies: {
          buildCommand: ({ args, toolName }) => createAgentToolCommand({
            args,
            sourceText,
            toolName,
            userGoal,
          }),
          isAllowedToolName: (toolName) => AGENT_SESSION_V2_TOOL_NAMES.has(toolName as AgentToolCallName),
          isPrimaryToolName: isAgentSessionV2PrimaryToolName,
          isSilentReadOnlyCommand: (command) => {
            const route = buildAgentPermissionRoute(command);
            return {
              ok: isAgentPermissionRouteSilentReadOnly(route),
              requiresApproval: route.requiresApproval,
              routeStatus: route.status,
              routeSummary: route.summary,
            };
          },
          prepareToolInput: prepareAgentDecisionToolInput,
          rejectCompatibilityTool: createAgentCompatibilityToolRejection,
          rejectPreviousFailure: ({ args, toolName }) => {
            const previousFailure = findLatestFailedAgentSessionV2ToolCall(
              toolResults,
              toolName,
              args,
            );
            return previousFailure
              ? createAgentRepeatedFailedToolCallRejection({
                  args,
                  previousFailure,
                  toolName,
                })
              : null;
          },
          rejectVideoSummarySearch: ({ args, toolName }) => (
            shouldRejectAgentSessionV2VideoSummarySearch({
              args,
              sourceText,
              toolName,
              userGoal,
            })
              ? createAgentVideoSummarySearchRejection()
              : null
          ),
          resolveRedirect: ({ args, toolName }) => (
            shouldRedirectAgentSessionV2DisplayInfoToDesktopItems({
              args,
              sourceText,
              toolName,
              userGoal,
            })
              ? {
                  args: createAgentSessionV2DesktopItemObservationRedirectArgs({
                    args,
                    sourceText,
                    userGoal,
                  }),
                  toolName: 'execute_desktop_observation',
                }
              : shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation({
                  args,
                  toolName,
                })
                ? {
                    args: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs({
                      args,
                    }),
                    toolName: 'execute_desktop_observation',
                  }
                : null
          ),
        },
        requestedTools,
        stepIndex,
      });
      for (const traceEvent of parallelPreparation.traceEvents) {
        appendTraceEvent(traceEvent);
      }
      const runnableCommands = parallelPreparation.runnableCommands;
      const deferredCommands = parallelPreparation.deferredCommands;
      const rejectedParallelToolLines = parallelPreparation.rejectedLines;

      if (!runnableCommands.length && !deferredCommands.length) {
        const errorText = [
          'Parallel tool_calls can only run silent read-only tools.',
          ...rejectedParallelToolLines,
        ].join('\n');
        if (
          rejectedParallelToolLines.some((line) => /(?:unavailable|invalid input)/u.test(line))
          && getModelOutputRepairRuns() < maxModelOutputRepairRuns
        ) {
          incrementModelOutputRepairRuns();
          historyLines.push([
            `Step ${stepIndex} rejected invalid parallel tool selection:`,
            errorText,
            `Allowed primary tools: ${AGENT_SESSION_V2_PRIMARY_TOOL_NAMES.join(', ')}`,
            'Choose valid primary tools only, fix args against the selected tool schema, or switch to one tool_call if the next step is not a silent read-only batch.',
          ].join('\n'));
          return { kind: 'continue' };
        }

        historyLines.push([
          `Step ${stepIndex} rejected parallel tool calls:`,
          errorText,
        ].join('\n'));
        steps.push({
          action: 'tool_result',
          errorText,
          index: steps.length + 1,
          ok: false,
          summary: errorText,
          tool: requestedTools.map((toolCall) => toolCall.tool).join(', '),
          understanding: decision.understanding ?? null,
        });
        return { kind: 'continue' };
      }

    return { kind: 'ready', runnableCommands, deferredCommands, rejectedParallelToolLines, toolExecutor };
  };

  return { prepareParallelSelection };
}
