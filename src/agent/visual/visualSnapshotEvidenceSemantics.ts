import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { type readVisualSnapshotEvidenceContent } from './visualSnapshotEvidenceContent';
import { createVisualSnapshotOcrDerivedRelation } from './visualSnapshotOcr';
import { getVisualSnapshotStringField, getVisualSnapshotStringListField } from './visualSnapshotParsing';
import { isVisualSnapshotAuthenticatedState, normalizeVisualSnapshotPostActionState } from './visualSnapshotPostActionState';

export function resolveVisualSnapshotEvidenceSemantics({
  parsed,
  selectedActionCandidate,
  selectedTargetCandidate,
  actionCandidates,
  targetCandidates,
  targetMatched,
  summaryText,
}: {
  parsed: Record<string, unknown>;
  selectedActionCandidate: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectedActionCandidate'];
  selectedTargetCandidate: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectedTargetCandidate'];
  actionCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['actionCandidates'];
  targetCandidates: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetCandidates'];
  targetMatched: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['targetMatched'];
  summaryText: ReturnType<typeof readVisualSnapshotEvidenceContent>['summaryText'];
}) {
  const elementRegion = getVisualSnapshotStringField(parsed, ['elementRegion', 'location', 'coordinates', 'region'])
    || selectedActionCandidate?.region
    || selectedTargetCandidate?.region
    || '';
  const relation = getVisualSnapshotStringField(parsed, ['relation', 'targetRelation', 'association'])
    || selectedActionCandidate?.relation
    || selectedTargetCandidate?.relation
    || createVisualSnapshotOcrDerivedRelation({
      actionCandidate: selectedActionCandidate,
      actionCandidates,
      targetCandidate: selectedTargetCandidate,
      targetCandidates,
      targetMatched,
    })
    || '';
  const explicitPostActionState = normalizeVisualSnapshotPostActionState(
    parsed.postActionState
    ?? parsed.uiState
    ?? parsed.actionState
    ?? parsed.resultState
    ?? parsed.state
    ?? parsed.status,
  );
  const authenticatedState = isVisualSnapshotAuthenticatedState([
    summaryText,
    getVisualSnapshotStringField(parsed, ['mainContent', 'content']),
    getVisualSnapshotStringListField(parsed, ['readableText', 'visibleText', 'visibleTextCandidates']).join(' | '),
    getVisualSnapshotStringListField(parsed, ['visibleObjects', 'objects']).join(' | '),
  ].filter(Boolean).join('\n'));
  const postActionState = explicitPostActionState || normalizeVisualSnapshotPostActionState(summaryText);
  const resolvedPostActionState = authenticatedState ? 'launched' : postActionState;
  return {
    elementRegion,
    relation,
    resolvedPostActionState,
  };
}
