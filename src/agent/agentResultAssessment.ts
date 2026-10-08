import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatFollowUpAction,
  type AgentChatResultAssessment,
} from './agentChatCommand';
import {
  isAgentReadOnlyObservationForVisualLocateRequest,
} from './agentReadOnlyActionCompletionEvidence';
import {
  resolveAgentResultFollowUpActions,
  hasAgentResultEvidence,
  isAgentReadOnlyObservationForDirectActionRequest,
  hasAgentReadOnlyObservationActionCompletionEvidence,
  compactAgentAssessmentEvidence,
  createAgentToolStateSummary,
} from './resultAssessment/resultEvidenceAssessment';
import {
  type AgentRunnableFollowUpAction,
  createAgentRecoveryFollowUpActions,
} from './resultAssessment/resultRecoveryActions';
export {
  resolveAgentResultFollowUpActions,
  createAgentToolStateSummary,
} from './resultAssessment/resultEvidenceAssessment';
export {
  createAgentRecoveryFollowUpActions,
} from './resultAssessment/resultRecoveryActions';

export function createAgentDecisionSummary(result: AgentChatCommandResult, followUpActions: AgentChatFollowUpAction[]) {
  const status = result.assessment?.status ?? 'unverified';
  if (status === 'completed') {
    return 'Result verified; ready for character reply';
  }

  if (status === 'can-continue') {
    return followUpActions.length
      ? `Can continue: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Result can continue, but no direct action was prepared';
  }

  if (status === 'needs-user') {
    return followUpActions.length
      ? `Needs user input: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Needs user input before continuing';
  }

  if (status === 'failed') {
    return followUpActions.length
      ? `Execution failed; recovery options: ${followUpActions.map((action) => action.label).join(', ')}`
      : 'Execution failed; no reliable recovery action is available';
  }

  return followUpActions.length
    ? `Result is not fully verified; recovery options: ${followUpActions.map((action) => action.label).join(', ')}`
    : 'Result is not fully verified; waiting for whether to continue';
}

function createAgentResultAssessment(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatResultAssessment {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const askUserAction = followUpActions.find((action) => action.kind === 'ask-user') ?? null;
  const runCommandAction = followUpActions.find((action): action is AgentRunnableFollowUpAction => (
    action.kind === 'run-command'
  )) ?? null;
  const nextStep = result.followUp ?? askUserAction?.prompt ?? runCommandAction?.label ?? null;
  const hasEvidence = hasAgentResultEvidence(result);
  const readOnlyActionObservation = isAgentReadOnlyObservationForDirectActionRequest(command);
  const readOnlyVisualLocateObservation = isAgentReadOnlyObservationForVisualLocateRequest(command);
  const readOnlyActionVerified = !(readOnlyActionObservation || readOnlyVisualLocateObservation)
    || hasAgentReadOnlyObservationActionCompletionEvidence(result);
  const failed = result.ok === false
    || result.receipt?.status === 'failed'
    || result.receipt?.status === 'blocked';
  const receiptUnverified = result.receipt?.status === 'unverified';
  const needsUser = Boolean(askUserAction || (failed && nextStep));
  const canContinue = Boolean(!failed && (runCommandAction || result.followUp));

  const status: AgentChatResultAssessment['status'] = failed
    ? needsUser ? 'needs-user' : 'failed'
    : needsUser
      ? 'needs-user'
      : receiptUnverified
        ? 'unverified'
        : canContinue
          ? 'can-continue'
          : hasEvidence && readOnlyActionVerified
            ? 'completed'
            : 'unverified';

  const summary = (() => {
    if (status === 'needs-user') {
      return nextStep ? `Needs user input: ${nextStep}` : 'Needs user input before continuing';
    }

    if (status === 'failed') {
      return result.errorText ?? 'Execution failed and no automatic next step is available.';
    }

    if (status === 'can-continue') {
      return nextStep ? `Current step completed; can continue: ${nextStep}` : 'Current step completed and provided a follow-up action';
    }

    if (status === 'unverified') {
      return 'Tool returned, but user-level verification evidence is insufficient';
    }

    return result.verification ?? 'Current step completed with tool verification evidence';
  })();

  return {
    evidence: compactAgentAssessmentEvidence([
      command.toolCall?.name ? `tool:${command.toolCall.name}` : `command:${command.kind}`,
      result.verification ? `verification:${result.verification}` : null,
      result.errorText ? `error:${result.errorText}` : null,
      result.responseText ? `result:${result.responseText}` : null,
      result.followUp ? `next:${result.followUp}` : null,
      ...(result.observations ?? []).map((observation) => `observation:${observation}`),
      ...(result.stateSummary?.observedState ?? []).map((item) => `observedState:${item}`),
      ...(result.stateSummary?.changedState ?? []).map((item) => `changedState:${item}`),
      ...(result.stateSummary?.verificationEvidence ?? []).map((item) => `verificationEvidence:${item}`),
      ...(result.stateSummary?.missingEvidence ?? []).map((item) => `missingEvidence:${item}`),
      ...(result.stateSummary?.recommendedRecovery ?? []).map((item) => `recommendedRecovery:${item}`),
    ]),
    nextStep,
    status,
    summary,
  };
}

function enrichAgentResultWithRecoveryActions(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const followUpActions = createAgentRecoveryFollowUpActions(command, result);
  const nextStep = result.followUp
    ?? result.assessment?.nextStep
    ?? (followUpActions.length ? createAgentDecisionSummary(result, followUpActions) : null);

  return {
    ...result,
    followUp: nextStep,
    followUpAction: followUpActions[0] ?? result.followUpAction ?? null,
    followUpActions: followUpActions.length ? followUpActions : result.followUpActions ?? null,
  };
}

export function assessAgentCommandResult(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  const statefulResult = {
    ...result,
    stateSummary: createAgentToolStateSummary(command, result),
  };
  const assessedResult = {
    ...statefulResult,
    assessment: statefulResult.assessment ?? createAgentResultAssessment(command, statefulResult),
  };
  const assessedStatefulResult = {
    ...assessedResult,
    stateSummary: createAgentToolStateSummary(command, assessedResult),
  };

  return enrichAgentResultWithRecoveryActions(command, assessedStatefulResult);
}
