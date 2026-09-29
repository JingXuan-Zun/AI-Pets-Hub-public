import { type PetVisualBounds } from './petVisualBounds';

type Rect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type ResolveVideo2DVisualBoundsOptions = {
  containerRect: Rect;
  sourceHeight: number;
  sourceWidth: number;
  videoRect: Rect;
};

function hasPositiveFiniteSize(width: number, height: number) {
  return Number.isFinite(width)
    && Number.isFinite(height)
    && width > 0
    && height > 0;
}

/**
 * Returns the visible content rectangle of a video rendered with
 * `object-fit: contain`, expressed as extents from the pet canvas center.
 */
export function resolveVideo2DVisualBounds({
  containerRect,
  sourceHeight,
  sourceWidth,
  videoRect,
}: ResolveVideo2DVisualBoundsOptions): PetVisualBounds | null {
  if (!hasPositiveFiniteSize(sourceWidth, sourceHeight)
    || !hasPositiveFiniteSize(videoRect.width, videoRect.height)
    || !hasPositiveFiniteSize(containerRect.width, containerRect.height)) {
    return null;
  }

  const containedScale = Math.min(
    videoRect.width / sourceWidth,
    videoRect.height / sourceHeight,
  );
  const visibleWidth = sourceWidth * containedScale;
  const visibleHeight = sourceHeight * containedScale;
  const visibleLeft = videoRect.left + (videoRect.width - visibleWidth) / 2;
  const visibleTop = videoRect.top + (videoRect.height - visibleHeight) / 2;
  const centerX = containerRect.left + containerRect.width / 2;
  const centerY = containerRect.top + containerRect.height / 2;

  return {
    bottom: Math.max(1, Math.ceil(visibleTop + visibleHeight - centerY)),
    left: Math.max(1, Math.ceil(centerX - visibleLeft)),
    right: Math.max(1, Math.ceil(visibleLeft + visibleWidth - centerX)),
    top: Math.max(1, Math.ceil(centerY - visibleTop)),
  } satisfies PetVisualBounds;
}
