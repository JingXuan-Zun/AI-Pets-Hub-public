type Position = {
  x: number;
  y: number;
};

type DragDelta = {
  x: number;
  y: number;
};

const NATIVE_ACTIVE_DRAG_PREDICTION_FRAMES = 5;
const NATIVE_ACTIVE_DRAG_MAX_PREDICTION_PX = 256;

function resolveProjectedDragOffset(delta: number) {
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) {
    return 0;
  }

  const distance = Math.min(
    NATIVE_ACTIVE_DRAG_MAX_PREDICTION_PX,
    Math.abs(delta) * NATIVE_ACTIVE_DRAG_PREDICTION_FRAMES,
  );
  return Math.sign(delta) * distance;
}

export function resolveProjectedNativeDragPosition(
  position: Position,
  dragDelta: DragDelta,
) {
  return {
    x: position.x + resolveProjectedDragOffset(dragDelta.x),
    y: position.y + resolveProjectedDragOffset(dragDelta.y),
  };
}
