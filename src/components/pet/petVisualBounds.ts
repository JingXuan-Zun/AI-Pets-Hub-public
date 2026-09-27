export type PetVisualBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function arePetVisualBoundsEqual(
  left: PetVisualBounds | null | undefined,
  right: PetVisualBounds | null | undefined,
) {
  return (left?.left ?? null) === (right?.left ?? null)
    && (left?.right ?? null) === (right?.right ?? null)
    && (left?.top ?? null) === (right?.top ?? null)
    && (left?.bottom ?? null) === (right?.bottom ?? null);
}

export function normalize2DVisualBounds(bounds: PetVisualBounds) {
  return {
    left: Math.max(4, Math.round(bounds.left * 1.01 + 2)),
    right: Math.max(9, Math.round(bounds.right * 1.03 + 6)),
    top: Math.max(2, Math.round(bounds.top * 1.0025 + 1)),
    bottom: Math.max(12, Math.round(bounds.bottom * 1.02 + 8)),
  } satisfies PetVisualBounds;
}

export function normalize3DVisualBounds(bounds: PetVisualBounds, isMoving: boolean) {
  const motionFactor = isMoving ? 1.02 : 1;

  return {
    left: Math.max(74, Math.round(bounds.left * motionFactor * 1.06 + 6) - 5),
    right: Math.max(74, Math.round(bounds.right * motionFactor * 1.06 + 6) - 5),
    top: Math.max(92, Math.round(bounds.top * motionFactor * 1.08 + 8) - 10),
    bottom: Math.max(44, Math.round(bounds.bottom * motionFactor * 1.03 + 5)),
  } satisfies PetVisualBounds;
}

type DragNativeWindowShapeState = {
  active?: boolean;
  deltaX?: number;
  deltaY?: number;
} | null | undefined;

function sanitizeDragDelta(value: number | null | undefined) {
  return Number.isFinite(value) ? value ?? 0 : 0;
}

function sanitizeVisualBoundExtent(value: number) {
  return Math.max(1, Math.round(Number.isFinite(value) ? value : 1));
}

export function resolve3DNativeWindowShapeSafeSquareVisualBounds(bounds: PetVisualBounds) {
  const safeBounds = {
    bottom: sanitizeVisualBoundExtent(bounds.bottom),
    left: sanitizeVisualBoundExtent(bounds.left),
    right: sanitizeVisualBoundExtent(bounds.right),
    top: sanitizeVisualBoundExtent(bounds.top),
  } satisfies PetVisualBounds;
  const width = safeBounds.left + safeBounds.right;
  const height = safeBounds.top + safeBounds.bottom;
  const squareSize = Math.max(width, height);
  const horizontalPadding = squareSize - width;
  const verticalPadding = squareSize - height;

  if (horizontalPadding <= 0 && verticalPadding <= 0) {
    return safeBounds;
  }

  const leftPadding = Math.floor(horizontalPadding / 2);
  const topPadding = Math.floor(verticalPadding / 2);

  return {
    bottom: safeBounds.bottom + verticalPadding - topPadding,
    left: safeBounds.left + leftPadding,
    right: safeBounds.right + horizontalPadding - leftPadding,
    top: safeBounds.top + topPadding,
  } satisfies PetVisualBounds;
}

function resolveDirectionalDragPadding({
  delta,
  leadingBase,
  leadingMultiplier,
  leadingMax,
  trailingBase,
  trailingMultiplier,
  trailingMax,
}: {
  delta: number;
  leadingBase: number;
  leadingMultiplier: number;
  leadingMax: number;
  trailingBase: number;
  trailingMultiplier: number;
  trailingMax: number;
}) {
  const speed = Math.min(48, Math.abs(delta));

  return {
    leading: Math.min(leadingMax, Math.round(leadingBase + speed * leadingMultiplier)),
    trailing: Math.min(trailingMax, Math.round(trailingBase + speed * trailingMultiplier)),
  };
}

