import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { hasAgentCandidateLocationEvidence } from '../runtime/agentPlanningSignalEvidence';
import { resolveAgentVisualActionPoint as resolveAgentSessionV2VisualActionPoint, isAgentVisualPointInsideActionableArea as hasAgentSessionV2PointInsideActionableArea } from './visualCoordinates';
import {
  getAgentVisualCandidateConfidenceScore as getAgentSessionV2CandidateConfidenceScore,
  getAgentVisualCandidateTextRelevanceScore as getAgentSessionV2CandidateTextRelevanceScore,
  getAgentVisualCandidateSourceFamily as getAgentSessionV2CandidateSourceFamily,
  getAgentVisualCandidateCrossSourceAgreementScore as getAgentSessionV2CandidateCrossSourceAgreementScore,
  getAgentVisualEvidenceCandidates as getAgentSessionV2VisualEvidenceCandidates,
  isAgentVisualUsefulPrimaryAction as isAgentSessionV2UsefulPrimaryAction,
  hasAgentVisualVerifiedPrimaryActionOwnership as hasAgentSessionV2VerifiedPrimaryActionOwnership,
  hasAgentVisualVerifiedLauncherActionOwnership as hasAgentSessionV2VerifiedLauncherActionOwnership,
  isAgentVisualLauncherVerificationBlocking as isAgentSessionV2LauncherVerificationBlocking,
  createAgentVisualCandidateFocusBounds as createAgentSessionV2CandidateFocusBounds,
} from './visualCandidateEvidence';

function clampAgentProductionRatio(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0.05, Math.min(0.9, value));
}

function getAgentProductionCandidateSmallTargetScore(candidate: AgentStructuredToolCandidateEvidence) {
  const boundsWidth = Number(candidate.bounds?.width);
  const boundsHeight = Number(candidate.bounds?.height);
  if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) || boundsWidth <= 0 || boundsHeight <= 0) {
    return 0;
  }

  const boundsSpace = candidate.bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
  const ratioLikeBounds = boundsSpace.includes('ratio') || (boundsWidth <= 1 && boundsHeight <= 1);
  if (ratioLikeBounds) {
    return boundsWidth * boundsHeight <= 0.018 || Math.max(boundsWidth, boundsHeight) <= 0.16 ? 8 : 0;
  }

  return boundsWidth <= 260 || boundsHeight <= 150 ? 8 : 0;
}

function hasAgentProductionSmallVisualCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  return getAgentProductionCandidateSmallTargetScore(candidate) > 0;
}

export function shouldRefineAgentProductionReadyVisualEvidence(options: {
  evidence: AgentStructuredToolEvidence | null;
  hasActionPoint: boolean;
  hasRefinableEvidenceLocation: boolean;
}) {
  const { evidence } = options;
  if (evidence?.visualActionReadiness !== 'ready' || !options.hasRefinableEvidenceLocation) {
    return false;
  }

  const stablePoint = resolveAgentSessionV2VisualActionPoint(evidence);
  const stableVisualEvidence = Boolean(
    options.hasActionPoint
      && stablePoint
      && evidence.confidence === 'high'
      && evidence.coordinateConfidence === 'high'
      && evidence.captureSourceType === 'window'
      && evidence.captureTrusted !== false
      && hasAgentSessionV2VerifiedPrimaryActionOwnership({ evidence })
      && hasAgentSessionV2PointInsideActionableArea(evidence, stablePoint)
      && !isAgentSessionV2LauncherVerificationBlocking(evidence)
  );
  if (stableVisualEvidence) {
    return false;
  }

  if (
    options.hasActionPoint
    && evidence.coordinateAuditStatus === 'coordinate_ok'
    && evidence.captureSourceType === 'window'
    && evidence.captureTrusted !== false
    && hasAgentSessionV2VerifiedLauncherActionOwnership(evidence)
  ) {
    return false;
  }

  if (
    evidence.targetMatched
    && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
    && !hasAgentSessionV2VerifiedPrimaryActionOwnership({ evidence })
  ) {
    return true;
  }

  if (!options.hasActionPoint || evidence.coordinateConfidence === 'low') {
    return true;
  }

  const candidates = getAgentSessionV2VisualEvidenceCandidates(evidence)
    .filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true);
  const hasVisualCandidate = candidates.some((candidate) => (
    getAgentSessionV2CandidateSourceFamily(candidate) === 'visual'
  ));
  const hasMultipleLocatedCandidates = candidates
    .filter(hasAgentCandidateLocationEvidence)
    .length > 1;
  const hasCrossSourceCandidateAgreement = candidates.some((candidate) => (
    getAgentSessionV2CandidateCrossSourceAgreementScore({
      candidate,
      evidence,
    }) > 0
  ));
  const hasSmallLocatedCandidate = candidates.some((candidate) => (
    hasAgentCandidateLocationEvidence(candidate)
    && hasAgentProductionSmallVisualCandidate(candidate)
  ));

  return Boolean(
    hasVisualCandidate
      && (
        evidence.confidence === 'medium'
        || evidence.coordinateConfidence === 'medium'
      )
      || (hasMultipleLocatedCandidates && hasCrossSourceCandidateAgreement)
      || (hasVisualCandidate && hasSmallLocatedCandidate)
  );
}

