import { type AgentRuntimeResult as AgentSessionV2Result, type AgentRuntimeToolResultEntry as AgentSessionV2ToolResultEntry } from '../runtime/agentRuntimeContract';
import { evaluateAgentActionRuntime, updateAgentActionRuntimeQueue, type AgentActionRuntimeQueue, type AgentActionRuntimeDependencies } from '../agentActionRuntime';
import { decideAgentRecoveryTrigger, type AgentRecoveryTriggerDecision } from '../runtime/agentRecoveryController';
import { createAgentPostActionTerminalStoppedHistoryLine } from '../runtime/agentExecutionProgressSignals';
import { type AgentPostActionTerminalEvaluation } from '../runtime/agentPostActionTerminalEvaluator';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';
import { type createAgentProductionSingleToolExecution } from './singleToolExecution';
import { type createAgentProductionObservationReuse } from './observationReuse';

type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
interface ActionOutcomeLifecycleDependencies extends Pick<VerificationDependencies, 'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'appendTraceEvent'> {
  actionRuntimeDependencies: AgentActionRuntimeDependencies;
  createFinalResult: Parameters<typeof createAgentProductionSingleToolExecution>[0]['createFinalResult'];
  isParallelDedupeResult: ReturnType<typeof createAgentProductionObservationReuse>['isAgentProductionParallelDedupeResult'];
  appendRuntimeTerminal: (evaluation: AgentPostActionTerminalEvaluation) => void;
}

