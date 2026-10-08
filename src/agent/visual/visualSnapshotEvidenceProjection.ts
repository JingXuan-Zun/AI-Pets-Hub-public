import { type AgentCaptureQualityAnalysis } from '../agentCaptureQuality';
import { type assessVisualSnapshotEvidenceAction } from './visualSnapshotEvidenceAction';
import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { type resolveVisualSnapshotEvidenceCoordinates } from './visualSnapshotEvidenceCoordinates';
import { type formatVisualSnapshotEvidenceLines } from './visualSnapshotEvidenceLines';
import { type resolveVisualSnapshotEvidencePresence } from './visualSnapshotEvidencePresence';
import { type createVisualSnapshotEvidenceRecovery } from './visualSnapshotEvidenceRecovery';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';
import { createVisualSnapshotStructuredFields } from './visualSnapshotStructuredFields';

export function projectVisualSnapshotEvidence(options: {
  companionCue: ReturnType<typeof readVisualSnapshotEvidenceContent>['companionCue'];
  confidenceText: ReturnType<typeof readVisualSnapshotEvidenceContent>['confidenceText'];
  mode: 'desktop' | 'game';
  evidenceLines: ReturnType<typeof formatVisualSnapshotEvidenceLines>['evidenceLines'];
  missingEvidence: ReturnType<typeof createVisualSnapshotEvidenceRecovery>['missingEvidence'];
  recommendedRecovery: ReturnType<typeof createVisualSnapshotEvidenceRecovery>['recommendedRecovery'];
  confidenceValue: ReturnType<typeof readVisualSnapshotEvidenceContent>['confidenceValue'];
  captureFallbackLine: ReturnType<typeof formatVisualSnapshotEvidenceLines>['captureFallbackLine'];
  captureContext: {
    fallbackLine?: string | null;
    quality?: AgentCaptureQualityAnalysis | null;
    selectedSource?: DesktopPetCaptureSourceLike | null;
  } | undefined;
  captureQuality: ReturnType<typeof formatVisualSnapshotEvidenceLines>['captureQuality'];
  source: DesktopPetCaptureSourceLike | null | undefined;
  captureAvailable: ReturnType<typeof resolveVisualSnapshotEvidencePresence>['captureAvailable'];
  coordinateAudit: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['coordinateAudit'];
  resolvedElementCenter: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementCenter'];
  resolvedElementCenterRatio: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementCenterRatio'];
  elementRegion: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['elementRegion'];
  actionCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['actionCandidates'];
  resolvedElementBounds: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementBounds'];
  parsed: Record<string, unknown>;
  summaryText: ReturnType<typeof readVisualSnapshotEvidenceContent>['summaryText'];
  desktopTargetPresence: ReturnType<typeof resolveVisualSnapshotEvidencePresence>['desktopTargetPresence'];
  launcherVerification: ReturnType<typeof assessVisualSnapshotEvidenceAction>['launcherVerification'];
  currentSelection: ReturnType<typeof readVisualSnapshotEvidenceContent>['currentSelection'];
  primaryAction: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['primaryAction'];
  interactionReady: ReturnType<typeof resolveVisualSnapshotEvidencePresence>['interactionReady'];
  resolvedPostActionState: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['resolvedPostActionState'];
  loginStateRecovery: ReturnType<typeof createVisualSnapshotEvidenceRecovery>['loginStateRecovery'];
  selectionRecovery: ReturnType<typeof createVisualSnapshotEvidenceRecovery>['selectionRecovery'];
  primaryActionRecovery: ReturnType<typeof createVisualSnapshotEvidenceRecovery>['primaryActionRecovery'];
  relation: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['relation'];
  selectionVerificationStatus: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectionVerificationStatus'];
  sourceGeometry: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['sourceGeometry'];
  uncertainty: ReturnType<typeof readVisualSnapshotEvidenceContent>['uncertainty'];
  loginGateRecoveryNeeded: ReturnType<typeof assessVisualSnapshotEvidenceAction>['loginGateRecoveryNeeded'];
  actionEvidence: ReturnType<typeof assessVisualSnapshotEvidenceAction>['actionEvidence'];
  targetCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetCandidates'];
  targetMatched: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetMatched'];
  visibleTextCandidates: ReturnType<typeof readVisualSnapshotEvidenceContent>['visibleTextCandidates'];
  visualReadable: ReturnType<typeof resolveVisualSnapshotEvidencePresence>['visualReadable'];
  windowPresent: ReturnType<typeof resolveVisualSnapshotEvidencePresence>['windowPresent'];
  launcherVerificationLine: ReturnType<typeof assessVisualSnapshotEvidenceAction>['launcherVerificationLine'];
  captureQualityLine: ReturnType<typeof formatVisualSnapshotEvidenceLines>['captureQualityLine'];
}) {
  const {
    companionCue,
    confidenceText,
    mode,
    evidenceLines,
    missingEvidence,
    recommendedRecovery,
    confidenceValue,
    captureFallbackLine,
    captureContext,
    captureQuality,
    source,
    captureAvailable,
    coordinateAudit,
    resolvedElementCenter,
    resolvedElementCenterRatio,
    elementRegion,
    actionCandidates,
    resolvedElementBounds,
    parsed,
    summaryText,
    desktopTargetPresence,
    launcherVerification,
    currentSelection,
    primaryAction,
    interactionReady,
    resolvedPostActionState,
    loginStateRecovery,
    selectionRecovery,
    primaryActionRecovery,
    relation,
    selectionVerificationStatus,
    sourceGeometry,
    uncertainty,
    loginGateRecoveryNeeded,
    actionEvidence,
    targetCandidates,
    targetMatched,
    visibleTextCandidates,
    visualReadable,
    windowPresent,
    launcherVerificationLine,
    captureQualityLine,
  } = options;
  return {
    companionCue,
    confidenceLine: confidenceText
      ? mode === 'game'
        ? `Game confidence: ${confidenceText}`
        : `Visual confidence: ${confidenceText}`
      : '',
    evidenceLines,
    missingEvidence,
    observedState: evidenceLines.filter((line) => !/ uncertainty: | confidence: | companion cue: | missing evidence: /iu.test(line)),
    recommendedRecovery,
    responseText: evidenceLines.join('\n'),
    structuredEvidence: createVisualSnapshotStructuredFields(options),
    summaryText,
    verificationEvidence: [
      confidenceText
        ? mode === 'game'
          ? `Game confidence: ${confidenceText}`
          : `Visual confidence: ${confidenceText}`
        : '',
      companionCue
        ? mode === 'game'
          ? `Game companion cue: ${companionCue}`
          : `Visual companion cue: ${companionCue}`
        : '',
      resolvedPostActionState ? `Visual post-action state: ${resolvedPostActionState}` : '',
      selectionVerificationStatus ? `Visual selection verification: ${selectionVerificationStatus}` : '',
      launcherVerificationLine,
      ...(resolvedPostActionState === 'launched' ? [] : actionEvidence.verificationEvidence),
      captureQualityLine,
      captureFallbackLine,
    ].filter(Boolean),
  };
}
