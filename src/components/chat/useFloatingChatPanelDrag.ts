import { useCallback, useEffect, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import { type ChatPanelDragState, type FloatingChatPanelOffset } from './floatingChatPanelTypes';

interface UseFloatingChatPanelDragOptions {
  chatPanelDragState: ChatPanelDragState;
  chatPanelOffset: FloatingChatPanelOffset;
  setChatPanelDragState: Dispatch<SetStateAction<ChatPanelDragState>>;
  setChatPanelOffset: Dispatch<SetStateAction<FloatingChatPanelOffset>>;
}

function isChatPanelDragBlockedTarget(target: EventTarget | null) {
  return target instanceof HTMLElement
    && Boolean(target.closest('button, input, select, textarea'));
}

export function useFloatingChatPanelDrag({
  chatPanelDragState,
  chatPanelOffset,
  setChatPanelDragState,
  setChatPanelOffset,
}: UseFloatingChatPanelDragOptions) {
  useEffect(() => {
    if (!chatPanelDragState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== chatPanelDragState.pointerId) {
        return;
      }

      setChatPanelOffset({
        x: chatPanelDragState.originX + (event.clientX - chatPanelDragState.startX),
        y: chatPanelDragState.originY + (event.clientY - chatPanelDragState.startY),
      });
    };

    const stopDrag = (event: PointerEvent) => {
      if (event.pointerId === chatPanelDragState.pointerId) {
        setChatPanelDragState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, [chatPanelDragState, setChatPanelDragState, setChatPanelOffset]);

  const startChatPanelDrag = useCallback((
    event: ReactPointerEvent<HTMLElement>,
    options?: { allowControl?: boolean },
  ) => {
    if (!options?.allowControl && isChatPanelDragBlockedTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setChatPanelDragState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: chatPanelOffset.x,
      originY: chatPanelOffset.y,
    });
  }, [chatPanelOffset.x, chatPanelOffset.y, setChatPanelDragState]);

  return {
    startChatPanelDrag,
  };
}
