import {
  createAgentCoordinateAuditEvidence,
  type AgentCoordinateAuditEvidence,
  type AgentCoordinateAuditSourceLike,
} from './agentCoordinateAudit';

export interface AgentCoordinateHarnessRatioPoint {
  x?: number | null;
  y?: number | null;
}

export interface AgentCoordinateHarnessScreenPoint {
  x?: number | null;
  y?: number | null;
}

export interface AgentCoordinateHarnessRegionState {
  signature?: string | null;
  trusted?: boolean | null;
}

export interface AgentCoordinateHarnessResult {
  audit: AgentCoordinateAuditEvidence;
  clickPoint: {
    x: number;
    y: number;
  } | null;
  redDotRatio: {
    x: number;
    y: number;
  } | null;
  status:
    | 'coordinate_closure_ok'
    | 'coordinate_closure_untrusted'
    | 'coordinate_closure_no_change'
    | 'coordinate_closure_coordinate_failed'
    | 'coordinate_closure_invalid_ratio';
  targetRegionChanged: boolean | null;
}

function roundAgentCoordinateHarnessNumber(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function normalizeAgentCoordinateHarnessBounds(source: AgentCoordinateAuditSourceLike | null | undefined) {
  const bounds = source?.bounds;
  const x = Number(bounds?.x);
  const y = Number(bounds?.y);
  const width = Number(bounds?.width);
  const height = Number(bounds?.height);
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

function normalizeAgentCoordinateHarnessRatio(value: unknown) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return null;
  }

  if (numberValue >= 0 && numberValue <= 1) {
    return numberValue;
  }

  if (numberValue > 1 && numberValue <= 100) {
    return numberValue / 100;
  }

  return null;
}

function resolveAgentCoordinateHarnessScreenPoint(options: {
  ratioPoint: AgentCoordinateHarnessRatioPoint;
  source: AgentCoordinateAuditSourceLike;
}) {
  const bounds = normalizeAgentCoordinateHarnessBounds(options.source);
  const xRatio = normalizeAgentCoordinateHarnessRatio(options.ratioPoint.x);
  const yRatio = normalizeAgentCoordinateHarnessRatio(options.ratioPoint.y);
  if (!bounds || xRatio === null || yRatio === null) {
    return null;
  }

  return {
    x: Math.round(bounds.x + bounds.width * xRatio),
    y: Math.round(bounds.y + bounds.height * yRatio),
  };
}

function normalizeAgentCoordinateHarnessScreenPoint(point: AgentCoordinateHarnessScreenPoint | null | undefined) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function resolveAgentCoordinateHarnessRedDotRatio(options: {
  point: { x: number; y: number };
  source: AgentCoordinateAuditSourceLike;
}) {
  const bounds = normalizeAgentCoordinateHarnessBounds(options.source);
  if (!bounds) {
    return null;
  }

  return {
    x: roundAgentCoordinateHarnessNumber((options.point.x - bounds.x) / bounds.width),
    y: roundAgentCoordinateHarnessNumber((options.point.y - bounds.y) / bounds.height),
  };
}

function evaluateAgentCoordinateHarnessTargetRegionChange(options: {
  after?: AgentCoordinateHarnessRegionState | null;
  before?: AgentCoordinateHarnessRegionState | null;
}) {
  if (
    options.before?.trusted === false
    || options.after?.trusted === false
  ) {
    return null;
  }

  const beforeSignature = options.before?.signature?.trim();
  const afterSignature = options.after?.signature?.trim();
  if (!beforeSignature || !afterSignature) {
    return null;
  }

  return beforeSignature !== afterSignature;
}

export function evaluateAgentCoordinateClosureHarness(options: {
  afterRegion?: AgentCoordinateHarnessRegionState | null;
  beforeRegion?: AgentCoordinateHarnessRegionState | null;
  displaySources?: AgentCoordinateAuditSourceLike[] | null;
  ratioPoint: AgentCoordinateHarnessRatioPoint;
  source: AgentCoordinateAuditSourceLike;
}): AgentCoordinateHarnessResult {
  const clickPoint = resolveAgentCoordinateHarnessScreenPoint({
    ratioPoint: options.ratioPoint,
    source: options.source,
  });
  const audit = createAgentCoordinateAuditEvidence({
    displaySources: options.displaySources,
    point: clickPoint
      ? {
          coordinateSpace: 'native-screen',
          x: clickPoint.x,
          y: clickPoint.y,
        }
      : null,
    source: options.source,
  });
  const redDotRatio = clickPoint
    ? resolveAgentCoordinateHarnessRedDotRatio({
        point: clickPoint,
        source: options.source,
      })
    : null;
  const targetRegionChanged = evaluateAgentCoordinateHarnessTargetRegionChange({
    after: options.afterRegion,
    before: options.beforeRegion,
  });

  const status: AgentCoordinateHarnessResult['status'] = !clickPoint
    ? 'coordinate_closure_invalid_ratio'
    : audit.status !== 'coordinate_ok'
      ? 'coordinate_closure_coordinate_failed'
      : options.beforeRegion?.trusted === false || options.afterRegion?.trusted === false
        ? 'coordinate_closure_untrusted'
        : targetRegionChanged === false
          ? 'coordinate_closure_no_change'
          : 'coordinate_closure_ok';

  return {
    audit,
    clickPoint,
    redDotRatio,
    status,
    targetRegionChanged,
  };
}

export function evaluateAgentCoordinateReplayClosureHarness(options: {
  afterRegion?: AgentCoordinateHarnessRegionState | null;
  beforeRegion?: AgentCoordinateHarnessRegionState | null;
  clickPoint: AgentCoordinateHarnessScreenPoint;
  displaySources?: AgentCoordinateAuditSourceLike[] | null;
  source: AgentCoordinateAuditSourceLike;
}): AgentCoordinateHarnessResult {
  const clickPoint = normalizeAgentCoordinateHarnessScreenPoint(options.clickPoint);
  const audit = createAgentCoordinateAuditEvidence({
    displaySources: options.displaySources,
    point: clickPoint
      ? {
          coordinateSpace: 'native-screen',
          x: clickPoint.x,
          y: clickPoint.y,
        }
      : null,
    source: options.source,
  });
  const redDotRatio = clickPoint
    ? resolveAgentCoordinateHarnessRedDotRatio({
        point: clickPoint,
        source: options.source,
      })
    : null;
  const targetRegionChanged = evaluateAgentCoordinateHarnessTargetRegionChange({
    after: options.afterRegion,
    before: options.beforeRegion,
  });
  const status: AgentCoordinateHarnessResult['status'] = !clickPoint
    ? 'coordinate_closure_invalid_ratio'
    : audit.status !== 'coordinate_ok'
      ? 'coordinate_closure_coordinate_failed'
      : options.beforeRegion?.trusted === false || options.afterRegion?.trusted === false
        ? 'coordinate_closure_untrusted'
        : targetRegionChanged === false
          ? 'coordinate_closure_no_change'
          : 'coordinate_closure_ok';

  return {
    audit,
    clickPoint,
    redDotRatio,
    status,
    targetRegionChanged,
  };
}
