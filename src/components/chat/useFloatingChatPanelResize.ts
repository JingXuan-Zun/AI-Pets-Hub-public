import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type PointerEvent as ReactPointerEvent, type SetStateAction } from 'react';
import {
  type FloatingChatPanelBasePositionResolver,
  type ChatPanelResizeState,
  type FloatingChatPanelOffset,
  type FloatingChatPanelSize,
  type ResizeDirection,
} from './floatingChatPanelTypes';

interface UseFloatingChatPanelResizeOptions {
  chatPanelOffset: FloatingChatPanelOffset;
  chatPanelResizeState: ChatPanelResizeState;
  chatPanelSize: FloatingChatPanelSize;
  maxHeight: number;
  maxWidth: number;
  minHeight: number;
  minWidth: number;
  panelBasePositionResolverRef: MutableRefObject<FloatingChatPanelBasePositionResolver>;
  setChatPanelOffset: Dispatch<SetStateAction<FloatingChatPanelOffset>>;
  setChatPanelResizeState: Dispatch<SetStateAction<ChatPanelResizeState>>;
  setChatPanelSize: Dispatch<SetStateAction<FloatingChatPanelSize>>;
}

export function useFloatingChatPanelResize({
  chatPanelOffset,
  chatPanelResizeState,
  chatPanelSize,
  maxHeight,
  maxWidth,
  minHeight,
  minWidth,
  panelBasePositionResolverRef,
  setChatPanelOffset,
  setChatPanelResizeState,
  setChatPanelSize,
}: UseFloatingChatPanelResizeOptions) {
  const resizeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!chatPanelResizeState) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== chatPanelResizeState.pointerId) {
        return;
      }

      const deltaX = event.clientX - chatPanelResizeState.startX;
      const deltaY = event.clientY - chatPanelResizeState.startY;
      const resizeFromLeft = chatPanelResizeState.direction.includes('w');
      const resizeFromRight = chatPanelResizeState.direction.includes('e');
      const resizeFromTop = chatPanelResizeState.direction.includes('n');
      const resizeFromBottom = chatPanelResizeState.direction.includes('s');
      const rawWidth = chatPanelResizeState.originWidth
        + (resizeFromRight ? deltaX : 0)
        - (resizeFromLeft ? deltaX : 0);
      const rawHeight = chatPanelResizeState.originHeight
        + (resizeFromBottom ? deltaY : 0)
        - (resizeFromTop ? deltaY : 0);
      const nextWidth = Math.max(minWidth, Math.min(maxWidth, rawWidth));
      const nextHeight = Math.max(minHeight, Math.min(maxHeight, rawHeight));
      const nextSize = {
        width: nextWidth,
        height: nextHeight,
      };
      const nextBasePosition = panelBasePositionResolverRef.current(nextSize);
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        setChatPanelSize(nextSize);
        setChatPanelOffset({
          x: resizeFromLeft
            ? chatPanelResizeState.originBaseX + chatPanelResizeState.originOffsetX + chatPanelResizeState.originWidth - nextWidth - nextBasePosition.x
            : chatPanelResizeState.originBaseX + chatPanelResizeState.originOffsetX - nextBasePosition.x,
          y: resizeFromTop
            ? chatPanelResizeState.originBaseY + chatPanelResizeState.originOffsetY + chatPanelResizeState.originHeight - nextHeight - nextBasePosition.y
            : chatPanelResizeState.originBaseY + chatPanelResizeState.originOffsetY - nextBasePosition.y,
        });
      });
    };

    const stopResize = (event: PointerEvent) => {
      if (event.pointerId === chatPanelResizeState.pointerId) {
        setChatPanelResizeState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);

    return () => {
      if (resizeFrameRef.current !== null) {
        window.cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);
    };
  }, [
    chatPanelResizeState,
    maxHeight,
    maxWidth,
    minHeight,
    minWidth,
    panelBasePositionResolverRef,
    setChatPanelOffset,
    setChatPanelResizeState,
    setChatPanelSize,
  ]);

  const startChatPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
    event.preventDefault();
    event.stopPropagation();
    const originBasePosition = panelBasePositionResolverRef.current(chatPanelSize);
    setChatPanelResizeState({
      direction,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originBaseX: originBasePosition.x,
      originBaseY: originBasePosition.y,
      originWidth: chatPanelSize.width,
      originHeight: chatPanelSize.height,
      originOffsetX: chatPanelOffset.x,
      originOffsetY: chatPanelOffset.y,
    });
  }, [
    chatPanelOffset.x,
    chatPanelOffset.y,
    chatPanelSize.height,
    chatPanelSize.width,
    panelBasePositionResolverRef,
    setChatPanelResizeState,
  ]);

  return {
    startChatPanelResize,
  };
}
