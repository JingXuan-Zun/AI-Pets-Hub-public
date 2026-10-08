import { record } from '../traceStore.ts';

export const LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS = 1000 / 60;
export const LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES = 120;

export function warmLive2DComplexPhysicsRig(options: Record<string, unknown>) {
  record('physicsWarmup', options);
  return { completed: true, errorMessage: null, frameCount: options.complexPhysicsRig ? 120 : 0 };
}

export function useLive2DRuntimeHeartbeatProbe(options: { petId: string; runtimeReadyVersion: number }) {
  record('heartbeat', options.petId, options.runtimeReadyVersion);
}

export function useLive2DMotionExpressionSync(options: Record<string, unknown>) {
  record('motionSync', {
    action: options.action,
    effectiveManualExpressionBinding: (options.effectiveManualExpressionBinding as { id?: string } | null)?.id ?? null,
    expressionAction: options.expressionAction ?? null,
    isDragging: options.isDragging,
    isMoving: options.isMoving,
    manualMotionBindingForMotion: (options.manualMotionBindingForMotion as { id?: string } | null)?.id ?? null,
    modelUrl: options.modelUrl,
    runtimePetId: options.runtimePetId,
    runtimeReadyVersion: options.runtimeReadyVersion,
  });
  return () => record('motionSync.reset');
}

export function resolveLive2DDisplayInfoParameterIds() { return new Set<string>(); }

export async function loadLive2DDeclaredParameterIds(model: unknown) {
  record('loadDeclaredParameterIds', model);
  return new Set(['ParamAngleX', 'ParamAngleY']);
}

export async function loadLive2DDeclaredParameterIdsFromModelUrl() { return new Set<string>(); }
