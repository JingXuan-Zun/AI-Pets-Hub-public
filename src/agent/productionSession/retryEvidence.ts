import { type AgentChatCommand, type AgentToolCallName } from '../agentChatCommand';
import { type AgentRuntimeStep, type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { createAgentActionPrimitiveSignature, createAgentToolCallSignature, getAgentPostActionState, getAgentStructuredEvidence, isAgentActionResultTool } from '../runtime/agentPlanningSignalEvidence';
import { inferAgentSelectionPostActionStateFromStructuredEvidence } from '../runtime/agentPostActionStateResolver';

const AGENT_PRODUCTION_RETRY_RECOVERABLE_UNVERIFIED_TOOL_NAMES = new Set<AgentToolCallName>([
  'control_browser',
  'execute_desktop_observation',
  'execute_desktop_action',
  'execute_desktop_input',
  'execute_desktop_sequence',
  'execute_file_management_action',
  'locate_screen_elements',
  'manage_game_companion_loop',
  'organize_desktop_icons',
  'remember_local_app',
  'run_controlled_command',
  'run_local_project_action',
]);

interface AgentProductionRetryEvidenceDependencies {
  getCommandClickPoints: (command: AgentChatCommand) => Array<{ x: number; y: number }>;
  getCommandDesktopInputActions: (command: AgentChatCommand) => string[];
  isNearPreviousActionPoint: (point: { x: number; y: number }, previousPoints: Array<{ x: number; y: number }>) => boolean;
}

export function createAgentProductionRetryEvidence(dependencies: AgentProductionRetryEvidenceDependencies) {
  const {
    getCommandClickPoints: getAgentSessionV2CommandClickPoints,
    getCommandDesktopInputActions: getAgentSessionV2CommandDesktopInputActions,
    isNearPreviousActionPoint: isAgentSessionV2NearPreviousActionPoint,
  } = dependencies;

  function findLatestFailedAgentProductionRetryToolCall(
    toolResults: AgentRuntimeToolResultEntry[],
    toolName?: string | null,
    args?: Record<string, unknown> | null,
  ) {
    const signature = toolName && args
      ? createAgentToolCallSignature(toolName, args)
      : null;
    return [...toolResults].reverse().find((entry) => {
      if (entry.result.ok !== false || !entry.command.toolCall?.name) {
        return false;
      }

      if (!signature) {
        return true;
      }

      return entry.command.toolCall.name === toolName
        && createAgentToolCallSignature(
          entry.command.toolCall.name,
          entry.command.toolCall.input ?? {},
        ) === signature;
    }) ?? null;
  }

  function countFailedAgentProductionRetryToolCalls(
    toolResults: AgentRuntimeToolResultEntry[],
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const signature = createAgentToolCallSignature(toolName, args);

    return toolResults.filter((entry) => (
      entry.result.ok === false
      && entry.command.toolCall?.name === toolName
      && createAgentToolCallSignature(
        entry.command.toolCall.name,
        entry.command.toolCall.input ?? {},
      ) === signature
    )).length;
  }

  function countAgentProductionRetryRepeatedFailedToolCallRejections(
    steps: AgentRuntimeStep[],
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const signature = createAgentToolCallSignature(toolName, args);

    return steps.filter((step) => (
      step.tool === toolName
      && step.errorText?.includes('Rejected repeated failed tool call before execution')
      && createAgentToolCallSignature(
        toolName,
        step.args ?? {},
      ) === signature
    )).length;
  }

  function isAgentProductionRetryRecoverableUnverifiedToolResult(
    entry: AgentRuntimeToolResultEntry | null,
  ): entry is AgentRuntimeToolResultEntry {
    const toolName = entry?.command.toolCall?.name ?? null;
    if (
      !entry
      || !toolName
      || !AGENT_PRODUCTION_RETRY_RECOVERABLE_UNVERIFIED_TOOL_NAMES.has(toolName)
    ) {
      return false;
    }

    const structuredEvidence = getAgentStructuredEvidence(entry);
    if (entry.result.ok === false) {
      return Boolean(
        structuredEvidence?.postActionRecovery?.nextTool
          || entry.result.stateSummary?.recommendedRecovery?.length,
      );
    }

    return entry.result.receipt?.status === 'unverified'
      || entry.result.assessment?.status === 'unverified'
      || Boolean(inferAgentSelectionPostActionStateFromStructuredEvidence(entry))
      || Boolean(entry.result.stateSummary?.missingEvidence?.length)
      || Boolean(entry.result.stateSummary?.recommendedRecovery?.length);
  }

  function findLatestAgentProductionRetryRecoverableUnverifiedActionAttempt(
    toolResults: AgentRuntimeToolResultEntry[],
  ) {
    return [...toolResults].reverse().find((entry) => (
      isAgentActionResultTool(entry.command)
      && isAgentProductionRetryRecoverableUnverifiedToolResult(entry)
    )) ?? null;
  }

  function findAgentProductionRetryRepeatedUnverifiedActionRetry(options: {
    command: AgentChatCommand;
    toolResults: AgentRuntimeToolResultEntry[];
  }) {
    const candidateSignature = createAgentActionPrimitiveSignature(options.command);
    const previousAttempt = findLatestAgentProductionRetryRecoverableUnverifiedActionAttempt(options.toolResults);
    if (!previousAttempt) {
      return null;
    }

    const previousSignature = createAgentActionPrimitiveSignature(previousAttempt.command);
    if (candidateSignature && previousSignature === candidateSignature) {
      return {
        candidateSignature,
        previousAttempt,
      };
    }

    const candidatePoints = getAgentSessionV2CommandClickPoints(options.command);
    const previousPoints = getAgentSessionV2CommandClickPoints(previousAttempt.command);
    const candidateActions = getAgentSessionV2CommandDesktopInputActions(options.command);
    const previousActions = getAgentSessionV2CommandDesktopInputActions(previousAttempt.command);
    const repeatedClickLikeAction = candidateActions.some((action) => (
      (action === 'click' || action === 'double_click')
      && previousActions.includes(action)
    ));
    if (
      repeatedClickLikeAction
      && candidatePoints.length
      && previousPoints.length
      && candidatePoints.some((point) => isAgentSessionV2NearPreviousActionPoint(point, previousPoints))
    ) {
      return {
        candidateSignature: candidateSignature
          ?? `near-click:${candidatePoints.map((point) => `${point.x},${point.y}`).join('|')}`,
        previousAttempt,
      };
    }

    return null;
  }

  function countAgentProductionRetryRepeatedUnverifiedActionRetryRejections(
    steps: AgentRuntimeStep[],
    command: AgentChatCommand,
  ) {
    const signature = createAgentActionPrimitiveSignature(command);
    if (!signature) {
      return 0;
    }

    return steps.filter((step) => (
      step.errorText?.includes('Rejected repeated unverified action retry before approval')
      && step.errorText.includes(signature)
    )).length;
  }

  function hasRecentAgentProductionRetryRepeatedUnverifiedActionRetryRejection(
    steps: AgentRuntimeStep[],
  ) {
    return steps
      .slice(-4)
      .some((step) => (
        step.errorText?.includes('Rejected repeated unverified action retry before approval')
        || step.summary?.includes('Rejected repeated unverified action retry before approval')
      ));
  }

  function createAgentProductionRetryRepeatedUnverifiedActionRetryAnswer(
    command: AgentChatCommand,
    previousAttempt: AgentRuntimeToolResultEntry,
  ) {
    const toolName = command.toolCall?.name ?? command.kind;
    const previousState = getAgentPostActionState(previousAttempt) || 'unverified';
    return [
      `I stopped before repeating the same unverified approval-required action for ${toolName}.`,
      `Previous post-action state: ${previousState}.`,
      'To continue safely, the Agent needs a different target, fresh observation, or a clear blocker/login/permission step handled first.',
    ].join('\n');
  }

  return {
    findLatestFailedAgentProductionRetryToolCall,
    countFailedAgentProductionRetryToolCalls,
    countAgentProductionRetryRepeatedFailedToolCallRejections,
    isAgentProductionRetryRecoverableUnverifiedToolResult,
    findLatestAgentProductionRetryRecoverableUnverifiedActionAttempt,
    findAgentProductionRetryRepeatedUnverifiedActionRetry,
    countAgentProductionRetryRepeatedUnverifiedActionRetryRejections,
    hasRecentAgentProductionRetryRepeatedUnverifiedActionRetryRejection,
    createAgentProductionRetryRepeatedUnverifiedActionRetryAnswer,
  };
}
