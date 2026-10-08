import { type AgentCaptureQualityAnalysis } from '../agentCaptureQuality';
import { assessVisualSnapshotEvidenceAction } from './visualSnapshotEvidenceAction';
import { resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { resolveVisualSnapshotEvidenceCoordinates } from './visualSnapshotEvidenceCoordinates';
import { formatVisualSnapshotEvidenceLines } from './visualSnapshotEvidenceLines';
import { resolveVisualSnapshotEvidencePresence } from './visualSnapshotEvidencePresence';
import { projectVisualSnapshotEvidence } from './visualSnapshotEvidenceProjection';
import { createVisualSnapshotEvidenceRecovery } from './visualSnapshotEvidenceRecovery';
import { resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';
import { compactVisualSnapshotSummary, tryParseVisualSnapshotJson } from './visualSnapshotParsing';

export function createVisualSnapshotStructuredEvidence(
  rawSummary: string,
  mode: 'desktop' | 'game',
  source?: DesktopPetCaptureSourceLike | null,
  availableSources: DesktopPetCaptureSourceLike[] = [],
  targetHint = '',
  captureContext?: {
    fallbackLine?: string | null;
    quality?: AgentCaptureQualityAnalysis | null;
    selectedSource?: DesktopPetCaptureSourceLike | null;
  }
) {
  const parsed = tryParseVisualSnapshotJson(rawSummary);
  const fallbackSummary = compactVisualSnapshotSummary(rawSummary, mode === 'game' ? 1200 : 900);
  if (!parsed) {
    const summaryLine = mode === 'game'
      ? `Game content analysis: ${fallbackSummary}`
      : `Visual summary: ${fallbackSummary}`;
    return {
      companionCue: '',
      confidenceLine: '',
      evidenceLines: [summaryLine],
      missingEvidence: [],
      observedState: [summaryLine],
      recommendedRecovery: [],
      responseText: fallbackSummary,
      structuredEvidence: null,
      summaryText: fallbackSummary,
      verificationEvidence: [],
    };
  }
  const content = readVisualSnapshotEvidenceContent({
    parsed,
    fallbackSummary,
  });
  const candidates = resolveVisualSnapshotEvidenceCandidates({
    explicitPrimaryAction: content.explicitPrimaryAction,
    explicitTargetMatched: content.explicitTargetMatched,
    ocrCandidates: content.ocrCandidates,
    summaryText: content.summaryText,
    parsed,
    targetHint,
    currentSelection: content.currentSelection,
  });
  const semantics = resolveVisualSnapshotEvidenceSemantics({
    parsed,
    selectedActionCandidate: candidates.selectedActionCandidate,
    selectedTargetCandidate: candidates.selectedTargetCandidate,
    actionCandidates: candidates.actionCandidates,
    targetCandidates: candidates.targetCandidates,
    targetMatched: candidates.targetMatched,
    summaryText: content.summaryText,
  });
  const coordinates = resolveVisualSnapshotEvidenceCoordinates({
    parsed,
    elementRegion: semantics.elementRegion,
    selectedActionCandidate: candidates.selectedActionCandidate,
    selectedTargetCandidate: candidates.selectedTargetCandidate,
    source,
    availableSources,
  });
  const action = assessVisualSnapshotEvidenceAction({
    actionCandidates: candidates.actionCandidates,
    confidenceValue: content.confidenceValue,
    coordinateAudit: coordinates.coordinateAudit,
    resolvedElementBounds: coordinates.resolvedElementBounds,
    resolvedElementCenter: coordinates.resolvedElementCenter,
    resolvedElementCenterRatio: coordinates.resolvedElementCenterRatio,
    elementRegion: semantics.elementRegion,
    mode,
    primaryAction: candidates.primaryAction,
    relation: semantics.relation,
    selectionVerificationStatus: candidates.selectionVerificationStatus,
    targetCandidates: candidates.targetCandidates,
    targetMatched: candidates.targetMatched,
    resolvedPostActionState: semantics.resolvedPostActionState,
    currentSelection: content.currentSelection,
  });
  const lines = formatVisualSnapshotEvidenceLines({
    resolvedElementCenter: coordinates.resolvedElementCenter,
    derivedAbsoluteCenter: coordinates.derivedAbsoluteCenter,
    resolvedElementCenterRatio: coordinates.resolvedElementCenterRatio,
    coordinateAudit: coordinates.coordinateAudit,
    captureContext,
    mode,
    targetCandidates: candidates.targetCandidates,
    actionCandidates: candidates.actionCandidates,
    summaryText: content.summaryText,
    parsed,
    readableText: content.readableText,
    uncertainty: content.uncertainty,
    confidenceText: content.confidenceText,
    companionCue: content.companionCue,
    visibleTextCandidates: content.visibleTextCandidates,
    currentSelection: content.currentSelection,
    selectionVerificationStatus: candidates.selectionVerificationStatus,
    targetMatched: candidates.targetMatched,
    primaryAction: candidates.primaryAction,
    elementRegion: semantics.elementRegion,
    sourceGeometry: coordinates.sourceGeometry,
    relation: semantics.relation,
    launcherVerificationLine: action.launcherVerificationLine,
    resolvedPostActionState: semantics.resolvedPostActionState,
    actionEvidence: action.actionEvidence,
  });
  const recovery = createVisualSnapshotEvidenceRecovery({
    confidenceValue: content.confidenceValue,
    mode,
    uncertainty: content.uncertainty,
    resolvedPostActionState: semantics.resolvedPostActionState,
    actionEvidence: action.actionEvidence,
    loginGateRecoveryNeeded: action.loginGateRecoveryNeeded,
    launcherVerification: action.launcherVerification,
    coordinateAudit: coordinates.coordinateAudit,
    captureQuality: lines.captureQuality,
    selectionVerificationStatus: candidates.selectionVerificationStatus,
    targetMatched: candidates.targetMatched,
    targetHint,
    summaryText: content.summaryText,
    source,
  });
  const presence = resolveVisualSnapshotEvidencePresence({
    captureQuality: lines.captureQuality,
    source,
    actionEvidence: action.actionEvidence,
    loginGateRecoveryNeeded: action.loginGateRecoveryNeeded,
    resolvedPostActionState: semantics.resolvedPostActionState,
  });
  return projectVisualSnapshotEvidence({
    companionCue: content.companionCue,
    confidenceText: content.confidenceText,
    mode,
    evidenceLines: lines.evidenceLines,
    missingEvidence: recovery.missingEvidence,
    recommendedRecovery: recovery.recommendedRecovery,
    confidenceValue: content.confidenceValue,
    captureFallbackLine: lines.captureFallbackLine,
    captureContext,
    captureQuality: lines.captureQuality,
    source,
    captureAvailable: presence.captureAvailable,
    coordinateAudit: coordinates.coordinateAudit,
    resolvedElementCenter: coordinates.resolvedElementCenter,
    resolvedElementCenterRatio: coordinates.resolvedElementCenterRatio,
    elementRegion: semantics.elementRegion,
    actionCandidates: candidates.actionCandidates,
    resolvedElementBounds: coordinates.resolvedElementBounds,
    parsed,
    summaryText: content.summaryText,
    desktopTargetPresence: presence.desktopTargetPresence,
    launcherVerification: action.launcherVerification,
    currentSelection: content.currentSelection,
    primaryAction: candidates.primaryAction,
    interactionReady: presence.interactionReady,
    resolvedPostActionState: semantics.resolvedPostActionState,
    loginStateRecovery: recovery.loginStateRecovery,
    selectionRecovery: recovery.selectionRecovery,
    primaryActionRecovery: recovery.primaryActionRecovery,
    relation: semantics.relation,
    selectionVerificationStatus: candidates.selectionVerificationStatus,
    sourceGeometry: coordinates.sourceGeometry,
    uncertainty: content.uncertainty,
    loginGateRecoveryNeeded: action.loginGateRecoveryNeeded,
    actionEvidence: action.actionEvidence,
    targetCandidates: candidates.targetCandidates,
    targetMatched: candidates.targetMatched,
    visibleTextCandidates: content.visibleTextCandidates,
    visualReadable: presence.visualReadable,
    windowPresent: presence.windowPresent,
    launcherVerificationLine: action.launcherVerificationLine,
    captureQualityLine: lines.captureQualityLine,
  });
}