export function resolvePetDragNativeWindowShapeVisualBounds(
  bounds: PetVisualBounds,
  isDragging: boolean,
  dragMotionState?: DragNativeWindowShapeState,
) {
  const safeSquareBounds = resolve3DNativeWindowShapeSafeSquareVisualBounds(bounds);

  if (!isDragging) {
    return safeSquareBounds;
  }

  const deltaX = sanitizeDragDelta(dragMotionState?.deltaX);
  const deltaY = sanitizeDragDelta(dragMotionState?.deltaY);
  const horizontalPadding = resolveDirectionalDragPadding({
    delta: deltaX,
    leadingBase: 64,
    leadingMultiplier: 2.8,
    leadingMax: 168,
    trailingBase: 40,
    trailingMultiplier: 1.35,
    trailingMax: 104,
  });
  const verticalPadding = resolveDirectionalDragPadding({
    delta: deltaY,
    leadingBase: 54,
    leadingMultiplier: 2.4,
    leadingMax: 144,
    trailingBase: 34,
    trailingMultiplier: 1.15,
    trailingMax: 96,
  });

  return {
    bottom: Math.round(safeSquareBounds.bottom + (deltaY > 0 ? verticalPadding.leading : verticalPadding.trailing)),
    left: Math.round(safeSquareBounds.left + (deltaX < 0 ? horizontalPadding.leading : horizontalPadding.trailing)),
    right: Math.round(safeSquareBounds.right + (deltaX > 0 ? horizontalPadding.leading : horizontalPadding.trailing)),
    top: Math.round(safeSquareBounds.top + (deltaY < 0 ? verticalPadding.leading : verticalPadding.trailing)),
  } satisfies PetVisualBounds;
}

export const resolve3DDragNativeWindowShapeVisualBounds = resolvePetDragNativeWindowShapeVisualBounds;

function resolveStableLayoutExtentPair({
  baselineLeadingExtent,
  baselineTrailingExtent,
  measuredLeadingExtent,
  measuredTrailingExtent,
  multiplier,
  padding,
}: {
  baselineLeadingExtent: number;
  baselineTrailingExtent: number;
  measuredLeadingExtent: number;
  measuredTrailingExtent: number;
  multiplier: number;
  padding: number;
}) {
  const safeBaselineLeadingExtent = Math.max(1, Math.round(baselineLeadingExtent));
  const safeBaselineTrailingExtent = Math.max(1, Math.round(baselineTrailingExtent));
  const safeMeasuredLeadingExtent = Math.max(1, Math.round(measuredLeadingExtent));
  const safeMeasuredTrailingExtent = Math.max(1, Math.round(measuredTrailingExtent));
  const baselineTotalExtent = safeBaselineLeadingExtent + safeBaselineTrailingExtent;
  const measuredTotalExtent = safeMeasuredLeadingExtent + safeMeasuredTrailingExtent;
  const maxLayoutTotalExtent = Math.max(
    baselineTotalExtent,
    Math.round(baselineTotalExtent * multiplier + padding),
  );
  const nextTotalExtent = Math.max(
    baselineTotalExtent,
    Math.min(measuredTotalExtent, maxLayoutTotalExtent),
  );
  const measuredLeadingRatio = safeMeasuredLeadingExtent / Math.max(1, measuredTotalExtent);
  const nextLeadingExtent = Math.max(
    1,
    Math.min(nextTotalExtent - 1, Math.round(nextTotalExtent * measuredLeadingRatio)),
  );

  return {
    leading: nextLeadingExtent,
    trailing: Math.max(1, nextTotalExtent - nextLeadingExtent),
  };
}

function constrain3DHorizontalExtentsForFullBodyAvatar(
  horizontalBounds: { leading: number; trailing: number },
  verticalBounds: { leading: number; trailing: number },
) {
  const safeLeading = Math.max(1, Math.round(horizontalBounds.leading));
  const safeTrailing = Math.max(1, Math.round(horizontalBounds.trailing));
  const totalWidth = safeLeading + safeTrailing;
  const totalHeight = Math.max(1, Math.round(verticalBounds.leading + verticalBounds.trailing));
  const maxFullBodyWidth = Math.max(156, Math.round(totalHeight * 0.34 + 64));

  if (totalWidth <= maxFullBodyWidth) {
    return {
      leading: safeLeading,
      trailing: safeTrailing,
    };
  }

  const leadingRatio = safeLeading / Math.max(1, totalWidth);
  const leading = Math.max(1, Math.min(maxFullBodyWidth - 1, Math.round(maxFullBodyWidth * leadingRatio)));

  return {
    leading,
    trailing: Math.max(1, maxFullBodyWidth - leading),
  };
}

