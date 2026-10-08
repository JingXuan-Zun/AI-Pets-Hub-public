import { harnessState, nextFakeId, record } from '../traceStore.ts';

function summarizePresentation(options: Record<string, unknown>) {
  return {
    contentManifest: options.contentManifest ? 'manifest' : null,
    live2dRuntimeProfile: options.live2dRuntimeProfile ?? null,
    motionBindings: Array.isArray(options.motionBindings) ? options.motionBindings.map((binding) => (binding as { id: string }).id) : null,
    stageSize: options.stageSize,
    visible: options.visible,
  };
}

function createFakeModel(url: string) {
  const id = nextFakeId('model');
  const model: Record<string, unknown> = {
    __fakeId: id,
    __url: url,
    anchor: { x: 0.5, y: 0.5 },
    autoUpdate: true,
    elapsedTime: 42,
    height: 300,
    parent: null as null | { removeChild: (child: unknown) => void },
    pivot: { x: 1, y: 2 },
    renderable: true,
    scale: { x: 0.25, y: 0.25 },
    visible: true,
    width: 200,
    x: 128,
    y: 140,
    worldTransform: {
      apply: (point: { x: number; y: number }) => ({ x: point.x * 0.5 + 30, y: point.y * 0.5 + 10 }),
    },
    destroy: (options?: unknown) => record(`${id}.destroy`, options ?? null),
    focus: (x: number, y: number) => {
      record(`${id}.focus`, x, y);
      if (url.includes('focus-fail')) throw new Error('fake focus failure');
    },
    getLocalBounds: () => ({ height: 600, width: 400, x: -200, y: -300 }),
  };
  return model;
}

export const LIVE2D_MOTION_PRIORITY_NORMAL = 2;
export const LIVE2D_MOTION_PRIORITY_FORCE = 3;

export async function loadLive2DCubism4Runtime() {
  record('runtime.load');
  return {
    Cubism4ExpressionManager: class FakeExpressionManager {},
    Live2DModel: {
      from: async (url: string, options: unknown) => {
        record('Live2DModel.from', url, options);
        if (harnessState.failingModelUrls.has(url)) throw new Error(`fake load failure ${url}`);
        return createFakeModel(url);
      },
    },
    MotionPreloadStrategy: { IDLE: 'IDLE' },
  };
}

export function resolveLive2DVisibleDrawableBounds(model: { __url?: string; __fakeId?: string }) {
  record('resolveVisibleDrawableBounds', model);
  return String(model.__url).includes('no-bounds') ? null : { height: 220, width: 160, x: 20, y: 30 };
}

export function resolveLive2DRuntimeProfileForModel(model: unknown, config: unknown, declared: unknown) {
  record('resolveRuntimeProfile', model, config ?? null, declared ?? null);
  const complexPhysicsRig = Boolean((config as { complex?: boolean } | null)?.complex);
  return { capabilities: { complexPhysicsRig }, layout: { scale: 1 }, profileVersion: 1 };
}

export function syncLive2DModelPresentation(model: unknown, options: Record<string, unknown>, manager: unknown) {
  record('syncPresentation', model, summarizePresentation(options), manager ? 'manager' : null);
}

export function resolveLive2DExpressionManager() { return null; }
export function resolveAvailableExpressionNames() { return []; }
export async function playFirstAvailableMotion() { return false; }
export async function setFirstAvailableExpression() { return false; }
export function resetLive2DExpression() {}
export function stopLive2DMotions() {}