export function createAgentProductionActionOutcomeLifecycle(dependencies: ActionOutcomeLifecycleDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, actionRuntimeDependencies, createFinalResult,
    isParallelDedupeResult: isAgentSessionV2ParallelDedupeResult,
    appendRuntimeTerminal: appendV3PilotShadowRuntimeTerminal,
  } = dependencies;
  let actionRuntimeQueue: AgentActionRuntimeQueue = {
    currentAction: null,
  };
  const recordActionRuntimeDecision = (options: {
    decision: ReturnType<typeof evaluateAgentActionRuntime>;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    source: Parameters<typeof updateAgentActionRuntimeQueue>[0]['source'];
  }) => {
    actionRuntimeQueue = updateAgentActionRuntimeQueue({
      decision: options.decision,
      latestEntry: options.latestEntry,
      queue: actionRuntimeQueue,
      source: options.source,
    });
    const currentAction = actionRuntimeQueue.currentAction;
    if (!currentAction) {
      return;
    }

    historyLines.push([
      'ActionRuntime current action:',
      `id=${currentAction.id}`,
      `source=${currentAction.latestSource}`,
      `status=${currentAction.status}`,
      `reason=${currentAction.latestReason}`,
      currentAction.latestReason === 'missing-requested-coverage'
        ? 'taskFlow=continuation-required'
        : '',
      `postActionState=${currentAction.postActionState}`,
      `events=${currentAction.entries.length}`,
    ].filter(Boolean).join('\n'));
  };
  const recordRecoveryTriggerDecision = (options: {
    actionDecision: ReturnType<typeof evaluateAgentActionRuntime>;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    triggerDecision: AgentRecoveryTriggerDecision;
  }) => {
    historyLines.push([
      'Recovery Controller trigger decision:',
      `action=${options.triggerDecision.action}`,
      `reason=${options.triggerDecision.reason}`,
      `actionStatus=${options.actionDecision.status}`,
      `postActionState=${options.actionDecision.postActionState}`,
      `latestTool=${options.latestEntry?.command.toolCall?.name ?? options.latestEntry?.command.kind ?? 'none'}`,
      `receiptStatus=${options.latestEntry?.result.receipt?.status ?? 'none'}`,
    ].join('\n'));
  };
  const decideRecoveryTrigger = (options: {
    actionDecision?: ReturnType<typeof evaluateAgentActionRuntime> | null;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    permissionState?: 'clear' | 'waiting-approval' | 'blocked';
  }): AgentRecoveryTriggerDecision => {
    const actionDecision = options.actionDecision ?? evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry: options.latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    const triggerDecision = decideAgentRecoveryTrigger({
      actionStatus: actionDecision.status,
      coverage: actionDecision.actionAttempted !== false && actionDecision.missingCoverage
        ? 'missing'
        : 'unknown',
      latestTool: options.latestEntry?.command.toolCall?.name
        ?? options.latestEntry?.command.kind
        ?? null,
      missingEvidence: actionDecision.reason === 'insufficient-evidence'
        || actionDecision.reason === 'no-latest-evidence',
      permissionState: options.permissionState ?? 'clear',
      postActionState: actionDecision.postActionState,
      receiptStatus: options.latestEntry?.result.receipt?.status ?? null,
      resultOk: options.latestEntry ? options.latestEntry.result.ok !== false : null,
      terminalStatus: actionDecision.terminalEvaluation?.status ?? null,
    });
    recordRecoveryTriggerDecision({
      actionDecision,
      latestEntry: options.latestEntry,
      triggerDecision,
    });
    return triggerDecision;
  };
  const createPostActionTerminalResultFromEvaluation = (
    latestEntry: AgentSessionV2ToolResultEntry,
    evaluation: AgentPostActionTerminalEvaluation,
    triggerStepIndex: number,
    sourceLabel: string,
  ) => {
    historyLines.push(createAgentPostActionTerminalStoppedHistoryLine({
      historyReason: evaluation.historyReason,
      postActionState: evaluation.postActionState,
      sourceLabel,
      status: evaluation.status,
      triggerStepIndex,
    }));
    steps.push({
      action: evaluation.stepAction,
      index: steps.length + 1,
      reason: evaluation.stepReason,
      summary: evaluation.finalAnswer,
      tool: latestEntry.command.toolCall?.name ?? latestEntry.command.kind,
    });
    appendV3PilotShadowRuntimeTerminal(evaluation);
    return createFinalResult({
      finalAnswer: evaluation.finalAnswer,
      status: evaluation.status,
    });
  };
  // A successful read-only result only finishes the task when it is the whole
  // task. If the model planned other goals, or already finished some, the
  // answer has to come from the model; otherwise "screen and system info"
  // stops after one observation and answers with only that result.
  const latestDecisionSpansSeveralGoals = () => {
    const understanding = [...steps].reverse()
      .find((step) => step.action === 'tool_call' || step.action === 'tool_calls')
      ?.understanding;
    return (understanding?.remainingGoals?.length ?? 0) > 1
      || (understanding?.completedGoals?.length ?? 0) > 0;
  };
  const createReadOnlyObservationTerminalResult = (
    latestEntry: AgentSessionV2ToolResultEntry,
    triggerStepIndex: number,
    sourceLabel: string,
    batchEntries: AgentSessionV2ToolResultEntry[] = [latestEntry],
  ) => {
    // A parallel batch completes from all of its successful results, not just
    // the first; failed fallbacks and dedupe placeholders are left out.
    const finalAnswer = batchEntries
      .filter((entry) => entry.result.ok !== false && !isAgentSessionV2ParallelDedupeResult(entry))
      .map((entry) => entry.result.responseText?.trim() || entry.result.verification?.trim() || '')
      .filter(Boolean)
      .join('\n')
      || 'Read-only observation completed.';
    historyLines.push([
      `Step ${triggerStepIndex} Runtime read-only terminal:`,
      `source=${sourceLabel}`,
      'status=completed',
      'reason=successful read-only evidence satisfies the task without another model turn',
    ].join('\n'));
    steps.push({
      action: 'final_answer',
      index: steps.length + 1,
      reason: 'Runtime completed the read-only task from successful observation evidence.',
      summary: finalAnswer,
      tool: latestEntry.command.toolCall?.name ?? latestEntry.command.kind,
    });
    appendTraceEvent({
      action: 'final_answer',
      status: 'completed',
      stepIndex: steps.length,
      summary: 'Runtime completed successful read-only observation without another model decision.',
      type: 'final_answer',
    });
    appendV3PilotShadowRuntimeTerminal({
      finalAnswer,
      kind: 'completed',
      postActionState: '',
      status: 'completed',
      stepAction: 'final_answer',
      stepReason: 'Runtime completed the read-only task from successful observation evidence.',
    });
    return createFinalResult({
      finalAnswer,
      status: 'completed',
    });
  };
  const createPostActionTerminalResult = (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
  ) => {
    const actionRuntimeDecision = evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: actionRuntimeDecision,
      latestEntry,
      source: 'post-action-terminal',
    });
    const evaluation = actionRuntimeDecision.terminalEvaluation ?? null;
    if (!latestEntry || !evaluation) {
      return null;
    }
    return createPostActionTerminalResultFromEvaluation(
      latestEntry,
      evaluation,
      triggerStepIndex,
      sourceLabel,
    );
  };
  const createRecoveryTriggerStopResult = (options: {
    decision: AgentRecoveryTriggerDecision;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    sourceLabel: string;
    triggerStepIndex: number;
  }): AgentSessionV2Result | null => {
    if (options.decision.action !== 'stop-needs-user') {
      return null;
    }
    return createPostActionTerminalResult(
      options.latestEntry,
      options.triggerStepIndex,
      `${options.sourceLabel}:recovery-trigger-stop`,
    ) ?? createFinalResult({
          finalAnswer: '自动恢复已停止：最新证据表明需要用户处理，例如登录、验证码或其他确认。',
      status: 'needs-user',
    });
  };
  return { recordActionRuntimeDecision, recordRecoveryTriggerDecision, decideRecoveryTrigger, createPostActionTerminalResultFromEvaluation, latestDecisionSpansSeveralGoals, createReadOnlyObservationTerminalResult, createPostActionTerminalResult, createRecoveryTriggerStopResult };
}
