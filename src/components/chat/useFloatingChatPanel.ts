import { useCallback, useState } from 'react';
import { useFloatingChatPanelDrag } from './useFloatingChatPanelDrag';
import { useFloatingChatPanelResize } from './useFloatingChatPanelResize';
import {
  type ChatPanelDragState,
  type FloatingChatPanelLayoutPreset,
  type ChatPanelResizeState,
  type UseFloatingChatPanelOptions,
} from './floatingChatPanelTypes';

function resolveChatPanelLayout(
  preset: FloatingChatPanelLayoutPreset,
  defaultOffset: UseFloatingChatPanelOptions['defaultOffset'],
  defaultSize: UseFloatingChatPanelOptions['defaultSize'],
  interactiveDefaultOffset: UseFloatingChatPanelOptions['interactiveDefaultOffset'],
  interactiveDefaultSize: UseFloatingChatPanelOptions['interactiveDefaultSize'],
) {
  if (preset === 'interactive-dialogue') {
    return {
      offset: interactiveDefaultOffset ?? defaultOffset,
      size: interactiveDefaultSize ?? defaultSize,
    };
  }

  return {
    offset: defaultOffset,
    size: defaultSize,
  };
}

export function useFloatingChatPanel({
  defaultOffset,
  defaultSize,
  interactiveDefaultOffset,
  interactiveDefaultSize,
  minHeight,
  maxHeight,
  minWidth,
  maxWidth,
  panelBasePositionResolverRef,
}: UseFloatingChatPanelOptions) {
  const [chatPanelOffset, setChatPanelOffset] = useState(defaultOffset);
  const [chatPanelSize, setChatPanelSize] = useState(defaultSize);
  const [chatPanelDragState, setChatPanelDragState] = useState<ChatPanelDragState>(null);
  const [chatPanelResizeState, setChatPanelResizeState] = useState<ChatPanelResizeState>(null);

  const { startChatPanelDrag } = useFloatingChatPanelDrag({
    chatPanelDragState,
    chatPanelOffset,
    setChatPanelDragState,
    setChatPanelOffset,
  });
  const { startChatPanelResize } = useFloatingChatPanelResize({
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
  });

  const resetChatPanelLayout = useCallback((preset: FloatingChatPanelLayoutPreset = 'default') => {
    const nextLayout = resolveChatPanelLayout(
      preset,
      defaultOffset,
      defaultSize,
      interactiveDefaultOffset,
      interactiveDefaultSize,
    );
    setChatPanelOffset(nextLayout.offset);
    setChatPanelSize(nextLayout.size);
    setChatPanelDragState(null);
    setChatPanelResizeState(null);
  }, [defaultOffset, defaultSize, interactiveDefaultOffset, interactiveDefaultSize]);
  const resetInteractiveChatPanelLayout = useCallback(() => {
    resetChatPanelLayout('interactive-dialogue');
  }, [resetChatPanelLayout]);

  return {
    chatPanelDragState,
    chatPanelOffset,
    chatPanelResizeState,
    chatPanelSize,
    resetInteractiveChatPanelLayout,
    resetChatPanelLayout,
    startChatPanelDrag,
    startChatPanelResize,
  };
}