interface AgentProductionVisualRefinementCandidateChoice {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  reason: string;
  score: number;
}

function scoreAgentProductionVisualRefinementCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  evidence: AgentStructuredToolEvidence | null;
  index: number;
  sourceText: string;
  userGoal: string;
}): AgentProductionVisualRefinementCandidateChoice {
  const { candidate, candidateKind, evidence, index } = options;
  const readiness = evidence?.visualActionReadiness ?? null;
  const reasonParts: string[] = [];
  let score = getAgentSessionV2CandidateConfidenceScore(candidate.confidence) - index;
  if (candidate.confidence) {
    reasonParts.push(`confidence=${candidate.confidence}`);
  }
  if (
    Number.isFinite(Number(candidate.centerRatio?.x))
    && Number.isFinite(Number(candidate.centerRatio?.y))
  ) {
    score += 35;
    reasonParts.push('has centerRatio');
  }
  if (
    Number.isFinite(Number(candidate.bounds?.x))
    && Number.isFinite(Number(candidate.bounds?.y))
    && Number.isFinite(Number(candidate.bounds?.width))
    && Number.isFinite(Number(candidate.bounds?.height))
  ) {
    score += 30;
    reasonParts.push('has bounds');
  }
  if (
    Number.isFinite(Number(candidate.center?.x))
    && Number.isFinite(Number(candidate.center?.y))
  ) {
    score += 25;
    reasonParts.push('has screen center');
  }
  if (candidate.relation?.trim()) {
    score += 10;
    reasonParts.push('has relation');
  }
  if (candidate.label?.trim() || candidate.description?.trim()) {
    score += 5;
  }
  if (candidate.source === 'uia-visual-fusion') {
    score += 35;
    reasonParts.push('combined UIA target/action relation crop');
  }
  if (
    (candidateKind === 'target' && (readiness === 'needs-target-selection' || readiness === 'low-confidence'))
    || (candidateKind === 'action' && (
      readiness === 'needs-primary-action'
      || readiness === 'needs-coordinate'
      || readiness === 'needs-relation'
    ))
  ) {
    score += 14;
    reasonParts.push(`${candidateKind} matches readiness`);
  }
  if (
    candidateKind === 'action'
    && readiness === 'ready'
    && evidence?.targetMatched
    && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
    && !hasAgentSessionV2VerifiedPrimaryActionOwnership({ candidate, evidence })
  ) {
    score += 22;
    reasonParts.push('action ownership needs focused relation check');
  }
  const relevanceScore = getAgentSessionV2CandidateTextRelevanceScore({
    candidate,
    evidence,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  if (relevanceScore > 0) {
    score += relevanceScore;
    reasonParts.push(`text relevance +${relevanceScore}`);
  }
  const smallTargetScore = getAgentProductionCandidateSmallTargetScore(candidate);
  if (smallTargetScore > 0) {
    score += smallTargetScore;
    reasonParts.push('small target needs close crop');
  }

  return {
    candidate,
    candidateKind,
    reason: reasonParts.length ? reasonParts.join(', ') : 'candidate has usable location evidence',
    score,
  };
}

export function resolveAgentProductionBestVisualRefinementCandidate(
  options: {
    evidence: AgentStructuredToolEvidence | null;
    sourceText: string;
    userGoal: string;
  },
): AgentProductionVisualRefinementCandidateChoice | null {
  const { evidence } = options;
  const readiness = evidence?.visualActionReadiness ?? null;
  const targetCandidates = Array.isArray(evidence?.targetCandidates)
    ? evidence.targetCandidates
    : [];
  const actionCandidates = Array.isArray(evidence?.actionCandidates)
    ? evidence.actionCandidates
    : [];
  const relationCandidate = createAgentProductionRelationVisualRefinementCandidate(evidence);
  const orderedCandidates = (
    readiness === 'needs-primary-action'
    || readiness === 'needs-coordinate'
    || readiness === 'needs-relation'
  )
    ? [
        ...(relationCandidate ? [{ candidate: relationCandidate, candidateKind: 'action' as const }] : []),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
      ]
    : [
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
      ];
  const syntheticCandidate = createAgentProductionStructuredEvidenceVisualRefinementCandidate(evidence);
  if (
    syntheticCandidate
    && (
      !orderedCandidates.length
      || readiness === 'ready'
      || readiness === 'low-confidence'
      || readiness === 'needs-coordinate'
    )
  ) {
    orderedCandidates.push({
      candidate: syntheticCandidate,
      candidateKind: isAgentSessionV2UsefulPrimaryAction(evidence?.primaryAction) ? 'action' : 'target',
    });
  }

  return orderedCandidates
    .map((candidate, index) => ({ ...candidate, index }))
    .filter(({ candidate }) => (
      hasAgentCandidateLocationEvidence(candidate)
      && candidate.enabled !== false
      && candidate.offscreen !== true
    ))
    .map((candidate, index) => ({
      ...candidate,
      score: scoreAgentProductionVisualRefinementCandidate({
        candidate: candidate.candidate,
        candidateKind: candidate.candidateKind,
        evidence,
        index,
        sourceText: options.sourceText,
        userGoal: options.userGoal,
      }),
    }))
    .sort((a, b) => b.score.score - a.score.score)
    .at(0)?.score ?? null;
}

function createAgentProductionRelationVisualRefinementCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  const targetCandidates = Array.isArray(evidence?.targetCandidates)
    ? evidence.targetCandidates.filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true)
    : [];
  const actionCandidates = Array.isArray(evidence?.actionCandidates)
    ? evidence.actionCandidates.filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true)
    : [];
  if (!targetCandidates.length || !actionCandidates.length) {
    return null;
  }

  const targetCandidate = targetCandidates.find(hasAgentCandidateLocationEvidence) ?? null;
  const actionCandidate = actionCandidates.find(hasAgentCandidateLocationEvidence) ?? null;
  if (!targetCandidate || !actionCandidate) {
    return null;
  }

  const unionBounds = createAgentProductionCandidateUnionBounds(targetCandidate, actionCandidate);
  if (!unionBounds) {
    return null;
  }

  const targetLabel = targetCandidate.label?.trim()
    || targetCandidate.name?.trim()
    || evidence?.targetMatched?.trim()
    || 'target candidate';
  const actionLabel = actionCandidate.label?.trim()
    || actionCandidate.name?.trim()
    || evidence?.primaryAction?.trim()
    || 'action candidate';

  return {
    bounds: unionBounds,
    center: unionBounds.coordinateSpace === 'native-screen'
      ? {
          coordinateSpace: 'native-screen',
          source: 'uia-visual-fusion',
          x: Math.round(unionBounds.x + unionBounds.width / 2),
          y: Math.round(unionBounds.y + unionBounds.height / 2),
        }
      : null,
    centerRatio: unionBounds.coordinateSpace === 'source-ratio'
      ? {
          coordinateSpace: 'source-ratio',
          source: 'uia-visual-fusion',
          x: Math.max(0, Math.min(1, unionBounds.x + unionBounds.width / 2)),
          y: Math.max(0, Math.min(1, unionBounds.y + unionBounds.height / 2)),
        }
      : null,
    confidence: 'high',
    description: `Combined target/action area: ${targetLabel} + ${actionLabel}`,
    label: `${targetLabel} + ${actionLabel}`,
    region: 'combined target/action relation area',
    relation: 'Crop includes both UI Automation target and action candidates so vision/OCR can verify their relation.',
    source: 'uia-visual-fusion',
  };
}

