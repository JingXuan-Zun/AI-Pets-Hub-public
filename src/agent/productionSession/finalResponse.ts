import { type AgentModelDecision } from '../runtime/agentModelDecisionRuntime';
import { type AgentRuntimeResult } from '../runtime/agentRuntimeContract';
import { evaluateAgentEvidenceTerminal } from '../runtime/agentEvidenceEngine';
import { getLatestAgentToolResult } from '../runtime/agentPlanningSignalEvidence';
import { createAgentRequestedActionCoverage, createAgentAttemptedActionCoverage, hasAgentDirectActionIntent, isAgentActionKindCovered } from '../runtime/agentActionCoverage';
import { isAgentVerifiedTargetWindowObservation } from '../runtime/agentCommandEvidencePredicates';
import { createAgentIncompleteTaskProgressFinalRejection, createAgentPrematureDesktopOrganizationFinalRejection, createAgentPrematureWindowMoveFinalRejection, createAgentReadonlyObservationFinalRejection, createAgentRecoverableUnverifiedRejection, createAgentUnattemptedRequestedActionFinalRejection, createAgentUnverifiedResultFinalRejection } from '../runtime/agentFinalAnswerRejectionSignals';
import { createAgentPrematureActionConfirmationRejection } from '../runtime/agentDecisionRejectionSignals';
import { createAgentFinalAnswerAcceptedTraceSummary } from '../runtime/agentDecisionTraceSummary';
import { type createAgentProductionFinalEvidenceGuards } from './finalEvidenceGuards';
import { type createAgentProductionDesktopActionEvidence } from './desktopActionEvidence';
import { type createAgentProductionRetryEvidence } from './retryEvidence';
import { type createAgentProductionSingleToolExecution } from './singleToolExecution';
import { type createAgentProductionPostApprovalVerification } from './postApprovalVerification';

type EvidenceGuards = ReturnType<typeof createAgentProductionFinalEvidenceGuards>;
type DesktopEvidence = ReturnType<typeof createAgentProductionDesktopActionEvidence>;
type RetryEvidence = ReturnType<typeof createAgentProductionRetryEvidence>;
type VerificationDependencies = Parameters<typeof createAgentProductionPostApprovalVerification>[0];
interface FinalResponseDependencies extends Pick<VerificationDependencies, 'sourceText' | 'userGoal' | 'historyLines' | 'steps' | 'toolResults' | 'appendTraceEvent'> {
  agentSessionV2ActionCoverageDependencies: VerificationDependencies['actionCoverageDependencies'];
  shouldAllowAgentSessionV2CappedAutoRecoveryFinal: EvidenceGuards['shouldAllowAgentProductionCappedAutoRecoveryFinal'];
  shouldRejectAgentSessionV2IncompleteTaskProgressFinal: EvidenceGuards['shouldRejectAgentProductionIncompleteTaskProgressFinal'];
  shouldRejectAgentSessionV2UnverifiedResultFinal: EvidenceGuards['shouldRejectAgentProductionUnverifiedResultFinal'];
  shouldRejectAgentSessionV2PrematureActionConfirmation: EvidenceGuards['shouldRejectAgentProductionPrematureActionConfirmation'];
  shouldRejectAgentSessionV2ReadonlyObservationFinal: EvidenceGuards['shouldRejectAgentProductionReadonlyObservationFinal'];
  shouldRejectAgentSessionV2UnattemptedRequestedActionFinal: EvidenceGuards['shouldRejectAgentProductionUnattemptedRequestedActionFinal'];
  shouldRejectAgentSessionV2RecoverableUnverifiedAskUser: EvidenceGuards['shouldRejectAgentProductionRecoverableUnverifiedAskUser'];
  isAgentSessionV2SilentReadOnlyToolResult: EvidenceGuards['isAgentProductionSilentReadOnlyToolResult'];
  shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal: DesktopEvidence['shouldRejectAgentProductionPrematureDesktopOrganizationFinal'];
  shouldRejectAgentSessionV2PrematureWindowMoveFinal: DesktopEvidence['shouldRejectAgentProductionPrematureWindowMoveFinal'];
  isAgentSessionV2RecoverableUnverifiedToolResult: RetryEvidence['isAgentProductionRetryRecoverableUnverifiedToolResult'];
  hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection: RetryEvidence['hasRecentAgentProductionRetryRepeatedUnverifiedActionRetryRejection'];
  resolveAgentRecoveryPostActionState: Parameters<typeof createAgentProductionFinalEvidenceGuards>[0]['resolveRecoveryPostActionState'];
  createFinalResult: Parameters<typeof createAgentProductionSingleToolExecution>[0]['createFinalResult'];
}

