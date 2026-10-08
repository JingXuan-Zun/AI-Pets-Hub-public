import { nextFakeId, record } from '../traceStore.ts';

function createRecordingController(kind: string, model: { __url?: string }, options: Record<string, unknown>) {
  const id = nextFakeId(kind);
  record(`${id}.create`, model, options);
  if (String(model.__url).includes(`${kind}-fail`)) throw new Error(`fake ${kind} failure`);
  return {
    applyImmediate: () => record(`${id}.applyImmediate`),
    destroy: () => record(`${id}.destroy`),
    setState: (state: unknown) => record(`${id}.setState`, state),
    setStrength: (strength: number) => record(`${id}.setStrength`, strength),
    summary: { id },
    updateInputTarget: (target: unknown) => record(`${id}.updateInputTarget`, target),
  };
}

export function createLive2DPointerLookRuntimeController(model: { __url?: string }, options: Record<string, unknown>) {
  return createRecordingController('pointerLook', model, options);
}

export function createLive2DPerformanceRuntimeController(model: { __url?: string }, options: Record<string, unknown>) {
  return createRecordingController('performance', model, options);
}

export function createLive2DMouthRuntimeController(model: { __url?: string }, options: Record<string, unknown>) {
  return createRecordingController('mouth', model, options);
}

export function resolveLive2DPointerLookLerpFactor() { return 1; }
export function resolveLive2DAutonomousIdleLookTarget() { return null; }
export function resolveLive2DIdleReentryTarget() { return null; }
export function resolveLive2DPointerLookParameterInfluence() { return 1; }
