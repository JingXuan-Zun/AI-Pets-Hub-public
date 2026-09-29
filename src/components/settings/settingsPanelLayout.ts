import { type PetVisualSize } from '../../types';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type ViewportRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PanelLayout = {
  offset: { x: number; y: number };
  size: { width: number; height: number };
};

// 只限制最小尺寸；最大尺寸交给当前屏幕和窗口系统处理。
export const MIN_PANEL_WIDTH = 1360;
export const MAX_PANEL_WIDTH = Number.POSITIVE_INFINITY;
export const MIN_PANEL_HEIGHT = 720;
export const MAX_PANEL_HEIGHT = Number.POSITIVE_INFINITY;
const PANEL_SCREEN_MARGIN = 24;

export const DEFAULT_PANEL_LAYOUT: PanelLayout = {
  offset: { x: 0, y: 0 },
  size: { width: 1440, height: 820 },
};

function getViewportSize() {
  return {
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
  };
}

export function resolvePanelStartPosition(
  anchorRect: ViewportRect | undefined,
  panelSize: PanelLayout['size'],
) {
  const viewport = getViewportSize();
  const safeAnchorRect = anchorRect && anchorRect.width > 0 && anchorRect.height > 0
    ? anchorRect
    : {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
      };
  const rightAlignedLeft = safeAnchorRect.x + safeAnchorRect.width - panelSize.width - PANEL_SCREEN_MARGIN;
  const centeredTop = safeAnchorRect.y + (safeAnchorRect.height - panelSize.height) / 2;
  const maxTop = safeAnchorRect.y + safeAnchorRect.height - panelSize.height - PANEL_SCREEN_MARGIN;

  return {
    x: Math.round(Math.max(safeAnchorRect.x + PANEL_SCREEN_MARGIN, rightAlignedLeft)),
    y: Math.round(Math.max(safeAnchorRect.y + PANEL_SCREEN_MARGIN, Math.min(maxTop, centeredTop))),
  };
}

export function resolveDockedPanelStartPosition(
  panelSize: PanelLayout['size'],
  dockAnchorPosition?: { x: number; y: number } | null,
  dockReferenceSize?: PetVisualSize | null,
) {
  if (!dockAnchorPosition) {
    return null;
  }

  const viewport = getViewportSize();
  const referenceWidth = Math.max(96, dockReferenceSize?.width ?? 180);
  const referenceHeight = Math.max(144, dockReferenceSize?.height ?? 220);
  const desiredRightLeft = dockAnchorPosition.x + referenceWidth / 2 + 288;
  const minLeft = PANEL_SCREEN_MARGIN;
  const maxLeft = Math.max(minLeft, viewport.width - panelSize.width - PANEL_SCREEN_MARGIN);
  const nextLeft = Math.min(maxLeft, Math.max(minLeft, desiredRightLeft));
  const nextTop = Math.max(
    PANEL_SCREEN_MARGIN,
    Math.min(
      viewport.height - panelSize.height - PANEL_SCREEN_MARGIN,
      dockAnchorPosition.y - Math.max(referenceHeight * 0.52, panelSize.height * 0.48),
    ),
  );

  return {
    x: Math.round(nextLeft),
    y: Math.round(nextTop),
  };
}

export function clampPanelOffset(
  basePosition: { x: number; y: number },
  nextOffset: { x: number; y: number },
  panelSize: PanelLayout['size'],
) {
  const viewport = getViewportSize();
  const minLeft = PANEL_SCREEN_MARGIN;
  const maxLeft = Math.max(minLeft, viewport.width - panelSize.width - PANEL_SCREEN_MARGIN);
  const minTop = PANEL_SCREEN_MARGIN;
  const maxTop = Math.max(minTop, viewport.height - panelSize.height - PANEL_SCREEN_MARGIN);
  const nextLeft = Math.min(maxLeft, Math.max(minLeft, basePosition.x + nextOffset.x));
  const nextTop = Math.min(maxTop, Math.max(minTop, basePosition.y + nextOffset.y));

  return {
    x: Math.round(nextLeft - basePosition.x),
    y: Math.round(nextTop - basePosition.y),
  };
}

export function getDisplayPixelSize(display: DesktopPetDisplayLike | null | undefined) {
  if (!display) {
    return {
      width: 0,
      height: 0,
    };
  }

  const scaleFactor = display.scaleFactor && display.scaleFactor > 0
    ? display.scaleFactor
    : 1;

  return {
    width: Math.max(1, Math.round(display.width * scaleFactor)),
    height: Math.max(1, Math.round(display.height * scaleFactor)),
  };
}