export function createAgentProductionFinalResponse(dependencies: FinalResponseDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, agentSessionV2ActionCoverageDependencies,
    shouldAllowAgentSessionV2CappedAutoRecoveryFinal, shouldRejectAgentSessionV2IncompleteTaskProgressFinal, shouldRejectAgentSessionV2UnverifiedResultFinal, shouldRejectAgentSessionV2PrematureActionConfirmation, shouldRejectAgentSessionV2ReadonlyObservationFinal, shouldRejectAgentSessionV2UnattemptedRequestedActionFinal, shouldRejectAgentSessionV2RecoverableUnverifiedAskUser, isAgentSessionV2SilentReadOnlyToolResult, shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal, shouldRejectAgentSessionV2PrematureWindowMoveFinal, isAgentSessionV2RecoverableUnverifiedToolResult, hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection, resolveAgentRecoveryPostActionState, createFinalResult
  } = dependencies;
  const prepareFinalResponse = (decision: AgentModelDecision, stepIndex: number, onAccepted: () => void): AgentRuntimeResult | null => {
    if (decision.action === 'final_answer') {
      const latestToolResult = getLatestAgentToolResult(toolResults);
      const cappedAutoRecoveryBlockedFinal = hasAgentDirectActionIntent(sourceText, userGoal)
        && shouldAllowAgentSessionV2CappedAutoRecoveryFinal(
          decision,
          latestToolResult,
          toolResults,
          sourceText,
          userGoal,
        );
      if (
        hasAgentDirectActionIntent(sourceText, userGoal)
        && isAgentSessionV2RecoverableUnverifiedToolResult(latestToolResult)
        && !cappedAutoRecoveryBlockedFinal
      ) {
        historyLines.push([
          `Step ${stepIndex} rejected unverified recoverable tool final answer:`,
          createAgentRecoverableUnverifiedRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        return null;
      }

      if (shouldRejectAgentSessionV2IncompleteTaskProgressFinal(decision)) {
        historyLines.push([
          `Step ${stepIndex} rejected incomplete task progress final answer:`,
          createAgentIncompleteTaskProgressFinalRejection(decision),
        ].join('\n'));
        return null;
      }

      if (shouldRejectAgentSessionV2UnverifiedResultFinal({
        decision,
        toolResults,
      })) {
        historyLines.push([
          `Step ${stepIndex} rejected unverified result final answer:`,
          createAgentUnverifiedResultFinalRejection(decision),
        ].join('\n'));
        return null;
      }

      if (
        !cappedAutoRecoveryBlockedFinal
        && shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal({
          sourceText,
          toolResults,
          userGoal,
        })
      ) {
        historyLines.push([
          `Step ${stepIndex} rejected premature final answer:`,
          createAgentPrematureDesktopOrganizationFinalRejection({
            decisionMessage: decision.message,
          }),
        ].join('\n'));
        return null;
      }

      if (shouldRejectAgentSessionV2PrematureWindowMoveFinal({
        sourceText,
        toolResults,
        userGoal,
      })) {
        historyLines.push([
          `Step ${stepIndex} rejected premature final answer:`,
          createAgentPrematureWindowMoveFinalRejection({
            decisionMessage: decision.message,
          }),
        ].join('\n'));
        return null;
      }

      if (shouldRejectAgentSessionV2PrematureActionConfirmation({
        decisionMessage: decision.message,
        sourceText,
        toolResults,
        userGoal,
      }) && latestToolResult) {
        historyLines.push([
          `Step ${stepIndex} rejected premature action confirmation final answer:`,
          createAgentPrematureActionConfirmationRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        return null;
      }

      if (shouldRejectAgentSessionV2ReadonlyObservationFinal({
        decision,
        sourceText,
        toolResults,
        userGoal,
      })) {
        historyLines.push([
          `Step ${stepIndex} rejected read-only observation final answer:`,
          createAgentReadonlyObservationFinalRejection({
            actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
            decision,
            sourceText,
            toolResults,
            userGoal,
          }),
        ].join('\n'));
        return null;
      }

      const missingActionCoverage = shouldRejectAgentSessionV2UnattemptedRequestedActionFinal({
        decision,
        sourceText,
        toolResults,
        userGoal,
      });
      if (missingActionCoverage) {
        historyLines.push([
          `Step ${stepIndex} rejected incomplete action coverage final answer:`,
          createAgentUnattemptedRequestedActionFinalRejection({
            ...missingActionCoverage,
            decision,
          }),
        ].join('\n'));
        return null;
      }

      if (cappedAutoRecoveryBlockedFinal) {
        appendTraceEvent({
          action: decision.action,
          details: {
            message: decision.message,
            verificationStatus: decision.understanding?.verificationStatus,
          },
          status: 'needs-user',
          stepIndex,
          summary: 'Accepted bounded recovery blocker with concrete evidence.',
          type: 'final_answer',
        });
        return createFinalResult({
          finalAnswer: decision.message ?? 'Automatic recovery stopped with a verified blocker.',
          historyLines,
          sourceText,
          status: 'needs-user',
          steps,
          toolResults,
          userGoal,
        });
      }

      if (hasAgentDirectActionIntent(sourceText, userGoal)) {
        const latestEvidenceEntry = getLatestAgentToolResult(toolResults);
        const requestedCoverage = new Set(createAgentRequestedActionCoverage({
          dependencies: agentSessionV2ActionCoverageDependencies,
          sourceText,
          userGoal,
        }));
        const attemptedCoverage = new Set(createAgentAttemptedActionCoverage({
          dependencies: agentSessionV2ActionCoverageDependencies,
          toolResults,
        }));
        const evidenceEvaluation = evaluateAgentEvidenceTerminal({
          coverageComplete: [...requestedCoverage].every((kind) => (
            isAgentActionKindCovered(kind, attemptedCoverage)
          )),
          directActionIntent: true,
          latestEntry: latestEvidenceEntry,
          postActionState: resolveAgentRecoveryPostActionState({
            entry: latestEvidenceEntry,
            sourceText,
            userGoal,
          }),
          readOnlyOnly: toolResults.length > 0
            && toolResults.every(isAgentSessionV2SilentReadOnlyToolResult),
          verifiedTargetState: latestEvidenceEntry
            ? isAgentVerifiedTargetWindowObservation(latestEvidenceEntry)
            : false,
        });
        if (evidenceEvaluation.status !== 'completed') {
          historyLines.push([
            `Step ${stepIndex} rejected final answer without Evidence Engine authorization:`,
            evidenceEvaluation.reason,
            `postActionState=${evidenceEvaluation.postActionState || 'unknown'}`,
          ].join('\n'));
          return null;
        }
      }

      appendTraceEvent({
        action: decision.action,
        details: {
          message: decision.message,
          verificationStatus: decision.understanding?.verificationStatus,
        },
        status: 'completed',
        stepIndex,
        summary: createAgentFinalAnswerAcceptedTraceSummary(),
        type: 'final_answer',
      });
      onAccepted();
      return createFinalResult({
        finalAnswer: decision.message ?? 'Done.',
        historyLines,
        sourceText,
        status: 'completed',
        steps,
        toolResults,
        userGoal,
      });
    }

    if (decision.action === 'ask_user') {
      const latestToolResult = getLatestAgentToolResult(toolResults);
      if (shouldRejectAgentSessionV2RecoverableUnverifiedAskUser({
        decisionMessage: decision.message,
        sourceText,
        toolResults,
        userGoal,
      }) && latestToolResult && !hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection(steps)) {
        historyLines.push([
          `Step ${stepIndex} rejected transitional unverified ask_user:`,
          createAgentRecoverableUnverifiedRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        return null;
      }

      if (shouldRejectAgentSessionV2PrematureActionConfirmation({
        decisionMessage: decision.message,
        sourceText,
        toolResults,
        userGoal,
      }) && latestToolResult) {
        historyLines.push([
          `Step ${stepIndex} rejected premature action confirmation ask_user:`,
          createAgentPrematureActionConfirmationRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        return null;
      }

      onAccepted();
      return createFinalResult({
        finalAnswer: decision.message ?? 'I need one more detail from you before continuing.',
        historyLines,
        sourceText,
        status: 'needs-user',
        steps,
        toolResults,
        userGoal,
      });
    }

    return null;
  };
  return { prepareFinalResponse };
}
