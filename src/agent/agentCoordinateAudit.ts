export type AgentCoordinateAuditStatus =
  | 'coordinate_ok'
  | 'coordinate_out_of_bounds'
  | 'coordinate_display_mismatch'
  | 'coordinate_unknown';

export interface AgentCoordinateAuditPointLike {
  coordinateSpace?: string | null;
  x?: number | null;
  y?: number | null;
}

export interface AgentCoordinateAuditRectLike {
  height?: number | null;
  width?: number | null;
  x?: number | null;
  y?: number | null;
}

export interface AgentCoordinateAuditSourceLike {
  bounds?: AgentCoordinateAuditRectLike | null;
  boundsCoordinateSpace?: string | null;
  displayId?: string | null;
  height?: number | null;
  id?: string | null;
  nativeBoundsSource?: string | null;
  name?: string | null;
  scaleFactor?: number | null;
  type?: 'screen' | 'window' | string | null;
  width?: number | null;
}

export interface AgentCoordinateAuditDistanceToBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface AgentCoordinateAuditEvidence {
  coordinateSpace?: string | null;
  distanceToBounds?: AgentCoordinateAuditDistanceToBounds | null;
  insideSourceBounds?: boolean | null;
  point?: {
    x: number;
    y: number;
  } | null;
  pointDisplayId?: string | null;
  pointDisplayLabel?: string | null;
  reason: string;
  sourceBounds?: {
    height: number;
    width: number;
    x: number;
    y: number;
  } | null;
  sourceBoundsCoordinateSpace?: string | null;
  sourceDisplayId?: string | null;
  sourceDisplayLabel?: string | null;
  sourceId?: string | null;
  sourceName?: string | null;
  sourceNativeBoundsSource?: string | null;
  sourceRatio?: {
    x: number;
    y: number;
  } | null;
  sourceScaleFactor?: number | null;
  sourceType?: string | null;
  status: AgentCoordinateAuditStatus;
}

function roundAgentCoordinateAuditNumber(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeAgentCoordinateAuditRect(rect?: AgentCoordinateAuditRectLike | null) {
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    height: Math.round(height),
    width: Math.round(width),
    x: Math.round(x),
    y: Math.round(y),
  };
}

function resolveAgentCoordinateAuditSourceBounds(source?: AgentCoordinateAuditSourceLike | null) {
  const explicitBounds = normalizeAgentCoordinateAuditRect(source?.bounds);
  if (explicitBounds) {
    return explicitBounds;
  }

  return null;
}

function getAgentCoordinateAuditDisplayId(source?: AgentCoordinateAuditSourceLike | null) {
  return source?.displayId?.trim()
    || (source?.type === 'screen' ? source.id?.trim() : '')
    || null;
}

function getAgentCoordinateAuditDisplayLabel(source?: AgentCoordinateAuditSourceLike | null) {
  return source?.name?.trim()
    || source?.id?.trim()
    || null;
}

function getAgentCoordinateAuditSourceBoundsCoordinateSpace(source?: AgentCoordinateAuditSourceLike | null) {
  const explicitSpace = source?.boundsCoordinateSpace?.trim();
  if (explicitSpace) {
    return explicitSpace;
  }

  return source?.type === 'screen' ? 'native-screen' : null;
}