export function resolve3DStableLayoutVisualBounds(
  bounds: PetVisualBounds,
  scale: number,
  isMoving: boolean,
) {
  const baselineBounds = resolveFallback3DVisualBounds(scale, isMoving);
  const horizontalBounds = resolveStableLayoutExtentPair({
    baselineLeadingExtent: baselineBounds.left,
    baselineTrailingExtent: baselineBounds.right,
    measuredLeadingExtent: bounds.left,
    measuredTrailingExtent: bounds.right,
    multiplier: 1.42,
    padding: 60,
  });
  const verticalBounds = resolveStableLayoutExtentPair({
    baselineLeadingExtent: baselineBounds.top,
    baselineTrailingExtent: baselineBounds.bottom,
    measuredLeadingExtent: bounds.top,
    measuredTrailingExtent: bounds.bottom,
    multiplier: 1.45,
    padding: 64,
  });
  const constrainedHorizontalBounds = constrain3DHorizontalExtentsForFullBodyAvatar(
    horizontalBounds,
    verticalBounds,
  );

  return {
    bottom: verticalBounds.trailing,
    left: constrainedHorizontalBounds.leading,
    right: constrainedHorizontalBounds.trailing,
    top: verticalBounds.leading,
  } satisfies PetVisualBounds;
}

export function resolveFallback3DVisualBounds(scale: number, isMoving: boolean) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return normalize3DVisualBounds({
    left: Math.max(60, Math.round(88 * safeScale)),
    right: Math.max(60, Math.round(88 * safeScale)),
    top: Math.max(72, Math.round(84 * safeScale)),
    bottom: Math.max(30, Math.round(40 * safeScale)),
  }, isMoving);
}

export function resolveUnity3DInteractiveVisualBounds(scale: number, isMoving: boolean) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const normalizedBounds = normalize3DVisualBounds({
    bottom: Math.max(52, Math.round(64 * safeScale)),
    left: Math.max(68, Math.round(40 * safeScale)),
    right: Math.max(68, Math.round(40 * safeScale)),
    top: Math.max(116, Math.round(126 * safeScale)),
  }, false);

  return {
    ...normalizedBounds,
    bottom: Math.max(52, normalizedBounds.bottom - 4),
    left: Math.max(68, normalizedBounds.left - 4),
    right: Math.max(68, normalizedBounds.right - 4),
  } satisfies PetVisualBounds;
}

export function resolveUnity3DActivityClampVisualBounds(scale: number, isMoving: boolean) {
  const interactiveBounds = resolveUnity3DInteractiveVisualBounds(scale, isMoving);
  const squareBounds = resolve3DNativeWindowShapeSafeSquareVisualBounds(interactiveBounds);
  const interactionHeight = interactiveBounds.top + interactiveBounds.bottom;

  return {
    bottom: squareBounds.bottom,
    left: squareBounds.left,
    right: squareBounds.right,
    top: Math.max(
      squareBounds.top,
      Math.round(squareBounds.top + interactionHeight * 0.3),
    ),
  } satisfies PetVisualBounds;
}

function resolveUnity3DViewportVisualBounds(scale: number, isMoving: boolean) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

  return normalize3DVisualBounds({
    bottom: Math.max(56, Math.round(80 * safeScale)),
    left: Math.max(76, Math.round(52 * safeScale)),
    right: Math.max(76, Math.round(52 * safeScale)),
    top: Math.max(116, Math.round(126 * safeScale)),
  }, false);
}

export function resolveUnity3DViewportShellSize(scale: number, isMoving: boolean) {
  const bounds = resolveUnity3DViewportVisualBounds(scale, isMoving);
  const visualWidth = bounds.left + bounds.right;
  const visualHeight = bounds.top + bounds.bottom;
  return Math.max(280, Math.min(1320, Math.round(Math.max(visualWidth, visualHeight) * 1.04)));
}

export function resolveLive2DViewportShellSize(scale: number, isMoving: boolean) {
  void isMoving;
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const shellSize = safeScale <= 3
    ? 256 * safeScale
    : 768 + (safeScale - 3) * 192;

  return Math.max(128, Math.min(960, Math.round(shellSize)));
}

export const resolve3DVisualBounds = resolveFallback3DVisualBounds;