function createAgentProductionCandidateUnionBounds(
  first: AgentStructuredToolCandidateEvidence,
  second: AgentStructuredToolCandidateEvidence,
) {
  const firstBounds = createAgentSessionV2CandidateFocusBounds(first);
  const secondBounds = createAgentSessionV2CandidateFocusBounds(second);
  if (!firstBounds || !secondBounds || firstBounds.coordinateSpace !== secondBounds.coordinateSpace) {
    return null;
  }

  const x = Math.min(firstBounds.x, secondBounds.x);
  const y = Math.min(firstBounds.y, secondBounds.y);
  const right = Math.max(firstBounds.x + firstBounds.width, secondBounds.x + secondBounds.width);
  const bottom = Math.max(firstBounds.y + firstBounds.height, secondBounds.y + secondBounds.height);

  return {
    coordinateSpace: firstBounds.coordinateSpace,
    height: Math.max(1, bottom - y),
    source: 'uia-visual-fusion',
    width: Math.max(1, right - x),
    x,
    y,
  };
}

function createAgentProductionStructuredEvidenceVisualRefinementCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  if (!evidence) {
    return null;
  }

  const label = [
    evidence.primaryAction,
    evidence.targetMatched,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join(' for ');
  const candidate: AgentStructuredToolCandidateEvidence = {
    bounds: evidence.elementBounds ?? null,
    center: evidence.elementCenter ?? null,
    centerRatio: evidence.elementCenterRatio ?? null,
    confidence: evidence.coordinateConfidence === 'low' ? 'low' : evidence.confidence ?? null,
    description: evidence.elementDescription ?? null,
    label: label || null,
    region: evidence.elementRegion ?? null,
    relation: evidence.relation ?? null,
    source: 'structuredEvidence',
  };

  return hasAgentCandidateLocationEvidence(candidate) ? candidate : null;
}

