import {
  createAgentRequestedActionCoverage,
  formatAgentActionCoverageKinds,
  type AgentActionCoverageDependencies,
  type AgentRequestedActionKind,
} from './agentActionCoverage';
import { type AgentModelDecision } from './agentModelDecisionRuntime';
import { compactAgentPlanningSignalText } from './agentPlanningSignalEvidence';
import {
  formatAgentActionEvidence,
  getAgentStructuredEvidence,
} from './agentPlanningSignalEvidence';
import { createAgentPostActionRecoveryGuidanceLines } from './agentPostActionRecoveryGuidance';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export function createAgentIncompleteTaskProgressFinalRejection(
  decision: AgentModelDecision,
) {
  const understanding = decision.understanding;
  return [
    'The model produced a rejected final_answer while its own task progress board still has remaining goals.',
    understanding?.userNeed ? `userNeed=${compactAgentPlanningSignalText(understanding.userNeed, 260)}` : '',
    understanding?.successCriteria ? `successCriteria=${compactAgentPlanningSignalText(understanding.successCriteria, 360)}` : '',
    understanding?.completedGoals?.length
      ? `completedGoals=${compactAgentPlanningSignalText(understanding.completedGoals.join(' | '), 420)}`
      : 'completedGoals=none yet',
    understanding?.remainingGoals?.length
      ? `remainingGoals=${compactAgentPlanningSignalText(understanding.remainingGoals.join(' | '), 520)}`
      : '',
    understanding?.blockedGoals?.length
      ? `blockedGoals=${compactAgentPlanningSignalText(understanding.blockedGoals.join(' | '), 360)}`
      : '',
    'incompleteTaskProgressFinalRejectionPolicy=This rejection is advisory/evidence-driven. It prevents accepting final_answer while declared remaining goals still exist, but it does not mandate a fixed recovery tool chain.',
    'Next action must address the remaining goals with a tool call, ask one short necessary question, or move truly attempted-but-impossible goals into blockedGoals with evidence.',
    decision.message ? `rejectedMessage=${compactAgentPlanningSignalText(decision.message, 360)}` : '',
  ].filter(Boolean).join('\n');
}

export function createAgentUnverifiedResultFinalRejection(decision: AgentModelDecision) {
  const understanding = decision.understanding;
  return [
    'The model produced a rejected final_answer because the user-level result is not verified well enough.',
    understanding?.userNeed ? `userNeed=${compactAgentPlanningSignalText(understanding.userNeed, 260)}` : '',
    understanding?.successCriteria ? `successCriteria=${compactAgentPlanningSignalText(understanding.successCriteria, 360)}` : '',
    understanding?.verificationStatus ? `verificationStatus=${understanding.verificationStatus}` : 'verificationStatus=missing',
    understanding?.verificationEvidence?.length
      ? `verificationEvidence=${compactAgentPlanningSignalText(understanding.verificationEvidence.join(' | '), 520)}`
      : 'verificationEvidence=missing',
    understanding?.verificationGaps?.length
      ? `verificationGaps=${compactAgentPlanningSignalText(understanding.verificationGaps.join(' | '), 520)}`
      : '',
    'unverifiedResultFinalRejectionPolicy=This rejection is advisory/evidence-driven. It requires concrete user-level verification evidence before accepting final_answer, but it does not mandate a fixed recovery tool chain.',
    'Next action must verify the user-level outcome with observation/visual evidence, ask one short necessary question, or explain a concrete blocked state with evidence.',
    decision.message ? `rejectedMessage=${compactAgentPlanningSignalText(decision.message, 360)}` : '',
  ].filter(Boolean).join('\n');
}

