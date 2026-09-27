import { Application, Container, type IApplicationOptions, UPDATE_PRIORITY } from 'pixi.js';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { isLive2DDragReleaseProbeEnabled } from './live2dDragProbeFlag';
import { installLive2DSharedRendererFrameBoundary } from './live2dSharedRendererFrame';

type Live2DSharedApplicationOptions = IApplicationOptions & {
  premultipliedAlpha?: boolean;
};

type Live2DSharedRendererRegistration = {
  container: HTMLDivElement;
  layer: Container;
  petId: string;
  stageSize: number;
};

export type Live2DSharedRendererHandle = {
  app: Application;
  layer: Container;
  setStageSize: (stageSize: number) => void;
  syncLayout: () => void;
  release: () => void;
};

type Live2DSharedRendererState = {
  app: Application;
  canvasHost: HTMLDivElement;
  registrations: Set<Live2DSharedRendererRegistration>;
  resize: () => void;
  syncLayouts: () => void;
};

type Live2DModelTickerTarget = {
  update: (deltaMs: number) => void;
};

export type Live2DModelTickerHandle = {
  release: () => void;
};

type Live2DModelTickerOptions = {
  onError?: (error: unknown, consecutiveErrorCount: number) => void;
  petId?: string;
};

let sharedRendererState: Live2DSharedRendererState | null = null;

export function resolveLive2DSharedLayerPosition(options: {
  canvasLeft: number;
  canvasTop: number;
  containerHeight: number;
  containerLeft: number;
  containerTop: number;
  containerWidth: number;
  stageSize: number;
}) {
  const stageSize = Math.max(1, Number(options.stageSize) || 1);
  return {
    x: options.containerLeft - options.canvasLeft + (options.containerWidth - stageSize) / 2,
    y: options.containerTop - options.canvasTop + (options.containerHeight - stageSize) / 2,
  };
}

function createSharedRendererState(): Live2DSharedRendererState {
  const canvasHost = document.createElement('div');
  canvasHost.dataset.desktopPetLive2DSharedRenderer = 'true';
  Object.assign(canvasHost.style, {
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: '0',
  });
  document.body.appendChild(canvasHost);

  const appOptions: Live2DSharedApplicationOptions = {
    autoDensity: true,
    autoStart: false,
    backgroundAlpha: 0,
    clearBeforeRender: true,
    height: Math.max(1, window.innerHeight),
    premultipliedAlpha: false,
    resolution: window.devicePixelRatio || 1,
    useContextAlpha: 'notMultiplied',
    width: Math.max(1, window.innerWidth),
  };
  const app = new Application(appOptions);
  app.renderer.backgroundAlpha = 0;
  app.view.dataset.desktopPetLive2DSharedCanvas = 'true';
  app.view.style.background = 'transparent';
  app.view.style.backgroundColor = 'transparent';
  app.view.style.display = 'block';
  app.view.style.height = '100%';
  app.view.style.pointerEvents = 'none';
  app.view.style.width = '100%';
  canvasHost.appendChild(app.view);

  const state: Live2DSharedRendererState = {
    app,
    canvasHost,
    registrations: new Set(),
    resize: () => {
      app.renderer.resize(
        Math.max(1, window.innerWidth),
        Math.max(1, window.innerHeight),
      );
    },
    syncLayouts: () => {
      const canvasRect = app.view.getBoundingClientRect();
      state.registrations.forEach(({ container, layer, stageSize }) => {
        if (!container.isConnected || !layer.parent) {
          return;
        }

        const containerRect = container.getBoundingClientRect();
        const layerPosition = resolveLive2DSharedLayerPosition({
          canvasLeft: canvasRect.left,
          canvasTop: canvasRect.top,
          containerHeight: containerRect.height,
          containerLeft: containerRect.left,
          containerTop: containerRect.top,
          containerWidth: containerRect.width,
          stageSize,
        });
        layer.position.set(layerPosition.x, layerPosition.y);
      });
    },
  };

  // Pixi does not isolate render-listener exceptions. Keep a replacing model
  // from stopping the shared RAF loop and freezing every sibling Live2D pet.
  installLive2DSharedRendererFrameBoundary(app, state.registrations);

  app.ticker.add(state.syncLayouts, state, UPDATE_PRIORITY.HIGH);
  window.addEventListener('resize', state.resize);
  state.resize();
  app.start();
  return state;
}

