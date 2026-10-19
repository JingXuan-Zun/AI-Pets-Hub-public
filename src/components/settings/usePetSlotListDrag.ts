import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react';

// Drag-to-reorder for the slot list, iOS style, with pointer events (native HTML drag let the
// row float outside the list and blocked the mouse wheel while held). A copy of the held
// character follows the pointer inside the list frame; the other rows slide aside to open a
// gap where she would land and close up behind her; on release the copy glides into the gap.
// The wheel scrolls as usual, and holding near the top or bottom edge scrolls the list.
//
// Positions come from the layout measured when the drag starts (offsetTop ignores the slide
// transforms), so the rows moving out of the way never change which gap is aimed at.

const DRAG_START_DISTANCE_PX = 5;
const EDGE_SCROLL_ZONE_PX = 24;
const EDGE_SCROLL_STEP_PX = 10;
const SLIDE_MS = 200;
const SLIDE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface DragState {
  pointerId: number;
  slotId: string;
  startY: number;
  started: boolean;
}

interface Layout {
  ids: string[];
  /** Each movable row's top inside the list's scroll content, as laid out before the drag. */
  tops: number[];
  height: number;
  step: number;
}

export function usePetSlotListDrag({ movableIds, onMove }: {
  /** Slots that can be moved (every character except the main pet). */
  movableIds: string[];
  onMove: (movedId: string, targetId: string) => void;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const lastYRef = useRef(0);
  const suppressClickRef = useRef(false);
  const settleTimerRef = useRef<number | null>(null);
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [targetIndex, setTargetIndex] = useState(0);
  const [settling, setSettling] = useState(false);
  // The floating copy, in px from the top of the list's frame (the list's parent).
  const [ghostTop, setGhostTop] = useState(0);
  const [ghostHeight, setGhostHeight] = useState(0);
  const targetIndexRef = useRef(0);
  const movableRef = useRef(movableIds);
  movableRef.current = movableIds;
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => () => {
    if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
  }, []);

  const measure = (): Layout | null => {
    const list = listRef.current;
    if (!list) return null;
    const rows = movableRef.current
      .map((id) => list.querySelector<HTMLElement>(`[data-slot-id="${CSS.escape(id)}"]`))
      .filter((row): row is HTMLElement => Boolean(row));
    if (!rows.length) return null;
    const tops = rows.map((row) => row.offsetTop);
    const height = rows[0].offsetHeight;
    return {
      ids: rows.map((row) => row.dataset.slotId ?? ''),
      tops,
      height,
      step: rows.length > 1 ? tops[1] - tops[0] : height + 6,
    };
  };

  // Where the held character would land: how many of the other rows sit above the pointer.
  const aim = (clientY: number) => {
    const list = listRef.current;
    const layout = layoutRef.current;
    const drag = dragRef.current;
    if (!list || !layout || !drag) return;
    const contentY = clientY - list.getBoundingClientRect().top + list.scrollTop;
    const from = layout.ids.indexOf(drag.slotId);
    const index = layout.tops.filter((top, i) => i !== from && top + layout.height / 2 < contentY).length;
    targetIndexRef.current = index;
    setTargetIndex(index);
  };

  const placeGhost = (clientY: number) => {
    const list = listRef.current;
    const frame = list?.parentElement;
    if (!list || !frame) return;
    const frameTop = frame.getBoundingClientRect().top;
    const listRect = list.getBoundingClientRect();
    const height = layoutRef.current?.height ?? 0;
    const min = listRect.top - frameTop;
    const max = Math.max(min, listRect.bottom - frameTop - height);
    setGhostTop(Math.min(max, Math.max(min, clientY - frameTop - height / 2)));
  };

  // Edge auto-scroll while a drag is under way; also re-aims after any scroll (wheel included).
  useEffect(() => {
    if (!draggedSlotId || settling) return undefined;
    const list = listRef.current;
    const timer = window.setInterval(() => {
      if (!list) return;
      const rect = list.getBoundingClientRect();
      const y = lastYRef.current;
      if (y < rect.top + EDGE_SCROLL_ZONE_PX) list.scrollTop -= EDGE_SCROLL_STEP_PX;
      else if (y > rect.bottom - EDGE_SCROLL_ZONE_PX) list.scrollTop += EDGE_SCROLL_STEP_PX;
    }, 16);
    const onScroll = () => aim(lastYRef.current);
    list?.addEventListener('scroll', onScroll);
    return () => {
      window.clearInterval(timer);
      list?.removeEventListener('scroll', onScroll);
    };
  }, [draggedSlotId, settling]);

  const reset = () => {
    dragRef.current = null;
    layoutRef.current = null;
    setDraggedSlotId(null);
    setSettling(false);
  };

  const finish = (drop: boolean) => {
    const drag = dragRef.current;
    const layout = layoutRef.current;
    const list = listRef.current;
    if (!drag?.started || !layout || !list?.parentElement) {
      dragRef.current = null;
      return;
    }
    suppressClickRef.current = true;
    const from = layout.ids.indexOf(drag.slotId);
    const to = drop ? targetIndexRef.current : from;
    if (!drop) targetIndexRef.current = from;
    setTargetIndex(to);
    // Glide the copy into the gap, then commit the new order in the same frame the rows
    // drop their slide offsets, so nothing jumps.
    const frameTop = list.parentElement.getBoundingClientRect().top;
    setGhostTop(list.getBoundingClientRect().top - frameTop + layout.tops[from] + (to - from) * layout.step - list.scrollTop);
    setSettling(true);
    settleTimerRef.current = window.setTimeout(() => {
      settleTimerRef.current = null;
      if (to !== from) onMoveRef.current(drag.slotId, layout.ids[to]);
      reset();
    }, SLIDE_MS);
  };

  /** How far a row slides to make room; the held row's own (hidden) place moves to the gap. */
  const shiftOf = (slotId: string) => {
    const layout = layoutRef.current;
    if (!draggedSlotId || !layout) return 0;
    const from = layout.ids.indexOf(draggedSlotId);
    const index = layout.ids.indexOf(slotId);
    if (index < 0 || from < 0) return 0;
    if (slotId === draggedSlotId) return (targetIndex - from) * layout.step;
    if (from < targetIndex && index > from && index <= targetIndex) return -layout.step;
    if (from > targetIndex && index >= targetIndex && index < from) return layout.step;
    return 0;
  };

  const getRowProps = (slotId: string) => {
    if (!movableIds.includes(slotId)) return { 'data-slot-id': slotId };
    const style: CSSProperties | undefined = draggedSlotId
      ? { transform: `translateY(${shiftOf(slotId)}px)`, transition: `transform ${SLIDE_MS}ms ${SLIDE_EASING}` }
      : undefined;
    return {
      'data-slot-id': slotId,
      style,
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        if (event.button !== 0 || dragRef.current) return;
        // The delete button keeps working as a plain button.
        if ((event.target as HTMLElement).closest('[data-no-slot-drag]')) return;
        dragRef.current = { pointerId: event.pointerId, slotId, startY: event.clientY, started: false };
        lastYRef.current = event.clientY;
        suppressClickRef.current = false;
      },
      onPointerMove: (event: PointerEvent<HTMLElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId || settling) return;
        lastYRef.current = event.clientY;
        if (!drag.started) {
          if (Math.abs(event.clientY - drag.startY) < DRAG_START_DISTANCE_PX) return;
          const layout = measure();
          if (!layout) return;
          drag.started = true;
          layoutRef.current = layout;
          try {
            event.currentTarget.setPointerCapture(event.pointerId);
          } catch {
            // Pointer already gone; the drag still ends on pointerup/cancel.
          }
          setGhostHeight(layout.height);
          setDraggedSlotId(drag.slotId);
        }
        aim(event.clientY);
        placeGhost(event.clientY);
      },
      onPointerUp: () => finish(true),
      onPointerCancel: () => finish(false),
      // A drag ends with a click on the row; that click must not also select it.
      onClickCapture: (event: MouseEvent<HTMLElement>) => {
        if (!suppressClickRef.current) return;
        suppressClickRef.current = false;
        event.preventDefault();
        event.stopPropagation();
      },
    };
  };

  const ghostStyle: CSSProperties = {
    top: ghostTop,
    height: ghostHeight,
    transition: settling ? `top ${SLIDE_MS}ms ${SLIDE_EASING}, transform ${SLIDE_MS}ms ${SLIDE_EASING}` : 'transform 120ms ease-out',
    transform: settling ? 'scale(1)' : 'scale(1.03)',
  };

  return { draggedSlotId, getRowProps, ghostStyle, listRef };
}
