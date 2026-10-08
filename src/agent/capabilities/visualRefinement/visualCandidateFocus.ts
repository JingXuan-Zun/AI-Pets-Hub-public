import {
  type AgentChatCommand,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from '../../agentChatCommand';
import {
  hasAgentCandidateLocationEvidence,
} from '../../runtime/agentToolEvidence';

export function hasTopLevelActionPoint(evidence: AgentStructuredToolEvidence | null) {
  return Boolean(
    Number.isFinite(Number(evidence?.elementCenter?.x))
      && Number.isFinite(Number(evidence?.elementCenter?.y))
    || Number.isFinite(Number(evidence?.elementCenterRatio?.x))
      && Number.isFinite(Number(evidence?.elementCenterRatio?.y))
    || Number.isFinite(Number(evidence?.elementBounds?.x))
      && Number.isFinite(Number(evidence?.elementBounds?.y))
      && Number.isFinite(Number(evidence?.elementBounds?.width))
      && Number.isFinite(Number(evidence?.elementBounds?.height))
  );
}

export function hasDirectInvokableUiCandidate(evidence: AgentStructuredToolEvidence | null) {
  return (evidence?.actionCandidates ?? []).some((candidate) => (
    candidate.source === 'ui-automation'
    && candidate.enabled !== false
    && candidate.offscreen !== true
    && (candidate.actions ?? []).some((action) => /^(?:invoke|select|toggle|expand|collapse|set_value)$/iu.test(action))
  ));
}

export function hasUnresolvedActionRelation(evidence: AgentStructuredToolEvidence | null) {
  const verification = evidence?.targetInteractionVerification ?? evidence?.launcherVerification;
  const relationText = [
    evidence?.relation,
    ...(evidence?.actionCandidates ?? []).flatMap((candidate) => [candidate.relation, candidate.description]),
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join('\n');
  const hasExplicitRelation = Boolean(
    evidence?.targetMatched
      && evidence?.primaryAction
      && /(?:belongs\s+to|associated\s+with|for\s+(?:the\s+)?(?:selected|current)|owned\s+by|对应|属于|关联|当前详情|已选中)/iu.test(relationText),
  );
  return verification?.status === 'needs-relation'
    || verification?.primaryActionMatchesTarget === false
    || !hasExplicitRelation
      && verification?.primaryActionMatchesTarget == null
      && Boolean(evidence?.targetMatched && evidence?.primaryAction);
}

// elementCenterRatio is relative to the evidence's sourceBounds. After a
// focused crop those bounds are the crop, not the window, so the ratio must be
// mapped to native-screen coordinates before cropping around it again.
export function isFocusedCropCommand(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  return ['focusCenterRatioX', 'focusX'].some((key) => (
    typeof input[key] === 'number' && Number.isFinite(input[key])
  ));
}

function resolveNativeCenterFromSourceBounds(evidence: AgentStructuredToolEvidence) {
  const ratioX = Number(evidence.elementCenterRatio?.x);
  const ratioY = Number(evidence.elementCenterRatio?.y);
  const bounds = evidence.sourceBounds;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    ![ratioX, ratioY, x, y, width, height].every(Number.isFinite)
    || ratioX < 0 || ratioX > 1 || ratioY < 0 || ratioY > 1
    || width <= 0 || height <= 0
    || coordinateSpace !== 'native-screen'
  ) {
    return null;
  }
  return {
    coordinateSpace: 'native-screen',
    x: Math.round(x + width * ratioX),
    y: Math.round(y + height * ratioY),
  };
}

export function createSyntheticCandidate(
  evidence: AgentStructuredToolEvidence | null,
  cropRelativeRatio = false,
): AgentStructuredToolCandidateEvidence | null {
  if (!evidence) return null;
  const nativeCenterFromRatio = cropRelativeRatio && !evidence.elementCenter
    ? resolveNativeCenterFromSourceBounds(evidence)
    : null;
  const candidate: AgentStructuredToolCandidateEvidence = {
    bounds: evidence.elementBounds ?? null,
    center: evidence.elementCenter ?? nativeCenterFromRatio,
    centerRatio: nativeCenterFromRatio ? null : evidence.elementCenterRatio ?? null,
    confidence: evidence.coordinateConfidence === 'low' ? 'low' : evidence.confidence ?? null,
    description: evidence.elementDescription ?? null,
    label: [evidence.primaryAction, evidence.targetMatched]
      .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
      .join(' for ') || null,
    region: evidence.elementRegion ?? null,
    relation: evidence.relation ?? null,
    source: 'structuredEvidence',
  };
  return hasAgentCandidateLocationEvidence(candidate) ? candidate : null;
}

function candidateBounds(candidate: AgentStructuredToolCandidateEvidence) {
  const bounds = candidate.bounds;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
  if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    const space = bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const ratio = space.includes('ratio') || (width <= 1 && height <= 1);
    return {
      coordinateSpace: ratio ? 'source-ratio' as const : 'native-screen' as const,
      height,
      width,
      x,
      y,
    };
  }
  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  if (Number.isFinite(ratioX) && Number.isFinite(ratioY)) {
    return {
      coordinateSpace: 'source-ratio' as const,
      height: 0.16,
      width: 0.22,
      x: Math.max(0, ratioX - 0.11),
      y: Math.max(0, ratioY - 0.08),
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

function createRelationCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  const target = evidence?.targetCandidates?.find((candidate) => (
    candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate)
  ));
  const action = evidence?.actionCandidates?.find((candidate) => (
    candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate)
  ));
  if (!target || !action) return null;
  const targetBounds = candidateBounds(target);
  const actionBounds = candidateBounds(action);
  if (!targetBounds || !actionBounds || targetBounds.coordinateSpace !== actionBounds.coordinateSpace) {
    return null;
  }
  const x = Math.min(targetBounds.x, actionBounds.x);
  const y = Math.min(targetBounds.y, actionBounds.y);
  const right = Math.max(targetBounds.x + targetBounds.width, actionBounds.x + actionBounds.width);
  const bottom = Math.max(targetBounds.y + targetBounds.height, actionBounds.y + actionBounds.height);
  const bounds = {
    coordinateSpace: targetBounds.coordinateSpace,
    height: bottom - y,
    source: 'uia-visual-fusion',
    width: right - x,
    x,
    y,
  };
  const targetLabel = target.label?.trim() || target.name?.trim() || evidence?.targetMatched?.trim() || 'target candidate';
  const actionLabel = action.label?.trim() || action.name?.trim() || evidence?.primaryAction?.trim() || 'action candidate';
  return {
    bounds,
    center: bounds.coordinateSpace === 'native-screen'
      ? { coordinateSpace: 'native-screen', source: 'uia-visual-fusion', x: Math.round(x + bounds.width / 2), y: Math.round(y + bounds.height / 2) }
      : null,
    centerRatio: bounds.coordinateSpace === 'source-ratio'
      ? { coordinateSpace: 'source-ratio', source: 'uia-visual-fusion', x: Math.min(1, x + bounds.width / 2), y: Math.min(1, y + bounds.height / 2) }
      : null,
    confidence: 'high',
    description: `Combined target/action area: ${targetLabel} + ${actionLabel}`,
    label: `${targetLabel} + ${actionLabel}`,
    region: 'combined target/action relation area',
    relation: 'Crop includes both target and action candidates so vision can verify their relation.',
    source: 'uia-visual-fusion',
  };
}

