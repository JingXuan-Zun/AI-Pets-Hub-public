import {
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolPointEvidence,
  type AgentStructuredToolRectEvidence,
} from '../agentChatCommand';

function normalizeAgentVisualScreenPoint(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function normalizeAgentVisualRectCenter(
  rect: AgentStructuredToolRectEvidence | null | undefined,
) {
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  const coordinateSpace = rect?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    x: Math.round(x + width / 2),
    y: Math.round(y + height / 2),
  };
}

export function normalizeAgentVisualRatioPoint(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }

  return { x, y };
}

function resolveAgentVisualRatioPointFromSourceBounds(
  evidence: AgentStructuredToolEvidence | null,
) {
  const ratioPoint = normalizeAgentVisualRatioPoint(evidence?.elementCenterRatio);
  const sourceBounds = evidence?.sourceBounds;
  const x = Number(sourceBounds?.x);
  const y = Number(sourceBounds?.y);
  const width = Number(sourceBounds?.width);
  const height = Number(sourceBounds?.height);
  if (
    !ratioPoint
    || ![x, y, width, height].every(Number.isFinite)
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  const coordinateSpace = sourceBounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    x: Math.round(x + width * ratioPoint.x),
    y: Math.round(y + height * ratioPoint.y),
  };
}

// Vision models sometimes return element points in the analyzed image's own pixels
// without a coordinate space; read as screen coordinates they land in another window
// (a WeGame login click once hit Calculator at 318,48). A screen point must lie inside
// the analyzed source, otherwise the ratio point derived from sourceBounds is used.
const AGENT_VISUAL_SOURCE_BOUNDS_TOLERANCE_PX = 8;

function keepAgentVisualPointInsideSource(
  point: { x: number; y: number } | null,
  evidence: AgentStructuredToolEvidence | null,
) {
  const bounds = evidence?.sourceBounds;
  const x = Number(bounds?.x); const y = Number(bounds?.y);
  const width = Number(bounds?.width); const height = Number(bounds?.height);
  const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (
    !point
    || coordinateSpace !== 'native-screen'
    || ![x, y, width, height].every(Number.isFinite)
    || width <= 0
    || height <= 0
  ) {
    return point;
  }
  const tolerance = AGENT_VISUAL_SOURCE_BOUNDS_TOLERANCE_PX;
  return point.x >= x - tolerance && point.x <= x + width + tolerance
    && point.y >= y - tolerance && point.y <= y + height + tolerance
    ? point
    : null;
}

export function resolveAgentVisualActionPoint(evidence: AgentStructuredToolEvidence | null) {
  const coordinateAuditStatus = evidence?.coordinateAuditStatus ?? evidence?.coordinateAudit?.status ?? null;
  if (coordinateAuditStatus && coordinateAuditStatus !== 'coordinate_ok') {
    return null;
  }

  return keepAgentVisualPointInsideSource(normalizeAgentVisualRectCenter(evidence?.elementBounds), evidence)
    ?? keepAgentVisualPointInsideSource(normalizeAgentVisualScreenPoint(evidence?.elementCenter), evidence)
    ?? resolveAgentVisualRatioPointFromSourceBounds(evidence);
}

function resolveAgentVisualNativePoint(
  point: AgentStructuredToolPointEvidence | null | undefined,
  evidence: AgentStructuredToolEvidence | null,
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() ?? 'native-screen';
  if (!coordinateSpace.includes('ratio')) {
    return { x, y };
  }
  const sourceBounds = evidence?.sourceBounds;
  const sourceX = Number(sourceBounds?.x);
  const sourceY = Number(sourceBounds?.y);
  const sourceWidth = Number(sourceBounds?.width);
  const sourceHeight = Number(sourceBounds?.height);
  if (
    sourceBounds?.coordinateSpace?.trim().toLowerCase() !== 'native-screen'
    || ![sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
    || sourceWidth <= 0
    || sourceHeight <= 0
  ) {
    return null;
  }
  return {
    x: sourceX + sourceWidth * x,
    y: sourceY + sourceHeight * y,
  };
}

function isAgentVisualNativePointInsideBounds(
  point: { x: number; y: number },
  bounds: AgentStructuredToolRectEvidence | null | undefined,
  evidence: AgentStructuredToolEvidence | null,
) {
  const left = resolveAgentVisualNativePoint({
    coordinateSpace: bounds?.coordinateSpace,
    x: bounds?.x,
    y: bounds?.y,
  }, evidence);
  const right = resolveAgentVisualNativePoint({
    coordinateSpace: bounds?.coordinateSpace,
    x: Number(bounds?.x) + Number(bounds?.width),
    y: Number(bounds?.y) + Number(bounds?.height),
  }, evidence);
  return Boolean(
    left
    && right
    && Number(bounds?.width) > 0
    && Number(bounds?.height) > 0
    && point.x >= left.x
    && point.x <= right.x
    && point.y >= left.y
    && point.y <= right.y,
  );
}

export function isAgentVisualPointInsideActionableArea(
  evidence: AgentStructuredToolEvidence | null,
  point: { x: number; y: number },
) {
  const getDeclaredCandidatePoint = (candidate: AgentStructuredToolCandidateEvidence) => {
    if (candidate.center) {
      return resolveAgentVisualNativePoint(candidate.center, evidence);
    }
    if (candidate.centerRatio) {
      return resolveAgentVisualNativePoint(candidate.centerRatio, evidence);
    }
    return null;
  };
  const actionCandidates = (evidence?.actionCandidates ?? [])
    .filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true)
    .filter((candidate) => candidate.bounds);
  if (actionCandidates.length) {
    return actionCandidates.some((candidate) => (
      (!getDeclaredCandidatePoint(candidate)
        || isAgentVisualNativePointInsideBounds(
          getDeclaredCandidatePoint(candidate)!,
          candidate.bounds,
          evidence,
        ))
      &&
      isAgentVisualNativePointInsideBounds(point, candidate.bounds, evidence)
    ));
  }
  return isAgentVisualNativePointInsideBounds(point, evidence?.elementBounds, evidence);
}

export function resolveAgentVisualCandidateScreenPoint(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
) {
  return keepAgentVisualPointInsideSource(normalizeAgentVisualRectCenter(candidate.bounds), evidence)
    ?? keepAgentVisualPointInsideSource(normalizeAgentVisualScreenPoint(candidate.center), evidence)
    ?? resolveAgentVisualRatioPointFromSourceBounds({
      elementCenterRatio: candidate.centerRatio,
      sourceBounds: evidence?.sourceBounds,
    } as AgentStructuredToolEvidence);
}
