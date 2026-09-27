import {
  compactAgentPlanningSignalText,
  createAgentActionPrimitiveSignature,
  getAgentActionEvidence,
} from './agentPlanningSignalEvidence';
import {
  createAgentRankedRecoveryStrategies,
  type AgentRecoveryStrategyRankingDependencies,
} from './agentRecoveryStrategyRanking';
import {
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEvent,
} from './agentRuntimeContract';
import {
  findAgentRepeatedActionOutcomeWindowMetric,
  findAgentRepeatedRecentToolResultSignatureMetrics,
} from './agentStuckSignatureMetrics';
import { createAgentGuardedTraceStuckSignalText } from './agentTraceStuckSignalGuard';

export interface AgentTraceStuckSignalDependencies {
  recoveryStrategyDependencies: AgentRecoveryStrategyRankingDependencies;
}

export function createAgentTraceStuckSignalText(options: {
  dependencies: AgentTraceStuckSignalDependencies;
  traceEvents: AgentRuntimeTraceEvent[];
  toolResults: AgentRuntimeToolResultEntry[];
}) {
  const lines: string[] = [];
  const recentTraceEvents = options.traceEvents.slice(-12);
  const recentToolResults = options.toolResults.slice(-6);
  const recentActionEvidence = recentToolResults
    .map((entry) => ({
      entry,
      evidence: getAgentActionEvidence(entry.result),
    }))
    .filter((item): item is {
      entry: AgentRuntimeToolResultEntry;
      evidence: NonNullable<ReturnType<typeof getAgentActionEvidence>>;
    } => Boolean(item.evidence));
  const incompleteActionEvidence = recentActionEvidence.filter(({ evidence }) => (
    evidence.outcome === 'no-op'
    || evidence.outcome === 'uncertain'
    || evidence.outcome === 'blocked'
  ));

  if (incompleteActionEvidence.length) {
    const latest = incompleteActionEvidence[incompleteActionEvidence.length - 1];
    const latestToolName = latest.entry.command.toolCall?.name ?? latest.entry.command.kind;
    const rankedRecoveryStrategies = createAgentRankedRecoveryStrategies({
      dependencies: options.dependencies.recoveryStrategyDependencies,
      entry: latest.entry,
      previousAttemptSignature: createAgentActionPrimitiveSignature(latest.entry.command),
      toolResults: options.toolResults,
    });
    lines.push(
      'reason=recent_action_evidence_not_completed',
      `actionOutcome=${latest.evidence.outcome}`,
      `actionTool=${latest.evidence.tool}`,
      latest.evidence.action ? `action=${latest.evidence.action}` : '',
      latest.evidence.targetRef?.label ? `target=${latest.evidence.targetRef.label}` : '',
      typeof latest.evidence.diff?.changed === 'boolean' ? `changed=${latest.evidence.diff.changed}` : '',
      latest.evidence.diff?.summary ? `diff=${compactAgentPlanningSignalText(latest.evidence.diff.summary, 360)}` : '',
      `latestTool=${latestToolName}`,
      `latestArgs=${compactAgentPlanningSignalText(latest.entry.command.toolCall?.input ?? {}, 520)}`,
      rankedRecoveryStrategies ? `rankedRecoveryStrategies=${rankedRecoveryStrategies}` : '',
      'requiredReplan=The last action evidence does not prove user-level success. Do not repeat the same action primitive without new evidence or changed args. Fill the evidence gap, choose a different safe observation/action, ask one short necessary question, or report a concrete blocker.',
    );

    const repeatedIncompleteActions = new Map<string, number>();
    for (const { entry, evidence } of incompleteActionEvidence) {
      const signature = createAgentActionPrimitiveSignature(entry.command);
      if (!signature) {
        continue;
      }

      repeatedIncompleteActions.set(
        `${signature}:${evidence.outcome}`,
        (repeatedIncompleteActions.get(`${signature}:${evidence.outcome}`) ?? 0) + 1,
      );
    }
    const repeatedIncompleteAction = [...repeatedIncompleteActions.entries()]
      .find(([, count]) => count >= 2);
    if (repeatedIncompleteAction) {
      lines.push(
        'reason=repeated_incomplete_action_primitive',
        `repeatCount=${repeatedIncompleteAction[1]}`,
        `actionPrimitiveSignature=${compactAgentPlanningSignalText(repeatedIncompleteAction[0], 520)}`,
        'loopRisk=High. A repeated action primitive produced incomplete evidence more than once.',
      );
    }
  }

  const repeatedActionOutcomeWindow = findAgentRepeatedActionOutcomeWindowMetric(options.toolResults);
  if (repeatedActionOutcomeWindow) {
    lines.push(
      'reason=repeated_action_outcome_window',
      `windowSize=${repeatedActionOutcomeWindow.windowSize}`,
      `repeatCount=${repeatedActionOutcomeWindow.repeatCount}`,
      `windowSignature=${compactAgentPlanningSignalText(repeatedActionOutcomeWindow.signature, 620)}`,
      'loopRisk=High. A recent action/outcome sequence repeated without enough completion evidence.',
      'requiredReplan=Treat this as advisory; change the evidence source, args, target, or report a concrete blocker instead of continuing the repeated pattern.',
    );
  }

  const repeatedRecentResults = findAgentRepeatedRecentToolResultSignatureMetrics(options.toolResults);
  const repeatedFailedResult = repeatedRecentResults.find(({ entry }) => entry.result.ok === false);
  if (repeatedFailedResult) {
    const toolName = repeatedFailedResult.entry.command.toolCall?.name ?? repeatedFailedResult.entry.command.kind;
    lines.push(
      'reason=repeated_failed_tool_signature',
      `tool=${toolName}`,
      `repeatCount=${repeatedFailedResult.count}`,
      `signature=${compactAgentPlanningSignalText(repeatedFailedResult.signature, 520)}`,
      repeatedFailedResult.entry.result.errorText
        ? `lastError=${compactAgentPlanningSignalText(repeatedFailedResult.entry.result.errorText, 420)}`
        : '',
      'requiredReplan=Do not run the same failed tool with the same args again. Change args/tool, gather different evidence, ask one necessary question, or stop with a concrete blocker.',
    );
  }

  const rejectedEvents = recentTraceEvents.filter((event) => (
    event.type === 'decision_rejected'
    || /(?:invalid|blocked|rejected|failed|permission-blocked)/iu.test(event.status ?? '')
  ));
  if (rejectedEvents.length) {
    const latestRejected = rejectedEvents[rejectedEvents.length - 1];
    lines.push(
      'reason=recent_trace_rejection',
      `eventType=${latestRejected.type}`,
      latestRejected.tool ? `tool=${latestRejected.tool}` : '',
      latestRejected.status ? `status=${latestRejected.status}` : '',
      `summary=${compactAgentPlanningSignalText(latestRejected.summary, 360)}`,
      'requiredReplan=Use the rejection as feedback. Fix schema/args, change the action, choose a safe observation, ask one short necessary question, or report the blocked policy with evidence.',
    );
  }

  const permissionBlocked = [...recentTraceEvents].reverse().find((event) => (
    event.type === 'permission_routed'
    && event.status === 'blocked'
  ));
  if (permissionBlocked) {
    lines.push(
      'reason=permission_route_blocked',
      permissionBlocked.tool ? `tool=${permissionBlocked.tool}` : '',
      `summary=${compactAgentPlanningSignalText(permissionBlocked.summary, 360)}`,
      'requiredReplan=Do not attempt to bypass the permission route. Choose an allowed alternative, ask the user for a safer scope, or final_answer as blocked with the policy evidence.',
    );
  }

  const recentFinishedTools = recentTraceEvents.filter((event) => event.type === 'tool_finished');
  const recentStartedTools = recentTraceEvents.filter((event) => event.type === 'tool_started');
  if (recentStartedTools.length >= 2 && recentFinishedTools.length === 0) {
    const latestStarted = recentStartedTools[recentStartedTools.length - 1];
    lines.push(
      'reason=tool_started_without_recent_finish',
      latestStarted.tool ? `tool=${latestStarted.tool}` : '',
      latestStarted.status ? `status=${latestStarted.status}` : '',
      'stuckRisk=The recent trace has tool start events without a matching finished event yet. Avoid assuming the tool outcome is known.',
    );
  }

  return lines.length
    ? createAgentGuardedTraceStuckSignalText(lines)
    : '';
}
