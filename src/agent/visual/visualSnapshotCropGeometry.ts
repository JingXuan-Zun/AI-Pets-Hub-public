import { type AgentToolCallCommand } from '../agentChatCommand';
import { normalizeVisualSnapshotCropCoordinateSpace, type VisualSnapshotFocusCropRequest, type VisualSnapshotResolvedCrop } from './visualSnapshotCropTypes';
import { resolveVisualSnapshotSourceBounds } from './visualSnapshotSourceBounds';

import { getToolNumberInputAny, getToolStringInput } from './visualToolInput';

function clampVisualSnapshotFocusScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(4, value));
}

function resolveAutoVisualSnapshotFocusScale(rect: { height: number; width: number }) {
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const longestSide = Math.max(width, height);
  const shortestSide = Math.min(width, height);
  const scale = Math.max(
    longestSide < 900 ? 900 / longestSide : 1,
    shortestSide < 360 ? 360 / shortestSide : 1,
  );
  const clampedScale = Math.min(3, clampVisualSnapshotFocusScale(scale));
  return clampedScale <= 1.15 ? 1 : Math.round(clampedScale * 100) / 100;
}

export function getVisualSnapshotFocusCropRequest(toolCall: AgentToolCallCommand): VisualSnapshotFocusCropRequest | null {
  const centerRatioX = getToolNumberInputAny(toolCall, ['focusCenterRatioX', 'cropCenterRatioX', 'centerRatioX']);
  const centerRatioY = getToolNumberInputAny(toolCall, ['focusCenterRatioY', 'cropCenterRatioY', 'centerRatioY']);
  const widthRatio = getToolNumberInputAny(toolCall, ['focusWidthRatio', 'cropWidthRatio', 'widthRatio']);
  const heightRatio = getToolNumberInputAny(toolCall, ['focusHeightRatio', 'cropHeightRatio', 'heightRatio']);
  const explicitScale = getToolNumberInputAny(toolCall, ['focusScale', 'cropScale', 'magnification', 'zoomScale']);
  const paddingRatio = Math.max(0, Math.min(2, getToolNumberInputAny(
    toolCall,
    ['focusPaddingRatio', 'cropPaddingRatio', 'paddingRatio'],
  ) ?? 0.35));

  if (
    typeof centerRatioX === 'number'
    && typeof centerRatioY === 'number'
    && centerRatioX >= 0
    && centerRatioX <= 1
    && centerRatioY >= 0
    && centerRatioY <= 1
  ) {
    const resolvedWidthRatio = Math.max(0.05, Math.min(1, widthRatio ?? 0.34));
    const resolvedHeightRatio = Math.max(0.05, Math.min(1, heightRatio ?? 0.26));
    return {
      coordinateSpace: 'source-ratio',
      height: resolvedHeightRatio,
      paddingRatio: 0,
      scale: typeof explicitScale === 'number' ? clampVisualSnapshotFocusScale(explicitScale) : undefined,
      width: resolvedWidthRatio,
      x: centerRatioX - resolvedWidthRatio / 2,
      y: centerRatioY - resolvedHeightRatio / 2,
    };
  }

  const x = getToolNumberInputAny(toolCall, ['focusX', 'cropX', 'x']);
  const y = getToolNumberInputAny(toolCall, ['focusY', 'cropY', 'y']);
  const width = getToolNumberInputAny(toolCall, ['focusWidth', 'cropWidth', 'width']);
  const height = getToolNumberInputAny(toolCall, ['focusHeight', 'cropHeight', 'height']);
  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof width !== 'number'
    || typeof height !== 'number'
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  return {
    coordinateSpace: normalizeVisualSnapshotCropCoordinateSpace(
      getToolStringInput(toolCall, ['focusCoordinateSpace', 'cropCoordinateSpace', 'coordinateSpace']) || 'source',
    ),
    height,
    paddingRatio,
    scale: typeof explicitScale === 'number' ? clampVisualSnapshotFocusScale(explicitScale) : undefined,
    width,
    x,
    y,
  };
}

