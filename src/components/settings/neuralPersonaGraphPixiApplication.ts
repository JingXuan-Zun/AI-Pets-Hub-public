import { Application, type IApplicationOptions } from 'pixi.js';
import {
  fitNeuralGraphStage,
  NEURAL_GRAPH_HEIGHT,
  NEURAL_GRAPH_WIDTH,
} from './neuralPersonaGraphPixiViewport';
import { NEURAL_PERSONA_GRAPH_TARGET_FPS } from './neuralPersonaGraphFrameRate';

const NEURAL_PERSONA_GRAPH_BACKGROUND_COLOR = 0x0d0e10;
const NEURAL_PERSONA_GRAPH_RENDER_RESOLUTION = 2;

export function neuralGraphHostSize(host: HTMLDivElement) {
  const bounds = host.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height || host.clientHeight || NEURAL_GRAPH_HEIGHT)),
    width: Math.max(1, Math.round(bounds.width || host.clientWidth || NEURAL_GRAPH_WIDTH)),
  };
}

function applyStageFit(app: Application, width: number, height: number) {
  const fit = fitNeuralGraphStage(width, height);
  app.stage.position.set(fit.x, fit.y);
  app.stage.scale.set(fit.scale);
}

export function createNeuralGraphPixiApplication(host: HTMLDivElement) {
  const size = neuralGraphHostSize(host);
  const options: IApplicationOptions = {
    antialias: true,
    autoDensity: true,
    backgroundAlpha: 1,
    backgroundColor: NEURAL_PERSONA_GRAPH_BACKGROUND_COLOR,
    clearBeforeRender: true,
    height: size.height,
    powerPreference: 'high-performance',
    resolution: NEURAL_PERSONA_GRAPH_RENDER_RESOLUTION,
    width: size.width,
  };
  const app = new Application(options);
  app.view.dataset.neuralGraphPixiCanvas = 'true';
  Object.assign(app.view.style, {
    display: 'block', height: '100%', touchAction: 'none', width: '100%',
  });
  host.appendChild(app.view);
  applyStageFit(app, size.width, size.height);
  app.ticker.maxFPS = NEURAL_PERSONA_GRAPH_TARGET_FPS;
  app.stop();
  return app;
}

export function resizeNeuralGraphPixiApplication(
  app: Application,
  size: { height: number; width: number },
) {
  app.renderer.resize(size.width, size.height);
  applyStageFit(app, size.width, size.height);
}
