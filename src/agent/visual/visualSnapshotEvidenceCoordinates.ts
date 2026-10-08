import { createAgentCoordinateAuditEvidence } from '../agentCoordinateAudit';
import { createVisualSnapshotCandidatePointFromBounds, createVisualSnapshotRatioPointFromBounds, normalizeVisualSnapshotRatioPointEvidence, normalizeVisualSnapshotScreenRectEvidence, resolveVisualSnapshotAbsoluteRectFromRatio } from './visualSnapshotCoordinateSpaces';
import { type resolveVisualSnapshotEvidenceCandidates } from './visualSnapshotEvidenceCandidates';
import { resolveVisualSnapshotPointEvidence } from './visualSnapshotEvidenceFormatting';
import { type resolveVisualSnapshotEvidenceSemantics } from './visualSnapshotEvidenceSemantics';
import { createVisualSnapshotSourceGeometryEvidence, resolveVisualSnapshotAbsolutePointFromRatio, resolveVisualSnapshotAuditedElementCenter } from './visualSnapshotSourceGeometry';

export function resolveVisualSnapshotEvidenceCoordinates({
  parsed,
  elementRegion,
  selectedActionCandidate,
  selectedTargetCandidate,
  source,
  availableSources,
}: {
  parsed: Record<string, unknown>;
  elementRegion: ReturnType<typeof resolveVisualSnapshotEvidenceSemantics>['elementRegion'];
  selectedActionCandidate: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectedActionCandidate'];
  selectedTargetCandidate: ReturnType<typeof resolveVisualSnapshotEvidenceCandidates>['selectedTargetCandidate'];
  source: DesktopPetCaptureSourceLike | null | undefined;
  availableSources: DesktopPetCaptureSourceLike[];
}) {
  const coordinateEvidence = resolveVisualSnapshotPointEvidence(parsed, elementRegion);
  const selectedCandidateBounds = selectedActionCandidate?.bounds ?? selectedTargetCandidate?.bounds ?? null;
  const selectedCandidateCenter = selectedActionCandidate?.center
    ?? selectedTargetCandidate?.center
    ?? createVisualSnapshotCandidatePointFromBounds(selectedCandidateBounds);
  const selectedCandidateCenterRatio = selectedActionCandidate?.centerRatio ?? selectedTargetCandidate?.centerRatio ?? null;
  const rawElementBounds = selectedActionCandidate
    ? selectedCandidateBounds ?? coordinateEvidence.bounds
    : coordinateEvidence.bounds ?? selectedCandidateBounds;
  const rawElementCenter = selectedActionCandidate
    ? selectedCandidateCenter ?? coordinateEvidence.center
    : coordinateEvidence.center ?? selectedCandidateCenter;
  const resolvedElementCenterRatio = coordinateEvidence.ratioCenter
    ? selectedActionCandidate
      ? selectedCandidateCenterRatio ?? coordinateEvidence.ratioCenter
      : coordinateEvidence.ratioCenter
    : selectedCandidateCenterRatio
    ?? normalizeVisualSnapshotRatioPointEvidence(rawElementCenter)
    ?? createVisualSnapshotRatioPointFromBounds(rawElementBounds);
  const resolvedScreenBoundsFromRatio = source
    ? resolveVisualSnapshotAbsoluteRectFromRatio({
      ratioBounds: rawElementBounds,
      source,
    })
    : null;
  const resolvedElementBounds = normalizeVisualSnapshotScreenRectEvidence(rawElementBounds)
    ?? resolvedScreenBoundsFromRatio
    ?? rawElementBounds;
  const derivedAbsoluteCenter = source
    ? resolveVisualSnapshotAbsolutePointFromRatio({
      ratioCenter: resolvedElementCenterRatio,
      source,
    })
    : null;
  const resolvedElementCenter = resolveVisualSnapshotAuditedElementCenter({
    availableSources,
    derivedAbsoluteCenter,
    rawElementBounds,
    rawElementCenter,
    resolvedScreenBoundsFromRatio,
    source,
  });
  const sourceGeometry = source ? createVisualSnapshotSourceGeometryEvidence(source) : null;
  const coordinateAudit = source
    ? createAgentCoordinateAuditEvidence({
      displaySources: availableSources,
      point: resolvedElementCenter,
      source,
    })
    : null;
  return {
    resolvedElementCenterRatio,
    resolvedElementBounds,
    derivedAbsoluteCenter,
    resolvedElementCenter,
    sourceGeometry,
    coordinateAudit,
  };
}
