import { type AgentStructuredToolPointEvidence, type AgentStructuredToolRectEvidence } from '../agentChatCommand';


function normalizeVisualSnapshotCoordinateValue(value: unknown) {
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function getVisualSnapshotObjectField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return null;
}

export function normalizeVisualSnapshotRatioValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }

  if (value > 1 && value <= 100) {
    return Math.max(0, Math.min(1, value / 100));
  }

  if (value >= 0 && value <= 1) {
    return value;
  }

  return null;
}

export function roundVisualSnapshotRatioValue(value: number) {
  return Math.round(value * 10_000) / 10_000;
}

export function normalizeVisualSnapshotPointObject(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  const x = normalizeVisualSnapshotCoordinateValue(value.x ?? value.left ?? value.centerX ?? value.cx);
  const y = normalizeVisualSnapshotCoordinateValue(value.y ?? value.top ?? value.centerY ?? value.cy);
  if (x === null || y === null) {
    return null;
  }

  return {
    coordinateSpace: typeof value.coordinateSpace === 'string' ? value.coordinateSpace : undefined,
    source: typeof value.source === 'string' ? value.source : undefined,
    x,
    y,
  } satisfies AgentStructuredToolPointEvidence;
}

export function normalizeVisualSnapshotRatioPointObject(value: Record<string, unknown> | null) {
  const point = normalizeVisualSnapshotPointObject(value);
  if (!point) {
    return null;
  }

  const x = normalizeVisualSnapshotRatioValue(point.x ?? null);
  const y = normalizeVisualSnapshotRatioValue(point.y ?? null);
  if (x === null || y === null) {
    return null;
  }

  return {
    ...point,
    coordinateSpace: point.coordinateSpace ?? 'source-ratio',
    x,
    y,
  } satisfies AgentStructuredToolPointEvidence;
}

export function normalizeVisualSnapshotRectObject(value: Record<string, unknown> | null) {
  if (!value) {
    return null;
  }

  const x = normalizeVisualSnapshotCoordinateValue(value.x ?? value.left);
  const y = normalizeVisualSnapshotCoordinateValue(value.y ?? value.top);
  const width = normalizeVisualSnapshotCoordinateValue(value.width ?? value.w);
  const height = normalizeVisualSnapshotCoordinateValue(value.height ?? value.h);
  if (x === null || y === null || width === null || height === null) {
    return null;
  }

  const coordinateSpace = typeof value.coordinateSpace === 'string' ? value.coordinateSpace : undefined;
  const inferredCoordinateSpace = coordinateSpace
    ?? ([x, y, width, height].every((item) => item >= 0 && item <= 1) ? 'source-ratio' : undefined);

  return {
    coordinateSpace: inferredCoordinateSpace,
    height,
    source: typeof value.source === 'string' ? value.source : undefined,
    width,
    x,
    y,
  } satisfies AgentStructuredToolRectEvidence;
}

export function normalizeVisualSnapshotCandidateConfidence(value: unknown) {
  const numericValue = getVisualSnapshotConfidenceValue(value);
  if (numericValue !== null) {
    return numericValue >= 0.8 ? 'high' : numericValue >= 0.6 ? 'medium' : 'low';
  }

  const text = typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase()
    : '';
  if (!text) {
    return null;
  }

  if (/^(?:high|sure|clear|confident|高|明确|清楚)$/iu.test(text)) {
    return 'high';
  }

  if (/^(?:medium|moderate|possible|maybe|中|可能)$/iu.test(text)) {
    return 'medium';
  }

  if (/^(?:low|unclear|weak|uncertain|低|不确定|不清楚)$/iu.test(text)) {
    return 'low';
  }

  return null;
}

export function getVisualSnapshotConfidenceValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.min(1, value));
  }

  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Number(value.trim());
    return Number.isFinite(parsedValue) ? Math.max(0, Math.min(1, parsedValue)) : null;
  }

  return null;
}
