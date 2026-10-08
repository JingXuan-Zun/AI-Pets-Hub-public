import { type AgentStructuredToolEvidence } from '../agentChatCommand';
import { resolveBestVisualSnapshotCandidate } from './visualSnapshotCandidateRanking';
import { getVisualSnapshotCandidateLabel, getVisualSnapshotCandidateListField } from './visualSnapshotCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { deriveVisualSnapshotCandidatesFromOcr, mergeVisualSnapshotCandidates } from './visualSnapshotOcr';
import { deriveVisualSnapshotSelectionVerificationStatus, normalizeVisualSnapshotSelectionVerificationStatus } from './visualSnapshotPostActionState';

export function resolveVisualSnapshotEvidenceCandidates({
  explicitPrimaryAction,
  explicitTargetMatched,
  ocrCandidates,
  summaryText,
  parsed,
  targetHint,
  currentSelection,
}: {
  explicitPrimaryAction: ReturnType<typeof readVisualSnapshotEvidenceContent>['explicitPrimaryAction'];
  explicitTargetMatched: ReturnType<typeof readVisualSnapshotEvidenceContent>['explicitTargetMatched'];
  ocrCandidates: ReturnType<typeof readVisualSnapshotEvidenceContent>['ocrCandidates'];
  summaryText: ReturnType<typeof readVisualSnapshotEvidenceContent>['summaryText'];
  parsed: Record<string, unknown>;
  targetHint: string;
  currentSelection: ReturnType<typeof readVisualSnapshotEvidenceContent>['currentSelection'];
}) {
  const ocrDerivedCandidates = deriveVisualSnapshotCandidatesFromOcr({
    explicitPrimaryAction,
    explicitTargetMatched,
    ocrCandidates,
    summaryText,
  });
  const targetCandidates = mergeVisualSnapshotCandidates(
    getVisualSnapshotCandidateListField(parsed, ['targetCandidates', 'matchedTargetCandidates', 'targetOptions', 'candidateTargets']),
    ocrDerivedCandidates.targetCandidates,
  );
  const actionCandidates = mergeVisualSnapshotCandidates(
    getVisualSnapshotCandidateListField(parsed, ['actionCandidates', 'primaryActionCandidates', 'buttonCandidates', 'candidateActions']),
    ocrDerivedCandidates.actionCandidates,
  );
  const selectedTargetCandidate = resolveBestVisualSnapshotCandidate({
    candidates: targetCandidates,
    kind: 'target',
    targetHint: explicitTargetMatched || targetHint || summaryText,
  });
  const targetMatched = explicitTargetMatched
    || getVisualSnapshotCandidateLabel(selectedTargetCandidate);
  const candidateSelectionStatus: AgentStructuredToolEvidence['selectionVerificationStatus'] = selectedTargetCandidate?.selected === true
    ? 'selected'
    : selectedTargetCandidate?.selected === false
      ? 'visible-only'
      : null;
  const explicitSelectionStatus = normalizeVisualSnapshotSelectionVerificationStatus(
    parsed.selectionVerificationStatus
    ?? parsed.selectionStatus
    ?? parsed.selectedState
    ?? parsed.currentSelectionStatus
    ?? parsed.targetSelectionStatus
    ?? parsed.selection,
  );
  const derivedSelectionStatus = deriveVisualSnapshotSelectionVerificationStatus({
    currentSelection,
    parsed,
    summaryText,
    targetMatched,
  });
  const selectionVerificationStatus = explicitSelectionStatus
    ?? candidateSelectionStatus
    ?? derivedSelectionStatus;
  const selectedActionCandidate = resolveBestVisualSnapshotCandidate({
    candidates: actionCandidates,
    kind: 'action',
    targetCandidate: selectedTargetCandidate,
    targetCandidates,
    targetHint: [
      targetMatched,
      explicitPrimaryAction,
      targetHint,
      summaryText,
    ].filter(Boolean).join(' '),
  });
  const primaryAction = explicitPrimaryAction
    || getVisualSnapshotCandidateLabel(selectedActionCandidate);
  return {
    targetCandidates,
    actionCandidates,
    selectedTargetCandidate,
    targetMatched,
    selectionVerificationStatus,
    selectedActionCandidate,
    primaryAction,
  };
}
