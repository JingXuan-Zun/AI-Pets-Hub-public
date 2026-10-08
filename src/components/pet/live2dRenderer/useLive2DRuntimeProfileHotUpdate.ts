import { useEffect } from 'react';
import { type Application } from 'pixi.js';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { resolveLive2DRuntimeProfileForModel, syncLive2DModelPresentation } from '../live2dModelRuntime';
import { type Live2DPointerLookFrameDiagnostic } from '../live2dPointerLookRuntimeController';
import { replaceLive2DRuntimeControllers } from './live2dRuntimeControllerSet';
import { type Live2DRendererRefs } from './live2dRendererRefs';

type RuntimeProfileHotUpdateOptions = {
  emitRenderedVisualBounds: (app: Application, measuredStageSize: number) => boolean;
  onPointerLookDiagnosticFrame?: (frame: Live2DPointerLookFrameDiagnostic) => void;
  refs: Live2DRendererRefs;
  runtimeProfileSignature: string;
  runtimeReadyVersion: number;
  stageSize: number;
};

function hotUpdateLive2DRuntimeProfile(options: RuntimeProfileHotUpdateOptions) {
  const { refs } = options;
  if (refs.appliedRuntimeProfileSignatureRef.current === options.runtimeProfileSignature) {
    return;
  }

  const model = refs.modelRef.current;
  if (!model) {
    return;
  }

  const runtimeContext = refs.runtimeContextRef.current;
  const currentRuntimeProfileConfig = refs.live2dRuntimeProfileRef.current;
  const runtimeProfile = resolveLive2DRuntimeProfileForModel(
    model,
    currentRuntimeProfileConfig,
    refs.declaredParameterIdsRef.current,
  );
  syncLive2DModelPresentation(
    model,
    {
      ...refs.presentationOptionsRef.current,
      live2dRuntimeProfile: currentRuntimeProfileConfig,
    },
    refs.createExpressionManagerRef.current,
  );
  const runtimeControllers = replaceLive2DRuntimeControllers({
    bootstrapMode: 'preserve-input',
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
  refs.appliedRuntimeProfileSignatureRef.current = options.runtimeProfileSignature;
  refs.appRef.current?.render();
  if (refs.appRef.current) {
    options.emitRenderedVisualBounds(refs.appRef.current, options.stageSize);
  }
  pushFrontendRuntimeLog('model', `live2d runtime profile hot updated pet=${runtimeContext.runtimePetId}`, {
    capabilities: runtimeProfile.capabilities,
    layout: runtimeProfile.layout,
    modelUrl: runtimeContext.modelUrl,
    profileVersion: runtimeProfile.profileVersion,
  });
}

export function useLive2DRuntimeProfileHotUpdate(options: RuntimeProfileHotUpdateOptions) {
  const {
    emitRenderedVisualBounds, onPointerLookDiagnosticFrame, runtimeProfileSignature, runtimeReadyVersion, stageSize,
  } = options;
  useEffect(() => {
    hotUpdateLive2DRuntimeProfile(options);
  }, [emitRenderedVisualBounds, onPointerLookDiagnosticFrame, runtimeProfileSignature, runtimeReadyVersion, stageSize]);
}
