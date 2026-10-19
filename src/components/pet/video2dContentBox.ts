/**
 * Where the character actually is inside a transparent video frame.
 *
 * Video pets are usually wide frames with the character in the middle and
 * transparent space around it. Using the whole frame as the pet's bounds made
 * the activity-region clamp stop far from the edge, the collision box too wide
 * and the pills/bubble misplaced. Sampling the opaque pixels gives the real box.
 *
 * Fractions are relative to the source frame (0..1).
 */
export type VideoContentBox = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export const FULL_VIDEO_CONTENT_BOX: VideoContentBox = { left: 0, top: 0, right: 1, bottom: 1 };

/** Downscaled sample width; enough to find the character box, cheap to scan. */
const SAMPLE_WIDTH = 192;
/** Alpha above this counts as part of the character (ignores faint edge noise). */
const OPAQUE_ALPHA_THRESHOLD = 24;

let sampleCanvas: HTMLCanvasElement | null = null;

/**
 * Bounding box of the opaque pixels in the video's current frame, or null when
 * the frame cannot be read (not decoded yet, or the pixels are not readable).
 */
export function measureVideoContentBox(video: HTMLVideoElement): VideoContentBox | null {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight || video.readyState < 2) return null;

  const width = SAMPLE_WIDTH;
  const height = Math.max(1, Math.round((SAMPLE_WIDTH * videoHeight) / videoWidth));
  sampleCanvas ??= document.createElement('canvas');
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const context = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  let pixels: Uint8ClampedArray;
  try {
    context.clearRect(0, 0, width, height);
    context.drawImage(video, 0, 0, width, height);
    pixels = context.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x += 1) {
      if (pixels[rowOffset + x * 4 + 3] > OPAQUE_ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Fully transparent frame (e.g. a fade): nothing to learn from it.
  if (maxX < 0) return null;
  return {
    left: minX / width,
    top: minY / height,
    right: (maxX + 1) / width,
    bottom: (maxY + 1) / height,
  };
}

/** Union of two boxes, so one clip's bounds cover its whole motion. */
export function unionVideoContentBoxes(current: VideoContentBox | null, next: VideoContentBox): VideoContentBox {
  if (!current) return next;
  return {
    left: Math.min(current.left, next.left),
    top: Math.min(current.top, next.top),
    right: Math.max(current.right, next.right),
    bottom: Math.max(current.bottom, next.bottom),
  };
}

export function areVideoContentBoxesEqual(left: VideoContentBox | null, right: VideoContentBox | null) {
  if (!left || !right) return left === right;
  return left.left === right.left && left.top === right.top && left.right === right.right && left.bottom === right.bottom;
}
