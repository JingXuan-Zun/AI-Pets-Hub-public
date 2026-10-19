import { type PetVisualBounds } from './petVisualBounds';
import { FULL_VIDEO_CONTENT_BOX, type VideoContentBox } from './video2dContentBox';

type Rect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type ResolveVideo2DVisualBoundsOptions = {
  containerRect: Rect;
  /** Opaque part of the frame (fractions); defaults to the whole frame. */
  contentBox?: VideoContentBox | null;
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
  contentBox,
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
  const frameWidth = sourceWidth * containedScale;
  const frameHeight = sourceHeight * containedScale;
  const frameLeft = videoRect.left + (videoRect.width - frameWidth) / 2;
  const frameTop = videoRect.top + (videoRect.height - frameHeight) / 2;
  // Narrow the drawn frame to where the character actually is.
  const box = contentBox ?? FULL_VIDEO_CONTENT_BOX;
  const visibleLeft = frameLeft + frameWidth * box.left;
  const visibleTop = frameTop + frameHeight * box.top;
  const visibleWidth = frameWidth * Math.max(0, box.right - box.left);
  const visibleHeight = frameHeight * Math.max(0, box.bottom - box.top);
  const centerX = containerRect.left + containerRect.width / 2;
  const centerY = containerRect.top + containerRect.height / 2;

  return {
    bottom: Math.max(1, Math.ceil(visibleTop + visibleHeight - centerY)),
    left: Math.max(1, Math.ceil(centerX - visibleLeft)),
    right: Math.max(1, Math.ceil(visibleLeft + visibleWidth - centerX)),
    top: Math.max(1, Math.ceil(centerY - visibleTop)),
  } satisfies PetVisualBounds;
}