function inferAgentProductionVisualRefinementFocusScale(candidate: AgentStructuredToolCandidateEvidence) {
  if (candidate.confidence === 'low') {
    return 3;
  }

  const boundsWidth = Number(candidate.bounds?.width);
  const boundsHeight = Number(candidate.bounds?.height);
  if (Number.isFinite(boundsWidth) && Number.isFinite(boundsHeight) && boundsWidth > 0 && boundsHeight > 0) {
    const boundsSpace = candidate.bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const ratioLikeBounds = boundsSpace.includes('ratio') || (boundsWidth <= 1 && boundsHeight <= 1);
    if (ratioLikeBounds && (boundsWidth * boundsHeight <= 0.018 || Math.max(boundsWidth, boundsHeight) <= 0.16)) {
      return 3;
    }
    if (!ratioLikeBounds && (boundsWidth <= 260 || boundsHeight <= 150)) {
      return 3;
    }
  }

  return candidate.confidence === 'medium' ? 2 : 1;
}

export function createAgentProductionVisualRefinementFocusArgs(
  candidate: AgentStructuredToolCandidateEvidence,
): Record<string, unknown> | null {
  const focusScale = inferAgentProductionVisualRefinementFocusScale(candidate);
  const scaleArgs = focusScale > 1 ? { focusScale } : {};
  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  if (
    Number.isFinite(ratioX)
    && Number.isFinite(ratioY)
    && ratioX >= 0
    && ratioX <= 1
    && ratioY >= 0
    && ratioY <= 1
  ) {
    const boundsWidth = Number(candidate.bounds?.width);
    const boundsHeight = Number(candidate.bounds?.height);
    const boundsSpace = candidate.bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const canUseRatioBounds = (
      boundsSpace.includes('ratio')
      || (
        Number.isFinite(boundsWidth)
        && Number.isFinite(boundsHeight)
        && boundsWidth > 0
        && boundsWidth <= 1
        && boundsHeight > 0
        && boundsHeight <= 1
      )
    );
    return {
      focusCenterRatioX: ratioX,
      focusCenterRatioY: ratioY,
      focusHeightRatio: canUseRatioBounds
        ? clampAgentProductionRatio(boundsHeight * 2.4, 0.24)
        : 0.24,
      ...scaleArgs,
      focusWidthRatio: canUseRatioBounds
        ? clampAgentProductionRatio(boundsWidth * 2.4, 0.28)
        : 0.28,
    };
  }

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
    return {
      focusCoordinateSpace: bounds?.coordinateSpace?.trim() || 'native-screen',
      focusHeight: Math.max(120, Math.round(boundsHeight * 2.2)),
      ...scaleArgs,
      focusWidth: Math.max(180, Math.round(boundsWidth * 2.2)),
      focusX: Math.max(0, Math.round(boundsX - boundsWidth * 0.6)),
      focusY: Math.max(0, Math.round(boundsY - boundsHeight * 0.6)),
    };
  }

  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      focusCoordinateSpace: candidate.center?.coordinateSpace?.trim() || 'native-screen',
      focusHeight: 240,
      ...scaleArgs,
      focusWidth: 360,
      focusX: Math.max(0, Math.round(centerX - 180)),
      focusY: Math.max(0, Math.round(centerY - 120)),
    };
  }

  return null;
}
