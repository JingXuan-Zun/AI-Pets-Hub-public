import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { type PetVisualSize } from '../../types';
import {
  DEFAULT_PANEL_LAYOUT,
  MAX_PANEL_HEIGHT,
  MAX_PANEL_WIDTH,
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  clampPanelOffset,
  resolveDockedPanelStartPosition,
  resolvePanelStartPosition,
  type ResizeDirection,
  type ViewportRect,
} from './settingsPanelLayout';

interface UseSettingsPanelFrameStateOptions {
  anchorRect?: ViewportRect;
  dockAnchorPosition?: { x: number; y: number } | null;
  dockReferenceSize?: PetVisualSize | null;
  isOpen: boolean;
  resetToken: number;
  standalone: boolean;
}

type PanelDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

type PanelResizeState = {
  direction: ResizeDirection;
  pointerId: number;
  startX: number;
  startY: number;
  originBaseX: number;
  originBaseY: number;
  originWidth: number;
  originHeight: number;
  originOffsetX: number;
  originOffsetY: number;
};

export function useSettingsPanelFrameState({
  anchorRect,
  dockAnchorPosition = null,
  dockReferenceSize = null,
  isOpen,
  resetToken,
  standalone,
}: UseSettingsPanelFrameStateOptions) {
  const [panelOffset, setPanelOffset] = useState(DEFAULT_PANEL_LAYOUT.offset);
  const [panelSize, setPanelSize] = useState(DEFAULT_PANEL_LAYOUT.size);
  const [panelDragState, setPanelDragState] = useState<PanelDragState | null>(null);
  const [panelResizeState, setPanelResizeState] = useState<PanelResizeState | null>(null);
  const panelDragFrameRef = useRef<number | null>(null);
  const panelResizeFrameRef = useRef<number | null>(null);

  const panelBasePosition = useMemo(() => (
    resolveDockedPanelStartPosition(
      panelSize,
      dockAnchorPosition,
      dockReferenceSize,
    ) ?? resolvePanelStartPosition(anchorRect, panelSize)
  ), [anchorRect, dockAnchorPosition, dockReferenceSize, panelSize]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setPanelOffset(DEFAULT_PANEL_LAYOUT.offset);
    setPanelSize(DEFAULT_PANEL_LAYOUT.size);
    setPanelDragState(null);
    setPanelResizeState(null);
  }, [isOpen, resetToken]);

  useEffect(() => {
    if (!panelDragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== panelDragState.pointerId) {
        return;
      }

      if (panelDragFrameRef.current !== null) {
        window.cancelAnimationFrame(panelDragFrameRef.current);
      }

      panelDragFrameRef.current = window.requestAnimationFrame(() => {
        setPanelOffset(clampPanelOffset(
          panelBasePosition,
          {
            x: panelDragState.originX + event.clientX - panelDragState.startX,
            y: panelDragState.originY + event.clientY - panelDragState.startY,
          },
          panelSize,
        ));
      });
    };

    const stopDrag = (event: PointerEvent) => {
      if (event.pointerId === panelDragState.pointerId) {
        setPanelDragState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    return () => {
      if (panelDragFrameRef.current !== null) {
        window.cancelAnimationFrame(panelDragFrameRef.current);
        panelDragFrameRef.current = null;
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, [panelBasePosition, panelDragState, panelSize]);

  useEffect(() => {
    if (!panelResizeState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== panelResizeState.pointerId) {
        return;
      }

      const deltaX = event.clientX - panelResizeState.startX;
      const deltaY = event.clientY - panelResizeState.startY;
      const resizeFromLeft = panelResizeState.direction.includes('w');
      const resizeFromRight = panelResizeState.direction.includes('e');
      const resizeFromTop = panelResizeState.direction.includes('n');
      const resizeFromBottom = panelResizeState.direction.includes('s');
      const rawWidth = panelResizeState.originWidth
        + (resizeFromRight ? deltaX : 0)
        - (resizeFromLeft ? deltaX : 0);
      const rawHeight = panelResizeState.originHeight
        + (resizeFromBottom ? deltaY : 0)
        - (resizeFromTop ? deltaY : 0);
      const nextWidth = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, rawWidth));
      const nextHeight = Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, rawHeight));
      const nextSize = {
        width: nextWidth,
        height: nextHeight,
      };
      const nextBasePosition = resolveDockedPanelStartPosition(
        nextSize,
        dockAnchorPosition,
        dockReferenceSize,
      ) ?? resolvePanelStartPosition(anchorRect, nextSize);

      if (panelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(panelResizeFrameRef.current);
      }

      panelResizeFrameRef.current = window.requestAnimationFrame(() => {
        setPanelSize(nextSize);
        setPanelOffset(clampPanelOffset(
          nextBasePosition,
          {
            x: resizeFromLeft
              ? panelResizeState.originBaseX + panelResizeState.originOffsetX + panelResizeState.originWidth - nextWidth - nextBasePosition.x
              : panelResizeState.originBaseX + panelResizeState.originOffsetX - nextBasePosition.x,
            y: resizeFromTop
              ? panelResizeState.originBaseY + panelResizeState.originOffsetY + panelResizeState.originHeight - nextHeight - nextBasePosition.y
              : panelResizeState.originBaseY + panelResizeState.originOffsetY - nextBasePosition.y,
          },
          nextSize,
        ));
      });
    };

    const stopResize = (event: PointerEvent) => {
      if (event.pointerId === panelResizeState.pointerId) {
        setPanelResizeState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);

    return () => {
      if (panelResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(panelResizeFrameRef.current);
        panelResizeFrameRef.current = null;
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [anchorRect, dockAnchorPosition, dockReferenceSize, panelResizeState]);

  const startPanelDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (standalone) {
      return;
    }

    if ((event.target as HTMLElement).closest('button, input, select, textarea, [role="tab"]')) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setPanelDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: panelOffset.x,
      originY: panelOffset.y,
    });
  };

  const startPanelResize = (event: ReactPointerEvent<HTMLElement>, direction: ResizeDirection) => {
    if (standalone) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setPanelResizeState({
      direction,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originBaseX: panelBasePosition.x,
      originBaseY: panelBasePosition.y,
      originWidth: panelSize.width,
      originHeight: panelSize.height,
      originOffsetX: panelOffset.x,
      originOffsetY: panelOffset.y,
    });
  };

  const clampedPanelOffset = standalone
    ? panelOffset
    : clampPanelOffset(panelBasePosition, panelOffset, panelSize);

  return {
    dragRegionStyle: standalone
      ? ({ WebkitAppRegion: 'drag' } as CSSProperties)
      : undefined,
    isDockedPresentation: !standalone,
    isDraggingPanel: panelDragState !== null,
    isFrameInteracting: panelDragState !== null || panelResizeState !== null,
    noDragRegionStyle: standalone
      ? ({ WebkitAppRegion: 'no-drag' } as CSSProperties)
      : undefined,
    rootStyle: standalone
      ? ({ width: '100%', height: '100%' } as CSSProperties)
      : ({
          left: panelBasePosition.x + clampedPanelOffset.x,
          top: panelBasePosition.y + clampedPanelOffset.y,
          width: panelSize.width,
          height: panelSize.height,
        } as CSSProperties),
    startPanelDrag,
    startPanelResize,
  };
}
