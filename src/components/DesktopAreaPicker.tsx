import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from '../../components/ui/button';
import { desktopPetShellRuntime } from '../desktopShellRuntime';

type RelativeAreaPickerDisplay = DesktopPetAreaPickerDisplayLike & {
  left: number;
  top: number;
};

type PickerPoint = {
  x: number;
  y: number;
};

type DragState = {
  start: PickerPoint;
  current: PickerPoint;
};

const MIN_SELECTION_SIZE = 8;

function getContextLayoutSignature(nextContext: DesktopPetAreaPickerContextLike | null | undefined) {
  if (!nextContext) {
    return '';
  }

  const displaySignature = nextContext.displays
    .map((display) => [
      display.id,
      display.sourceId,
      display.x,
      display.y,
      display.width,
      display.height,
    ].join(':'))
    .join('|');

  return [
    nextContext.virtualBounds.x,
    nextContext.virtualBounds.y,
    nextContext.virtualBounds.width,
    nextContext.virtualBounds.height,
    displaySignature,
  ].join('::');
}

export default function DesktopAreaPicker() {
  const [context, setContext] = useState<DesktopPetAreaPickerContextLike | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [hoverDisplayId, setHoverDisplayId] = useState('');
  const dragStateRef = useRef<DragState | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pendingPointRef = useRef<PickerPoint | null>(null);
  const pendingHoverDisplayIdRef = useRef('');
  const contextLayoutSignatureRef = useRef('');

  const setDragStateValue = (nextDragState: DragState | null) => {
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
  };

  const resetPickerInteraction = () => {
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    pendingPointRef.current = null;
    pendingHoverDisplayIdRef.current = '';
    setHoverDisplayId('');
    setDragStateValue(null);
  };

  const applyIncomingContext = (nextContext: DesktopPetAreaPickerContextLike | null | undefined) => {
    const resolvedContext = nextContext ?? null;
    const nextLayoutSignature = getContextLayoutSignature(resolvedContext);
    const shouldResetInteraction = contextLayoutSignatureRef.current !== nextLayoutSignature;

    if (shouldResetInteraction) {
      resetPickerInteraction();
    }

    contextLayoutSignatureRef.current = nextLayoutSignature;
    setContext(resolvedContext);
  };

  useEffect(() => {
    let isMounted = true;

    desktopPetShellRuntime.getAreaPickerContext()
      .then((nextContext) => {
        if (isMounted) {
          applyIncomingContext(nextContext);
        }
      })
      .catch(() => {
        if (isMounted) {
          applyIncomingContext(null);
        }
      });
    const unsubscribeContext = desktopPetShellRuntime.onAreaPickerContext((nextContext) => {
      if (isMounted) {
        applyIncomingContext(nextContext);
      }
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        desktopPetShellRuntime.cancelAreaPickerSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      isMounted = false;
      unsubscribeContext();
      resetPickerInteraction();
      contextLayoutSignatureRef.current = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const relativeDisplays: RelativeAreaPickerDisplay[] = context
    ? context.displays.map((display) => ({
        ...display,
        left: display.x - context.virtualBounds.x,
        top: display.y - context.virtualBounds.y,
      }))
    : [];

  const getDisplayForPoint = (point: PickerPoint) =>
    relativeDisplays.find((display) =>
      point.x >= display.left
      && point.x <= display.left + display.width
      && point.y >= display.top
      && point.y <= display.top + display.height,
    ) ?? null;

  const getPointFromEvent = (event: ReactPointerEvent<HTMLDivElement>): PickerPoint => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };

  const selectionRect = dragState
    ? {
        left: Math.min(dragState.start.x, dragState.current.x),
        top: Math.min(dragState.start.y, dragState.current.y),
        width: Math.abs(dragState.current.x - dragState.start.x),
        height: Math.abs(dragState.current.y - dragState.start.y),
      }
    : null;
  const selectedDisplays = selectionRect
    ? relativeDisplays.filter((display) => (
        selectionRect.left < display.left + display.width
        && selectionRect.left + selectionRect.width > display.left
        && selectionRect.top < display.top + display.height
        && selectionRect.top + selectionRect.height > display.top
      ))
    : [];
  const activeDisplayIds = new Set(selectedDisplays.map((display) => display.id));

  const flushPointerPreview = () => {
    pointerFrameRef.current = null;
    const nextPoint = pendingPointRef.current;
    const nextHoverDisplayId = pendingHoverDisplayIdRef.current;

    setHoverDisplayId((currentValue) => (
      currentValue === nextHoverDisplayId ? currentValue : nextHoverDisplayId
    ));

    const currentDragState = dragStateRef.current;
    if (!currentDragState || !nextPoint) {
      return;
    }

    if (
      currentDragState.current.x === nextPoint.x
      && currentDragState.current.y === nextPoint.y
    ) {
      return;
    }

    setDragStateValue({
      start: currentDragState.start,
      current: nextPoint,
    });
  };

  const queuePointerPreview = (point: PickerPoint, hoverId: string) => {
    pendingPointRef.current = point;
    pendingHoverDisplayIdRef.current = hoverId;

    if (pointerFrameRef.current !== null) {
      return;
    }

    pointerFrameRef.current = window.requestAnimationFrame(flushPointerPreview);
  };

  const cancelSelection = () => {
    desktopPetShellRuntime.cancelAreaPickerSelection();
  };

  const submitSelection = (nextSelectionRect = selectionRect) => {
    if (!nextSelectionRect) {
      return;
    }

    const nextSelectedDisplays = relativeDisplays.filter((display) => (
      nextSelectionRect.left < display.left + display.width
      && nextSelectionRect.left + nextSelectionRect.width > display.left
      && nextSelectionRect.top < display.top + display.height
      && nextSelectionRect.top + nextSelectionRect.height > display.top
    ));
    if (!nextSelectedDisplays.length) {
      return;
    }

    if (nextSelectionRect.width < MIN_SELECTION_SIZE || nextSelectionRect.height < MIN_SELECTION_SIZE) {
      setDragStateValue(null);
      return;
    }

    const primaryDisplay = nextSelectedDisplays[0];
    const areaSourceList = nextSelectedDisplays.map((display) => ({
      displayId: display.id,
      displayLabel: display.label,
      sourceId: display.sourceId,
      sourceName: display.sourceName,
      sourceType: 'screen' as const,
      x: Math.round(display.left),
      y: Math.round(display.top),
      width: Math.round(display.width),
      height: Math.round(display.height),
    }));
    const isCrossDisplaySelection = nextSelectedDisplays.length > 1;
    const displayLabel = isCrossDisplaySelection
      ? `Cross-display (${nextSelectedDisplays.length})`
      : primaryDisplay.label;
    const sourceName = isCrossDisplaySelection
      ? displayLabel
      : primaryDisplay.sourceName;

    desktopPetShellRuntime.submitAreaPickerSelection({
      displayId: primaryDisplay.id,
      displayLabel,
      sourceId: primaryDisplay.sourceId,
      sourceName,
      sourceType: 'screen',
      cropRect: {
        x: Math.round(nextSelectionRect.left),
        y: Math.round(nextSelectionRect.top),
        width: Math.round(nextSelectionRect.width),
        height: Math.round(nextSelectionRect.height),
      },
      cropBasisWidth: Math.round(context?.virtualBounds.width ?? nextSelectionRect.width),
      cropBasisHeight: Math.round(context?.virtualBounds.height ?? nextSelectionRect.height),
      areaSources: areaSourceList,
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!context) {
      return;
    }

    const point = getPointFromEvent(event);
    const hoveredDisplay = getDisplayForPoint(point);
    event.preventDefault();
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setHoverDisplayId(hoveredDisplay?.id ?? '');
    setDragStateValue({
      start: point,
      current: point,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const point = getPointFromEvent(event);
    const hoveredDisplay = getDisplayForPoint(point);
    queuePointerPreview(point, hoveredDisplay?.id ?? '');

    if (dragStateRef.current) {
      event.preventDefault();
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentDragState = dragStateRef.current;
    if (!currentDragState) {
      return;
    }

    const point = getPointFromEvent(event);
    const nextSelectionRect = {
      left: Math.min(currentDragState.start.x, point.x),
      top: Math.min(currentDragState.start.y, point.y),
      width: Math.abs(point.x - currentDragState.start.x),
      height: Math.abs(point.y - currentDragState.start.y),
    };

    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }

    pendingPointRef.current = point;
    pendingHoverDisplayIdRef.current = '';
    setHoverDisplayId('');
    setDragStateValue({
      start: currentDragState.start,
      current: point,
    });
    if (
      typeof event.currentTarget.hasPointerCapture === 'function'
      && event.currentTarget.hasPointerCapture(event.pointerId)
      && typeof event.currentTarget.releasePointerCapture === 'function'
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
    submitSelection(nextSelectionRect);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      typeof event.currentTarget.hasPointerCapture === 'function'
      && event.currentTarget.hasPointerCapture(event.pointerId)
      && typeof event.currentTarget.releasePointerCapture === 'function'
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    setHoverDisplayId('');
    setDragStateValue(null);
  };

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-transparent text-white"
      onContextMenu={(event) => {
        event.preventDefault();
        cancelSelection();
      }}
      style={{ touchAction: 'none', cursor: 'crosshair', userSelect: 'none' }}
    >
      {relativeDisplays.map((display) => {
        const isActive = activeDisplayIds.has(display.id);
        const isHovered = hoverDisplayId === display.id;

        return (
          <div
            key={display.id}
            className={`pointer-events-none absolute overflow-hidden rounded-lg border ${
              isActive
                ? 'border-emerald-300'
                : isHovered
                  ? 'border-emerald-200/80'
                  : 'border-white/25'
            }`}
            style={{
              left: display.left,
              top: display.top,
              width: display.width,
              height: display.height,
            }}
          >
            {display.previewThumbnail ? (
              <img
                src={display.previewThumbnail}
                alt=""
                className="absolute inset-0 h-full w-full object-fill"
                draggable={false}
                style={{ imageRendering: 'auto' }}
              />
            ) : (
              <div className="absolute inset-0 bg-transparent" />
            )}
            <div className="absolute inset-0 bg-transparent" />
            <div className="absolute left-4 top-4 rounded-md border border-white/20 bg-[#081017]/92 px-3 py-2 text-xs shadow-[0_8px_24px_rgba(0,0,0,0.3)]">
              <div className="font-semibold tracking-wide">{display.label || display.sourceName}</div>
              <div className="mt-1 text-[11px] text-white/70">{display.width} x {display.height}</div>
            </div>
          </div>
        );
      })}

      <div
        className="absolute inset-0 z-20"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ touchAction: 'none', cursor: 'crosshair' }}
      />

      {selectionRect && (
        <div
          className="pointer-events-none absolute z-30 rounded-lg border-2 border-emerald-400 bg-transparent shadow-[0_0_0_1px_rgba(52,211,153,0.55),0_0_24px_rgba(16,185,129,0.22)]"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: Math.max(1, selectionRect.width),
            height: Math.max(1, selectionRect.height),
          }}
        >
          <div className="absolute -top-9 left-0 rounded-md border border-emerald-300/40 bg-[#081017]/94 px-3 py-1 text-[11px] font-medium text-emerald-100 shadow-[0_6px_18px_rgba(0,0,0,0.28)]">
            {Math.round(selectionRect.width)} x {Math.round(selectionRect.height)}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center px-6 pt-6">
        <div
          className="pointer-events-auto flex max-w-3xl items-center gap-4 rounded-xl border border-white/15 bg-[#081017]/94 px-5 py-3 shadow-[0_12px_36px_rgba(0,0,0,0.32)]"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-wide">桌面区域框选</div>
            <div className="mt-1 text-xs text-white/75">
              直接在任意显示器上拖动鼠标框选，松开后自动应用。按 Esc 或右键取消。
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              cancelSelection();
            }}
            className="shrink-0 border-white/20 bg-white/5 text-white hover:bg-white/10"
          >
            取消
          </Button>
        </div>
      </div>

      {!context && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-white/15 bg-[#081017]/94 px-5 py-4 text-sm text-white/80 shadow-[0_12px_36px_rgba(0,0,0,0.32)]">
            正在准备桌面框选...
          </div>
        </div>
      )}
    </div>
  );
}