function textTokens(value: string) {
  return value.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/gu).filter((token) => token.length > 1);
}

function scoreCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  evidence: AgentStructuredToolEvidence | null;
  index: number;
  sourceText: string;
  userGoal: string;
}) {
  const { candidate, evidence } = options;
  const reasons: string[] = [];
  let score = candidate.confidence === 'high' ? 30 : candidate.confidence === 'medium' ? 20 : 5;
  score -= options.index;
  if (candidate.centerRatio) { score += 35; reasons.push('has centerRatio'); }
  if (candidate.bounds) { score += 30; reasons.push('has bounds'); }
  if (candidate.center) { score += 25; reasons.push('has screen center'); }
  if (candidate.relation?.trim()) { score += 10; reasons.push('has relation'); }
  if (candidate.source === 'uia-visual-fusion') { score += 35; reasons.push('combined UIA target/action relation crop'); }
  const readiness = evidence?.visualActionReadiness;
  if (
    options.candidateKind === 'target' && ['needs-target-selection', 'low-confidence'].includes(readiness ?? '')
    || options.candidateKind === 'action' && ['needs-primary-action', 'needs-coordinate', 'needs-relation'].includes(readiness ?? '')
  ) {
    score += 14;
    reasons.push(`${options.candidateKind} matches readiness`);
  }
  const requestedTokens = new Set(textTokens(`${options.sourceText} ${options.userGoal}`));
  const candidateText = `${candidate.label ?? ''} ${candidate.name ?? ''} ${candidate.description ?? ''} ${candidate.relation ?? ''}`.toLowerCase();
  const relevance = [...requestedTokens].filter((token) => candidateText.includes(token)).length * 7;
  if (relevance) { score += relevance; reasons.push(`text relevance +${relevance}`); }
  const width = Number(candidate.bounds?.width);
  const height = Number(candidate.bounds?.height);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const ratio = candidate.bounds?.coordinateSpace?.includes('ratio') || (width <= 1 && height <= 1);
    if (ratio ? width * height <= 0.018 || Math.max(width, height) <= 0.16 : width <= 260 || height <= 150) {
      score += 8;
      reasons.push('small target needs close crop');
    }
  }
  return { reason: reasons.join(', ') || 'candidate has usable location evidence', score };
}

function isLoginContinuationContext(evidence: AgentStructuredToolEvidence | null) {
  const text = [
    evidence?.postActionState,
    evidence?.targetMatched,
    evidence?.primaryAction,
    evidence?.elementDescription,
    evidence?.relation,
    ...(evidence?.visibleTextCandidates ?? []),
  ].filter(Boolean).join('\n').normalize('NFKC');
  return evidence?.postActionState === 'login_required'
    || /(?:login|log\s*in|sign\s*in|continue|confirm|submit|\u767b\u5f55|\u767b\u9646|\u7ee7\u7eed|\u786e\u8ba4|\u63d0\u4ea4)/iu.test(text);
}

