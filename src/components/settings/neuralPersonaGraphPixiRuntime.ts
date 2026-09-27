import {
  Application,
  UPDATE_PRIORITY,
} from 'pixi.js';
import {
  CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT,
  type NeuralPersonaGraphExplorerView,
  type NeuralPersonaGraphPhysics,
  type NeuralPersonaGraphPhysicsConfig,
  type NeuralPersonaGraphViewport,
} from '../../character-graph/neural-persona';
import {
  createNeuralPersonaGraphPixiScene,
  type NeuralPersonaGraphPixiScene,
} from './neuralPersonaGraphPixiScene';
import {
  createNeuralGraphPixiApplication,
} from './neuralPersonaGraphPixiApplication';
import {
  createNeuralPersonaGraphWorkerPhysics,
  type NeuralPersonaGraphWorkerPhysics,
} from './neuralPersonaGraphWorkerPhysics';
import {
  createNeuralPersonaGraphDiagnostics,
  installNeuralPersonaGraphRenderDiagnostics,
  type NeuralPersonaGraphDiagnostics,
  type NeuralPersonaGraphDiagnosticsSample,
} from './neuralPersonaGraphDiagnostics';
import {
  applyNeuralPersonaGraphViewState,
  captureNeuralPersonaGraphViewState,
  type NeuralPersonaGraphPixiViewState,
} from './neuralPersonaGraphPixiViewState';
import { installNeuralPersonaGraphResizeObserver } from './neuralPersonaGraphPixiResizeObserver';
import {
  installNeuralPersonaGraphPixiInteractions,
  type NeuralPersonaGraphPixiCallbacks as Callbacks,
  type NeuralPersonaGraphPixiInteractionRuntime as MutableRuntime,
} from './neuralPersonaGraphPixiInteractions';
type Selection = {
  activationPreview?: import('../../character-graph/neural-persona').NeuralPersonaActivationPreview | null;
  batchSelectedNodeIds?: string[];
  focusRootNodeId?: string;
  focusedNodeId?: string;
  multiSelectMode?: boolean;
  selectedEdgeId?: string;
  selectedNodeId?: string;
};
function createScene(app: Application, physics: NeuralPersonaGraphPhysics, selection: Selection, view: NeuralPersonaGraphExplorerView) {
  return createNeuralPersonaGraphPixiScene({ app, physics, view, ...selection });
}
function installTicker(
  app: Application,
  physics: NeuralPersonaGraphPhysics,
  scene: NeuralPersonaGraphPixiScene,
  diagnostics?: NeuralPersonaGraphDiagnostics,
) {
  let renderRequested = false;
  const update = () => {
    diagnostics?.recordTickerUpdate();
    physics.step(app.ticker.deltaMS / 16.67);
    scene.renderPositions(app.ticker.deltaMS);
    diagnostics?.recordMotionLag(scene.getVisualLag());
    const shouldContinue = physics.isActive() || scene.isAnimating() || renderRequested;
    renderRequested = false;
    if (!shouldContinue) { diagnostics?.recordTickerStop(); app.stop(); }
  };
  app.ticker.add(update, undefined, UPDATE_PRIORITY.HIGH);
  return {
    destroy: () => app.ticker.remove(update),
    wake: () => {
      renderRequested = true;
      if (!app.ticker.started) { diagnostics?.recordTickerStart(); app.start(); }
    },
  };
}
type RuntimeOptions = {
  callbacks: Callbacks;
  host: HTMLDivElement;
  initialViewState?: NeuralPersonaGraphPixiViewState;
  onDiagnostics?: (sample: NeuralPersonaGraphDiagnosticsSample) => void;
  onFailure: () => void;
  physicsConfig: NeuralPersonaGraphPhysicsConfig;
  selection: Selection;
  view: NeuralPersonaGraphExplorerView;
};

function createRuntimeCore(options: RuntimeOptions) {
  const app = createNeuralGraphPixiApplication(options.host);
  const view = applyNeuralPersonaGraphViewState(options.view, options.initialViewState);
  let wake = () => {};
  const diagnostics = options.onDiagnostics ? createNeuralPersonaGraphDiagnostics(options.onDiagnostics) : undefined;
  const physics = createNeuralPersonaGraphWorkerPhysics({
    config: options.physicsConfig,
    edges: view.edges,
    nodes: view.nodes,
    onFailure: options.onFailure,
    onFrame: () => { diagnostics?.recordWorkerFrame(); wake(); },
    resetNodes: options.view.nodes,
  });
  const scene = createScene(app, physics, options.selection, view);
  const ticker = installTicker(app, physics, scene, diagnostics);
  wake = ticker.wake;
  return { app, diagnostics, physics, scene, ticker, view };
}

export function createNeuralPersonaGraphPixiRuntime(options: RuntimeOptions) {
  const { app, diagnostics, physics, scene, ticker, view } = createRuntimeCore(options);
  const runtime: MutableRuntime = {
    app, callbacks: { ...options.callbacks, onSelectNodes: options.callbacks.onSelectNodes },
    canvas: app.view, diagnostics, physics,
    multiSelectMode: Boolean(options.selection.multiSelectMode), pointer: null, scene,
    ticker, view,
    viewport: options.initialViewState?.viewport
      ? { ...options.initialViewState.viewport } : CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT,
  };
  scene.setViewport(runtime.viewport);
  const removeInteractions = installNeuralPersonaGraphPixiInteractions(runtime);
  const removeRenderDiagnostics = installNeuralPersonaGraphRenderDiagnostics(app, diagnostics);
  const removeResizeObserver = installNeuralPersonaGraphResizeObserver(
    app, options.host, ticker.wake,
  );
  app.renderer.render(app.stage);
  return {
    destroy: () => {
      removeInteractions(); removeRenderDiagnostics(); removeResizeObserver();
      ticker.destroy(); diagnostics?.destroy(); physics.destroy();
      app.destroy(true, { baseTexture: true, children: true, texture: true });
    },
    getViewState: () => captureNeuralPersonaGraphViewState(
      runtime.view, runtime.scene.getPosition, runtime.viewport,
    ),
    reset: () => {
      runtime.pointer = null;
      scene.setMarquee();
      scene.resetActivationDisplay();
      runtime.viewport = CENTERED_NEURAL_PERSONA_GRAPH_VIEWPORT;
      physics.reset();
      scene.setViewport(runtime.viewport);
      runtime.ticker.wake();
    },
    setCallbacks: (callbacks: Callbacks) => { runtime.callbacks = callbacks; },
    setPhysicsConfig: (config: NeuralPersonaGraphPhysicsConfig) => { physics.setConfig(config); runtime.ticker.wake(); },
    setSelection: (selection: Selection) => {
      runtime.multiSelectMode = Boolean(selection.multiSelectMode);
      if (!runtime.multiSelectMode && runtime.pointer?.kind === 'marquee') {
        runtime.pointer = null; scene.setMarquee();
      }
      scene.setSelection(selection);
      runtime.ticker.wake();
    },
  };
}

export type NeuralPersonaGraphPixiRuntime = ReturnType<typeof createNeuralPersonaGraphPixiRuntime>;
