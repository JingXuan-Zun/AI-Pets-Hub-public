import { type AgentStructuredToolPointEvidence, type AgentStructuredToolRectEvidence } from '../agentChatCommand';
import { createAgentCoordinateAuditEvidence } from '../agentCoordinateAudit';
import { createVisualSnapshotCandidatePointFromBounds, normalizeVisualSnapshotScreenPointEvidence, normalizeVisualSnapshotScreenRectEvidence } from './visualSnapshotCoordinateSpaces';
import { resolveVisualSnapshotSourceBounds } from './visualSnapshotSourceBounds';

export function createVisualSnapshotSourceLabel(source: DesktopPetCaptureSourceLike) {
  const sizeText = source.width && source.height ? `${source.width}x${source.height}` : 'unknown-size';
  const displayText = source.displayId ? ` display=${source.displayId}` : '';
  return `[${source.type}] ${source.name} ${sizeText}${displayText}`;
}



export function resolveVisualSnapshotAbsolutePointFromRatio(options: {
  ratioCenter?: AgentStructuredToolPointEvidence | null;
  source: DesktopPetCaptureSourceLike;
}) {
  const ratioCenter = options.ratioCenter;
  if (
    !ratioCenter
    || !Number.isFinite(Number(ratioCenter.x))
    || !Number.isFinite(Number(ratioCenter.y))
  ) {
    return null;
  }

  const sourceBounds = resolveVisualSnapshotSourceBounds(options.source);
  if (!sourceBounds) {
    return null;
  }

  const xRatio = Math.max(0, Math.min(1, Number(ratioCenter.x)));
  const yRatio = Math.max(0, Math.min(1, Number(ratioCenter.y)));

  return {
    coordinateSpace: 'native-screen',
    source: 'elementCenterRatio',
    x: Math.round(sourceBounds.x + sourceBounds.width * xRatio),
    y: Math.round(sourceBounds.y + sourceBounds.height * yRatio),
  } satisfies AgentStructuredToolPointEvidence;
}

export function resolveVisualSnapshotAuditedElementCenter(options: {
  availableSources: DesktopPetCaptureSourceLike[];
  derivedAbsoluteCenter?: AgentStructuredToolPointEvidence | null;
  rawElementBounds?: AgentStructuredToolRectEvidence | null;
  rawElementCenter?: AgentStructuredToolPointEvidence | null;
  resolvedScreenBoundsFromRatio?: AgentStructuredToolRectEvidence | null;
  source?: DesktopPetCaptureSourceLike | null;
}) {
  const normalizedRawCenter = normalizeVisualSnapshotScreenPointEvidence(options.rawElementCenter);
  const boundsCenter = createVisualSnapshotCandidatePointFromBounds(
    normalizeVisualSnapshotScreenRectEvidence(options.rawElementBounds) ?? options.resolvedScreenBoundsFromRatio,
  );

  if (!options.source) {
    return normalizedRawCenter ?? boundsCenter ?? options.derivedAbsoluteCenter ?? null;
  }

  const rawAudit = normalizedRawCenter
    ? createAgentCoordinateAuditEvidence({
        displaySources: options.availableSources,
        point: normalizedRawCenter,
        source: options.source,
      })
    : null;
  if (rawAudit?.status === 'coordinate_ok') {
    return normalizedRawCenter;
  }

  const derivedAudit = options.derivedAbsoluteCenter
    ? createAgentCoordinateAuditEvidence({
        displaySources: options.availableSources,
        point: options.derivedAbsoluteCenter,
        source: options.source,
      })
    : null;
  if (derivedAudit?.status === 'coordinate_ok') {
    return options.derivedAbsoluteCenter ?? null;
  }

  const boundsAudit = boundsCenter
    ? createAgentCoordinateAuditEvidence({
        displaySources: options.availableSources,
        point: boundsCenter,
        source: options.source,
      })
    : null;
  if (boundsAudit?.status === 'coordinate_ok') {
    return boundsCenter;
  }

  return normalizedRawCenter ?? boundsCenter ?? options.derivedAbsoluteCenter ?? null;
}

export function createVisualSnapshotSourceGeometryEvidence(source: DesktopPetCaptureSourceLike) {
  const bounds = resolveVisualSnapshotSourceBounds(source);
  return {
    bounds: bounds
      ? {
          coordinateSpace: 'native-screen',
          height: bounds.height,
          source: 'capture-source',
          sourceId: source.id || null,
          width: bounds.width,
          x: bounds.x,
          y: bounds.y,
        } satisfies AgentStructuredToolRectEvidence
      : null,
    line: bounds
      ? `Visual source bounds: x=${bounds.x} y=${bounds.y} width=${bounds.width} height=${bounds.height}`
      : '',
  };
}