export function selectCandidate(options: {
  cropRelativeRatio?: boolean;
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const readiness = options.evidence?.visualActionReadiness ?? '';
  const targetCandidates = options.evidence?.targetCandidates ?? [];
  const actionCandidates = options.evidence?.actionCandidates ?? [];
  const relationCandidate = createRelationCandidate(options.evidence);
  // On an authentication/account gate the actionable control is the useful
  // refinement target; the visible app content is often just a background or
  // remembered-account card and must not displace the login action candidate.
  const preferAction = isLoginContinuationContext(options.evidence)
    || ['needs-primary-action', 'needs-coordinate', 'needs-relation'].includes(readiness);
  const candidates: Array<{ candidate: AgentStructuredToolCandidateEvidence; candidateKind: 'action' | 'target' }> = preferAction
    ? [
        ...(relationCandidate ? [{ candidate: relationCandidate, candidateKind: 'action' as const }] : []),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
      ]
    : [
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
      ];
  const synthetic = createSyntheticCandidate(options.evidence, options.cropRelativeRatio);
  if (synthetic && (!candidates.length || ['ready', 'low-confidence', 'needs-coordinate'].includes(readiness))) {
    candidates.push({ candidate: synthetic, candidateKind: options.evidence?.primaryAction ? 'action' : 'target' });
  }
  return candidates
    .filter(({ candidate }) => candidate.enabled !== false && candidate.offscreen !== true && hasAgentCandidateLocationEvidence(candidate))
    .map((choice, index) => ({
      ...choice,
      ...scoreCandidate({ ...choice, evidence: options.evidence, index, sourceText: options.sourceText, userGoal: options.userGoal }),
    }))
    .sort((a, b) => b.score - a.score)[0] ?? null;
}

function clampRatio(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(0.05, Math.min(0.9, value)) : fallback;
}

export function focusArgs(
  candidate: AgentStructuredToolCandidateEvidence,
  readiness: AgentStructuredToolEvidence['visualActionReadiness'] = null,
): Record<string, unknown> | null {
  const width = Number(candidate.bounds?.width);
  const height = Number(candidate.bounds?.height);
  const boundsRatio = candidate.bounds?.coordinateSpace?.includes('ratio') || (width <= 1 && height <= 1);
  const needsRelationContext = readiness === 'needs-relation';
  const contextMultiplier = needsRelationContext ? 4.8 : 2.4;
  const minWidthRatio = needsRelationContext ? 0.42 : 0.28;
  const minHeightRatio = needsRelationContext ? 0.36 : 0.24;
  const focusScale = readiness === 'ready'
    ? Math.max(2, candidate.confidence === 'low' ? 3 : candidate.confidence === 'medium' ? 2 : 2)
    : candidate.confidence === 'low'
    || Number.isFinite(width) && Number.isFinite(height) && (
      boundsRatio ? width * height <= 0.018 || Math.max(width, height) <= 0.16 : width <= 260 || height <= 150
    ) ? 3 : candidate.confidence === 'medium' ? 2 : 1;
  const scaleArgs = focusScale > 1 ? { focusScale } : {};
  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  if (Number.isFinite(ratioX) && Number.isFinite(ratioY) && ratioX >= 0 && ratioX <= 1 && ratioY >= 0 && ratioY <= 1) {
    return {
      focusCenterRatioX: ratioX,
      focusCenterRatioY: ratioY,
      focusHeightRatio: boundsRatio ? clampRatio(height * contextMultiplier, minHeightRatio) : minHeightRatio,
      ...scaleArgs,
      focusWidthRatio: boundsRatio ? clampRatio(width * contextMultiplier, minWidthRatio) : minWidthRatio,
    };
  }
  const x = Number(candidate.bounds?.x);
  const y = Number(candidate.bounds?.y);
  if ([x, y, width, height].every(Number.isFinite) && width > 0 && height > 0) {
    return {
      focusCoordinateSpace: candidate.bounds?.coordinateSpace?.trim() || 'native-screen',
        focusHeight: Math.max(needsRelationContext ? 260 : 120, Math.round(height * (needsRelationContext ? 4.4 : 2.2))),
      ...scaleArgs,
        focusWidth: Math.max(needsRelationContext ? 320 : 180, Math.round(width * (needsRelationContext ? 4.4 : 2.2))),
      focusX: Math.max(0, Math.round(x - width * 0.6)),
      focusY: Math.max(0, Math.round(y - height * 0.6)),
    };
  }
  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  return Number.isFinite(centerX) && Number.isFinite(centerY)
    ? {
        focusCoordinateSpace: candidate.center?.coordinateSpace?.trim() || 'native-screen',
        focusHeight: needsRelationContext ? 360 : 240,
        ...scaleArgs,
        focusWidth: needsRelationContext ? 520 : 360,
        focusX: Math.max(0, Math.round(centerX - 180)),
        focusY: Math.max(0, Math.round(centerY - 120)),
      }
    : null;
}
