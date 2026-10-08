import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { normalizeAgentVisualRatioPoint, resolveAgentVisualCandidateScreenPoint } from './visualCoordinates';

export function getAgentVisualCandidateConfidenceScore(
  confidence: AgentStructuredToolCandidateEvidence['confidence'] | AgentStructuredToolEvidence['confidence'],
) {
  switch (confidence) {
    case 'high':
      return 30;
    case 'medium':
      return 15;
    case 'low':
      return -20;
    default:
      return 0;
  }
}

export function normalizeAgentVisualCandidateSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, '').trim().toLowerCase()
    : '';
}

export function getAgentVisualSearchTokens(value: unknown) {
  return typeof value === 'string'
    ? (value
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [])
      .filter((token) => !/^(?:agent|start|play|open|launch|run|enter|continue|install|update|resume|from|with|the|visible|launcher|app|application|button|control)$/iu.test(token))
    : [];
}

export function getAgentVisualCandidateSearchText(candidate: AgentStructuredToolCandidateEvidence) {
  return [
    candidate.label,
    candidate.name,
    candidate.description,
    candidate.region,
    candidate.relation,
    candidate.controlType,
    candidate.automationId,
  ].map(normalizeAgentVisualCandidateSearchText).filter(Boolean).join(' ');
}

