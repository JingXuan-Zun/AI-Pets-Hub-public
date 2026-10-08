import { type assessVisualSnapshotEvidenceAction } from './visualSnapshotEvidenceAction';
import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { type resolveVisualSnapshotEvidenceCoordinates } from './visualSnapshotEvidenceCoordinates';
import { type formatVisualSnapshotEvidenceLines } from './visualSnapshotEvidenceLines';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';

export function createVisualSnapshotEvidenceRecovery({
  confidenceValue,
  mode,
  uncertainty,
  resolvedPostActionState,
  actionEvidence,
  loginGateRecoveryNeeded,
  launcherVerification,
  coordinateAudit,
  captureQuality,
  selectionVerificationStatus,
  targetMatched,
  targetHint,
  summaryText,
  source,
}: {
  confidenceValue: ReturnType<typeof readVisualSnapshotEvidenceContent>['confidenceValue'];
  mode: 'desktop' | 'game';
  uncertainty: ReturnType<typeof readVisualSnapshotEvidenceContent>['uncertainty'];
  resolvedPostActionState: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['resolvedPostActionState'];
  actionEvidence: ReturnType<typeof assessVisualSnapshotEvidenceAction>['actionEvidence'];
  loginGateRecoveryNeeded: ReturnType<typeof assessVisualSnapshotEvidenceAction>['loginGateRecoveryNeeded'];
  launcherVerification: ReturnType<typeof assessVisualSnapshotEvidenceAction>['launcherVerification'];
  coordinateAudit: ReturnType<typeof resolveVisualSnapshotEvidenceCoordinates>['coordinateAudit'];
  captureQuality: ReturnType<typeof formatVisualSnapshotEvidenceLines>['captureQuality'];
  selectionVerificationStatus: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectionVerificationStatus'];
  targetMatched: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetMatched'];
  targetHint: string;
  summaryText: ReturnType<typeof readVisualSnapshotEvidenceContent>['summaryText'];
  source: DesktopPetCaptureSourceLike | null | undefined;
}) {
  const recommendedRecovery = [
    confidenceValue !== null && confidenceValue < 0.6
      ? mode === 'game'
        ? `Low game visual confidence (${confidenceValue}); ask the user to confirm the game/window or visible state before acting on it.`
        : `Low visual confidence (${confidenceValue}); ask the user to confirm the target/window/content before acting on it.`
      : '',
    uncertainty.length
      ? mode === 'game'
        ? 'Use the game uncertainty fields in the answer; ask a short clarification before taking action that depends on unclear HUD/text/state.'
        : 'Use the visual uncertainty fields in the answer; ask a short clarification before taking action that depends on unclear text/target/content.'
      : '',
    ...(resolvedPostActionState === 'launched' ? [] : actionEvidence.recommendedRecovery),
    loginGateRecoveryNeeded
      ? 'The current app is on a login/account gate. Locate and resolve the login control before searching for the requested in-app target.'
      : '',
    launcherVerification
      && launcherVerification.status
      && launcherVerification.status !== 'ready'
      && launcherVerification.reason
      ? `Recover launcher state: ${launcherVerification.reason}`
      : '',
    coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
      ? 'Refresh capture sources and re-locate the target before clicking; the current coordinate does not geometrically match the selected capture source.'
      : '',
    captureQuality && !captureQuality.trusted
      ? 'Do not act on this visual result until a trusted capture is available; retry with a screen source, a different sourceId, or ask the user to reveal the target window.'
      : '',
  ].filter(Boolean);
  const missingEvidence = [
    ...uncertainty.map((item) => (
      mode === 'game' ? `Game uncertainty: ${item}` : `Visual uncertainty: ${item}`
    )),
    ...(resolvedPostActionState === 'launched' ? [] : actionEvidence.missingEvidence),
    loginGateRecoveryNeeded
      ? 'The requested in-app target is not actionable until the current login/account gate is resolved.'
      : '',
    launcherVerification
      && launcherVerification.status
      && launcherVerification.status !== 'ready'
      && launcherVerification.reason
      ? `Launcher verification failed: ${launcherVerification.reason}`
      : '',
    coordinateAudit && coordinateAudit.status !== 'coordinate_ok'
      ? `Coordinate audit failed: ${coordinateAudit.status} (${coordinateAudit.reason})`
      : '',
    captureQuality && !captureQuality.trusted
      ? `Capture is untrusted: ${captureQuality.status} (${captureQuality.reason})`
      : '',
  ];
  const selectionRecoveryReason = selectionVerificationStatus === 'mismatch'
    ? 'The requested target is visible, but visual evidence says a different item/detail page is currently selected.'
    : selectionVerificationStatus === 'visible-only'
      ? 'The requested target is visible, but visual evidence does not confirm it is the current selected/detail item.'
      : '';
  const primaryActionRecoveryReason = actionEvidence.readiness === 'needs-primary-action'
    && targetMatched
    && selectionVerificationStatus === 'selected'
    ? 'The requested target is confirmed selected/current, but no associated primary open/start/play action has been identified yet.'
    : '';
  const selectionRecovery = selectionRecoveryReason
    ? {
      nextArgs: {
        action: 'locate_element',
        forceRefresh: true,
        question: [
          'Re-check target selection state before any primary open/start/play action.',
          'Identify the current selected/detail item, the requested target item, whether the requested target is selected/current or only visible, and the best safe coordinate or UIA candidate for selecting the requested target item.',
          'Do not click or invoke anything during this read.',
        ].join(' '),
        targetDescription: targetMatched || targetHint || summaryText,
        targetText: targetMatched || targetHint || '',
      },
      nextTool: 'locate_screen_elements' as const,
      reason: selectionRecoveryReason,
      strategy: 're-locate-target' as const,
    }
    : null;
  const primaryActionRecovery = primaryActionRecoveryReason
    ? {
      nextArgs: {
        action: 'locate_element',
        forceRefresh: true,
        question: [
          'The requested target is already selected/current.',
          'Find the primary open/start/play/launch action that belongs to this selected target or its current detail page.',
          'Return primaryAction, relation, actionCandidates, elementCenter or elementCenterRatio, confidence, coordinateConfidence, and visualActionReadiness.',
          'Do not click or invoke anything during this read.',
        ].join(' '),
        targetDescription: `${targetMatched}; primary open/start/play action associated with the selected target`,
        targetText: targetMatched,
      },
      nextTool: 'locate_screen_elements' as const,
      reason: primaryActionRecoveryReason,
      strategy: 're-locate-target' as const,
    }
    : null;
  const loginStateRecovery = loginGateRecoveryNeeded
    ? {
      nextArgs: {
        action: 'locate_element',
        forceRefresh: true,
        ...(source?.name ? { sourceQuery: source.name } : {}),
        question: [
          'The current app/window is still on a login or account gate.',
          'Locate the visible login, continue, confirm, or one-click-login control before looking for the requested in-app target.',
          'Do not click or invoke anything during this read.',
        ].join(' '),
        targetDescription: `login or continue control in ${source?.name || 'the current app/window'}`,
        targetText: '登录',
      },
      nextTool: 'locate_screen_elements' as const,
      reason: 'The full visual state indicates login is required; defer the requested in-app target until login is resolved.',
      strategy: 're-locate-target' as const,
    }
    : null;
  return {
    recommendedRecovery,
    missingEvidence,
    selectionRecovery,
    primaryActionRecovery,
    loginStateRecovery,
  };
}
