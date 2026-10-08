import { type AgentStructuredToolCandidateEvidence } from '../agentChatCommand';
import { createVisualSnapshotQueryTokens, normalizeVisualSnapshotCompactMatchText } from './captureSourceMatching';
import { getVisualSnapshotCandidateLabel } from './visualSnapshotCandidates';

import { getVisualSnapshotCandidateSearchText } from './visualSnapshotCandidates';
import { createVisualSnapshotCandidatePointFromBounds, createVisualSnapshotRatioPointFromBounds, getVisualSnapshotCoordinateSpace, normalizeVisualSnapshotRatioPointEvidence, normalizeVisualSnapshotScreenPointEvidence, normalizeVisualSnapshotScreenRectEvidence } from './visualSnapshotCoordinateSpaces';

export function getVisualSnapshotCandidateConfidenceScore(candidate: AgentStructuredToolCandidateEvidence) {
  switch (candidate.confidence) {
    case 'high':
      return 36;
    case 'medium':
      return 18;
    case 'low':
      return -18;
    default:
      return 0;
  }
}

export function getVisualSnapshotActionShapeScore(candidate: AgentStructuredToolCandidateEvidence) {
  const bounds = candidate.bounds;
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 0;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(bounds?.coordinateSpace);
  const ratioLikeBounds = coordinateSpace.includes('ratio') || (width <= 1 && height <= 1);
  const area = width * height;
  const aspectRatio = width / height;

  if (ratioLikeBounds) {
    if (area >= 0.09 || width >= 0.42 || height >= 0.24) {
      return -28;
    }
    if (area <= 0.04 && width >= 0.06 && height >= 0.025 && aspectRatio >= 1.4 && aspectRatio <= 8) {
      return 18;
    }
    if (area <= 0.025) {
      return 10;
    }
    return 0;
  }

  if (area >= 150_000 || width >= 620 || height >= 260) {
    return -28;
  }
  if (area <= 55_000 && width >= 70 && height >= 24 && aspectRatio >= 1.4 && aspectRatio <= 8) {
    return 18;
  }
  if (area <= 32_000) {
    return 10;
  }

  return 0;
}

export function getVisualSnapshotCandidateTargetHintScore(
  candidate: AgentStructuredToolCandidateEvidence,
  targetHint: string,
) {
  const hint = normalizeVisualSnapshotCompactMatchText(targetHint);
  if (!hint) {
    return 0;
  }

  const candidateLabel = normalizeVisualSnapshotCompactMatchText(getVisualSnapshotCandidateLabel(candidate));
  if (candidateLabel && (hint.includes(candidateLabel) || candidateLabel.includes(hint))) {
    return 48;
  }

  const candidateText = normalizeVisualSnapshotCompactMatchText(
    getVisualSnapshotCandidateSearchText(candidate),
  );
  if (!candidateText) {
    return 0;
  }

  if (candidateText.includes(hint) || hint.includes(candidateText)) {
    return 28;
  }

  const tokens = createVisualSnapshotQueryTokens(targetHint);
  return Math.min(20, tokens.filter((token) => candidateText.includes(token)).length * 6);
}

export function getVisualSnapshotCandidateApproxPoint(
  candidate: AgentStructuredToolCandidateEvidence,
) {
  return normalizeVisualSnapshotRatioPointEvidence(candidate.centerRatio)
    ?? normalizeVisualSnapshotRatioPointEvidence(candidate.center)
    ?? createVisualSnapshotRatioPointFromBounds(candidate.bounds)
    ?? normalizeVisualSnapshotScreenPointEvidence(candidate.center)
    ?? createVisualSnapshotCandidatePointFromBounds(normalizeVisualSnapshotScreenRectEvidence(candidate.bounds));
}