function getAgentCoordinateAuditSourceScaleFactor(source?: AgentCoordinateAuditSourceLike | null) {
  const value = Number(source?.scaleFactor);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function isAgentCoordinateAuditPointInsideRect(
  point: { x: number; y: number },
  rect: { height: number; width: number; x: number; y: number },
) {
  return point.x >= rect.x
    && point.x < rect.x + rect.width
    && point.y >= rect.y
    && point.y < rect.y + rect.height;
}

function findAgentCoordinateAuditPointDisplay(
  point: { x: number; y: number },
  displaySources?: AgentCoordinateAuditSourceLike[] | null,
) {
  const sources = Array.isArray(displaySources) ? displaySources : [];
  return sources.find((source) => {
    if (source.type && source.type !== 'screen') {
      return false;
    }

    const bounds = resolveAgentCoordinateAuditSourceBounds(source);
    return bounds ? isAgentCoordinateAuditPointInsideRect(point, bounds) : false;
  }) ?? null;
}

function createAgentCoordinateAuditDistanceToBounds(
  point: { x: number; y: number },
  bounds: { height: number; width: number; x: number; y: number },
): AgentCoordinateAuditDistanceToBounds {
  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.height;
  return {
    bottom: roundAgentCoordinateAuditNumber(bottom - point.y, 2),
    left: roundAgentCoordinateAuditNumber(point.x - bounds.x, 2),
    right: roundAgentCoordinateAuditNumber(right - point.x, 2),
    top: roundAgentCoordinateAuditNumber(point.y - bounds.y, 2),
  };
}

function createAgentCoordinateAuditSourceRatio(
  point: { x: number; y: number },
  bounds: { height: number; width: number; x: number; y: number },
) {
  return {
    x: roundAgentCoordinateAuditNumber((point.x - bounds.x) / bounds.width),
    y: roundAgentCoordinateAuditNumber((point.y - bounds.y) / bounds.height),
  };
}

export function createAgentCoordinateAuditEvidence(options: {
  displaySources?: AgentCoordinateAuditSourceLike[] | null;
  point?: AgentCoordinateAuditPointLike | null;
  source?: AgentCoordinateAuditSourceLike | null;
}): AgentCoordinateAuditEvidence {
  const coordinateSpace = options.point?.coordinateSpace?.trim() || 'native-screen';
  const x = Number(options.point?.x);
  const y = Number(options.point?.y);
  const source = options.source ?? null;
  const sourceBounds = resolveAgentCoordinateAuditSourceBounds(source);
  const sourceBoundsCoordinateSpace = getAgentCoordinateAuditSourceBoundsCoordinateSpace(source);
  const sourceDisplayId = getAgentCoordinateAuditDisplayId(source);
  const sourceDisplayLabel = getAgentCoordinateAuditDisplayLabel(source);
  const sourceNativeBoundsSource = source?.nativeBoundsSource?.trim() || null;
  const sourceScaleFactor = getAgentCoordinateAuditSourceScaleFactor(source);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return {
      coordinateSpace,
      insideSourceBounds: null,
      point: null,
      pointDisplayId: null,
      pointDisplayLabel: null,
      reason: 'No finite native-screen point was available to audit.',
      sourceBounds,
      sourceBoundsCoordinateSpace,
      sourceDisplayId,
      sourceDisplayLabel,
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? null,
      sourceNativeBoundsSource,
      sourceRatio: null,
      sourceScaleFactor,
      sourceType: source?.type ?? null,
      status: 'coordinate_unknown',
    };
  }

  const point = {
    x: Math.round(x),
    y: Math.round(y),
  };

  if (coordinateSpace.toLowerCase() !== 'native-screen') {
    return {
      coordinateSpace,
      insideSourceBounds: null,
      point,
      pointDisplayId: null,
      pointDisplayLabel: null,
      reason: `Point coordinateSpace is ${coordinateSpace}, not native-screen.`,
      sourceBounds,
      sourceBoundsCoordinateSpace,
      sourceDisplayId,
      sourceDisplayLabel,
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? null,
      sourceNativeBoundsSource,
      sourceRatio: null,
      sourceScaleFactor,
      sourceType: source?.type ?? null,
      status: 'coordinate_unknown',
    };
  }

  const pointDisplay = findAgentCoordinateAuditPointDisplay(point, options.displaySources);
  const pointDisplayId = getAgentCoordinateAuditDisplayId(pointDisplay);
  const pointDisplayLabel = getAgentCoordinateAuditDisplayLabel(pointDisplay);
  const insideSourceBounds = sourceBounds
    ? isAgentCoordinateAuditPointInsideRect(point, sourceBounds)
    : null;
  const sourceRatio = sourceBounds ? createAgentCoordinateAuditSourceRatio(point, sourceBounds) : null;
  const distanceToBounds = sourceBounds ? createAgentCoordinateAuditDistanceToBounds(point, sourceBounds) : null;
  const displayMismatch = Boolean(
    pointDisplayId
      && sourceDisplayId
      && pointDisplayId !== sourceDisplayId,
  );

  if (!sourceBounds) {
    return {
      coordinateSpace,
      distanceToBounds,
      insideSourceBounds,
      point,
      pointDisplayId,
      pointDisplayLabel,
      reason: 'Capture source has no screen bounds, so the point cannot be audited against a source rectangle.',
      sourceBounds,
      sourceBoundsCoordinateSpace,
      sourceDisplayId,
      sourceDisplayLabel,
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? null,
      sourceNativeBoundsSource,
      sourceRatio,
      sourceScaleFactor,
      sourceType: source?.type ?? null,
      status: 'coordinate_unknown',
    };
  }

  if (displayMismatch) {
    return {
      coordinateSpace,
      distanceToBounds,
      insideSourceBounds,
      point,
      pointDisplayId,
      pointDisplayLabel,
      reason: `Point belongs to display ${pointDisplayLabel ?? pointDisplayId}, but the capture source is display ${sourceDisplayLabel ?? sourceDisplayId}.`,
      sourceBounds,
      sourceBoundsCoordinateSpace,
      sourceDisplayId,
      sourceDisplayLabel,
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? null,
      sourceNativeBoundsSource,
      sourceRatio,
      sourceScaleFactor,
      sourceType: source?.type ?? null,
      status: 'coordinate_display_mismatch',
    };
  }

  if (insideSourceBounds === false) {
    return {
      coordinateSpace,
      distanceToBounds,
      insideSourceBounds,
      point,
      pointDisplayId,
      pointDisplayLabel,
      reason: 'Point is outside the selected capture source bounds.',
      sourceBounds,
      sourceBoundsCoordinateSpace,
      sourceDisplayId,
      sourceDisplayLabel,
      sourceId: source?.id ?? null,
      sourceName: source?.name ?? null,
      sourceNativeBoundsSource,
      sourceRatio,
      sourceScaleFactor,
      sourceType: source?.type ?? null,
      status: 'coordinate_out_of_bounds',
    };
  }

  return {
    coordinateSpace,
    distanceToBounds,
    insideSourceBounds,
    point,
    pointDisplayId,
    pointDisplayLabel,
    reason: 'Point is inside the selected capture source bounds and display ownership is consistent.',
    sourceBounds,
    sourceBoundsCoordinateSpace,
    sourceDisplayId,
    sourceDisplayLabel,
    sourceId: source?.id ?? null,
    sourceName: source?.name ?? null,
    sourceNativeBoundsSource,
    sourceRatio,
    sourceScaleFactor,
    sourceType: source?.type ?? null,
    status: 'coordinate_ok',
  };
}

