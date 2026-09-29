import {
  type AgentChatCommand,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
} from './agentChatCommand';

export type AgentVisualTargetVerificationStatus = 'passed' | 'blocked';

export interface AgentVisualTargetVerification {
  consistency: 'passed' | 'missing' | 'inconsistent';
  focusReview: 'passed' | 'missing';
  reason: string;
  sampleCount: number;
  status: AgentVisualTargetVerificationStatus;
  targetArea: 'present' | 'missing';
}

export interface AgentVisualSampleConsensus {
  agreementCount: number;
  sampleCount: number;
  status: 'passed' | 'needs-more-samples' | 'blocked';
  reason: string;
}

function hasFiniteBounds(bounds: AgentStructuredToolCandidateEvidence['bounds']) {
  return Boolean(
    Number.isFinite(Number(bounds?.x))
      && Number.isFinite(Number(bounds?.y))
      && Number.isFinite(Number(bounds?.width))
      && Number.isFinite(Number(bounds?.height))
      && Number(bounds?.width) > 0
      && Number(bounds?.height) > 0,
  );
}

function hasFinitePoint(point: { x?: number | null; y?: number | null } | null | undefined) {
  return Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y));
}

function hasLocationPoint(evidence: AgentStructuredToolEvidence | null) {
  return Boolean(
    hasFinitePoint(evidence?.elementCenter)
      || hasFinitePoint(evidence?.elementCenterRatio),
  );
}

function hasTargetArea(evidence: AgentStructuredToolEvidence | null, command: AgentChatCommand) {
  if (!evidence) return false;
  if (hasFiniteBounds(evidence.elementBounds)) return true;
  if (
    [...(evidence.actionCandidates ?? []), ...(evidence.targetCandidates ?? [])]
      .some((candidate) => hasFiniteBounds(candidate.bounds))
  ) {
    return true;
  }

  const input = command.toolCall?.input ?? {};
  const focusWidth = Number(input.focusWidthRatio ?? input.focusWidth);
  const focusHeight = Number(input.focusHeightRatio ?? input.focusHeight);
  const focusCenterX = Number(input.focusCenterRatioX ?? input.focusX);
  const focusCenterY = Number(input.focusCenterRatioY ?? input.focusY);
  return Number.isFinite(focusWidth)
    && Number.isFinite(focusHeight)
    && focusWidth > 0
    && focusHeight > 0
    && Number.isFinite(focusCenterX)
    && Number.isFinite(focusCenterY)
    && hasLocationPoint(evidence);
}

function hasMagnifiedFocusReview(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const scale = Number(input.focusScale ?? input.cropScale ?? input.magnification);
  const hasFocusBounds = [
    input.focusWidthRatio,
    input.focusHeightRatio,
    input.focusWidth,
    input.focusHeight,
  ].some((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return Number.isFinite(scale) && scale >= 2 && hasFocusBounds;
}

function hasIndependentWindowReview(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  return input.sourceType === 'window'
    && input.forceRefresh === true
    && typeof input.sourceQuery === 'string'
    && Boolean(input.sourceQuery.trim());
}

function textTokens(value: unknown) {
  const genericTokens = new Set([
    'action',
    'app',
    'button',
    'control',
    'current',
    'element',
    'target',
    'window',
    '动作',
    '应用',
    '按钮',
    '控件',
    '当前',
    '目标',
    '窗口',
  ]);
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}]+/gu)
        .filter((token) => token.length > 1 && !genericTokens.has(token))
    : [];
}

function textAgrees(first: unknown, second: unknown) {
  const firstTokens = new Set(textTokens(first));
  const secondTokens = textTokens(second);
  if (!firstTokens.size || !secondTokens.length) return false;
  const overlap = secondTokens.filter((token) => firstTokens.has(token)).length;
  return overlap >= Math.min(2, firstTokens.size, secondTokens.length);
}

function candidateTexts(candidates: AgentStructuredToolCandidateEvidence[] | null | undefined) {
  return (candidates ?? []).flatMap((candidate) => [
    candidate.label,
    candidate.name,
    candidate.description,
  ]).filter((value): value is string => typeof value === 'string' && Boolean(value.trim()));
}