function getSharedRendererState() {
  if (!sharedRendererState) {
    sharedRendererState = createSharedRendererState();
  }
  return sharedRendererState;
}

export function acquireLive2DSharedRenderer(
  container: HTMLDivElement,
  stageSize: number,
  petId: string,
): Live2DSharedRendererHandle {
  const state = getSharedRendererState();
  const layer = new Container();
  state.app.stage.addChild(layer);

  const registration = {
    container,
    layer,
    petId,
    stageSize: Math.max(1, Number(stageSize) || 1),
  } satisfies Live2DSharedRendererRegistration;
  state.registrations.add(registration);
  state.syncLayouts();
  if (isLive2DDragReleaseProbeEnabled()) {
    pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d shared layer acquired', {
      layerIndex: state.app.stage.getChildIndex(layer),
      petId,
      registrationCount: state.registrations.size,
      registrationOrder: [...state.registrations].map((item) => item.petId),
    });
  }
  // The shared ticker is stopped when the last Live2D layer is released.
  // A later mount (for example when adding a companion pet) must resume it;
  // otherwise every remaining/new model renders only its last frame and
  // pointer-look, physics, motions, and mouth updates appear frozen.
  state.app.start();

  let released = false;
  return {
    app: state.app,
    layer,
    setStageSize: (nextStageSize: number) => {
      registration.stageSize = Math.max(1, Number(nextStageSize) || 1);
      state.syncLayouts();
    },
    syncLayout: state.syncLayouts,
    release: () => {
      if (released) {
        return;
      }
      released = true;
      const releasedLayerIndex = layer.parent === state.app.stage
        ? state.app.stage.getChildIndex(layer)
        : -1;
      state.registrations.delete(registration);
      if (layer.parent === state.app.stage) {
        state.app.stage.removeChild(layer);
      }
      layer.destroy({ children: false });
      state.app.render();
      if (isLive2DDragReleaseProbeEnabled()) {
        pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d shared layer released', {
          petId,
          registrationCount: state.registrations.size,
          registrationOrder: [...state.registrations].map((item) => item.petId),
          releasedLayerIndex,
        });
      }
      if (state.registrations.size === 0) {
        state.app.stop();
      }
    },
  };
}

/**
 * Drive one model from the shared Application ticker, while keeping its
 * update registration independent from every other model instance. The
 * pixi-live2d-display default uses Ticker.shared; that global clock can be
 * disturbed by an async model replacement even while the shared renderer is
 * still painting. Application-owned registrations keep update and render on
 * the same clock and make cleanup local to the replaced model.
 */
export function attachLive2DModelToApplicationTicker(
  app: Application,
  model: Live2DModelTickerTarget,
  options: Live2DModelTickerOptions = {},
): Live2DModelTickerHandle {
  let released = false;
  let consecutiveErrorCount = 0;
  const updateModel = () => {
    if (released) {
      return;
    }

    try {
      model.update(app.ticker.deltaMS);
      consecutiveErrorCount = 0;
    } catch (error) {
      consecutiveErrorCount += 1;
      if (consecutiveErrorCount === 1 || consecutiveErrorCount === 3) {
        options.onError?.(error, consecutiveErrorCount);
        pushFrontendRuntimeError(
          'model',
          `live2d model ticker update failed pet=${options.petId ?? 'unknown'}`,
          error,
          { consecutiveErrorCount },
        );
      }

      // Ticker listeners are not exception-isolated by Pixi. A stale model
      // update must not abort the shared ticker and freeze sibling models.
      if (consecutiveErrorCount >= 3) {
        released = true;
        app.ticker.remove(updateModel, model);
      }
    }
  };
  app.ticker.add(updateModel, model, UPDATE_PRIORITY.NORMAL);
  return {
    release: () => {
      if (released) {
        return;
      }
      released = true;
      app.ticker.remove(updateModel, model);
    },
  };
}
