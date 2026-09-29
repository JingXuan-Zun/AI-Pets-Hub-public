export type Live2DFitBounds = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type Live2DStageFit = {
  bounds: Live2DFitBounds;
  scale: number;
  useDrawableBounds: boolean;
};

function isFiniteLive2DFitBounds(bounds: Live2DFitBounds) {
  return Number.isFinite(bounds.x)
    && Number.isFinite(bounds.y)
    && Number.isFinite(bounds.width)
    && Number.isFinite(bounds.height)
    && bounds.width > 0
    && bounds.height > 0;
}

export function resolveLive2DStageFit(options: {
  canvasBounds: Live2DFitBounds;
  drawableBounds: Live2DFitBounds | null;
  fitMode?: 'canvas' | 'visible' | 'visible-overflow';
  profileScale?: number;
  stageSize: number;
}) {
  const safeStageSize = Math.max(1, Math.round(options.stageSize));
  const canvasBounds = isFiniteLive2DFitBounds(options.canvasBounds)
    ? options.canvasBounds
    : { height: 1, width: 1, x: 0, y: 0 };
  const drawableBounds = options.drawableBounds && isFiniteLive2DFitBounds(options.drawableBounds)
    ? options.drawableBounds
    : null;
  const overflowTolerance = Math.max(
    1,
    Math.min(canvasBounds.width, canvasBounds.height) * 0.005,
  );
  const drawableBoundsOverflowCanvas = Boolean(drawableBounds && (
    drawableBounds.x < canvasBounds.x - overflowTolerance
    || drawableBounds.y < canvasBounds.y - overflowTolerance
    || drawableBounds.x + drawableBounds.width > canvasBounds.x + canvasBounds.width + overflowTolerance
    || drawableBounds.y + drawableBounds.height > canvasBounds.y + canvasBounds.height + overflowTolerance
  ));
  const fitMode = options.fitMode ?? 'visible-overflow';
  const useDrawableBounds = Boolean(drawableBounds && (
    fitMode === 'visible'
    || (fitMode === 'visible-overflow' && drawableBoundsOverflowCanvas)
  ));
  const bounds = useDrawableBounds && drawableBounds
    ? drawableBounds
    : canvasBounds;
  const profileScale = Number.isFinite(options.profileScale)
    ? Math.max(0.1, Math.min(4, options.profileScale as number))
    : 1;

  return {
    bounds,
    scale: Math.min(
      safeStageSize / bounds.width,
      safeStageSize / bounds.height,
    ) * 0.88 * profileScale,
    useDrawableBounds,
  } satisfies Live2DStageFit;
}
