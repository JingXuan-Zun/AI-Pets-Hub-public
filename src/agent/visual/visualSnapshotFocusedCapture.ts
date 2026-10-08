import { type AgentToolCallCommand } from '../agentChatCommand';
import { resolveVisualSnapshotSourceImage } from './visualSnapshotSourceImage';
import { getVisualSnapshotFocusCropRequest, resolveVisualSnapshotCropRequest } from './visualSnapshotCropGeometry';

function loadVisualSnapshotImage(imageDataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof Image === 'undefined') {
      reject(new Error('Current runtime cannot crop visual snapshots because Image is unavailable.'));
      return;
    }

    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load visual snapshot image for focus crop.'));
    image.src = imageDataUrl;
  });
}

const MAX_FOCUSED_OUTPUT_SIDE = 2560;

export async function createFocusedVisualSnapshotSource(options: {
  source: DesktopPetCaptureSourceLike;
  toolCall: AgentToolCallCommand;
}) {
  const request = getVisualSnapshotFocusCropRequest(options.toolCall);
  const baseImageDataUrl = await resolveVisualSnapshotSourceImage(options.source);
  if (!request) {
    return {
      cropLine: '',
      imageDataUrl: baseImageDataUrl,
      source: options.source,
    };
  }

  const image = await loadVisualSnapshotImage(baseImageDataUrl);
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  if (imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('视觉快照图片尺寸无效，无法裁剪局部区域。');
  }

  const crop = resolveVisualSnapshotCropRequest({
    imageHeight,
    imageWidth,
    request,
    source: options.source,
  });
  if (!crop) {
    throw new Error('局部视觉观察参数无效，无法解析裁剪区域。');
  }

  if (typeof document === 'undefined') {
    throw new Error('Current runtime cannot crop visual snapshots because document is unavailable.');
  }

  // Crops now come from full-resolution frames, so cap upscaling to keep the request bounded.
  const outputScale = Math.min(crop.scale, MAX_FOCUSED_OUTPUT_SIDE / Math.max(crop.imageRect.width, crop.imageRect.height, 1));
  const outputWidth = Math.max(1, Math.round(crop.imageRect.width * outputScale));
  const outputHeight = Math.max(1, Math.round(crop.imageRect.height * outputScale));
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法创建视觉裁剪画布。');
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    crop.imageRect.x,
    crop.imageRect.y,
    crop.imageRect.width,
    crop.imageRect.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );
  const croppedImageDataUrl = canvas.toDataURL('image/png');
  const scaleLine = crop.scale > 1 ? ` scale=${crop.scale} output=${outputWidth}x${outputHeight}` : '';

  return {
    cropLine: `Visual focus crop: ${crop.label}${scaleLine}${crop.sourceBounds ? ` screenBounds=${crop.sourceBounds.x},${crop.sourceBounds.y},${crop.sourceBounds.width}x${crop.sourceBounds.height}` : ''}`,
    imageDataUrl: croppedImageDataUrl,
    source: {
      ...options.source,
      bounds: crop.sourceBounds ?? options.source.bounds,
      height: crop.sourceBounds?.height ?? crop.imageRect.height,
      name: `${options.source.name} focus crop`,
      thumbnail: croppedImageDataUrl,
      width: crop.sourceBounds?.width ?? crop.imageRect.width,
    } satisfies DesktopPetCaptureSourceLike,
  };
}
