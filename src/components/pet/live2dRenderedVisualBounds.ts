import { normalize2DVisualBounds, type PetVisualBounds } from './petVisualBounds';

export type Live2DRenderedAlphaBounds = {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
};

export type Live2DRenderedAlphaSummary = {
  bounds: Live2DRenderedAlphaBounds | null;
  opaquePixelCount: number;
  pixelCount: number;
};

export function summarizeLive2DRenderedAlphaBounds(
  pixels: Uint8Array,
  width: number,
  height: number,
): Live2DRenderedAlphaSummary {
  let bottom = -1;
  let left = width;
  let opaquePixelCount = 0;
  let right = -1;
  let top = height;
  const pixelCount = Math.min(width * height, Math.floor(pixels.length / 4));

  for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
    if (pixels[pixelIndex * 4 + 3] <= 4) {
      continue;
    }
    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    opaquePixelCount += 1;
    bottom = Math.max(bottom, y);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
  }

  return opaquePixelCount === 0
    ? { bounds: null, opaquePixelCount, pixelCount }
    : {
        bounds: {
          bottom,
          height: bottom - top + 1,
          left,
          right,
          top,
          width: right - left + 1,
        },
        opaquePixelCount,
        pixelCount,
      };
}

export function resolveLive2DRenderedVisualBounds(options: {
  alphaBounds: Live2DRenderedAlphaBounds | null;
  rendererHeight: number;
  rendererWidth: number;
  stageSize: number;
}): PetVisualBounds | null {
  const { alphaBounds } = options;
  if (!alphaBounds) {
    return null;
  }

  const rendererWidth = Math.max(1, Number(options.rendererWidth) || 1);
  const rendererHeight = Math.max(1, Number(options.rendererHeight) || 1);
  const stageSize = Math.max(1, Number(options.stageSize) || 1);
  const pixelToStageX = stageSize / rendererWidth;
  const pixelToStageY = stageSize / rendererHeight;
  const center = stageSize / 2;

  return normalize2DVisualBounds({
    bottom: Math.max(1, (alphaBounds.bottom + 1) * pixelToStageY - center),
    left: Math.max(1, center - alphaBounds.left * pixelToStageX),
    right: Math.max(1, (alphaBounds.right + 1) * pixelToStageX - center),
    top: Math.max(1, center - alphaBounds.top * pixelToStageY),
  });
}
