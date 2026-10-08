import { createAgentProductionVisualInputFallback } from './visualInputFallback';
import {
  isAgentProductionInvokableUiCandidate as isAgentSessionV2InvokableUiCandidate,
  inferAgentProductionWindowUiAction as inferAgentSessionV2WindowUiAction,
  isAgentProductionWindowUiSetValueIntentWithoutValue as isAgentSessionV2WindowUiSetValueIntentWithoutValue,
  hasAgentProductionClearInvokableUiCandidateEvidence as hasAgentSessionV2ClearInvokableUiCandidateEvidence,
} from "./windowUiActionIntent";
import {
  isAgentVisualLauncherVerificationBlocking as isAgentSessionV2LauncherVerificationBlocking,
  isAgentVisualUsefulPrimaryAction as isAgentSessionV2UsefulPrimaryAction,
  hasAgentVisualSafeLoginContinuationApprovalEvidence as hasAgentSessionV2SafeLoginContinuationApprovalEvidence,
  createAgentEffectiveVisualActionEvidence as createAgentSessionV2EffectiveVisualActionEvidence,
  hasAgentApproximateVisualEvidence as hasAgentSessionV2ApproximateVisualEvidence,
  collectAgentVisualApprovalResultText as collectAgentSessionV2VisualApprovalResultText,
} from "./visualCandidateEvidence";
import { isAgentVisualPointInsideActionableArea as hasAgentSessionV2PointInsideActionableArea } from "./visualCoordinates";
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
} from "../agentChatCommand";
import { evaluateAgentVisualSampleConsensus } from "../agentVisualTargetVerification";
import { buildAgentPermissionRoute } from "../agentPermissionRouter";
import { getAgentStructuredEvidence as getAgentStructuredEvidence } from "../runtime/agentPlanningSignalEvidence";
import {
  createAgentVisualActionApprovalReason,
  createAgentVisualInvokeApprovalReason,
} from "../runtime/agentApprovalReasonSignals";
import { hasAgentAuthenticationHardGateCue } from "../runtime/agentAuthenticationGate";
import { hasAgentDirectActionIntent as hasAgentDirectActionIntent } from "../runtime/agentActionCoverage";
import { type AgentRuntimeToolResultEntry, type AgentRuntimePendingApproval } from '../runtime/agentRuntimeContract';
import { type createAgentProductionVisualRetryEvidence } from './visualRetryEvidence';
import { type createAgentProductionVisualCandidateSelection } from './visualCandidateSelection';
import { type createAgentProductionVisualSequenceCommands } from './visualSequenceCommands';

