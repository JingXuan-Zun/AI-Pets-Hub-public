import { buildAgentPermissionRoute, isAgentPermissionRouteSilentReadOnly } from '../agentPermissionRouter';
import { type AgentModelDecision as AgentProductionDecision } from '../runtime/agentModelDecisionRuntime';
import {
  type AgentRuntimeToolResultEntry as AgentProductionToolResultEntry,
  type AgentRuntimeStep as AgentProductionStep,
} from '../runtime/agentRuntimeContract';
import {
  createAgentRequestedActionCoverage,
  createAgentAttemptedActionCoverage,
  hasAgentDirectActionIntent,
  hasAgentEffectiveDirectActionIntent,
  isAgentActionKindCovered,
  normalizeAgentIntentText,
  type AgentActionCoverageDependencies,
} from '../runtime/agentActionCoverage';
import { AGENT_TRANSITIONAL_POST_ACTION_STATES, getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { isAgentVerifiedTargetWindowObservation } from '../runtime/agentCommandEvidencePredicates';
import {
  isAgentDesktopAutoRecoveryReadCommand,
  isAgentDesktopAutoRecoveryWaitCapReadCommand,
  findLatestAgentDesktopAutoRecoverySourceEntry,
  resolveAgentDesktopAutoRecoveryMaxWaits,
  hasAgentDesktopAutoRecoveryWaitBudgetRemaining,
} from '../capabilities/agentDesktopRecoveryObservationBuilder';

interface AgentProductionFinalEvidenceGuardDependencies {
  actionCoverage: AgentActionCoverageDependencies;
  resolveRecoveryPostActionState: (options: {
    entry: AgentProductionToolResultEntry | null;
    sourceText: string;
    userGoal: string;
  }) => string;
  isRecoverableUnverifiedToolResult: (entry: AgentProductionToolResultEntry | null) => boolean;
  isPrematureActionConfirmationText: (value: unknown) => boolean;
  hasClearActionableVisualEvidence: (entry: AgentProductionToolResultEntry | null) => boolean;
}

export function createAgentProductionFinalEvidenceGuards(dependencies: AgentProductionFinalEvidenceGuardDependencies) {
  const {
    actionCoverage: agentSessionV2ActionCoverageDependencies,
    resolveRecoveryPostActionState: resolveAgentRecoveryPostActionState,
    isRecoverableUnverifiedToolResult: isAgentSessionV2RecoverableUnverifiedToolResult,
    isPrematureActionConfirmationText: isAgentSessionV2PrematureActionConfirmationText,
    hasClearActionableVisualEvidence: hasAgentSessionV2ClearActionableVisualEvidence,
  } = dependencies;

  function isAgentProductionBlockedFinalWithEvidence(decision: AgentProductionDecision) {
    return Boolean(decision.understanding?.blockedGoals?.length)
      || (
        decision.understanding?.verificationStatus === 'blocked'
        && Boolean(
          decision.understanding.verificationEvidence?.length
          || decision.understanding.verificationGaps?.length
        )
      );
  }

  function findAgentProductionMissingRequestedActionCoverage(options: {
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    const requestedCoverage = createAgentRequestedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      sourceText: options.sourceText,
      userGoal: options.userGoal,
    });
    if (!requestedCoverage.size) {
      return null;
    }

    const attemptedCoverage = createAgentAttemptedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      toolResults: options.toolResults,
    });
    const missingCoverage = [...requestedCoverage].filter((kind) => (
      !isAgentActionKindCovered(kind, attemptedCoverage)
    ));
    if (!missingCoverage.length) {
      return null;
    }

    return {
      attemptedCoverage,
      missingCoverage,
      requestedCoverage,
    };
  }

  function shouldRejectAgentProductionUnattemptedRequestedActionFinal(options: {
    decision: AgentProductionDecision;
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    if (
      !hasAgentDirectActionIntent(options.sourceText, options.userGoal)
      || isAgentProductionBlockedFinalWithEvidence(options.decision)
    ) {
      return null;
    }

    return findAgentProductionMissingRequestedActionCoverage(options);
  }

  function isAgentProductionSilentReadOnlyToolResult(entry: AgentProductionToolResultEntry) {
    const route = buildAgentPermissionRoute(entry.command);
    return isAgentPermissionRouteSilentReadOnly(route);
  }

  function isAgentProductionSatisfiedActionFinal(decision: AgentProductionDecision) {
    if (decision.understanding?.verificationStatus === 'satisfied') {
      return true;
    }

    const text = normalizeAgentIntentText(
      decision.message ?? '',
      ...(decision.understanding?.completedGoals ?? []),
      ...(decision.understanding?.verificationEvidence ?? []),
    );
    return /(?:\u5df2\u7ecf|\u5df2|\u6210\u529f|\u5b8c\u6210|\u6253\u5f00\u6210\u529f|\u542f\u52a8\u6210\u529f|done|completed|succeeded|success|opened|launched|started|clicked|pressed|moved|closed)/iu.test(text);
  }

  function hasAgentProductionConcreteVerifiedOutcomeEvidence(
    toolResults: AgentProductionToolResultEntry[],
  ) {
    if (!toolResults.length) {
      return false;
    }

    const attemptedCoverage = createAgentAttemptedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      toolResults,
    });
    if (!attemptedCoverage.size) {
      return false;
    }

    const latestEntry = toolResults[toolResults.length - 1] ?? null;
    if (!latestEntry || latestEntry.result.ok === false) {
      return false;
    }

    if (isAgentVerifiedTargetWindowObservation(latestEntry)) {
      return true;
    }

    const evidenceText = normalizeAgentIntentText(
      latestEntry.result.verification ?? '',
      latestEntry.result.responseText ?? '',
      ...(latestEntry.result.observations ?? []),
      ...(latestEntry.result.stateSummary?.verificationEvidence ?? []),
      ...(latestEntry.result.receipt?.evidenceLines ?? []),
    );
    return /(?:verified|confirmed|belongs\s+to|on\s+(?:the\s+)?(?:secondary|primary)\s+display|target\s+(?:is\s+)?(?:open|opened|launched|started)|\u5df2(?:\u9a8c\u8bc1|\u786e\u8ba4)|\u9a8c\u8bc1(?:\u6210\u529f|\u901a\u8fc7)|\u5728(?:\u4e3b|\u526f)\u5c4f|\u5c5e\u4e8e(?:\u4e3b|\u526f)\u5c4f)/iu.test(evidenceText);
  }

  function shouldRejectAgentProductionReadonlyObservationFinal(options: {
    decision: AgentProductionDecision;
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    if (
      !hasAgentEffectiveDirectActionIntent(options.sourceText, options.userGoal)
      || isAgentProductionBlockedFinalWithEvidence(options.decision)
      || !isAgentProductionSatisfiedActionFinal(options.decision)
    ) {
      return false;
    }

    const attemptedCoverage = createAgentAttemptedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      toolResults: options.toolResults,
    });
    if (attemptedCoverage.size > 0) {
      return false;
    }

    return options.toolResults.length > 0
      && options.toolResults.every(isAgentProductionSilentReadOnlyToolResult);
  }


  function shouldAllowAgentProductionCappedAutoRecoveryFinal(
    decision: AgentProductionDecision,
    latestEntry: AgentProductionToolResultEntry | null,
    toolResults: AgentProductionToolResultEntry[],
    sourceText: string,
    userGoal: string,
  ) {
    const isBlockedFinalWithEvidence = decision.understanding?.verificationStatus === 'blocked'
      && !decision.understanding?.remainingGoals?.length
      && Boolean(decision.understanding.verificationEvidence?.length);
    if (!isBlockedFinalWithEvidence) {
      return false;
    }

    if (latestEntry && isAgentDesktopAutoRecoveryReadCommand(latestEntry.command)) {
      const latestPostActionState = resolveAgentRecoveryPostActionState({
        entry: latestEntry,
        sourceText,
        userGoal,
      });
      if (
        latestPostActionState === 'blocked'
        || latestPostActionState === 'error'
        || latestPostActionState === 'login_required'
        || latestPostActionState === 'unchanged'
        || latestPostActionState === 'unknown'
      ) {
        return true;
      }
    }

    const sourceEntry = latestEntry && isAgentDesktopAutoRecoveryWaitCapReadCommand(latestEntry.command)
      ? findLatestAgentDesktopAutoRecoverySourceEntry(toolResults.slice(0, -1))
      : latestEntry;
    const postActionState = resolveAgentRecoveryPostActionState({
      entry: sourceEntry,
      sourceText,
      userGoal,
    });
    if (
      !sourceEntry
      || resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, sourceEntry, toolResults) <= 0
      || hasAgentDesktopAutoRecoveryWaitBudgetRemaining(sourceEntry, toolResults)
    ) {
      return false;
    }

    return true;
  }

  function shouldRejectAgentProductionRecoverableUnverifiedAskUser(options: {
    decisionMessage?: string | null;
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    const latestToolResult = getLatestAgentToolResult(options.toolResults);
    if (
      !(
        hasAgentDirectActionIntent(options.sourceText, options.userGoal)
        && isAgentSessionV2RecoverableUnverifiedToolResult(latestToolResult)
        && AGENT_TRANSITIONAL_POST_ACTION_STATES.has(
          resolveAgentRecoveryPostActionState({
            entry: latestToolResult,
            sourceText: options.sourceText,
            userGoal: options.userGoal,
          }),
        )
      )
    ) {
      return false;
    }

    if (isAgentSessionV2PrematureActionConfirmationText(options.decisionMessage)) {
      return true;
    }

    return Boolean(latestToolResult)
      && isAgentSessionV2RecoverableUnverifiedToolResult(latestToolResult)
      && hasAgentDesktopAutoRecoveryWaitBudgetRemaining(latestToolResult, options.toolResults);
  }


  function shouldRejectAgentProductionPrematureActionConfirmation(options: {
    decisionMessage?: string;
    sourceText: string;
    toolResults: AgentProductionToolResultEntry[];
    userGoal: string;
  }) {
    return hasAgentDirectActionIntent(options.sourceText, options.userGoal)
      && isAgentSessionV2PrematureActionConfirmationText(options.decisionMessage)
      && hasAgentSessionV2ClearActionableVisualEvidence(
        getLatestAgentToolResult(options.toolResults),
      );
  }


  function shouldRejectAgentProductionIncompleteTaskProgressFinal(
    decision: AgentProductionDecision,
  ) {
    return Boolean(decision.understanding?.remainingGoals?.length);
  }

  // The read-only terminal answers directly from the observation(s) just
  // collected. That only fits when they are the task's whole evidence and the
  // model's latest plan has no goals beyond them; otherwise the model must keep
  // planning or compose the answer from earlier evidence too.
  function canAgentProductionCompleteFromLatestReadOnlyObservations(
    steps: AgentProductionStep[],
    toolResults: AgentProductionToolResultEntry[],
    observationCount: number,
  ) {
    const remainingGoals = [...steps].reverse()
      .find((step) => step.understanding?.remainingGoals)
      ?.understanding?.remainingGoals ?? [];
    return toolResults.length <= observationCount
      && remainingGoals.length <= observationCount;
  }

  function shouldRejectAgentProductionUnverifiedResultFinal(options: {
    decision: AgentProductionDecision;
    toolResults: AgentProductionToolResultEntry[];
  }) {
    const { decision } = options;
    const status = decision.understanding?.verificationStatus;
    if (
      !status
      && hasAgentProductionConcreteVerifiedOutcomeEvidence(options.toolResults)
    ) {
      return false;
    }

    if (status === 'partial' || status === 'unknown') {
      return true;
    }

    if (
      (status === 'satisfied' || status === 'blocked')
      && !decision.understanding?.verificationEvidence?.length
    ) {
      return true;
    }

    return false;
  }

  return {
    findAgentProductionMissingRequestedActionCoverage,
    shouldRejectAgentProductionUnattemptedRequestedActionFinal,
    isAgentProductionSilentReadOnlyToolResult,
    shouldRejectAgentProductionReadonlyObservationFinal,
    shouldAllowAgentProductionCappedAutoRecoveryFinal,
    shouldRejectAgentProductionRecoverableUnverifiedAskUser,
    shouldRejectAgentProductionPrematureActionConfirmation,
    shouldRejectAgentProductionIncompleteTaskProgressFinal,
    canAgentProductionCompleteFromLatestReadOnlyObservations,
    shouldRejectAgentProductionUnverifiedResultFinal,
  };
}
