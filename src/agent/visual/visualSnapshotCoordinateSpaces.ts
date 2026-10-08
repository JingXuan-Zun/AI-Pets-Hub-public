import { type AgentStructuredToolPointEvidence, type AgentStructuredToolRectEvidence } from '../agentChatCommand';
import { normalizeVisualSnapshotRatioValue, roundVisualSnapshotRatioValue } from './visualSnapshotCoordinateValues';
import { resolveVisualSnapshotSourceBounds } from './visualSnapshotSourceBounds';


export function createVisualSnapshotCandidatePointFromBounds(
  bounds: AgentStructuredToolRectEvidence | null | undefined,
) {
  const ratioPoint = createVisualSnapshotRatioPointFromBounds(bounds);
  if (ratioPoint) {
    return ratioPoint;
  }

  if (
    !bounds
    || !Number.isFinite(Number(bounds.x))
    || !Number.isFinite(Number(bounds.y))
    || !Number.isFinite(Number(bounds.width))
    || !Number.isFinite(Number(bounds.height))
  ) {
    return null;
  }

  return {
    coordinateSpace: bounds.coordinateSpace ?? 'native-screen',
    source: bounds.source ?? 'candidateBounds',
    x: Math.round(Number(bounds.x) + Number(bounds.width) / 2),
    y: Math.round(Number(bounds.y) + Number(bounds.height) / 2),
  } satisfies AgentStructuredToolPointEvidence;
}

export function getVisualSnapshotCoordinateSpace(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function isVisualSnapshotRatioPointEvidence(point: AgentStructuredToolPointEvidence | null | undefined) {
  if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) {
    return false;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(point.coordinateSpace);
  return coordinateSpace.includes('ratio')
    || (
      !coordinateSpace
      && Number(point.x) >= 0
      && Number(point.x) <= 1
      && Number(point.y) >= 0
      && Number(point.y) <= 1
    );
}

export function normalizeVisualSnapshotScreenPointEvidence(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  if (
    !point
    || !Number.isFinite(Number(point.x))
    || !Number.isFinite(Number(point.y))
    || isVisualSnapshotRatioPointEvidence(point)
  ) {
    return null;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(point.coordinateSpace);
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    ...point,
    coordinateSpace: 'native-screen',
    x: Math.round(Number(point.x)),
    y: Math.round(Number(point.y)),
  } satisfies AgentStructuredToolPointEvidence;
}

export function normalizeVisualSnapshotRatioPointEvidence(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  if (!isVisualSnapshotRatioPointEvidence(point)) {
    return null;
  }

  const x = normalizeVisualSnapshotRatioValue(Number(point?.x));
  const y = normalizeVisualSnapshotRatioValue(Number(point?.y));
  if (x === null || y === null) {
    return null;
  }

  return {
    ...point,
    coordinateSpace: 'source-ratio',
    x: roundVisualSnapshotRatioValue(x),
    y: roundVisualSnapshotRatioValue(y),
  } satisfies AgentStructuredToolPointEvidence;
}

function isVisualSnapshotRatioRectEvidence(rect: AgentStructuredToolRectEvidence | null | undefined) {
  if (
    !rect
    || !Number.isFinite(Number(rect.x))
    || !Number.isFinite(Number(rect.y))
    || !Number.isFinite(Number(rect.width))
    || !Number.isFinite(Number(rect.height))
    || Number(rect.width) <= 0
    || Number(rect.height) <= 0
  ) {
    return false;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(rect.coordinateSpace);
  return coordinateSpace.includes('ratio')
    || (
      !coordinateSpace
      && Number(rect.x) >= 0
      && Number(rect.x) <= 1
      && Number(rect.y) >= 0
      && Number(rect.y) <= 1
      && Number(rect.width) > 0
      && Number(rect.width) <= 1
      && Number(rect.height) > 0
      && Number(rect.height) <= 1
    );
}

export function normalizeVisualSnapshotScreenRectEvidence(
  rect: AgentStructuredToolRectEvidence | null | undefined,
) {
  if (
    !rect
    || !Number.isFinite(Number(rect.x))
    || !Number.isFinite(Number(rect.y))
    || !Number.isFinite(Number(rect.width))
    || !Number.isFinite(Number(rect.height))
    || Number(rect.width) <= 0
    || Number(rect.height) <= 0
    || isVisualSnapshotRatioRectEvidence(rect)
  ) {
    return null;
  }

  const coordinateSpace = getVisualSnapshotCoordinateSpace(rect.coordinateSpace);
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    ...rect,
    coordinateSpace: 'native-screen',
    height: Math.round(Number(rect.height)),
    width: Math.round(Number(rect.width)),
    x: Math.round(Number(rect.x)),
    y: Math.round(Number(rect.y)),
  } satisfies AgentStructuredToolRectEvidence;
}

export function createVisualSnapshotRatioPointFromBounds(
  bounds: AgentStructuredToolRectEvidence | null | undefined,
) {
  if (!isVisualSnapshotRatioRectEvidence(bounds)) {
    return null;
  }

  const x = normalizeVisualSnapshotRatioValue(Number(bounds?.x) + Number(bounds?.width) / 2);
  const y = normalizeVisualSnapshotRatioValue(Number(bounds?.y) + Number(bounds?.height) / 2);
  if (x === null || y === null) {
    return null;
  }

  return {
    coordinateSpace: 'source-ratio',
    source: bounds?.source ?? 'ratioBounds',
    x: roundVisualSnapshotRatioValue(x),
    y: roundVisualSnapshotRatioValue(y),
  } satisfies AgentStructuredToolPointEvidence;
}

export function resolveVisualSnapshotAbsoluteRectFromRatio(options: {
  ratioBounds?: AgentStructuredToolRectEvidence | null;
  source: DesktopPetCaptureSourceLike;
}) {
  const ratioBounds = options.ratioBounds;
  if (!isVisualSnapshotRatioRectEvidence(ratioBounds)) {
    return null;
  }

  const sourceBounds = resolveVisualSnapshotSourceBounds(options.source);
  if (!sourceBounds) {
    return null;
  }

  const xRatio = Math.max(0, Math.min(1, Number(ratioBounds?.x)));
  const yRatio = Math.max(0, Math.min(1, Number(ratioBounds?.y)));
  const widthRatio = Math.max(0, Math.min(1, Number(ratioBounds?.width)));
  const heightRatio = Math.max(0, Math.min(1, Number(ratioBounds?.height)));

  return {
    coordinateSpace: 'native-screen',
    height: Math.max(1, Math.round(sourceBounds.height * heightRatio)),
    source: ratioBounds?.source ?? 'ratioBounds',
    width: Math.max(1, Math.round(sourceBounds.width * widthRatio)),
    x: Math.round(sourceBounds.x + sourceBounds.width * xRatio),
    y: Math.round(sourceBounds.y + sourceBounds.height * yRatio),
  } satisfies AgentStructuredToolRectEvidence;
}
