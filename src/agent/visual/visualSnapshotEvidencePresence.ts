import { type AgentStructuredToolEvidence } from '../agentChatCommand';
import { type assessVisualSnapshotEvidenceAction } from './visualSnapshotEvidenceAction';
import { type formatVisualSnapshotEvidenceLines } from './visualSnapshotEvidenceLines';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';

export function resolveVisualSnapshotEvidencePresence({
  captureQuality,
  source,
  actionEvidence,
  loginGateRecoveryNeeded,
  resolvedPostActionState,
}: {
  captureQuality: ReturnType<typeof formatVisualSnapshotEvidenceLines>['captureQuality'];
  source: DesktopPetCaptureSourceLike | null | undefined;
  actionEvidence: ReturnType<typeof assessVisualSnapshotEvidenceAction>['actionEvidence'];
  loginGateRecoveryNeeded: ReturnType<typeof assessVisualSnapshotEvidenceAction>['loginGateRecoveryNeeded'];
  resolvedPostActionState: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['resolvedPostActionState'];
}) {
  const visualReadable = captureQuality?.trusted ?? true;
  const captureAvailable = Boolean(source);
  const windowPresent = source?.type === 'window';
  const interactionReady = actionEvidence.readiness === 'ready'
    && !loginGateRecoveryNeeded
    && resolvedPostActionState !== 'launched';
  const desktopTargetPresence: AgentStructuredToolEvidence['desktopTargetPresence'] = !windowPresent
    ? 'unknown'
    : !visualReadable
      ? 'present_unreadable'
      : interactionReady || resolvedPostActionState === 'launched'
        ? 'present_interactable'
        : 'present_unreadable';
  return {
    visualReadable,
    captureAvailable,
    windowPresent,
    interactionReady,
    desktopTargetPresence,
  };
}
