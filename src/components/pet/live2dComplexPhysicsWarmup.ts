export const LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS = 1000 / 60;
export const LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES = 120;

type Live2DComplexPhysicsWarmupModel = {
  deltaTime?: number;
  elapsedTime?: number;
  internalModel?: {
    update?: (deltaMs: number, nowMs: number) => void;
  };
};

export function warmLive2DComplexPhysicsRig(options: {
  complexPhysicsRig: boolean;
  model: Live2DComplexPhysicsWarmupModel;
  startNowMs?: number;
}) {
  const updateInternalModel = options.model.internalModel?.update;
  if (!options.complexPhysicsRig || typeof updateInternalModel !== 'function') {
    return {
      completed: false,
      errorMessage: null,
      frameCount: 0,
    };
  }

  const startNowMs = Number.isFinite(options.startNowMs)
    ? options.startNowMs as number
    : Number.isFinite(options.model.elapsedTime)
      ? options.model.elapsedTime as number
      : 0;
  let frameCount = 0;

  try {
    for (let frame = 0; frame < LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES; frame += 1) {
      const nowMs = startNowMs + LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS * (frame + 1);
      updateInternalModel.call(
        options.model.internalModel,
        LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS,
        nowMs,
      );
      frameCount += 1;
    }

    options.model.deltaTime = 0;
    options.model.elapsedTime = startNowMs
      + LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS * LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAMES;
    return {
      completed: true,
      errorMessage: null,
      frameCount,
    };
  } catch (error) {
    options.model.deltaTime = 0;
    options.model.elapsedTime = startNowMs
      + LIVE2D_COMPLEX_PHYSICS_WARMUP_FRAME_MS * frameCount;
    return {
      completed: false,
      errorMessage: error instanceof Error ? error.message : String(error),
      frameCount,
    };
  }
}
