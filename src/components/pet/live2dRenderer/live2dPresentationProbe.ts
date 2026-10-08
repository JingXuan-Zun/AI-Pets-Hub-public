import { type Application, type Container } from 'pixi.js';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type Live2DModelLike } from '../live2dModelRuntime';
import { resolveLive2DDrawableVisualBounds } from './live2dRendererVisualBounds';
import { type Live2DRendererRuntimeContext } from './live2dRendererRefs';

type RectLike = { height: number; left: number; top: number; width: number };

function summarizeRect(rect: RectLike | null) {
  return rect
    ? {
        height: Number(rect.height.toFixed(2)),
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
      }
    : null;
}

function summarizeProbeModel(model: Live2DModelLike, localBounds: { height: number; width: number; x: number; y: number }) {
  return {
    anchor: { x: model.anchor.x, y: model.anchor.y },
    height: model.height,
    localBounds: {
      height: localBounds.height,
      width: localBounds.width,
      x: localBounds.x,
      y: localBounds.y,
    },
    pivot: { x: model.pivot.x, y: model.pivot.y },
    position: { x: model.x, y: model.y },
    renderable: model.renderable,
    scale: { x: model.scale.x, y: model.scale.y },
    visible: model.visible,
    width: model.width,
  };
}

function summarizeProbeRenderer(app: Application) {
  return {
    height: app.renderer.height,
    resolution: app.renderer.resolution,
    screenHeight: app.renderer.screen.height,
    screenWidth: app.renderer.screen.width,
    width: app.renderer.width,
  };
}

function resolveRendererContextLost(app: Application) {
  const rendererWithContext = app.renderer as unknown as {
    gl?: { isContextLost?: () => boolean };
  };
  return typeof rendererWithContext.gl?.isContextLost === 'function'
    ? rendererWithContext.gl.isContextLost()
    : null;
}

export function runLive2DPresentationProbe(options: {
  app: Application;
  container: HTMLDivElement | null;
  model: Live2DModelLike;
  modelLayer: Container | null;
  runtimeContext: Live2DRendererRuntimeContext;
  sampleDelayMs: number;
  stageSize: number;
}) {
  const { app, container, model, runtimeContext, sampleDelayMs, stageSize } = options;
  try {
    app.render();
    const canvasRect = app.view.getBoundingClientRect();
    const containerRect = container?.getBoundingClientRect() ?? null;
    const parentRect = container?.parentElement?.getBoundingClientRect() ?? null;
    const localBounds = model.getLocalBounds();
    const drawableBounds = options.modelLayer
      ? resolveLive2DDrawableVisualBounds(model, options.modelLayer, stageSize)
      : null;
    const contextLost = resolveRendererContextLost(app);
    const computedStyle = container ? window.getComputedStyle(container) : null;
    pushFrontendRuntimeLog('model', 'TEMP live2d presentation probe', {
      sampleDelayMs,
      canvas: {
        clientHeight: app.view.clientHeight,
        clientWidth: app.view.clientWidth,
        connected: app.view.isConnected,
        height: app.view.height,
        rect: summarizeRect(canvasRect),
        width: app.view.width,
      },
      container: {
        connected: Boolean(container?.isConnected),
        opacity: computedStyle?.opacity ?? null,
        rect: summarizeRect(containerRect),
        visibility: computedStyle?.visibility ?? null,
        zIndex: computedStyle?.zIndex ?? null,
      },
      contextLost,
      model: summarizeProbeModel(model, localBounds),
      modelUrl: runtimeContext.modelUrl,
      petId: runtimeContext.runtimePetId,
      parentRect: summarizeRect(parentRect),
      renderedDrawableBounds: drawableBounds,
      renderer: summarizeProbeRenderer(app),
      runtimeUrl: runtimeContext.modelRuntimeUrl,
      stageSize,
    });
  } catch (error) {
    pushFrontendRuntimeError('model', 'TEMP live2d presentation probe failed', error, {
      modelUrl: runtimeContext.modelUrl,
      petId: runtimeContext.runtimePetId,
      runtimeUrl: runtimeContext.modelRuntimeUrl,
    });
  }
}
