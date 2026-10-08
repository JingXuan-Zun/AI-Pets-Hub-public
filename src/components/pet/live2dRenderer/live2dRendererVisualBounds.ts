import { Container, Point } from 'pixi.js';
import { type AvatarRuntimeEventListener } from '../../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type AvatarRuntimeViewport } from '../../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { normalize2DVisualBounds, type PetVisualBounds } from '../petVisualBounds';
import { resolveLive2DVisibleDrawableBounds, type Live2DModelLike } from '../live2dModelRuntime';

export const LIVE2D_BASE_STAGE_SIZE = 256;
export const LIVE2D_MAX_STAGE_SIZE = 960;

export function resolveLive2DDrawableVisualBounds(
  model: Live2DModelLike,
  modelLayer: Container,
  stageSize: number,
) {
  const drawableBounds = resolveLive2DVisibleDrawableBounds(model);
  if (!drawableBounds) {
    return null;
  }

  const corners = [
    new Point(drawableBounds.x, drawableBounds.y),
    new Point(drawableBounds.x + drawableBounds.width, drawableBounds.y),
    new Point(drawableBounds.x, drawableBounds.y + drawableBounds.height),
    new Point(drawableBounds.x + drawableBounds.width, drawableBounds.y + drawableBounds.height),
  ].map((point) => model.worldTransform.apply(point));
  const layerOffsetX = modelLayer.worldTransform.tx;
  const layerOffsetY = modelLayer.worldTransform.ty;
  const left = Math.min(...corners.map((point) => point.x)) - layerOffsetX;
  const right = Math.max(...corners.map((point) => point.x)) - layerOffsetX;
  const top = Math.min(...corners.map((point) => point.y)) - layerOffsetY;
  const bottom = Math.max(...corners.map((point) => point.y)) - layerOffsetY;
  const center = stageSize / 2;

  return normalize2DVisualBounds({
    bottom: Math.max(1, bottom - center),
    left: Math.max(1, center - left),
    right: Math.max(1, right - center),
    top: Math.max(1, center - top),
  });
}

export function emitLive2DFallbackBounds(options: {
  bounds?: PetVisualBounds;
  isMoving: boolean;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  petId: string;
  stageSize: number;
}) {
  const fallbackBounds = options.bounds ?? resolveLive2DFallbackBounds(options);

  options.onRuntimeEvent?.({
    bounds: fallbackBounds,
    petId: options.petId,
    runtimeKind: 'live2d',
    source: 'fallback',
    type: 'visual-bounds',
  });
  options.onVisualBoundsChange?.(fallbackBounds);
}

export function resolveLive2DFallbackBounds(options: {
  isMoving: boolean;
  stageSize: number;
}) {
  void options.isMoving;
  const stageScale = Math.max(
    0.5,
    Math.min(
      LIVE2D_MAX_STAGE_SIZE / LIVE2D_BASE_STAGE_SIZE,
      (Number(options.stageSize) || LIVE2D_BASE_STAGE_SIZE) / LIVE2D_BASE_STAGE_SIZE,
    ),
  );
  return normalize2DVisualBounds({
    bottom: Math.round(116 * stageScale),
    left: Math.round(90 * stageScale),
    right: Math.round(90 * stageScale),
    top: Math.round(126 * stageScale),
  });
}

export function createLive2DFallbackBoundsSignature(options: {
  bounds: PetVisualBounds;
  isMoving: boolean;
  modelUrl: string;
  petId: string;
  stageSize: number;
}) {
  const { bounds } = options;
  return [
    options.petId,
    options.modelUrl,
    options.stageSize,
    bounds.left,
    bounds.right,
    bounds.top,
    bounds.bottom,
  ].join('|');
}

export function summarizeLive2DViewport(viewport: AvatarRuntimeViewport | null | undefined) {
  if (!viewport) {
    return null;
  }

  return {
    height: Math.round(Number(viewport.height) || 0),
    width: Math.round(Number(viewport.width) || 0),
    x: Math.round(Number(viewport.x) || 0),
    y: Math.round(Number(viewport.y) || 0),
  };
}

export function resolveLive2DRendererStageSize(viewport: AvatarRuntimeViewport | null | undefined) {
  const viewportSize = Math.max(
    Number(viewport?.width) || 0,
    Number(viewport?.height) || 0,
  );

  return Math.max(
    LIVE2D_BASE_STAGE_SIZE,
    Math.min(LIVE2D_MAX_STAGE_SIZE, Math.round(viewportSize || LIVE2D_BASE_STAGE_SIZE)),
  );
}
