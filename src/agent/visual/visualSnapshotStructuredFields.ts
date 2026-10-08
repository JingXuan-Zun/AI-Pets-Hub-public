import { type AgentCaptureQualityAnalysis } from '../agentCaptureQuality';
import { type AgentStructuredToolEvidence } from '../agentChatCommand';
import { type assessVisualSnapshotEvidenceAction } from './visualSnapshotEvidenceAction';
import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { type resolveVisualSnapshotEvidenceCoordinates } from './visualSnapshotEvidenceCoordinates';
import { isVisualSnapshotPrimaryActionUseful } from './visualSnapshotEvidenceFormatting';
import { type formatVisualSnapshotEvidenceLines } from './visualSnapshotEvidenceLines';
import { type resolveVisualSnapshotEvidencePresence } from './visualSnapshotEvidencePresence';
import { type createVisualSnapshotEvidenceRecovery } from './visualSnapshotEvidenceRecovery';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';
import { getVisualSnapshotStringField } from './visualSnapshotParsing';

export function createVisualSnapshotStructuredFields({
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
}: {
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
}) {
  return {
    confidence: confidenceValue !== null
      ? confidenceValue >= 0.8
        ? 'high'
        : confidenceValue >= 0.6
          ? 'medium'
          : 'low'
      : null,
    captureFallback: captureFallbackLine
      ? {
        fromSourceId: captureContext?.selectedSource?.id ?? null,
        fromSourceType: captureContext?.selectedSource?.type ?? null,
        reason: captureQuality?.reason ?? captureFallbackLine,
        toSourceId: source?.id ?? null,
        toSourceType: source?.type ?? null,
      }
      : null,
    captureQuality: captureQuality?.metrics ?? null,
    captureReason: captureQuality?.reason ?? null,
    captureSourceType: source?.type ?? null,
    captureStatus: captureQuality?.status ?? null,
    captureTrusted: captureQuality?.trusted ?? null,
    appExecutionProfile: 'unknown',
    captureAvailable,
    coordinateAudit,
    coordinateAuditStatus: coordinateAudit?.status ?? null,
    coordinateConfidence: resolvedElementCenter || resolvedElementCenterRatio
      ? coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
        ? 'low'
        : confidenceValue !== null && confidenceValue >= 0.8
          ? 'high'
          : 'medium'
      : elementRegion
        ? 'low'
        : null,
    actionCandidates: actionCandidates.length ? actionCandidates : null,
    elementBounds: resolvedElementBounds,
    elementCenter: resolvedElementCenter,
    elementCenterRatio: resolvedElementCenterRatio,
    elementDescription: getVisualSnapshotStringField(parsed, ['elementDescription', 'description']) || summaryText,
    elementRegion,
    desktopTargetPresence,
    foreground: null,
    launcherVerification,
    targetInteractionVerification: launcherVerification,
    currentSelection,
    primaryAction,
    interactionReady,
    postActionState: resolvedPostActionState || null,
    postActionRecovery: loginStateRecovery ?? selectionRecovery ?? primaryActionRecovery,
    processPresent: null,
    relation,
    selectionEvidence: [
      currentSelection ? `Visual current selection: ${currentSelection}` : '',
      selectionVerificationStatus ? `Visual selection verification: ${selectionVerificationStatus}` : '',
    ].filter(Boolean),
    selectionVerificationStatus,
    sourceBounds: sourceGeometry?.bounds ?? null,
    status: uncertainty.length
      || (captureQuality && !captureQuality.trusted)
      || (confidenceValue !== null && confidenceValue < 0.6)
      || loginGateRecoveryNeeded
      || (primaryAction ? !isVisualSnapshotPrimaryActionUseful(primaryAction) : false)
      || (
        resolvedPostActionState !== 'launched'
        && actionEvidence.readiness !== null
        && actionEvidence.readiness !== 'ready'
      )
      ? 'unverified'
      : 'success',
    targetCandidates: targetCandidates.length ? targetCandidates : null,
    targetMatched,
    visibleTextCandidates: visibleTextCandidates.length ? visibleTextCandidates : null,
    visualActionReadiness: resolvedPostActionState === 'launched'
      ? null
      : loginGateRecoveryNeeded ? 'needs-primary-action' : actionEvidence.readiness,
    visualReadable,
    windowPresent,
  } satisfies AgentStructuredToolEvidence;
}