function evidenceTextAgrees(options: {
  current: unknown;
  previous: unknown;
  previousCandidates?: AgentStructuredToolCandidateEvidence[] | null;
}) {
  return textAgrees(options.previous, options.current)
    || candidateTexts(options.previousCandidates).some((text) => textAgrees(text, options.current));
}

function evidenceHasActionLocation(evidence: AgentStructuredToolEvidence | null) {
  return Boolean(
    hasFinitePoint(evidence?.elementCenter)
      || hasFinitePoint(evidence?.elementCenterRatio)
      || (evidence?.actionCandidates ?? []).some((candidate) => (
        hasFinitePoint(candidate.center)
          || hasFinitePoint(candidate.centerRatio)
          || hasFiniteBounds(candidate.bounds)
      )),
  );
}

function getPoint(evidence: AgentStructuredToolEvidence | null) {
  const candidate = [
    ...(evidence?.actionCandidates ?? []),
    ...(evidence?.targetCandidates ?? []),
  ].find((item) => item.enabled !== false && item.offscreen !== true && (
    hasFinitePoint(item.center)
      || hasFinitePoint(item.centerRatio)
      || hasFiniteBounds(item.bounds)
  ));
  const point = hasFinitePoint(candidate?.center)
    ? candidate?.center
    : hasFinitePoint(candidate?.centerRatio)
      ? candidate?.centerRatio
      : hasFinitePoint(evidence?.elementCenter)
        ? evidence?.elementCenter
        : hasFinitePoint(evidence?.elementCenterRatio)
          ? evidence?.elementCenterRatio
          : null;
  if (!point || !hasFinitePoint(point)) {
    if (candidate && hasFiniteBounds(candidate.bounds)) {
      const bounds = candidate.bounds;
      const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
      if (coordinateSpace === 'native-screen') {
        return {
          coordinateSpace,
          x: Number(bounds.x) + Number(bounds.width) / 2,
          y: Number(bounds.y) + Number(bounds.height) / 2,
        };
      }
    }
    return null;
  }

  const coordinateSpace = point.coordinateSpace?.includes('ratio') ? 'ratio' : 'native-screen';
  if (coordinateSpace === 'native-screen') {
    return { coordinateSpace, x: Number(point.x), y: Number(point.y) };
  }

  const bounds = evidence?.sourceBounds;
  const boundsX = Number(bounds?.x);
  const boundsY = Number(bounds?.y);
  const boundsWidth = Number(bounds?.width);
  const boundsHeight = Number(bounds?.height);
  if (
    bounds?.coordinateSpace?.trim().toLowerCase() === 'native-screen'
    && [boundsX, boundsY, boundsWidth, boundsHeight].every(Number.isFinite)
    && boundsWidth > 0
    && boundsHeight > 0
  ) {
    return {
      coordinateSpace: 'native-screen',
      x: boundsX + boundsWidth * Number(point.x),
      y: boundsY + boundsHeight * Number(point.y),
    };
  }

  if (candidate && hasFiniteBounds(candidate.bounds)) {
    const candidateBounds = candidate.bounds;
    if (candidateBounds?.coordinateSpace?.trim().toLowerCase() === 'native-screen') {
      return {
        coordinateSpace: 'native-screen',
        x: Number(candidateBounds.x) + Number(candidateBounds.width) / 2,
        y: Number(candidateBounds.y) + Number(candidateBounds.height) / 2,
      };
    }
  }

  return { coordinateSpace, x: Number(point.x), y: Number(point.y) };
}

function locationsAgree(first: AgentStructuredToolEvidence | null, second: AgentStructuredToolEvidence | null) {
  const firstPoint = getPoint(first);
  const secondPoint = getPoint(second);
  if (!firstPoint || !secondPoint) return false;
  if (firstPoint.coordinateSpace !== secondPoint.coordinateSpace) {
    return false;
  }
  const distance = Math.hypot(firstPoint.x - secondPoint.x, firstPoint.y - secondPoint.y);
  return firstPoint.coordinateSpace === 'ratio' ? distance <= 0.12 : distance <= 96;
}