export function getAgentVisualCandidateTextRelevanceScore(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const candidateText = getAgentVisualCandidateSearchText(options.candidate);
  const contextText = normalizeAgentVisualCandidateSearchText([
    options.sourceText,
    options.userGoal,
    options.evidence?.targetMatched,
    options.evidence?.primaryAction,
  ].filter(Boolean).join(' '));
  if (!candidateText || !contextText) {
    return 0;
  }

  const labels = [
    options.candidate.label,
    options.candidate.name,
    options.candidate.automationId,
  ].map(normalizeAgentVisualCandidateSearchText).filter((value) => value.length >= 2);
  const directLabelMatch = labels.some((label) => contextText.includes(label) || label.includes(contextText));
  const targetText = normalizeAgentVisualCandidateSearchText(options.evidence?.targetMatched);
  const primaryActionText = normalizeAgentVisualCandidateSearchText(options.evidence?.primaryAction);
  return [
    directLabelMatch ? 22 : 0,
    targetText && candidateText.includes(targetText) ? 12 : 0,
    primaryActionText && candidateText.includes(primaryActionText) ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

export function getAgentVisualCandidateSourceFamily(candidate: AgentStructuredToolCandidateEvidence) {
  const source = candidate.source?.trim().toLowerCase() ?? '';
  if (source.includes('ui-automation') || source.includes('uia')) {
    return 'uia';
  }

  if (source.includes('visual') || source.includes('ocr')) {
    return 'visual';
  }

  return source;
}

function getAgentVisualCandidateTextTokens(candidate: AgentStructuredToolCandidateEvidence) {
  const text = getAgentVisualCandidateSearchText(candidate);
  return new Set(text.match(/[\p{L}\p{N}]{2,}/gu) ?? []);
}

export function getAgentVisualCandidateTextOverlapScore(
  candidate: AgentStructuredToolCandidateEvidence,
  other: AgentStructuredToolCandidateEvidence,
) {
  const candidateText = getAgentVisualCandidateSearchText(candidate);
  const otherText = getAgentVisualCandidateSearchText(other);
  if (!candidateText || !otherText) {
    return 0;
  }

  if (candidateText.includes(otherText) || otherText.includes(candidateText)) {
    return 18;
  }

  const candidateTokens = getAgentVisualCandidateTextTokens(candidate);
  const otherTokens = getAgentVisualCandidateTextTokens(other);
  if (!candidateTokens.size || !otherTokens.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of candidateTokens) {
    if (otherTokens.has(token)) {
      overlap += 1;
    }
  }

  return Math.min(14, overlap * 7);
}

function getAgentVisualCandidateApproxPoint(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
) {
  const screenPoint = resolveAgentVisualCandidateScreenPoint(candidate, evidence);
  if (screenPoint) {
    return {
      coordinateSpace: 'native-screen',
      x: screenPoint.x,
      y: screenPoint.y,
    };
  }

  const ratioPoint = normalizeAgentVisualRatioPoint(candidate.centerRatio);
  if (ratioPoint) {
    return {
      coordinateSpace: 'source-ratio',
      x: ratioPoint.x,
      y: ratioPoint.y,
    };
  }

  const bounds = createAgentVisualCandidateFocusBounds(candidate);
  if (bounds) {
    return {
      coordinateSpace: bounds.coordinateSpace,
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  return null;
}

function getAgentVisualCandidateSpatialAgreementScore(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  other: AgentStructuredToolCandidateEvidence;
}) {
  const candidatePoint = getAgentVisualCandidateApproxPoint(options.candidate, options.evidence);
  const otherPoint = getAgentVisualCandidateApproxPoint(options.other, options.evidence);
  if (!candidatePoint || !otherPoint || candidatePoint.coordinateSpace !== otherPoint.coordinateSpace) {
    return 0;
  }

  const distance = Math.hypot(candidatePoint.x - otherPoint.x, candidatePoint.y - otherPoint.y);
  if (candidatePoint.coordinateSpace === 'source-ratio') {
    if (distance <= 0.035) {
      return 24;
    }
    if (distance <= 0.07) {
      return 14;
    }
    return 0;
  }

  if (distance <= 64) {
    return 24;
  }
  if (distance <= 140) {
    return 14;
  }

  return 0;
}

export function getAgentVisualCandidateCrossSourceAgreementScore(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const candidateSource = getAgentVisualCandidateSourceFamily(options.candidate);
  if (candidateSource !== 'uia' && candidateSource !== 'visual') {
    return 0;
  }

  const peers = getAgentVisualEvidenceCandidates(options.evidence)
    .filter((peer) => peer !== options.candidate && peer.enabled !== false && peer.offscreen !== true);
  let bestScore = 0;

  for (const peer of peers) {
    const peerSource = getAgentVisualCandidateSourceFamily(peer);
    if (
      (peerSource !== 'uia' && peerSource !== 'visual')
      || peerSource === candidateSource
    ) {
      continue;
    }

    const spatialScore = getAgentVisualCandidateSpatialAgreementScore({
      candidate: options.candidate,
      evidence: options.evidence,
      other: peer,
    });
    const textScore = getAgentVisualCandidateTextOverlapScore(options.candidate, peer);
    const combinedScore = spatialScore && textScore
      ? spatialScore + textScore + 16
      : spatialScore >= 24
        ? spatialScore + 8
        : textScore >= 18
          ? textScore + 6
          : 0;
    bestScore = Math.max(bestScore, combinedScore);
  }

  return Math.min(58, bestScore);
}

export function getAgentVisualEvidenceCandidates(evidence: AgentStructuredToolEvidence | null) {
  return [
    ...(Array.isArray(evidence?.actionCandidates) ? evidence.actionCandidates : []),
    ...(Array.isArray(evidence?.targetCandidates) ? evidence.targetCandidates : []),
  ];
}

export function createAgentVisualCandidateFocusBounds(candidate: AgentStructuredToolCandidateEvidence) {
  const bounds = candidate.bounds;
  const boundsX = Number(bounds?.x);
  const boundsY = Number(bounds?.y);
  const boundsWidth = Number(bounds?.width);
  const boundsHeight = Number(bounds?.height);
  if (
    [boundsX, boundsY, boundsWidth, boundsHeight].every(Number.isFinite)
    && boundsWidth > 0
    && boundsHeight > 0
  ) {
    const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const ratioLikeBounds = coordinateSpace.includes('ratio') || (boundsWidth <= 1 && boundsHeight <= 1);
    return {
      coordinateSpace: ratioLikeBounds ? 'source-ratio' as const : 'native-screen' as const,
      height: boundsHeight,
      width: boundsWidth,
      x: boundsX,
      y: boundsY,
    };
  }

  const centerRatioX = Number(candidate.centerRatio?.x);
  const centerRatioY = Number(candidate.centerRatio?.y);
  if (
    Number.isFinite(centerRatioX)
    && Number.isFinite(centerRatioY)
    && centerRatioX >= 0
    && centerRatioX <= 1
    && centerRatioY >= 0
    && centerRatioY <= 1
  ) {
    return {
      coordinateSpace: 'source-ratio' as const,
      height: 0.16,
      width: 0.22,
      x: Math.max(0, centerRatioX - 0.11),
      y: Math.max(0, centerRatioY - 0.08),
    };
  }

  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      coordinateSpace: 'native-screen' as const,
      height: 140,
      width: 220,
      x: Math.max(0, centerX - 110),
      y: Math.max(0, centerY - 70),
    };
  }

  return null;
}

export function getAgentVisualPointDistance(
  point: { x: number; y: number },
  other: { x: number; y: number },
) {
  return Math.hypot(point.x - other.x, point.y - other.y);
}
