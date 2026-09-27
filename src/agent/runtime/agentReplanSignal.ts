import { type AgentRequestedActionKind } from './agentActionCoverage';
import {
  compactAgentPlanningSignalText,
  createAgentActionPrimitiveSignature,
  createAgentToolCallSignature,
  formatAgentStructuredCandidates,
  getAgentStructuredEvidence,
  getLatestAgentToolResult,
} from './agentPlanningSignalEvidence';
import {
  createAgentRankedRecoveryStrategies,
  type AgentRecoveryStrategyRankingDependencies,
} from './agentRecoveryStrategyRanking';
import {
  type AgentRuntimeStep,
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';

export interface AgentReplanSignalDependencies {
  recoveryStrategyDependencies: AgentRecoveryStrategyRankingDependencies;
}

function getLatestAgentReplanTaskUnderstanding(steps: AgentRuntimeStep[]) {
  return [...steps].reverse().find((step) => (
    step.understanding
    && (
      step.understanding.userNeed
      || step.understanding.successCriteria
      || step.understanding.completedGoals?.length
      || step.understanding.remainingGoals?.length
      || step.understanding.blockedGoals?.length
      || step.understanding.verificationStatus
      || step.understanding.verificationEvidence?.length
      || step.understanding.verificationGaps?.length
    )
  ))?.understanding ?? null;
}

function findLatestFailedAgentReplanToolCall(
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

function hasAgentReplanAttemptedOpenOrLaunch(toolResults: AgentRuntimeToolResultEntry[]) {
  return toolResults.some((entry) => {
    const toolName = entry.command.toolCall?.name;
    const input = entry.command.toolCall?.input ?? {};
    const action = typeof input.action === 'string'
      ? input.action.trim().toLowerCase().replace(/[-\s]+/gu, '_')
      : '';

    return toolName === 'launch_local_app'
      || toolName === 'open_resource'
      || toolName === 'focus_window'
      || (
        toolName === 'execute_desktop_action'
        && (
          action === 'launch_local_app'
          || action === 'open_resource'
          || action === 'focus_window'
          || action === 'open_app'
          || action === 'start_app'
        )
      );
  });
}

function hasAgentReplanObservedAppCandidate(entry: AgentRuntimeToolResultEntry) {
  const structuredEvidence = getAgentStructuredEvidence(entry);
  if (structuredEvidence?.finalWindow || structuredEvidence?.targetCandidates?.length) {
    return true;
  }

  const observationText = [
    entry.result.responseText ?? '',
    ...(entry.result.observations ?? []),
    ...(entry.result.receipt?.evidenceLines ?? []),
  ].join('\n');

  return /(?:^|\n)\s*(?:Installed|Taskbar pinned|Running)\s+\d+:/iu.test(observationText)
    || /(?:installed app|taskbar pinned app|running window):/iu.test(observationText);
}

function createAgentObservationOnlyOpenOrLaunchSignal(options: {
  requestedActionCoverage?: Iterable<AgentRequestedActionKind> | null;
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  if (
    !options.requestedActionCoverage
    || ![...options.requestedActionCoverage].includes('open-or-launch')
    || hasAgentReplanAttemptedOpenOrLaunch(options.toolResults)
  ) {
    return [];
  }

  const latestToolResult = getLatestAgentToolResult(options.toolResults);
  const latestToolName = latestToolResult?.command.toolCall?.name ?? '';
  if (
    !latestToolResult
    || ![
      'execute_desktop_observation',
      'get_active_window_info',
      'list_running_apps',
      'observe_windows_and_apps',
    ].includes(latestToolName)
    || latestToolResult.result.ok === false
  ) {
    return [];
  }

  const structuredEvidence = getAgentStructuredEvidence(latestToolResult);
  const targetCandidates = formatAgentStructuredCandidates(structuredEvidence?.targetCandidates);
  const query = latestToolResult.command.toolCall?.input?.query
    ?? latestToolResult.command.toolCall?.input?.target
    ?? latestToolResult.command.toolCall?.input?.name
    ?? '';
  const observedCandidate = hasAgentReplanObservedAppCandidate(latestToolResult);

  return [
    'reason=observation_only_for_open_or_launch_request',
    'requiredNextAction=open-or-launch',
    'suggestedTool=execute_desktop_action',
    `suggestedArgs=${compactAgentPlanningSignalText({
      action: 'launch_local_app',
      ...(query ? { target: query } : {}),
    }, 320)}`,
    query ? `observedQuery=${compactAgentPlanningSignalText(query, 160)}` : '',
    targetCandidates ? `targetCandidates=${compactAgentPlanningSignalText(targetCandidates, 520)}` : '',
    observedCandidate
      ? 'planningRule=The latest read-only app/window observation found candidate evidence but did not open, focus, or launch the requested app/resource. Use a primary action tool to launch/focus/open it next, or ask one short question if the candidate is ambiguous.'
      : 'planningRule=The latest read-only observation did not open, focus, or launch the requested app/resource. Use a primary action tool to perform the requested launch/focus/open action next, or ask one short question only if the target is ambiguous.',
  ].filter(Boolean);
}

export function createAgentReplanSignalText(options: {
  dependencies: AgentReplanSignalDependencies;
  requestedActionCoverage?: Iterable<AgentRequestedActionKind> | null;
  steps: AgentRuntimeStep[];
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  const latestToolResult = getLatestAgentToolResult(options.toolResults);
  const latestFailedToolResult = findLatestFailedAgentReplanToolCall(options.toolResults);
  const taskUnderstanding = getLatestAgentReplanTaskUnderstanding(options.steps);
  const lines: string[] = [];

  if (latestToolResult) {
    const latestToolName = latestToolResult.command.toolCall?.name ?? latestToolResult.command.kind;
    if (latestToolResult.result.ok === false) {
      const structuredEvidence = getAgentStructuredEvidence(latestToolResult);
      const targetCandidates = formatAgentStructuredCandidates(structuredEvidence?.targetCandidates);
      const actionCandidates = formatAgentStructuredCandidates(structuredEvidence?.actionCandidates);
      const rankedRecoveryStrategies = createAgentRankedRecoveryStrategies({
        dependencies: options.dependencies.recoveryStrategyDependencies,
        entry: latestToolResult,
        previousAttemptSignature: createAgentActionPrimitiveSignature(latestToolResult.command),
        toolResults: options.toolResults,
      });
      lines.push(
        'reason=latest_tool_failed',
        `failedTool=${latestToolName}`,
        `failedArgs=${compactAgentPlanningSignalText(latestToolResult.command.toolCall?.input ?? {}, 520)}`,
        latestToolResult.result.errorText
          ? `errorText=${compactAgentPlanningSignalText(latestToolResult.result.errorText, 420)}`
          : '',
        latestToolResult.result.followUp
          ? `followUp=${compactAgentPlanningSignalText(latestToolResult.result.followUp, 360)}`
          : '',
        latestToolResult.result.observations?.length
          ? `observations=${compactAgentPlanningSignalText(latestToolResult.result.observations.join(' | '), 520)}`
          : '',
        latestToolResult.result.stateSummary?.missingEvidence?.length
          ? `missingEvidence=${compactAgentPlanningSignalText(latestToolResult.result.stateSummary.missingEvidence.join(' | '), 520)}`
          : '',
        latestToolResult.result.stateSummary?.recommendedRecovery?.length
          ? `recommendedRecovery=${compactAgentPlanningSignalText(latestToolResult.result.stateSummary.recommendedRecovery.join(' | '), 520)}`
          : '',
        structuredEvidence?.visualActionReadiness ? `visualActionReadiness=${structuredEvidence.visualActionReadiness}` : '',
        structuredEvidence?.targetMatched ? `target=${structuredEvidence.targetMatched}` : '',
        structuredEvidence?.primaryAction ? `primaryAction=${structuredEvidence.primaryAction}` : '',
        targetCandidates ? `targetCandidates=${compactAgentPlanningSignalText(targetCandidates, 520)}` : '',
        actionCandidates ? `actionCandidates=${compactAgentPlanningSignalText(actionCandidates, 520)}` : '',
        rankedRecoveryStrategies ? `rankedRecoveryStrategies=${rankedRecoveryStrategies}` : '',
        'failureRecoveryRule=Treat the failed tool result as fresh evidence. Prefer a safe read-only recovery before retrying: focus a candidate crop, re-locate coordinates, read blocker/error/recovery controls, observe the active window/source, or ask one short necessary question. Do not repeat the same failed tool and args.',
        'requiredReplan=Do not repeat the same tool with the same args. Change the observation/action, change args, ask one short necessary question, or report a concrete blocker.',
      );
    } else if (
      latestToolResult.result.receipt?.status === 'unverified'
      || latestToolResult.result.assessment?.status === 'unverified'
      || latestToolResult.result.stateSummary?.missingEvidence?.length
      || latestToolResult.result.stateSummary?.recommendedRecovery?.length
    ) {
      const rankedRecoveryStrategies = createAgentRankedRecoveryStrategies({
        dependencies: options.dependencies.recoveryStrategyDependencies,
        entry: latestToolResult,
        previousAttemptSignature: createAgentActionPrimitiveSignature(latestToolResult.command),
        toolResults: options.toolResults,
      });
      lines.push(
        'reason=latest_tool_unverified',
        `tool=${latestToolName}`,
        latestToolResult.result.receipt?.status ? `receiptStatus=${latestToolResult.result.receipt.status}` : '',
        latestToolResult.result.assessment?.status ? `assessmentStatus=${latestToolResult.result.assessment.status}` : '',
        latestToolResult.result.stateSummary?.missingEvidence?.length
          ? `missingEvidence=${compactAgentPlanningSignalText(latestToolResult.result.stateSummary.missingEvidence.join(' | '), 520)}`
          : '',
        latestToolResult.result.stateSummary?.recommendedRecovery?.length
          ? `recommendedRecovery=${compactAgentPlanningSignalText(latestToolResult.result.stateSummary.recommendedRecovery.join(' | '), 520)}`
          : '',
        rankedRecoveryStrategies ? `rankedRecoveryStrategies=${rankedRecoveryStrategies}` : '',
        'requiredReplan=Use the missing evidence or recommended recovery before claiming completion.',
      );
    }
  } else if (latestFailedToolResult) {
    const failedToolName = latestFailedToolResult.command.toolCall?.name ?? latestFailedToolResult.command.kind;
    lines.push(
      'reason=previous_tool_failed',
      `failedTool=${failedToolName}`,
      `failedArgs=${compactAgentPlanningSignalText(latestFailedToolResult.command.toolCall?.input ?? {}, 520)}`,
      latestFailedToolResult.result.errorText
        ? `errorText=${compactAgentPlanningSignalText(latestFailedToolResult.result.errorText, 420)}`
        : '',
    );
  }

  if (taskUnderstanding?.remainingGoals?.length) {
    lines.push(
      `remainingGoals=${compactAgentPlanningSignalText(taskUnderstanding.remainingGoals.join(' | '), 520)}`,
      taskUnderstanding.completedGoals?.length
        ? `completedGoals=${compactAgentPlanningSignalText(taskUnderstanding.completedGoals.join(' | '), 420)}`
        : '',
    );
  }

  lines.push(...createAgentObservationOnlyOpenOrLaunchSignal({
    requestedActionCoverage: options.requestedActionCoverage,
    toolResults: options.toolResults,
  }));

  return lines.filter(Boolean).join('\n');
}