export function evaluateAgentVisualTargetVerification(options: {
  command: AgentChatCommand;
  current: AgentStructuredToolEvidence | null;
  previous: AgentStructuredToolEvidence | null;
}): AgentVisualTargetVerification {
  const targetArea = hasTargetArea(options.current, options.command) ? 'present' : 'missing';
  const focusReview = hasMagnifiedFocusReview(options.command) || hasIndependentWindowReview(options.command)
    ? 'passed'
    : 'missing';
  if (!options.previous) {
    return {
      consistency: 'missing',
      focusReview,
      reason: 'A second visual result is required before coordinate approval.',
      sampleCount: 1,
      status: 'blocked',
      targetArea,
    };
  }

  const targetAgrees = evidenceTextAgrees({
    current: options.current?.targetMatched,
    previous: options.previous.targetMatched,
    previousCandidates: options.previous.targetCandidates,
  });
  const previousActionTokens = textTokens(options.previous.primaryAction);
  const actionAgrees = previousActionTokens.length
    ? evidenceTextAgrees({
        current: options.current?.primaryAction,
        previous: options.previous.primaryAction,
        previousCandidates: options.previous.actionCandidates,
      })
    : textTokens(options.current?.primaryAction).length > 0;
  const locationAgrees = locationsAgree(options.previous, options.current);
  const consistency = targetAgrees && actionAgrees && locationAgrees ? 'passed' : 'inconsistent';
  const passed = targetArea === 'present' && focusReview === 'passed' && consistency === 'passed';
  return {
    consistency,
    focusReview,
    reason: passed
      ? 'Target area, independent window review, and two-result visual agreement passed.'
      : [
          targetArea === 'missing' ? 'A bounded target area is missing.' : '',
          focusReview === 'missing' ? 'Magnified focus review is missing.' : '',
          consistency !== 'passed' ? 'The target/action evidence is not consistent across visual results.' : '',
        ].filter(Boolean).join(' '),
    sampleCount: 2,
    status: passed ? 'passed' : 'blocked',
    targetArea,
  };
}

/**
 * A single visual result is provisional. Accept a majority across at most
 * three samples so one misread or an in-flight frame does not end the task.
 */
export function evaluateAgentVisualSampleConsensus(options: {
  command: AgentChatCommand;
  samples: Array<AgentStructuredToolEvidence | null>;
}): AgentVisualSampleConsensus {
  const samples = options.samples.filter(Boolean) as AgentStructuredToolEvidence[];
  if (samples.length < 2) {
    return {
      agreementCount: samples.length,
      sampleCount: samples.length,
      status: 'needs-more-samples',
      reason: 'At least two independent visual samples are required before approval.',
    };
  }

  const agreeingPairs: Array<[number, number]> = [];
  for (let firstIndex = 0; firstIndex < samples.length - 1; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < samples.length; secondIndex += 1) {
      const first = samples[firstIndex];
      const second = samples[secondIndex];
      const targetAgrees = evidenceTextAgrees({
        current: second.targetMatched,
        previous: first.targetMatched,
        previousCandidates: first.targetCandidates,
      });
      const bothHaveActionLocation = evidenceHasActionLocation(first)
        && evidenceHasActionLocation(second);
      const actionAgrees = !bothHaveActionLocation || evidenceTextAgrees({
        current: second.primaryAction,
        previous: first.primaryAction,
        previousCandidates: first.actionCandidates,
      });
      const locationAgrees = !bothHaveActionLocation || locationsAgree(first, second);
      if (hasTargetArea(second, options.command) && targetAgrees && actionAgrees && locationAgrees) {
        agreeingPairs.push([firstIndex, secondIndex]);
      }
    }
  }
  const agreementCount = agreeingPairs.length ? 2 : 1;
  if (agreementCount >= 2) {
    return {
      agreementCount,
      sampleCount: samples.length,
      status: 'passed',
      reason: `Visual target/action/coordinate consensus reached (${agreementCount}/${samples.length} samples).`,
    };
  }

  if (samples.length < 3) {
    return {
      agreementCount,
      sampleCount: samples.length,
      status: 'needs-more-samples',
      reason: 'The first two visual samples disagree; collect one more fresh sample before deciding.',
    };
  }

  return {
    agreementCount,
    sampleCount: samples.length,
    status: 'blocked',
    reason: 'Three visual samples did not produce a two-sample consensus; no click is safe.',
  };
}
