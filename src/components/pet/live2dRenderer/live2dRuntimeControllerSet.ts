import { pushFrontendRuntimeError } from '../../../frontendRuntimeLogger';
import { type ResolvedLive2DRuntimeProfile } from '../../../pet-runtime/live2d/live2dRuntimeProfile';
import { type Live2DResolvedPointerLookPosition } from '../live2dPointerLookTarget';
import {
  createLive2DPointerLookRuntimeController,
  type Live2DPointerLookFrameDiagnostic,
  type Live2DPointerLookRuntimeController,
} from '../live2dPointerLookRuntimeController';
import {
  createLive2DPerformanceRuntimeController,
  type Live2DPerformanceRuntimeController,
  type Live2DPerformanceRuntimeState,
} from '../live2dPerformanceRuntimeController';
import {
  createLive2DMouthRuntimeController,
  type Live2DMouthRuntimeController,
  type Live2DMouthRuntimeState,
} from '../live2dMouthRuntimeController';
import { type Live2DModelLike } from '../live2dModelRuntime';

export type Live2DRuntimeControllerSet = {
  mouth: Live2DMouthRuntimeController | null;
  performance: Live2DPerformanceRuntimeController | null;
  pointerLook: Live2DPointerLookRuntimeController | null;
};

const LIVE2D_RUNTIME_CENTER_LOOK_POSITION = {
  source: 'center',
  x: 0,
  y: 0,
} satisfies Live2DResolvedPointerLookPosition;

export function replaceLive2DRuntimeControllers(options: {
  bootstrapMode: 'model-load' | 'preserve-input';
  currentControllers: Live2DRuntimeControllerSet;
  lookPosition: Live2DResolvedPointerLookPosition;
  model: Live2DModelLike;
  modelRuntimeUrl: string;
  modelUrl: string;
  onDiagnosticFrame?: (frame: Live2DPointerLookFrameDiagnostic) => void;
  mouthState: Live2DMouthRuntimeState;
  performanceState: Live2DPerformanceRuntimeState;
  petId: string;
  pointerLookStrength: number;
  runtimeProfile: ResolvedLive2DRuntimeProfile;
}): Live2DRuntimeControllerSet {
  options.currentControllers.pointerLook?.destroy();
  options.currentControllers.performance?.destroy();
  options.currentControllers.mouth?.destroy();

  const pointerLook = createPointerLookController(options);
  const performance = createPerformanceController(options);
  const mouth = createMouthController(options);
  return {
    mouth,
    performance,
    pointerLook,
  };
}

type ReplaceControllerOptions = Parameters<typeof replaceLive2DRuntimeControllers>[0];

function createPointerLookController(options: ReplaceControllerOptions) {
  let pointerLook: Live2DPointerLookRuntimeController | null = null;
  const shouldStartCentered = options.bootstrapMode === 'model-load';
  try {
    pointerLook = createLive2DPointerLookRuntimeController(options.model, {
      modelUrl: options.modelUrl,
      onDiagnosticFrame: options.onDiagnosticFrame,
      petId: options.petId,
      runtimeProfile: options.runtimeProfile,
      startCenteredBeforeIdle: shouldStartCentered,
    });
    pointerLook?.setStrength(options.pointerLookStrength);
    pointerLook?.updateInputTarget(
      shouldStartCentered ? LIVE2D_RUNTIME_CENTER_LOOK_POSITION : options.lookPosition,
    );
    pointerLook?.applyImmediate();
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d pointer look setup skipped pet=${options.petId}`, error, {
      modelUrl: options.modelUrl,
      runtimeUrl: options.modelRuntimeUrl,
    });
  }
  return pointerLook;
}

function createPerformanceController(options: ReplaceControllerOptions) {
  let performance: Live2DPerformanceRuntimeController | null = null;
  try {
    performance = createLive2DPerformanceRuntimeController(options.model, {
      modelUrl: options.modelUrl,
      petId: options.petId,
      runtimeProfile: options.runtimeProfile,
    });
    performance?.setState(options.performanceState);
    performance?.applyImmediate();
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d performance setup skipped pet=${options.petId}`, error, {
      modelUrl: options.modelUrl,
      runtimeUrl: options.modelRuntimeUrl,
    });
  }
  return performance;
}

function createMouthController(options: ReplaceControllerOptions) {
  let mouth: Live2DMouthRuntimeController | null = null;
  try {
    mouth = createLive2DMouthRuntimeController(options.model, {
      modelUrl: options.modelUrl,
      petId: options.petId,
      runtimeProfile: options.runtimeProfile,
    });
    mouth?.setState(options.mouthState);
    mouth?.applyImmediate();
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d mouth setup skipped pet=${options.petId}`, error, {
      modelUrl: options.modelUrl,
      runtimeUrl: options.modelRuntimeUrl,
    });
  }
  return mouth;
}
