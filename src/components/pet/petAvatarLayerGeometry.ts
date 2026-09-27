import { type CSSProperties } from 'react';

type Position = {
  x: number;
  y: number;
};

interface ResolvePetRuntimeViewportOptions {
  activityCenter: Position;
  renderedPosition: Position;
  shellSize: number;
}

interface ResolvePetAvatarShellStyleOptions {
  isDragging: boolean;
  isScaling?: boolean;
  renderedPosition: Position;
  shellSize: number;
  shouldLetDragPreviewOwnTransform?: boolean;
}

export function resolvePetRuntimeViewport({
  activityCenter,
  renderedPosition,
  shellSize,
}: ResolvePetRuntimeViewportOptions) {
  const centerX = activityCenter.x + renderedPosition.x;
  const centerY = activityCenter.y + renderedPosition.y;

  return {
    height: shellSize,
    width: shellSize,
    x: Math.round(centerX - shellSize / 2),
    y: Math.round(centerY - shellSize / 2),
  };
}

export function resolvePetAvatarShellStyle({
  isDragging,
  isScaling = false,
  renderedPosition,
  shellSize,
  shouldLetDragPreviewOwnTransform = false,
}: ResolvePetAvatarShellStyleOptions) {
  const shouldOmitManagedTransform = isDragging && shouldLetDragPreviewOwnTransform;

  return {
    height: `${shellSize}px`,
    ...(!shouldOmitManagedTransform
      ? { transform: `translate3d(${renderedPosition.x}px, ${renderedPosition.y}px, 0)` }
      : {}),
    transition: isDragging || isScaling
      ? 'none'
      : 'transform 220ms ease, width 220ms ease, height 220ms ease',
    willChange: 'transform',
    width: `${shellSize}px`,
  } satisfies CSSProperties;
}
