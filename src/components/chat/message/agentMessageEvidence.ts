import { type ChatAgentExecutionReceipt } from '../../../types';
import { compactAgentPanelText } from './agentMessageProgress';

export function countAgentStateSummaryItems(stateSummary: ChatAgentExecutionReceipt['stateSummary']) {
  if (!stateSummary) {
    return 0;
  }

  return [
    stateSummary.observedState,
    stateSummary.changedState,
    stateSummary.verificationEvidence,
    stateSummary.missingEvidence,
    stateSummary.recommendedRecovery,
  ].reduce((count, items) => count + (items?.length ?? 0), stateSummary.structuredEvidence ? 1 : 0);
}

export function createAgentStructuredEvidenceLines(stateSummary: ChatAgentExecutionReceipt['stateSummary']) {
  const evidence = stateSummary?.structuredEvidence;
  if (!evidence) {
    return [];
  }

  const window = evidence.finalWindow;
  const bounds = window?.bounds;
  const formatCandidateLabels = (candidates: typeof evidence.targetCandidates) => (
    Array.isArray(candidates) && candidates.length
      ? candidates.slice(0, 4).map((candidate, index) => (
          `${index + 1}:${compactAgentPanelText(candidate.label || candidate.description || 'candidate', 50)}${candidate.confidence ? `(${candidate.confidence})` : ''}`
        )).join(' | ')
      : ''
  );
  const targetCandidates = formatCandidateLabels(evidence.targetCandidates);
  const actionCandidates = formatCandidateLabels(evidence.actionCandidates);
  const coordinateAudit = evidence.coordinateAudit ?? evidence.inputReplayPreview?.coordinateAudit ?? null;
  const launcherVerification = evidence.launcherVerification;
  const formatTriState = (value: boolean | null | undefined) => (
    typeof value === 'boolean' ? String(value) : 'unknown'
  );
  return [
    evidence.captureStatus ? `captureStatus=${evidence.captureStatus}` : '',
    typeof evidence.captureTrusted === 'boolean' ? `captureTrusted=${evidence.captureTrusted}` : '',
    coordinateAudit
      ? [
          `coordinateAudit=${coordinateAudit.status}`,
          coordinateAudit.point ? `point=${coordinateAudit.point.x},${coordinateAudit.point.y}` : '',
          typeof coordinateAudit.insideSourceBounds === 'boolean' ? `insideSource=${coordinateAudit.insideSourceBounds}` : '',
          coordinateAudit.sourceRatio ? `ratio=${coordinateAudit.sourceRatio.x},${coordinateAudit.sourceRatio.y}` : '',
          coordinateAudit.sourceBoundsCoordinateSpace ? `boundsSpace=${coordinateAudit.sourceBoundsCoordinateSpace}` : '',
          coordinateAudit.sourceNativeBoundsSource ? `nativeBounds=${coordinateAudit.sourceNativeBoundsSource}` : '',
          coordinateAudit.sourceScaleFactor ? `scale=${coordinateAudit.sourceScaleFactor}` : '',
        ].filter(Boolean).join(', ')
      : '',
    evidence.inputReplayPreview?.clickPoint
      ? `inputReplayPoint=${evidence.inputReplayPreview.clickPoint.x},${evidence.inputReplayPreview.clickPoint.y}`
      : '',
    typeof evidence.inputReplayPreview?.uiChanged === 'boolean'
      ? `inputReplayChanged=${evidence.inputReplayPreview.uiChanged}`
      : '',
    evidence.inputReplayPreview?.coordinateClosureStatus
      ? `inputReplayClosure=${evidence.inputReplayPreview.coordinateClosureStatus}`
      : '',
    evidence.targetMatched ? `target=${evidence.targetMatched}` : '',
    targetCandidates ? `targetCandidates=${targetCandidates}` : '',
    actionCandidates ? `actionCandidates=${actionCandidates}` : '',
    launcherVerification?.status
      ? [
          `launcher=${launcherVerification.status}`,
          `visible=${formatTriState(launcherVerification.targetVisible)}`,
          `selected=${formatTriState(launcherVerification.targetSelected)}`,
          `detail=${formatTriState(launcherVerification.detailMatchesTarget)}`,
          `action=${formatTriState(launcherVerification.primaryActionMatchesTarget)}`,
        ].join(', ')
      : '',
    evidence.finalUrl ? `url=${evidence.finalUrl}` : '',
    window ? [
      window.processName ? `process=${window.processName}` : '',
      window.title ? `title=${compactAgentPanelText(window.title, 90)}` : '',
      typeof window.pid === 'number' ? `pid=${window.pid}` : '',
      typeof window.hwnd === 'number' ? `hwnd=${window.hwnd}` : '',
    ].filter(Boolean).join(', ') : '',
    evidence.finalDisplay?.label || evidence.finalDisplay?.id
      ? `display=${evidence.finalDisplay.label ?? evidence.finalDisplay.id}`
      : '',
    evidence.postActionState ? `postActionState=${evidence.postActionState}` : '',
    bounds && typeof bounds.x === 'number' && typeof bounds.y === 'number'
      ? `bounds=${bounds.x},${bounds.y},${bounds.width ?? '?'}x${bounds.height ?? '?'}`
      : '',
    evidence.status ? `status=${evidence.status}` : '',
    evidence.confidence ? `confidence=${evidence.confidence}` : '',
  ].filter(Boolean);
}
