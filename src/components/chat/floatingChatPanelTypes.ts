import { type MutableRefObject } from 'react';

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface FloatingChatPanelOffset {
  x: number;
  y: number;
}

export interface FloatingChatPanelSize {
  width: number;
  height: number;
}

export type FloatingChatPanelBasePositionResolver = (
  size: FloatingChatPanelSize,
) => FloatingChatPanelOffset;

export type FloatingChatPanelLayoutPreset = 'default' | 'interactive-dialogue';

export type ChatPanelDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
} | null;

export type ChatPanelResizeState = {
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
} | null;

export interface UseFloatingChatPanelOptions {
  defaultOffset: FloatingChatPanelOffset;
  defaultSize: FloatingChatPanelSize;
  interactiveDefaultOffset?: FloatingChatPanelOffset;
  interactiveDefaultSize?: FloatingChatPanelSize;
  minHeight: number;
  maxHeight: number;
  minWidth: number;
  maxWidth: number;
  panelBasePositionResolverRef: MutableRefObject<FloatingChatPanelBasePositionResolver>;
}
