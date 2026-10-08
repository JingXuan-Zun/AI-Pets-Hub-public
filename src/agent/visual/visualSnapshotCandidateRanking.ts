import { type AgentStructuredToolCandidateEvidence } from '../agentChatCommand';
import { normalizeVisualSnapshotCompactMatchText } from './captureSourceMatching';
import { getSingleHighConfidenceVisualSnapshotCandidate, getVisualSnapshotCandidateLabel, getVisualSnapshotCandidateSearchText, hasVisualSnapshotCandidateLocationEvidence, isVisualSnapshotActionCandidateText, isVisualSnapshotNegativeRelationText } from './visualSnapshotCandidates';
import { getVisualSnapshotActionShapeScore, getVisualSnapshotCandidateApproxPoint, getVisualSnapshotCandidateConfidenceScore, getVisualSnapshotCandidateTargetHintScore } from './visualSnapshotCandidateShape';
import { getVisualSnapshotCoordinateSpace } from './visualSnapshotCoordinateSpaces';

function getVisualSnapshotCandidateActionAssociationScore(options: {
  actionCandidate: AgentStructuredToolCandidateEvidence;
  targetCandidate?: AgentStructuredToolCandidateEvidence | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
}) {
  const targetCandidate = options.targetCandidate;
  if (!targetCandidate) {
    return 0;
  }

  let score = 0;
  const targetLabel = getVisualSnapshotCandidateLabel(targetCandidate);
  const targetLabelCompact = normalizeVisualSnapshotCompactMatchText(targetLabel);
  const actionRelationCompact = normalizeVisualSnapshotCompactMatchText(options.actionCandidate.relation);
  const actionSearchCompact = normalizeVisualSnapshotCompactMatchText(
    getVisualSnapshotCandidateSearchText(options.actionCandidate),
  );

  if (targetLabelCompact) {
    if (actionRelationCompact.includes(targetLabelCompact)) {
      score += 58;
    } else if (actionSearchCompact.includes(targetLabelCompact)) {
      score += 34;
    }
  }

  for (const otherTarget of options.targetCandidates ?? []) {
    if (otherTarget === targetCandidate) {
      continue;
    }

    const otherLabelCompact = normalizeVisualSnapshotCompactMatchText(getVisualSnapshotCandidateLabel(otherTarget));
    if (
      otherLabelCompact
      && otherLabelCompact !== targetLabelCompact
      && actionRelationCompact.includes(otherLabelCompact)
      && (!targetLabelCompact || !actionRelationCompact.includes(targetLabelCompact))
    ) {
      score -= 46;
    }
  }

  const targetPoint = getVisualSnapshotCandidateApproxPoint(targetCandidate);
  const actionPoint = getVisualSnapshotCandidateApproxPoint(options.actionCandidate);
  if (!targetPoint || !actionPoint || targetPoint.coordinateSpace !== actionPoint.coordinateSpace) {
    return score;
  }

  const dx = Number(actionPoint.x) - Number(targetPoint.x);
  const dy = Math.abs(Number(actionPoint.y) - Number(targetPoint.y));
  const distance = Math.hypot(dx, dy);
  const coordinateSpace = getVisualSnapshotCoordinateSpace(actionPoint.coordinateSpace);
  if (coordinateSpace.includes('ratio')) {
    if (dy <= 0.04) {
      score += 44;
    } else if (dy <= 0.08) {
      score += 30;
    } else if (dy <= 0.14) {
      score += 12;
    } else if (dy >= 0.28) {
      score -= 18;
    }

    if (dx >= -0.04 && dx <= 0.8) {
      score += 12;
    }
    if (distance <= 0.18) {
      score += 18;
    } else if (distance <= 0.42) {
      score += 8;
    } else if (distance >= 0.75) {
      score -= 10;
    }
  } else {
    if (dy <= 48) {
      score += 44;
    } else if (dy <= 96) {
      score += 30;
    } else if (dy <= 170) {
      score += 12;
    } else if (dy >= 320) {
      score -= 18;
    }

    if (dx >= -48 && dx <= 900) {
      score += 12;
    }
    if (distance <= 180) {
      score += 18;
    } else if (distance <= 420) {
      score += 8;
    } else if (distance >= 900) {
      score -= 10;
    }
  }

  return score;
}

export function scoreVisualSnapshotCandidateChoice(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  index: number;
  kind: 'action' | 'target';
  targetCandidate?: AgentStructuredToolCandidateEvidence | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
  targetHint?: string;
}) {
  const candidateText = getVisualSnapshotCandidateSearchText(options.candidate);
  let score = getVisualSnapshotCandidateConfidenceScore(options.candidate) - options.index;
  if (getVisualSnapshotCandidateLabel(options.candidate)) {
    score += 8;
  }
  if (hasVisualSnapshotCandidateLocationEvidence(options.candidate)) {
    score += 14;
  }
  if (options.candidate.center || options.candidate.centerRatio || options.candidate.bounds) {
    score += 16;
  }
  if (options.candidate.relation?.trim()) {
    score += 10;
  }
  if (isVisualSnapshotNegativeRelationText(candidateText)) {
    score -= 42;
  }
  if (options.kind === 'action' && isVisualSnapshotActionCandidateText(candidateText)) {
    score += 26;
  }
  if (options.kind === 'action') {
    score += getVisualSnapshotActionShapeScore(options.candidate);
  }
  if (options.kind === 'target') {
    score += getVisualSnapshotCandidateTargetHintScore(options.candidate, options.targetHint ?? '');
  } else {
    score += getVisualSnapshotCandidateTargetHintScore(options.candidate, options.targetHint ?? '');
  }
  if (options.kind === 'action') {
    score += getVisualSnapshotCandidateActionAssociationScore({
      actionCandidate: options.candidate,
      targetCandidate: options.targetCandidate,
      targetCandidates: options.targetCandidates,
    });
  }

  return {
    candidate: options.candidate,
    score,
  };
}

export function resolveBestVisualSnapshotCandidate(options: {
  candidates: AgentStructuredToolCandidateEvidence[];
  kind: 'action' | 'target';
  targetCandidate?: AgentStructuredToolCandidateEvidence | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
  targetHint?: string;
}) {
  if (!options.candidates.length) {
    return null;
  }

  const singleHighConfidenceCandidate = getSingleHighConfidenceVisualSnapshotCandidate(options.candidates);
  const hasSelectionContext = Boolean(
    options.targetCandidate
      || normalizeVisualSnapshotCompactMatchText(options.targetHint),
  );
  if (
    singleHighConfidenceCandidate
    && (
      options.candidates.length === 1
      || (
        !hasSelectionContext
        && (
          options.kind === 'target'
          || isVisualSnapshotActionCandidateText(getVisualSnapshotCandidateSearchText(singleHighConfidenceCandidate))
        )
      )
    )
  ) {
    return singleHighConfidenceCandidate;
  }

  const rankedCandidates = options.candidates
    .map((candidate, index) => scoreVisualSnapshotCandidateChoice({
      candidate,
      index,
      kind: options.kind,
      targetCandidate: options.targetCandidate,
      targetCandidates: options.targetCandidates,
      targetHint: options.targetHint,
    }))
    .sort((first, second) => second.score - first.score);
  const bestCandidate = rankedCandidates[0] ?? null;
  const secondCandidate = rankedCandidates[1] ?? null;
  if (!bestCandidate) {
    return null;
  }

  const decisiveMargin = options.kind === 'action' ? 14 : 10;
  if (!secondCandidate || bestCandidate.score - secondCandidate.score >= decisiveMargin) {
    return bestCandidate.candidate;
  }

  return null;
}


