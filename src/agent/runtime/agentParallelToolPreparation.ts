import {
  type AgentChatCommand,
  type AgentToolCallName,
} from '../agentChatCommand';
import { type AgentDecisionToolInputResult } from './agentDecisionContract';
import { type AgentModelParallelToolCall } from './agentModelDecisionRuntime';
import { type AgentRuntimeTraceEventDraft } from './agentRuntimeContract';

export interface AgentParallelToolPreparationDependencies {
  buildCommand: (options: { args: Record<string, unknown>; toolName: AgentToolCallName }) => AgentChatCommand;
  isAllowedToolName: (toolName: string) => boolean;
  isPrimaryToolName: (toolName: string) => toolName is AgentToolCallName;
  isSilentReadOnlyCommand: (command: AgentChatCommand) => {
    ok: boolean;
    routeStatus: string;
    routeSummary: string;
    requiresApproval: boolean;
  };
  prepareToolInput: (options: {
    args?: Record<string, unknown> | null;
    toolName: string | null | undefined;
  }) => AgentDecisionToolInputResult;
  rejectCompatibilityTool: (toolName: string) => string;
  rejectPreviousFailure: (options: {
    args: Record<string, unknown>;
    toolName: AgentToolCallName;
  }) => string | null;
  rejectVideoSummarySearch: (options: {
    args: Record<string, unknown>;
    toolName: AgentToolCallName;
  }) => string | null;
  resolveRedirect: (options: { args: Record<string, unknown>; toolName: string }) => {
    args: Record<string, unknown>;
    toolName: string;
  } | null;
}

export interface AgentParallelToolPreparationOptions {
  dependencies: AgentParallelToolPreparationDependencies;
  requestedTools: readonly AgentModelParallelToolCall[];
  stepIndex: number;
}

export interface AgentParallelToolPreparationResult {
  deferredCommands: AgentChatCommand[];
  rejectedLines: string[];
  runnableCommands: AgentChatCommand[];
  traceEvents: AgentRuntimeTraceEventDraft[];
}

export function prepareAgentParallelToolCommands(
  options: AgentParallelToolPreparationOptions,
): AgentParallelToolPreparationResult {
  const rejectedLines: string[] = [];
  const deferredCommands: AgentChatCommand[] = [];
  const runnableCommands: AgentChatCommand[] = [];
  const traceEvents: AgentRuntimeTraceEventDraft[] = [];
  const { dependencies } = options;

  for (const requestedTool of options.requestedTools.slice(0, 6)) {
    let requestedToolName = requestedTool.tool;
    let requestedToolArgs = requestedTool.args ?? {};
    if (!dependencies.isAllowedToolName(requestedToolName)) {
      rejectedLines.push(`tool=${requestedToolName}: unavailable`);
      continue;
    }

    const redirect = dependencies.resolveRedirect({ args: requestedToolArgs, toolName: requestedToolName });
    if (redirect) {
      requestedToolName = redirect.toolName;
      requestedToolArgs = redirect.args;
    }

    if (!dependencies.isPrimaryToolName(requestedToolName)) {
      rejectedLines.push(`tool=${requestedToolName}: ${dependencies.rejectCompatibilityTool(requestedToolName)}`);
      continue;
    }

    const videoSummaryRejection = dependencies.rejectVideoSummarySearch({
      args: requestedToolArgs,
      toolName: requestedToolName,
    });
    if (videoSummaryRejection) {
      rejectedLines.push(`tool=${requestedToolName}: ${videoSummaryRejection}`);
      continue;
    }

    const preparedInput = dependencies.prepareToolInput({ args: requestedToolArgs, toolName: requestedToolName });
    if (preparedInput.ok === false) {
      traceEvents.push({
        action: 'tool_calls',
        details: { args: requestedToolArgs, error: preparedInput.error, issue: preparedInput.issue },
        status: 'invalid-tool-input',
        stepIndex: options.stepIndex,
        summary: `Decision contract rejected parallel tool input for ${requestedToolName}.`,
        tool: requestedToolName,
        type: 'decision_rejected',
      });
      rejectedLines.push(`tool=${requestedToolName}: invalid input (${preparedInput.error})`);
      continue;
    }

    const preparedToolName = preparedInput.toolName;
    const preparedToolArgs = preparedInput.args;
    const previousFailureRejection = dependencies.rejectPreviousFailure({ args: preparedToolArgs, toolName: preparedToolName });
    if (previousFailureRejection) {
      rejectedLines.push(`tool=${preparedToolName}: ${previousFailureRejection}`);
      continue;
    }

    const command = dependencies.buildCommand({ args: preparedToolArgs, toolName: preparedToolName });
    const route = dependencies.isSilentReadOnlyCommand(command);
    traceEvents.push({
      action: 'tool_calls',
      details: { requiresApproval: route.requiresApproval, routeSummary: route.routeSummary },
      status: route.routeStatus,
      stepIndex: options.stepIndex,
      summary: `Permission route evaluated ${preparedToolName}.`,
      tool: preparedToolName,
      type: 'permission_routed',
    });
    if (!route.ok) {
      const isVisualObservation = preparedToolName === 'locate_screen_elements'
        || preparedToolName === 'summarize_visual_snapshot'
        || preparedToolName === 'execute_desktop_observation'
          && ['summarize_visual_snapshot', 'inspect_window_ui'].includes(
            typeof preparedToolArgs.action === 'string' ? preparedToolArgs.action : '',
          );
      if (isVisualObservation && route.routeStatus === 'notify' && !route.requiresApproval) {
        deferredCommands.push(command);
        continue;
      }
      rejectedLines.push(`tool=${preparedToolName}: not silent read-only (${route.routeSummary})`);
      continue;
    }
    runnableCommands.push(command);
  }

  return { deferredCommands, rejectedLines, runnableCommands, traceEvents };
}