export function formatAgentCoordinateAuditLine(
  audit: AgentCoordinateAuditEvidence | null | undefined,
  prefix = 'Coordinate audit',
) {
  if (!audit) {
    return '';
  }

  return [
    `${prefix}: status=${audit.status}`,
    audit.point ? `point=${audit.point.x},${audit.point.y}` : '',
    typeof audit.insideSourceBounds === 'boolean' ? `insideSource=${audit.insideSourceBounds}` : '',
    audit.sourceRatio ? `sourceRatio=${audit.sourceRatio.x},${audit.sourceRatio.y}` : '',
    audit.pointDisplayLabel || audit.pointDisplayId ? `pointDisplay=${audit.pointDisplayLabel ?? audit.pointDisplayId}` : '',
    audit.sourceDisplayLabel || audit.sourceDisplayId ? `sourceDisplay=${audit.sourceDisplayLabel ?? audit.sourceDisplayId}` : '',
    audit.sourceBoundsCoordinateSpace ? `boundsSpace=${audit.sourceBoundsCoordinateSpace}` : '',
    audit.sourceNativeBoundsSource ? `nativeBounds=${audit.sourceNativeBoundsSource}` : '',
    audit.sourceScaleFactor ? `scale=${audit.sourceScaleFactor}` : '',
    `reason=${audit.reason}`,
  ].filter(Boolean).join(' | ');
}
