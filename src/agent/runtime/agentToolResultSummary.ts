import {
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../agentChatCommand';
import { resolveAgentResultFollowUpActions } from '../agentResultAssessment';
import {
  compactAgentPlanningSignalText,
  formatAgentActionEvidence,
  formatAgentStructuredCandidates,
  getAgentActionEvidence,
} from './agentPlanningSignalEvidence';
import { isAgentCachedToolResult } from './agentToolResultCacheEvidence';

function createAgentToolResultVisualActionBlocker(value: unknown) {
  const readiness = typeof value === 'string' ? value.trim() : '';
  switch (readiness) {
    case 'needs-target-selection':
      return 'target-visible-but-not-selected-or-current';
    case 'needs-primary-action':
      return 'primary-open-start-play-action-not-identified';
    case 'needs-coordinate':
      return 'native-screen-coordinate-not-resolved';
    case 'needs-relation':
      return 'target-action-ownership-not-proven';
    case 'low-confidence':
      return 'visual-confidence-too-low';
    case 'not-actionable':
      return 'visible-evidence-not-actionable';
    default:
      return '';
  }
}

export function createAgentToolResultCriticalFacts(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const actionEvidence = getAgentActionEvidence(result);
  const targetCandidates = formatAgentStructuredCandidates(structuredEvidence?.targetCandidates);
  const actionCandidates = formatAgentStructuredCandidates(structuredEvidence?.actionCandidates);
  const visualActionBlocker = createAgentToolResultVisualActionBlocker(
    structuredEvidence?.visualActionReadiness,
  );
  const facts = [
    `tool=${command.toolCall?.name ?? command.kind}`,
    `ok=${result.ok === false ? 'false' : 'true'}`,
    isAgentCachedToolResult(result) ? 'cache=hit' : '',
    result.assessment?.status ? `assessment=${result.assessment.status}` : '',
    result.receipt?.status ? `receipt=${result.receipt.status}` : '',
    actionEvidence?.outcome ? `actionOutcome=${actionEvidence.outcome}` : '',
    actionEvidence?.action ? `action=${actionEvidence.action}` : '',
    actionEvidence?.targetRef?.label ? `actionTarget=${actionEvidence.targetRef.label}` : '',
    actionEvidence?.diff?.summary ? `actionDiff=${actionEvidence.diff.summary}` : '',
    structuredEvidence?.targetMatched ? `target=${structuredEvidence.targetMatched}` : '',
    targetCandidates ? `targetCandidates=${targetCandidates}` : '',
    structuredEvidence?.primaryAction ? `primaryAction=${structuredEvidence.primaryAction}` : '',
    actionCandidates ? `actionCandidates=${actionCandidates}` : '',
    structuredEvidence?.relation ? `relation=${structuredEvidence.relation}` : '',
    structuredEvidence?.elementRegion ? `elementRegion=${structuredEvidence.elementRegion}` : '',
    Number.isFinite(Number(structuredEvidence?.elementCenter?.x))
      && Number.isFinite(Number(structuredEvidence?.elementCenter?.y))
      ? `elementCenter=${Math.round(Number(structuredEvidence?.elementCenter?.x))},${Math.round(Number(structuredEvidence?.elementCenter?.y))}`
      : '',
    Number.isFinite(Number(structuredEvidence?.elementCenterRatio?.x))
      && Number.isFinite(Number(structuredEvidence?.elementCenterRatio?.y))
      ? `elementCenterRatio=${Number(structuredEvidence?.elementCenterRatio?.x).toFixed(3)},${Number(structuredEvidence?.elementCenterRatio?.y).toFixed(3)}`
      : '',
    structuredEvidence?.finalUrl ? `url=${structuredEvidence.finalUrl}` : '',
    structuredEvidence?.finalWindow?.processName ? `windowProcess=${structuredEvidence.finalWindow.processName}` : '',
    structuredEvidence?.finalWindow?.title ? `windowTitle=${structuredEvidence.finalWindow.title}` : '',
    structuredEvidence?.finalWindow?.displayLabel || structuredEvidence?.finalWindow?.displayId
      ? `windowDisplay=${structuredEvidence.finalWindow.displayLabel ?? structuredEvidence.finalWindow.displayId}`
      : '',
    structuredEvidence?.finalDisplay?.label || structuredEvidence?.finalDisplay?.id
      ? `finalDisplay=${structuredEvidence.finalDisplay.label ?? structuredEvidence.finalDisplay.id}`
      : '',
    structuredEvidence?.postActionState ? `postActionState=${structuredEvidence.postActionState}` : '',
    structuredEvidence?.postActionRecovery?.strategy ? `postActionRecoveryStrategy=${structuredEvidence.postActionRecovery.strategy}` : '',
    structuredEvidence?.postActionRecovery?.nextTool ? `postActionRecoveryNextTool=${structuredEvidence.postActionRecovery.nextTool}` : '',
    structuredEvidence?.selectionVerificationStatus ? `selectionVerificationStatus=${structuredEvidence.selectionVerificationStatus}` : '',
    structuredEvidence?.launcherVerification?.status ? `launcherStatus=${structuredEvidence.launcherVerification.status}` : '',
    typeof structuredEvidence?.launcherVerification?.targetVisible === 'boolean'
      ? `launcherTargetVisible=${structuredEvidence.launcherVerification.targetVisible}`
      : '',
    typeof structuredEvidence?.launcherVerification?.targetSelected === 'boolean'
      ? `launcherTargetSelected=${structuredEvidence.launcherVerification.targetSelected}`
      : '',
    typeof structuredEvidence?.launcherVerification?.detailMatchesTarget === 'boolean'
      ? `launcherDetailMatches=${structuredEvidence.launcherVerification.detailMatchesTarget}`
      : '',
    typeof structuredEvidence?.launcherVerification?.primaryActionMatchesTarget === 'boolean'
      ? `launcherActionMatches=${structuredEvidence.launcherVerification.primaryActionMatchesTarget}`
      : '',
    structuredEvidence?.captureStatus ? `captureStatus=${structuredEvidence.captureStatus}` : '',
    typeof structuredEvidence?.captureTrusted === 'boolean' ? `captureTrusted=${structuredEvidence.captureTrusted}` : '',
    structuredEvidence?.coordinateAuditStatus || structuredEvidence?.coordinateAudit?.status
      ? `coordinateAudit=${structuredEvidence.coordinateAuditStatus ?? structuredEvidence.coordinateAudit?.status}`
      : '',
    structuredEvidence?.coordinateAudit?.sourceRatio
      ? `coordinateSourceRatio=${structuredEvidence.coordinateAudit.sourceRatio.x},${structuredEvidence.coordinateAudit.sourceRatio.y}`
      : '',
    structuredEvidence?.coordinateAudit?.pointDisplayLabel || structuredEvidence?.coordinateAudit?.pointDisplayId
      ? `coordinatePointDisplay=${structuredEvidence.coordinateAudit.pointDisplayLabel ?? structuredEvidence.coordinateAudit.pointDisplayId}`
      : '',
    structuredEvidence?.coordinateAudit?.sourceDisplayLabel || structuredEvidence?.coordinateAudit?.sourceDisplayId
      ? `coordinateSourceDisplay=${structuredEvidence.coordinateAudit.sourceDisplayLabel ?? structuredEvidence.coordinateAudit.sourceDisplayId}`
      : '',
    typeof structuredEvidence?.inputReplayPreview?.uiChanged === 'boolean'
      ? `inputReplayChanged=${structuredEvidence.inputReplayPreview.uiChanged}`
      : '',
    structuredEvidence?.inputReplayPreview?.coordinateClosureStatus
      ? `inputReplayCoordinateClosure=${structuredEvidence.inputReplayPreview.coordinateClosureStatus}`
      : '',
    structuredEvidence?.confidence ? `confidence=${structuredEvidence.confidence}` : '',
    structuredEvidence?.visualActionReadiness ? `visualActionReadiness=${structuredEvidence.visualActionReadiness}` : '',
    visualActionBlocker ? `visualActionBlocker=${visualActionBlocker}` : '',
    structuredEvidence?.launcherVerification?.reason
      ? `launcherReason=${compactAgentPlanningSignalText(structuredEvidence.launcherVerification.reason, 220)}`
      : '',
    result.errorText ? `error=${compactAgentPlanningSignalText(result.errorText, 220)}` : '',
    result.stateSummary?.missingEvidence?.length
      ? `missing=${compactAgentPlanningSignalText(result.stateSummary.missingEvidence.slice(0, 3).join(' | '), 260)}`
      : '',
    result.stateSummary?.recommendedRecovery?.length
      ? `recover=${compactAgentPlanningSignalText(result.stateSummary.recommendedRecovery.slice(0, 3).join(' | '), 260)}`
      : '',
  ].filter(Boolean);

  return facts.join(' | ');
}

export function formatAgentToolResultForModel(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
) {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const structuredEvidence = result.stateSummary?.structuredEvidence
    ?? result.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const actionEvidenceText = formatAgentActionEvidence(result);
  const targetCandidates = formatAgentStructuredCandidates(structuredEvidence?.targetCandidates);
  const actionCandidates = formatAgentStructuredCandidates(structuredEvidence?.actionCandidates);
  return [
    `tool=${command.toolCall?.name ?? command.kind}`,
    `ok=${result.ok === false ? 'false' : 'true'}`,
    `criticalFacts=${createAgentToolResultCriticalFacts(command, result)}`,
    result.assessment?.status ? `assessmentStatus=${result.assessment.status}` : '',
    result.receipt?.status ? `receiptStatus=${result.receipt.status}` : '',
    result.responseText ? `responseText=${compactAgentPlanningSignalText(result.responseText, 420)}` : '',
    result.errorText ? `errorText=${compactAgentPlanningSignalText(result.errorText, 360)}` : '',
    result.followUp ? `followUp=${compactAgentPlanningSignalText(result.followUp, 360)}` : '',
    followUpActions.length
      ? `availableFollowUpActions=${compactAgentPlanningSignalText(followUpActions.map((action) => (
          `${action.kind}:${action.label}${action.kind === 'run-command' && action.requiresApproval ? ':requiresApproval' : ''}`
        )).join(' | '), 700)}`
      : '',
    result.previewSummaryLines?.length
      ? `previewSummary=${compactAgentPlanningSignalText(result.previewSummaryLines.join(' | '), 700)}`
      : '',
    result.previewWarning ? `previewWarning=${compactAgentPlanningSignalText(result.previewWarning, 360)}` : '',
    result.verification ? `verification=${compactAgentPlanningSignalText(result.verification, 420)}` : '',
    result.receipt?.summaryLines?.length
      ? `receiptSummary=${compactAgentPlanningSignalText(result.receipt.summaryLines.join(' | '), 360)}`
      : '',
    result.receipt?.evidenceLines?.length
      ? `rawEvidencePreview=${compactAgentPlanningSignalText(result.receipt.evidenceLines.join(' | '), 420)}`
      : '',
    result.observations?.length
      ? `observationsPreview=${compactAgentPlanningSignalText(result.observations.join(' | '), 420)}`
      : '',
    result.stateSummary?.observedState?.length
      ? `observedState=${compactAgentPlanningSignalText(result.stateSummary.observedState.join(' | '), 420)}`
      : '',
    result.stateSummary?.verificationEvidence?.length
      ? `verificationEvidence=${compactAgentPlanningSignalText(result.stateSummary.verificationEvidence.join(' | '), 420)}`
      : '',
    result.stateSummary?.missingEvidence?.length
      ? `missingEvidence=${compactAgentPlanningSignalText(result.stateSummary.missingEvidence.join(' | '), 420)}`
      : '',
    result.stateSummary?.recommendedRecovery?.length
      ? `recommendedRecovery=${compactAgentPlanningSignalText(result.stateSummary.recommendedRecovery.join(' | '), 420)}`
      : '',
    actionEvidenceText ? `actionEvidence=${actionEvidenceText}` : '',
    targetCandidates ? `targetCandidates=${compactAgentPlanningSignalText(targetCandidates, 420)}` : '',
    actionCandidates ? `actionCandidates=${compactAgentPlanningSignalText(actionCandidates, 420)}` : '',
    structuredEvidence
      ? `structuredEvidence=${compactAgentPlanningSignalText(JSON.stringify(structuredEvidence), 520)}`
      : '',
  ].filter(Boolean).join('\n');
}
