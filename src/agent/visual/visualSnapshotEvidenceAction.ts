import { createVisualSnapshotActionEvidenceAssessment } from './visualSnapshotActionAssessment';
import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { type resolveVisualSnapshotEvidenceCoordinates } from './visualSnapshotEvidenceCoordinates';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';
import { createVisualSnapshotLauncherVerification, createVisualSnapshotLauncherVerificationLine } from './visualSnapshotLauncherVerification';

export function assessVisualSnapshotEvidenceAction({
  actionCandidates,
  confidenceValue,
  coordinateAudit,
  resolvedElementBounds,
  resolvedElementCenter,
  resolvedElementCenterRatio,
  elementRegion,
  mode,
  primaryAction,
  relation,
  selectionVerificationStatus,
  targetCandidates,
  targetMatched,
  resolvedPostActionState,
  currentSelection,
}: {
  actionCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['actionCandidates'];
  confidenceValue: ReturnType<typeof readVisualSnapshotEvidenceContent>['confidenceValue'];
  coordinateAudit: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['coordinateAudit'];
  resolvedElementBounds: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementBounds'];
  resolvedElementCenter: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementCenter'];
  resolvedElementCenterRatio: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['resolvedElementCenterRatio'];
  elementRegion: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['elementRegion'];
  mode: 'desktop' | 'game';
  primaryAction: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['primaryAction'];
  relation: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['relation'];
  selectionVerificationStatus: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectionVerificationStatus'];
  targetCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetCandidates'];
  targetMatched: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetMatched'];
  resolvedPostActionState: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['resolvedPostActionState'];
  currentSelection: ReturnType<typeof readVisualSnapshotEvidenceContent>['currentSelection'];
}) {
  const actionEvidence = createVisualSnapshotActionEvidenceAssessment({
    actionCandidates,
    confidenceValue,
    coordinateAudit,
    elementBounds: resolvedElementBounds,
    elementCenter: resolvedElementCenter,
    elementCenterRatio: resolvedElementCenterRatio,
    elementRegion,
    mode,
    primaryAction,
    relation,
    selectionVerificationStatus,
    targetCandidates,
    targetMatched,
  });
  const loginControlCue = /(?:login|log\s*in|sign\s*in|continue|confirm|登录|登陆|继续|确认)/iu;
  const loginGateRecoveryNeeded = resolvedPostActionState === 'login_required'
    && !loginControlCue.test([targetMatched, primaryAction, relation].filter(Boolean).join('\n'));
  const rawLauncherVerification = mode === 'desktop'
    ? createVisualSnapshotLauncherVerification({
      actionCandidates,
      currentSelection,
      primaryAction,
      readiness: actionEvidence.readiness ?? 'unknown',
      relation,
      relationRequired: actionEvidence.relationRequired,
      selectionVerificationStatus,
      targetCandidates,
      targetMatched,
    })
    : null;
  const launcherVerification = resolvedPostActionState === 'launched'
    ? null
    : rawLauncherVerification;
  const launcherVerificationLine = createVisualSnapshotLauncherVerificationLine(launcherVerification);
  return {
    actionEvidence,
    loginGateRecoveryNeeded,
    launcherVerification,
    launcherVerificationLine,
  };
}