function clampVisualSnapshotRectToImage(rect: {
  height: number;
  width: number;
  x: number;
  y: number;
}, imageWidth: number, imageHeight: number) {
  const x = Math.max(0, Math.min(imageWidth - 1, rect.x));
  const y = Math.max(0, Math.min(imageHeight - 1, rect.y));
  const right = Math.max(x + 1, Math.min(imageWidth, rect.x + rect.width));
  const bottom = Math.max(y + 1, Math.min(imageHeight, rect.y + rect.height));
  return {
    height: Math.max(1, Math.round(bottom - y)),
    width: Math.max(1, Math.round(right - x)),
    x: Math.round(x),
    y: Math.round(y),
  };
}

function expandVisualSnapshotRect(rect: {
  height: number;
  width: number;
  x: number;
  y: number;
}, paddingRatio: number) {
  const padX = rect.width * paddingRatio;
  const padY = rect.height * paddingRatio;
  return {
    height: rect.height + padY * 2,
    width: rect.width + padX * 2,
    x: rect.x - padX,
    y: rect.y - padY,
  };
}

export function resolveVisualSnapshotCropRequest(options: {
  imageHeight: number;
  imageWidth: number;
  request: VisualSnapshotFocusCropRequest;
  source: DesktopPetCaptureSourceLike;
}): VisualSnapshotResolvedCrop | null {
  const { imageHeight, imageWidth, request, source } = options;
  const sourceBounds = resolveVisualSnapshotSourceBounds(source);
  const sourceWidth = sourceBounds?.width ?? source.width ?? imageWidth;
  const sourceHeight = sourceBounds?.height ?? source.height ?? imageHeight;
  if (sourceWidth <= 0 || sourceHeight <= 0) {
    return null;
  }

  let sourceRect: { height: number; width: number; x: number; y: number };
  if (request.coordinateSpace === 'source-ratio') {
    sourceRect = {
      height: (request.height ?? 0) * sourceHeight,
      width: (request.width ?? 0) * sourceWidth,
      x: (request.x ?? 0) * sourceWidth,
      y: (request.y ?? 0) * sourceHeight,
    };
  } else if (request.coordinateSpace === 'native-screen' && sourceBounds) {
    sourceRect = {
      height: request.height ?? 0,
      width: request.width ?? 0,
      x: (request.x ?? 0) - sourceBounds.x,
      y: (request.y ?? 0) - sourceBounds.y,
    };
  } else {
    sourceRect = {
      height: request.height ?? 0,
      width: request.width ?? 0,
      x: request.x ?? 0,
      y: request.y ?? 0,
    };
  }

  if (sourceRect.width <= 0 || sourceRect.height <= 0) {
    return null;
  }

  const paddedSourceRect = expandVisualSnapshotRect(sourceRect, request.paddingRatio);
  const imageRect = clampVisualSnapshotRectToImage({
    height: paddedSourceRect.height * (imageHeight / sourceHeight),
    width: paddedSourceRect.width * (imageWidth / sourceWidth),
    x: paddedSourceRect.x * (imageWidth / sourceWidth),
    y: paddedSourceRect.y * (imageHeight / sourceHeight),
  }, imageWidth, imageHeight);
  const cropSourceRect = {
    height: imageRect.height * (sourceHeight / imageHeight),
    width: imageRect.width * (sourceWidth / imageWidth),
    x: imageRect.x * (sourceWidth / imageWidth),
    y: imageRect.y * (sourceHeight / imageHeight),
  };
  const cropScreenBounds = sourceBounds
    ? {
        height: Math.round(cropSourceRect.height),
        width: Math.round(cropSourceRect.width),
        x: Math.round(sourceBounds.x + cropSourceRect.x),
        y: Math.round(sourceBounds.y + cropSourceRect.y),
      }
    : null;

  return {
    imageRect,
    label: `focus crop ${imageRect.x},${imageRect.y},${imageRect.width}x${imageRect.height} from ${imageWidth}x${imageHeight}`,
    scale: request.scale ?? resolveAutoVisualSnapshotFocusScale(imageRect),
    sourceBounds: cropScreenBounds,
  };
}
