import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { type Application } from 'pixi.js';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { loadLive2DDeclaredParameterIds } from '../../../pet-runtime/live2d/live2dDisplayInfoParameters';
import { warmLive2DComplexPhysicsRig } from '../live2dComplexPhysicsWarmup';
import {
  loadLive2DCubism4Runtime,
  resolveLive2DRuntimeProfileForModel,
  syncLive2DModelPresentation,
  type Live2DExpressionManagerConstructor,
  type Live2DModelLike,
} from '../live2dModelRuntime';
import { type Live2DPointerLookFrameDiagnostic } from '../live2dPointerLookRuntimeController';
import { attachLive2DModelToApplicationTicker } from '../live2dSharedRenderer';
import { replaceLive2DRuntimeControllers } from './live2dRuntimeControllerSet';
import { runLive2DPresentationProbe } from './live2dPresentationProbe';
import { type Live2DRendererRefs } from './live2dRendererRefs';
import { releaseLive2DRendererModel, type ModelLoadSession } from './live2dRendererModelSession';

type ModelLoaderOptions = {
  emitRenderedVisualBounds: (app: Application, measuredStageSize: number) => boolean;
  modelRuntimeUrl: string;
  onPointerLookDiagnosticFrame?: (frame: Live2DPointerLookFrameDiagnostic) => void;
  refs: Live2DRendererRefs;
  setRuntimeReadyVersion: Dispatch<SetStateAction<number>>;
  stageSize: number;
};


async function loadLive2DRendererModel(options: ModelLoaderOptions, session: ModelLoadSession, app: Application) {
  const { refs } = options;
  try {
    const {
      Cubism4ExpressionManager,
      Live2DModel,
      MotionPreloadStrategy,
    } = await loadLive2DCubism4Runtime();
    refs.createExpressionManagerRef.current = Cubism4ExpressionManager as Live2DExpressionManagerConstructor;
    if (session.cancelled) {
      return;
    }

    const model = await Live2DModel.from(options.modelRuntimeUrl, {
      autoInteract: false,
      autoUpdate: false,
      motionPreload: MotionPreloadStrategy.IDLE,
    }) as Live2DModelLike;
    if (session.cancelled || refs.appRef.current !== app) {
      model.destroy();
      return;
    }

    session.loadedModel = model;
    const declaredParameterIds = await loadLive2DDeclaredParameterIds(model);
    if (session.cancelled || refs.appRef.current !== app) {
      if (session.loadedModel === model) {
        session.loadedModel = null;
        model.destroy();
      }
      return;
    }
    const runtimeProfile = prepareLoadedModelProfile(refs, model, declaredParameterIds);
    attachLoadedModelRuntime(options, app, model, runtimeProfile);
    startLoadedModelTicker(options, app, model);
    schedulePresentationProbes(options, session, app, model);
    announceLoadedModelReady(options, runtimeProfile);
  } catch (error) {
    if (session.cancelled) {
      return;
    }
    reportModelLoadFailure(options, error);
  }
}

function prepareLoadedModelProfile(refs: Live2DRendererRefs, model: Live2DModelLike, declaredParameterIds: ReadonlySet<string> | null) {
  refs.declaredParameterIdsRef.current = declaredParameterIds;
  const currentRuntimeProfileConfig = refs.live2dRuntimeProfileRef.current;
  const runtimeProfile = resolveLive2DRuntimeProfileForModel(
    model,
    currentRuntimeProfileConfig,
    declaredParameterIds,
  );
  const physicsWarmup = warmLive2DComplexPhysicsRig({
    complexPhysicsRig: runtimeProfile.capabilities.complexPhysicsRig,
    model,
    startNowMs: model.elapsedTime,
  });
  if (runtimeProfile.capabilities.complexPhysicsRig) {
    pushFrontendRuntimeLog('model', 'live2d complex physics warmup', {
      completed: physicsWarmup.completed,
      errorMessage: physicsWarmup.errorMessage,
      frameCount: physicsWarmup.frameCount,
      modelUrl: refs.runtimeContextRef.current.modelUrl,
      petId: refs.runtimeContextRef.current.runtimePetId,
    });
  }
  refs.appliedRuntimeProfileSignatureRef.current = JSON.stringify(currentRuntimeProfileConfig ?? null);
  syncLive2DModelPresentation(
    model,
    {
      ...refs.presentationOptionsRef.current,
      live2dRuntimeProfile: currentRuntimeProfileConfig,
    },
    refs.createExpressionManagerRef.current,
  );
  return runtimeProfile;
}

