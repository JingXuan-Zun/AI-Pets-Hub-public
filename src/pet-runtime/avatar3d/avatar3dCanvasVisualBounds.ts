import { type PetVisualBounds } from '../../components/pet/petVisualBounds';

const VISIBLE_ALPHA_THRESHOLD = 14;
const MAX_SAMPLE_EDGE = 512;

export type Avatar3DCanvasVisualBoundsSampler = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

function resolveCanvasSampleSize(canvas: HTMLCanvasElement) {
  const sourceWidth = Math.max(1, Math.round(canvas.width));
  const sourceHeight = Math.max(1, Math.round(canvas.height));
  const scale = Math.min(1, MAX_SAMPLE_EDGE / Math.max(sourceWidth, sourceHeight));

  return {
    sourceHeight,
    sourceWidth,
    targetHeight: Math.max(1, Math.round(sourceHeight * scale)),
    targetWidth: Math.max(1, Math.round(sourceWidth * scale)),
  };
}

export function createAvatar3DCanvasVisualBoundsSampler(): Avatar3DCanvasVisualBoundsSampler | null {
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });

  return sampleContext
    ? {
        canvas: sampleCanvas,
        context: sampleContext,
      }
    : null;
}

export function mergeAvatar3DVisualBounds(
  currentBounds: PetVisualBounds | null,
  nextBounds: PetVisualBounds,
) {
  if (!currentBounds) {
    return nextBounds;
  }

  return {
    left: Math.max(currentBounds.left, nextBounds.left),
    right: Math.max(currentBounds.right, nextBounds.right),
    top: Math.max(currentBounds.top, nextBounds.top),
    bottom: Math.max(currentBounds.bottom, nextBounds.bottom),
  } satisfies PetVisualBounds;
}

export function measureAvatar3DCanvasVisualBounds(
  canvas: HTMLCanvasElement,
  sampler: Avatar3DCanvasVisualBoundsSampler | null = null,
): PetVisualBounds | null {
  const canvasRect = canvas.getBoundingClientRect();
  if (canvasRect.width <= 0 || canvasRect.height <= 0) {
    return null;
  }

  const sampleCanvas = sampler?.canvas ?? document.createElement('canvas');
  const { targetHeight, targetWidth } = resolveCanvasSampleSize(canvas);
  sampleCanvas.width = targetWidth;
  sampleCanvas.height = targetHeight;
  const sampleContext = sampler?.context ?? sampleCanvas.getContext('2d', { willReadFrequently: true });

  if (!sampleContext) {
    return null;
  }

  sampleContext.clearRect(0, 0, targetWidth, targetHeight);
  sampleContext.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  let imageData: ImageData;
  try {
    imageData = sampleContext.getImageData(0, 0, targetWidth, targetHeight);
  } catch {
    return null;
  }

  const { data } = imageData;
  let minX = targetWidth;
  let minY = targetHeight;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const alpha = data[(y * targetWidth + x) * 4 + 3] ?? 0;
      if (alpha < VISIBLE_ALPHA_THRESHOLD) {
        continue;
      }

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  const centerX = canvasRect.left + canvasRect.width / 2;
  const centerY = canvasRect.top + canvasRect.height / 2;
  const visibleLeft = canvasRect.left + canvasRect.width * (minX / targetWidth);
  const visibleRight = canvasRect.left + canvasRect.width * ((maxX + 1) / targetWidth);
  const visibleTop = canvasRect.top + canvasRect.height * (minY / targetHeight);
  const visibleBottom = canvasRect.top + canvasRect.height * ((maxY + 1) / targetHeight);

  return {
    left: Math.max(0, Math.ceil(centerX - visibleLeft)),
    right: Math.max(0, Math.ceil(visibleRight - centerX)),
    top: Math.max(0, Math.ceil(centerY - visibleTop)),
    bottom: Math.max(0, Math.ceil(visibleBottom - centerY)),
  } satisfies PetVisualBounds;
}