export function createAgentReadonlyObservationFinalRejection(options: {
  actionCoverageDependencies: Pick<
    AgentActionCoverageDependencies,
    'hasDesktopOrganizationRequest' | 'hasWindowMoveToDisplayRequest'
  >;
  decision: AgentModelDecision;
  sourceText: string;
  toolResults: AgentRuntimeToolResultEntry[];
  userGoal: string;
}) {
  const requestedCoverage = createAgentRequestedActionCoverage({
    dependencies: options.actionCoverageDependencies,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const toolNames = options.toolResults.map((entry) => (
    entry.command.toolCall?.name ?? entry.command.kind
  ));

  return [
    'The model produced a rejected final_answer because only read-only observation tools have run.',
    'Rule: read-only observation can identify candidates, but it cannot satisfy open/start/launch/control requests.',
    requestedCoverage.size
      ? `requestedActionCoverage=${formatAgentActionCoverageKinds(requestedCoverage)}`
      : 'requestedActionCoverage=explicit direct action request',
    `observedTools=${toolNames.join(', ') || 'none'}`,
    'readonlyObservationFinalRejectionPolicy=This rejection is advisory/evidence-driven. It prevents accepting read-only observation as completion for direct action requests, but it does not mandate a fixed recovery tool chain.',
    'Next action must request approval for the actual open/focus/launch/click/control step, continue observing if the target is ambiguous, ask one short necessary question, or report a blocked state with concrete evidence.',
    options.decision.message ? `rejectedMessage=${compactAgentPlanningSignalText(options.decision.message, 360)}` : '',
  ].filter(Boolean).join('\n');
}

export function createAgentUnattemptedRequestedActionFinalRejection(options: {
  attemptedCoverage: Set<AgentRequestedActionKind>;
  decision: AgentModelDecision;
  missingCoverage: AgentRequestedActionKind[];
  requestedCoverage: Set<AgentRequestedActionKind>;
}) {
  return [
    'The model produced a rejected final_answer before attempting every action type requested by the user.',
    `requestedActionCoverage=${formatAgentActionCoverageKinds(options.requestedCoverage)}`,
    `attemptedActionCoverage=${formatAgentActionCoverageKinds(options.attemptedCoverage)}`,
    `missingActionGoals=${formatAgentActionCoverageKinds(options.missingCoverage)}`,
    options.decision.understanding?.successCriteria
      ? `successCriteria=${compactAgentPlanningSignalText(options.decision.understanding.successCriteria, 360)}`
      : '',
    options.decision.understanding?.verificationStatus
      ? `verificationStatus=${options.decision.understanding.verificationStatus}`
      : '',
    options.missingCoverage.includes('in-app-action')
      ? 'inAppActionGap=The user requested an action inside an outer app/launcher. Evidence that only opens or observes the outer app is not enough; the next decision should use current evidence to identify the outer app/window and the inner target/control, or report the concrete blocker.'
      : '',
    'unattemptedRequestedActionFinalRejectionPolicy=This rejection is advisory/evidence-driven. It requires declared direct action goals to be attempted or blocked with evidence, but it does not mandate a fixed recovery tool chain.',
    'Next action must address the missing action goals with a tool call, continue through execute_desktop_sequence when the next approval-required primitives are clear, observe the missing target first, ask one short necessary question, or report a blocked state with concrete evidence.',
    options.decision.message ? `rejectedMessage=${compactAgentPlanningSignalText(options.decision.message, 360)}` : '',
  ].filter(Boolean).join('\n');
}

export function createAgentPrematureDesktopOrganizationFinalRejection(options: {
  decisionMessage?: string | null;
}) {
  return [
    'The original request asks for desktop organization, but only desktop inventory has been observed.',
    'prematureFinalRejectionPolicy=This rejection is evidence-driven. It points to the missing organization planning stage without creating a general fixed tool chain.',
    'Next action should be organize_desktop_icons with mode=preview so the app can prepare an approval card.',
    options.decisionMessage
      ? `rejectedMessage=${compactAgentPlanningSignalText(options.decisionMessage, 360)}`
      : '',
  ].filter(Boolean).join('\n');
}

export function createAgentPrematureWindowMoveFinalRejection(options: {
  decisionMessage?: string | null;
}) {
  return [
    'The original request asks to move a window/app to a display, but no move_window_to_display action has been attempted.',
    'prematureFinalRejectionPolicy=This rejection is evidence-driven. It reports the missing move action and leaves observation conditional on current evidence.',
    'Opening or focusing the app/window is only a prerequisite. Next observe windows/displays if needed, then call execute_desktop_action action=move_window_to_display.',
    options.decisionMessage
      ? `rejectedMessage=${compactAgentPlanningSignalText(options.decisionMessage, 360)}`
      : '',
  ].filter(Boolean).join('\n');
}

export function createAgentRecoverableUnverifiedRejection(
  entry: AgentRuntimeToolResultEntry,
  rejectedMessage?: string,
) {
  const toolName = entry.command.toolCall?.name ?? entry.command.kind;
  const result = entry.result;
  const structuredEvidence = getAgentStructuredEvidence(entry);
  const actionEvidenceText = formatAgentActionEvidence(result, 520);
  return [
    `The latest recoverable tool result is still unverified: tool=${toolName}.`,
    result.receipt?.status ? `receiptStatus=${result.receipt.status}` : '',
    result.assessment?.status ? `assessmentStatus=${result.assessment.status}` : '',
    actionEvidenceText ? `actionEvidence=${actionEvidenceText}` : '',
    structuredEvidence?.postActionState ? `postActionState=${structuredEvidence.postActionState}` : '',
    structuredEvidence?.postActionRecovery?.strategy ? `postActionRecoveryStrategy=${structuredEvidence.postActionRecovery.strategy}` : '',
    structuredEvidence?.postActionRecovery?.nextTool ? `postActionRecoveryNextTool=${structuredEvidence.postActionRecovery.nextTool}` : '',
    structuredEvidence?.postActionRecovery?.nextArgs
      ? `postActionRecoveryNextArgs=${compactAgentPlanningSignalText(JSON.stringify(structuredEvidence.postActionRecovery.nextArgs), 420)}`
      : '',
    structuredEvidence?.visualActionReadiness ? `visualActionReadiness=${structuredEvidence.visualActionReadiness}` : '',
    result.stateSummary?.missingEvidence?.length
      ? `missingEvidence=${compactAgentPlanningSignalText(result.stateSummary.missingEvidence.join(' | '), 520)}`
      : '',
    result.stateSummary?.recommendedRecovery?.length
      ? `recommendedRecovery=${compactAgentPlanningSignalText(result.stateSummary.recommendedRecovery.join(' | '), 520)}`
      : '',
    result.receipt?.evidenceLines?.length
      ? `receiptEvidence=${compactAgentPlanningSignalText(result.receipt.evidenceLines.join(' | '), 700)}`
      : '',
    result.verification ? `verification=${compactAgentPlanningSignalText(result.verification, 520)}` : '',
    ...createAgentPostActionRecoveryGuidanceLines(entry),
    'recoverableUnverifiedRejectionPolicy=This signal is advisory/evidence-driven. Use it to recover from missing verification evidence, but it does not mandate a fixed recovery tool chain.',
    'Next action must recover from this evidence: observe current state, retry only the unclear primitive with better args, or ask one short question if the target is ambiguous. Do not final_answer as completed yet.',
    rejectedMessage ? `rejectedMessage=${compactAgentPlanningSignalText(rejectedMessage, 360)}` : '',
  ].filter(Boolean).join('\n');
}