export function createAgentProductionVisualApproval(options: {
  retryEvidence: ReturnType<typeof createAgentProductionVisualRetryEvidence>;
  candidateSelection: ReturnType<typeof createAgentProductionVisualCandidateSelection>;
  sequenceCommands: ReturnType<typeof createAgentProductionVisualSequenceCommands>;
  findRecoverableUnverifiedActionAttempt: (entries: AgentRuntimeToolResultEntry[]) => AgentRuntimeToolResultEntry | null;
  isLoginControlEvidence: (evidence: AgentStructuredToolEvidence | null) => boolean;
  hasClearActionableVisualEvidence: (entry: AgentRuntimeToolResultEntry) => boolean;
  resolveTargetSelectionApproval: (options: {
    command: AgentChatCommand;
    result: AgentChatCommandResult;
    sourceText: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal: string;
  }) => AgentRuntimePendingApproval | null;
}) {
  const {
    isLoginControlEvidence: isAgentSessionV2LoginControlEvidence,
    hasClearActionableVisualEvidence: hasAgentSessionV2ClearActionableVisualEvidence,
    resolveTargetSelectionApproval: resolveAgentSessionV2TargetSelectionApproval,
  } = options;
  const {
    resolveAgentProductionVisualActionApprovalPoint: resolveAgentSessionV2VisualActionApprovalPoint,
    resolveAgentProductionInvokableUiCandidate: resolveAgentSessionV2InvokableUiCandidate,
  } = options.candidateSelection;
  const {
    createAgentProductionVisualInputSequenceCommand: createAgentSessionV2VisualInputSequenceCommand,
    createAgentProductionVisualInvokeSequenceCommand: createAgentSessionV2VisualInvokeSequenceCommand,
  } = options.sequenceCommands;

  const { getAgentProductionToolInputAction, isAgentProductionVisualToolCommand, getAgentProductionCommandDesktopInputActions, isAgentProductionWindowUiCoordinateFallbackEvidence, shouldUseAgentProductionDoubleClickFallback, shouldUseAgentProductionKeyboardConfirmFallback, inferAgentProductionKeyboardConfirmInputAction } = createAgentProductionVisualInputFallback({
    retryEvidence: options.retryEvidence,
    candidateSelection: options.candidateSelection,
    findRecoverableUnverifiedActionAttempt: options.findRecoverableUnverifiedActionAttempt,
  });

  function resolveAgentProductionVisualActionApproval(options: {
    command: AgentChatCommand;
    result: AgentChatCommandResult;
    sourceText: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal: string;
  }): AgentRuntimePendingApproval | null {
    if (!hasAgentDirectActionIntent(options.sourceText, options.userGoal)) {
      return null;
    }

    const entry: AgentRuntimeToolResultEntry = {
      command: options.command,
      result: options.result,
    };
    const sourceEvidence = getAgentStructuredEvidence(entry);
    const sourceToolName = options.command.toolCall?.name ?? null;
    const sourceAction = getAgentProductionToolInputAction(options.command);
    const hasExplicitWaitObservationUiCandidate = sourceAction === 'wait_and_observe'
      && [
        ...(sourceEvidence?.actionCandidates ?? []),
        ...(sourceEvidence?.targetCandidates ?? []),
      ].some((candidate) => (
        candidate.source === 'ui-automation'
        && Boolean(candidate.window?.hwnd)
        && isAgentSessionV2InvokableUiCandidate(candidate)
      ));
    const isTrustedVisualActionSource = sourceToolName === 'locate_screen_elements'
      || isAgentProductionVisualToolCommand(options.command)
      || (
        sourceToolName === 'execute_desktop_observation'
        && (
          sourceAction === 'summarize_visual_snapshot'
          || sourceAction === 'inspect_window_ui'
          || hasExplicitWaitObservationUiCandidate
        )
      )
      || isAgentProductionWindowUiCoordinateFallbackEvidence(entry);
    if (!isTrustedVisualActionSource) {
      return null;
    }

    const targetSelectionApproval = resolveAgentSessionV2TargetSelectionApproval({
      command: options.command,
      result: options.result,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    });
    if (targetSelectionApproval) {
      return targetSelectionApproval;
    }

    const coordinateFallbackAfterWindowUiFailure = isAgentProductionWindowUiCoordinateFallbackEvidence(entry);
    if (options.result.ok === false && !coordinateFallbackAfterWindowUiFailure) {
      return null;
    }

    const evidence = createAgentSessionV2EffectiveVisualActionEvidence(
      sourceEvidence,
    );
    const isLoginControl = isAgentSessionV2LoginControlEvidence(evidence);
    const invokableUiCandidate = resolveAgentSessionV2InvokableUiCandidate({
      evidence,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    });
    const currentEvidenceIsSafeLoginControl = Boolean(
      hasAgentSessionV2SafeLoginContinuationApprovalEvidence({
        evidence,
        result: options.result,
      }),
    );
    const currentVisualEvidenceIsApproximate = hasAgentSessionV2ApproximateVisualEvidence(options.result);
    const refinementSampleCount = (options.toolResults ?? []).filter((historyEntry) => (
      historyEntry.result.ok !== false
        && historyEntry.command.toolCall?.name === 'locate_screen_elements'
        && typeof historyEntry.command.toolCall.input.question === 'string'
        && historyEntry.command.toolCall.input.question.includes('AgentSessionV2 visual refinement')
    )).length;
    const visualLocateNeedsStableReview = sourceToolName === 'locate_screen_elements'
      && !invokableUiCandidate
      && (
        evidence?.confidence !== 'high'
        || evidence.coordinateConfidence !== 'high'
        || typeof options.command.toolCall?.input.question === 'string'
          && options.command.toolCall.input.question.includes('AgentSessionV2 visual refinement')
        || currentEvidenceIsSafeLoginControl
        || currentVisualEvidenceIsApproximate
        || isAgentSessionV2LauncherVerificationBlocking(evidence)
      );
    // The focused crop itself is the second sample. Do not demand another crop
    // merely because its question contains the refinement marker; only a real
    // disagreement may consume the bounded third sample.
    const requiresAnotherVisualSample = visualLocateNeedsStableReview
      && refinementSampleCount < 2;
    if (visualLocateNeedsStableReview) {
      const previousVisualEntries = [...(options.toolResults ?? [])]
        .reverse()
        .filter((historyEntry) => (
          historyEntry.command !== options.command
          && historyEntry.result.ok !== false
          && (historyEntry.command.toolCall?.name === 'locate_screen_elements'
            || isAgentProductionVisualToolCommand(historyEntry.command)
            || historyEntry.command.toolCall?.name === 'execute_desktop_observation'
              && getAgentProductionToolInputAction(historyEntry.command) === 'inspect_window_ui')
          && Boolean(getAgentStructuredEvidence(historyEntry)?.elementCenter
            || getAgentStructuredEvidence(historyEntry)?.elementCenterRatio
            || getAgentStructuredEvidence(historyEntry)?.elementBounds
            || getAgentStructuredEvidence(historyEntry)?.actionCandidates?.some((candidate) => (
              Boolean(candidate.center || candidate.centerRatio || candidate.bounds)
            )))
        ))
        .slice(0, 3);
      const visualConsensus = evaluateAgentVisualSampleConsensus({
        command: options.command,
        // The current result is fresh. Keep at most two earlier independent
        // observations, yielding a bounded two-of-three confirmation policy.
        samples: [
          ...previousVisualEntries.reverse().map(getAgentStructuredEvidence),
          evidence,
        ],
      });
      if (visualConsensus.status !== 'passed' && requiresAnotherVisualSample) {
        return null;
      }
    }

    // The newest locate result owns the click candidate. Do not resurrect a
    // coordinate from an older unverified attempt when the current crop is not
    // actionable or its coordinate audit is unknown.
    const currentLocateRejectsHistoricalPoint = sourceToolName === 'locate_screen_elements'
      && !invokableUiCandidate
      && (
        evidence?.visualActionReadiness !== 'ready'
        || evidence?.coordinateAuditStatus === 'coordinate_unknown'
        || evidence?.coordinateAudit?.status === 'coordinate_unknown'
        || !isAgentSessionV2UsefulPrimaryAction(evidence?.primaryAction)
        || evidence?.targetMatched === null
        || evidence?.targetMatched === undefined
      );
    if (currentLocateRejectsHistoricalPoint) {
      return null;
    }

    const point = resolveAgentSessionV2VisualActionApprovalPoint({
      evidence,
      toolResults: options.toolResults,
    });
    if (!point && !invokableUiCandidate) {
      return null;
    }
    if (
      point
      && !invokableUiCandidate
      && !hasAgentSessionV2PointInsideActionableArea(evidence, point)
    ) {
      return null;
    }

    const hasClearTopLevelEvidence = hasAgentSessionV2ClearActionableVisualEvidence(entry);
    const hasClearInvokableUiCandidateEvidence = Boolean(
      invokableUiCandidate
        && hasAgentSessionV2ClearInvokableUiCandidateEvidence({
          candidate: invokableUiCandidate.candidate,
          evidence,
          sourceText: options.sourceText,
          userGoal: options.userGoal,
        }),
    );
    const hasSafeLoginContinuationEvidence = Boolean(
      point
        && hasAgentSessionV2SafeLoginContinuationApprovalEvidence({
          evidence,
          result: options.result,
        }),
    );
    const requiresWindowBoundVisualInput = Boolean(
      evidence?.postActionState === 'login_required'
        || hasSafeLoginContinuationEvidence,
    );
    if (requiresWindowBoundVisualInput && evidence?.captureSourceType !== 'window') {
      return null;
    }
    if (
      requiresWindowBoundVisualInput
      && (!Number.isFinite(Number(evidence?.finalWindow?.hwnd)) || Number(evidence?.finalWindow?.hwnd) <= 0)
    ) {
      return null;
    }
    const hasExplicitSafeLoginControl = Boolean(
      evidence?.postActionState === 'login_required'
        && /(?:login|log\s*in|sign\s*in|continue|confirm|submit|\u767b\u5f55|\u767b\u9646|\u7ee7\u7eed|\u786e\u8ba4|\u63d0\u4ea4)/iu.test([
          evidence.primaryAction,
          evidence.targetMatched,
          ...((evidence.actionCandidates ?? []).flatMap((candidate) => [
            candidate.label,
            candidate.name,
            candidate.description,
          ])),
        ].filter(Boolean).join('\n'))
        && !hasAgentAuthenticationHardGateCue(
          collectAgentSessionV2VisualApprovalResultText(options.result),
        ),
    );
    if (isAgentSessionV2LauncherVerificationBlocking(evidence)) {
      if (!hasSafeLoginContinuationEvidence) {
        return null;
      }
    }

    const hasClearCandidateEvidence = Boolean(
      evidence?.visualActionReadiness === 'ready'
        && (
          (
            evidence.targetMatched
            && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
          )
          || hasClearInvokableUiCandidateEvidence
        )
        && evidence.confidence !== 'low'
        && (evidence.coordinateConfidence !== 'low' || Boolean(invokableUiCandidate)),
    );
    if (
      !hasClearTopLevelEvidence
      && !hasClearCandidateEvidence
      && !hasClearInvokableUiCandidateEvidence
      && !hasSafeLoginContinuationEvidence
    ) {
      return null;
    }

    const invokableUiAction = invokableUiCandidate
      ? inferAgentSessionV2WindowUiAction(
          invokableUiCandidate.candidate,
          evidence,
          options.sourceText,
          options.userGoal,
        )
      : '';
    if (invokableUiAction !== 'focus' && isAgentSessionV2WindowUiSetValueIntentWithoutValue({
      evidence,
      sourceText: options.sourceText,
      userGoal: options.userGoal,
    })) {
      return null;
    }

    if (invokableUiCandidate && hasClearInvokableUiCandidateEvidence && !coordinateFallbackAfterWindowUiFailure) {
      const command = createAgentSessionV2VisualInvokeSequenceCommand({
        candidate: invokableUiCandidate.candidate,
        entry,
        point: invokableUiCandidate.point ?? point,
        sourceText: options.sourceText,
        userGoal: options.userGoal,
      });
      if (!command) {
        return null;
      }

      const route = buildAgentPermissionRoute(command);
      if (route.plan && !route.blockedStep && route.requiresApproval) {
        const targetText = evidence?.targetMatched?.trim()
          || invokableUiCandidate.candidate.label?.trim()
          || invokableUiCandidate.candidate.name?.trim()
          || 'UI control';
        const primaryActionText = evidence?.primaryAction?.trim()
          || invokableUiCandidate.candidate.label?.trim()
          || 'UI action';
        return {
          command,
          plan: route.plan,
          reason: createAgentVisualInvokeApprovalReason({
            primaryActionText,
            targetText,
          }),
          routeSummary: route.summary,
        };
      }
    }

    if (!point) {
      return null;
    }

    const inputAction = shouldUseAgentProductionKeyboardConfirmFallback({
      evidence,
      point,
      toolResults: options.toolResults,
    })
      ? inferAgentProductionKeyboardConfirmInputAction(evidence)
      : shouldUseAgentProductionDoubleClickFallback({
          evidence,
          point,
          toolResults: options.toolResults,
        })
        ? 'double_click'
        : 'click';
    const command = createAgentSessionV2VisualInputSequenceCommand({
      evidence,
      entry,
      forceLoginContinuationInput: hasSafeLoginContinuationEvidence || hasExplicitSafeLoginControl || isLoginControl,
      inputAction,
      point,
      sourceText: options.sourceText,
      userGoal: options.userGoal,
    });
    const route = buildAgentPermissionRoute(command);
    if (!route.plan || route.blockedStep || !route.requiresApproval) {
      return null;
    }

    if (coordinateFallbackAfterWindowUiFailure) {
      const targetText = evidence?.targetMatched?.trim() || 'UI control';
      return {
        command,
        plan: route.plan,
        reason: createAgentVisualActionApprovalReason({
          coordinateFallbackAfterWindowUiFailure: true,
          inputAction,
          point,
          primaryActionText: evidence?.primaryAction?.trim() || 'primary action',
          targetText,
        }),
        routeSummary: route.summary,
      };
    }

    const targetText = evidence?.targetMatched?.trim() || 'target';
    const primaryActionText = evidence?.primaryAction?.trim() || 'primary action';
    if (inputAction === 'click_then_enter' || inputAction === 'click_then_space') {
      const keyName = inputAction === 'click_then_space' ? 'Space' : 'Enter';
      return {
        command,
        plan: route.plan,
        reason: createAgentVisualActionApprovalReason({
          inputAction,
          keyName,
          point,
          primaryActionText,
          targetText,
        }),
        routeSummary: route.summary,
      };
    }

    return {
      command,
      plan: route.plan,
      reason: createAgentVisualActionApprovalReason({
        inputAction,
        point,
        primaryActionText,
        targetText,
      }),
      routeSummary: route.summary,
    };
  }

  return {
    getAgentProductionToolInputAction,
    isAgentProductionVisualToolCommand,
    getAgentProductionCommandDesktopInputActions,
    resolveAgentProductionVisualActionApproval,
  };
}