function attachLoadedModelRuntime(
  options: ModelLoaderOptions,
  app: Application,
  model: Live2DModelLike,
  runtimeProfile: ReturnType<typeof resolveLive2DRuntimeProfileForModel>,
) {
  const { refs } = options;
  const modelLayer = refs.modelLayerRef.current;
  if (!modelLayer) {
    model.destroy({ baseTexture: false, children: true, texture: false });
    throw new Error('Live2D shared renderer layer is unavailable.');
  }
  modelLayer.addChild(model);
  refs.modelRef.current = model;
  const runtimeContext = refs.runtimeContextRef.current;
  const runtimeControllers = replaceLive2DRuntimeControllers({
    bootstrapMode: 'model-load',
    currentControllers: {
      mouth: refs.mouthRuntimeControllerRef.current,
      performance: refs.performanceRuntimeControllerRef.current,
      pointerLook: refs.pointerLookRuntimeControllerRef.current,
    },
    lookPosition: refs.lookPositionRef.current,
    model,
    modelRuntimeUrl: runtimeContext.modelRuntimeUrl,
    modelUrl: runtimeContext.modelUrl,
    onDiagnosticFrame: options.onPointerLookDiagnosticFrame,
    mouthState: refs.mouthRuntimeStateRef.current,
    performanceState: refs.performanceRuntimeStateRef.current,
    petId: runtimeContext.runtimePetId,
    pointerLookStrength: refs.pointerLookStrengthRef.current,
    runtimeProfile,
  });
  refs.pointerLookRuntimeControllerRef.current = runtimeControllers.pointerLook;
  refs.performanceRuntimeControllerRef.current = runtimeControllers.performance;
  refs.mouthRuntimeControllerRef.current = runtimeControllers.mouth;
  return runtimeContext;
}

function startLoadedModelTicker(options: ModelLoaderOptions, app: Application, model: Live2DModelLike) {
  const { refs } = options;
  const runtimeContext = refs.runtimeContextRef.current;
  model.autoUpdate = false;
  refs.modelTickerHandleRef.current?.release();
  refs.modelTickerHandleRef.current = attachLive2DModelToApplicationTicker(app, model, {
    onError: (error, consecutiveErrorCount) => {
      pushFrontendRuntimeError(
        'model',
        `live2d model ticker boundary failed pet=${runtimeContext.runtimePetId}`,
        error,
        {
          consecutiveErrorCount,
          modelUrl: runtimeContext.modelUrl,
        },
      );
    },
    petId: runtimeContext.runtimePetId,
  });
  app.start();
  app.render();
  options.emitRenderedVisualBounds(app, refs.presentationOptionsRef.current.stageSize);
}

function schedulePresentationProbes(
  options: ModelLoaderOptions,
  session: ModelLoadSession,
  app: Application,
  model: Live2DModelLike,
) {
  const { refs } = options;
  const runtimeContext = refs.runtimeContextRef.current;
  const runPresentationProbe = (sampleDelayMs: number) => {
    if (session.cancelled || refs.modelRef.current !== model || refs.appRef.current !== app) {
      return;
    }

    runLive2DPresentationProbe({
      app,
      container: refs.containerRef.current,
      model,
      modelLayer: refs.modelLayerRef.current,
      runtimeContext,
      sampleDelayMs,
      stageSize: options.stageSize,
    });
  };
  session.presentationProbeTimeoutId = window.setTimeout(() => {
    session.presentationProbeTimeoutId = null;
    runPresentationProbe(120);
  }, 120);
  session.delayedPresentationProbeTimeoutId = window.setTimeout(() => {
    session.delayedPresentationProbeTimeoutId = null;
    runPresentationProbe(600);
  }, 600);
}

function announceLoadedModelReady(
  options: ModelLoaderOptions,
  runtimeProfile: ReturnType<typeof resolveLive2DRuntimeProfileForModel>,
) {
  const { refs } = options;
  const runtimeContext = refs.runtimeContextRef.current;
  options.setRuntimeReadyVersion((currentVersion) => currentVersion + 1);
  runtimeContext.onRuntimeEvent?.({
    petId: runtimeContext.runtimePetId,
    runtimeKind: 'live2d',
    type: 'ready',
  });
  pushFrontendRuntimeLog('model', `live2d runtime ready pet=${runtimeContext.runtimePetId}`, {
    performanceParameters: refs.performanceRuntimeControllerRef.current?.summary ?? null,
    pointerLookParameters: refs.pointerLookRuntimeControllerRef.current?.summary ?? null,
    modelUrl: runtimeContext.modelUrl,
    runtimeProfile: {
      capabilities: runtimeProfile.capabilities,
      layout: runtimeProfile.layout,
      profileVersion: runtimeProfile.profileVersion,
    },
    runtimeUrl: runtimeContext.modelRuntimeUrl,
  });
}

function reportModelLoadFailure(options: ModelLoaderOptions, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const runtimeContext = options.refs.runtimeContextRef.current;
  runtimeContext.onRuntimeEvent?.({
    errorMessage,
    petId: runtimeContext.runtimePetId,
    runtimeKind: 'live2d',
    type: 'error',
  });
  pushFrontendRuntimeError('model', `live2d runtime failed pet=${runtimeContext.runtimePetId}`, error, {
    modelUrl: runtimeContext.modelUrl,
    runtimeUrl: runtimeContext.modelRuntimeUrl,
  });
}

export function useLive2DRendererModelLoader(options: ModelLoaderOptions) {
  useEffect(() => {
    const session: ModelLoadSession = {
      cancelled: false,
      delayedPresentationProbeTimeoutId: null,
      loadedModel: null,
      presentationProbeTimeoutId: null,
    };
    const app = options.refs.appRef.current;
    if (!app || !options.modelRuntimeUrl.trim()) {
      return undefined;
    }

    void loadLive2DRendererModel(options, session, app);

    return () => {
      releaseLive2DRendererModel(options.refs, session);
    };
  }, [options.modelRuntimeUrl]);
}
