import { harnessState, nextFakeId, record } from '../traceStore.ts';

function createFakeApplication(id: string) {
  const rect = { height: 256, left: 4, top: 6, width: 256 };
  return {
    __fakeId: `${id}.app`,
    render: () => record(`${id}.app.render`),
    start: () => record(`${id}.app.start`),
    view: {
      clientHeight: 256, clientWidth: 256, height: 512, isConnected: true, width: 512,
      getBoundingClientRect: () => ({ ...rect }),
    },
    renderer: { gl: { isContextLost: () => false }, height: 512, resolution: 2, screen: { height: 256, width: 256 }, width: 512 },
  };
}

export function acquireLive2DSharedRenderer(container: unknown, stageSize: number, petId: string) {
  const id = nextFakeId('shared');
  record(`${id}.acquire`, container, stageSize, petId);
  const layer = {
    __fakeId: `${id}.layer`,
    worldTransform: { tx: 12, ty: 8 },
    addChild: (child: { parent?: unknown }) => { record(`${id}.layer.addChild`, child); child.parent = layer; },
    removeChild: (child: { parent?: unknown }) => { record(`${id}.layer.removeChild`, child); child.parent = null; },
  };
  return {
    app: createFakeApplication(id),
    layer,
    release: () => record(`${id}.release`),
    setStageSize: (size: number) => record(`${id}.setStageSize`, size),
    syncLayout: () => record(`${id}.syncLayout`),
  };
}

export function attachLive2DModelToApplicationTicker(
  app: unknown,
  model: unknown,
  options: { onError: (error: unknown, count: number) => void; petId: string },
) {
  record('ticker.attach', app, model, options.petId);
  harnessState.tickerErrorHandlers.push(options.onError);
  return { release: () => record('ticker.release', model) };
}

export function resolveLive2DSharedLayerPosition() {
  return { x: 0, y: 0 };
}
