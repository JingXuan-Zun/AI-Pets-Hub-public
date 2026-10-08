import { useEffect, useRef } from 'react';
import { type Application } from 'pixi.js';
import { type PetModelMotionBinding } from '../../../types';
import { type PetContentManifest } from '../../../pet-runtime/content/petContentManifest';
import { type AvatarRuntimeEventListener } from '../../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type Live2DRuntimeProfileConfigV1 } from '../../../pet-runtime/live2d/live2dRuntimeProfile';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  summarizePointerLookTarget,
} from '../petPointerLookDiagnostics';
import { syncLive2DModelPresentation } from '../live2dModelRuntime';
import { type Live2DPerformanceRuntimeState } from '../live2dPerformanceRuntimeController';
import { type Live2DMouthRuntimeState } from '../live2dMouthRuntimeController';
import { acquireLive2DSharedRenderer } from '../live2dSharedRenderer';
import { type Live2DRendererRefs } from './live2dRendererRefs';

type Position = {
  x: number;
  y: number;
};

type PresentationValues = {
  contentManifestOverride: PetContentManifest | null;
  live2dRuntimeProfile: Live2DRuntimeProfileConfigV1 | null;
  motionBindings: PetModelMotionBinding[];
  stageSize: number;
  visible: boolean;
};

type RendererStageSyncValues = PresentationValues & {
  effectivePointerLookStrength: number;
  emitRenderedVisualBounds: (app: Application, measuredStageSize: number) => boolean;
  modelRuntimeUrl: string;
  modelUrl: string;
  mouthRuntimeState: Live2DMouthRuntimeState;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  performanceRuntimeState: Live2DPerformanceRuntimeState;
  refs: Live2DRendererRefs;
  runtimePetId: string;
};

// Ref mirrors, stage-size layout sync and shared renderer ownership, in the
// renderer's original effect order.
export function useLive2DRendererStageSync(values: RendererStageSyncValues) {
  const {
    contentManifestOverride, effectivePointerLookStrength, emitRenderedVisualBounds, live2dRuntimeProfile,
    modelRuntimeUrl, modelUrl, motionBindings, mouthRuntimeState, onRuntimeEvent, performanceRuntimeState,
    refs, runtimePetId, stageSize, visible,
  } = values;
  useEffect(() => {
    refs.presentationOptionsRef.current = {
      contentManifest: contentManifestOverride,
      live2dRuntimeProfile,
      motionBindings,
      stageSize,
      visible,
    };
  }, [contentManifestOverride, live2dRuntimeProfile, motionBindings, stageSize, visible]);

  useEffect(() => {
    refs.pointerLookStrengthRef.current = effectivePointerLookStrength;
  }, [effectivePointerLookStrength]);

  useEffect(() => {
    refs.performanceRuntimeStateRef.current = performanceRuntimeState;
  }, [performanceRuntimeState]);

  useEffect(() => {
    refs.mouthRuntimeStateRef.current = mouthRuntimeState;
  }, [mouthRuntimeState]);

  useEffect(() => {
    refs.runtimeContextRef.current = {
      modelRuntimeUrl,
      modelUrl,
      onRuntimeEvent,
      runtimePetId,
    };
  }, [modelRuntimeUrl, modelUrl, onRuntimeEvent, runtimePetId]);

  useLive2DStageSizeLayout(refs, emitRenderedVisualBounds, stageSize);
  useLive2DSharedRendererOwnership(refs, stageSize, runtimePetId);
}

function useLive2DStageSizeLayout(
  refs: Live2DRendererRefs,
  emitRenderedVisualBounds: RendererStageSyncValues['emitRenderedVisualBounds'],
  stageSize: number,
) {
  useEffect(() => {
    const app = refs.appRef.current;
    if (!app) {
      return;
    }

    refs.sharedRendererHandleRef.current?.setStageSize(stageSize);
    const model = refs.modelRef.current;
    if (model) {
      syncLive2DModelPresentation(
        model,
        refs.presentationOptionsRef.current,
        refs.createExpressionManagerRef.current,
      );
      emitRenderedVisualBounds(app, stageSize);
    }
    refs.sharedRendererHandleRef.current?.syncLayout();
  }, [emitRenderedVisualBounds, stageSize]);
}

function useLive2DSharedRendererOwnership(refs: Live2DRendererRefs, stageSize: number, runtimePetId: string) {
  useEffect(() => {
    const container = refs.containerRef.current;
    if (!container) {
      return undefined;
    }

    const sharedRendererHandle = acquireLive2DSharedRenderer(container, stageSize, runtimePetId);
    refs.sharedRendererHandleRef.current = sharedRendererHandle;
    refs.appRef.current = sharedRendererHandle.app;
    refs.modelLayerRef.current = sharedRendererHandle.layer;

    return () => {
      if (refs.appRef.current === sharedRendererHandle.app) {
        refs.appRef.current = null;
      }
      if (refs.sharedRendererHandleRef.current === sharedRendererHandle) {
        refs.sharedRendererHandleRef.current = null;
      }
      if (refs.modelLayerRef.current === sharedRendererHandle.layer) {
        refs.modelLayerRef.current = null;
      }
      sharedRendererHandle.release();
    };
  }, []);
}

type PresentationSyncValues = PresentationValues & {
  focusTarget: Position | null;
  modelUrl: string;
  pointerLookTarget: Position | null;
  refs: Live2DRendererRefs;
  runtimePetId: string;
  runtimeReadyVersion: number;
};

// Pointer target diagnostics followed by model presentation sync.
export function useLive2DRendererPresentationSync(values: PresentationSyncValues) {
  const pointerLookDiagnosticsRef = useRef(createPointerLookDiagnosticsState());
  const {
    contentManifestOverride, focusTarget, live2dRuntimeProfile, modelUrl, motionBindings, pointerLookTarget,
    refs, runtimePetId, runtimeReadyVersion, stageSize, visible,
  } = values;
  useEffect(() => {
    pushPointerLookDiagnosticLog(
      pointerLookDiagnosticsRef.current,
      'live2d renderer received pointer look target',
      [
        runtimePetId,
        createPointerLookTargetSignature(pointerLookTarget),
      ],
      {
        focusTarget: summarizePointerLookTarget(focusTarget),
        modelUrl,
        pointerLookTarget: summarizePointerLookTarget(pointerLookTarget),
        runtimePetId,
        visible,
      },
    );
  }, [focusTarget, modelUrl, pointerLookTarget, runtimePetId, visible]);

  useEffect(() => {
    const model = refs.modelRef.current;
    if (!model) {
      return;
    }

    syncLive2DModelPresentation(
      model,
      {
        contentManifest: contentManifestOverride,
        live2dRuntimeProfile,
        motionBindings,
        stageSize,
        visible,
      },
      refs.createExpressionManagerRef.current,
    );
  }, [contentManifestOverride, live2dRuntimeProfile, motionBindings, runtimeReadyVersion, stageSize, visible]);
}

type ControllerStateSyncValues = {
  effectivePointerLookStrength: number;
  mouthRuntimeState: Live2DMouthRuntimeState;
  performanceRuntimeState: Live2DPerformanceRuntimeState;
  refs: Live2DRendererRefs;
  runtimeReadyVersion: number;
};

export function useLive2DRuntimeControllerStateSync(values: ControllerStateSyncValues) {
  const { effectivePointerLookStrength, mouthRuntimeState, performanceRuntimeState, refs, runtimeReadyVersion } = values;
  useEffect(() => {
    refs.pointerLookRuntimeControllerRef.current?.setStrength(effectivePointerLookStrength);
  }, [effectivePointerLookStrength, runtimeReadyVersion]);

  useEffect(() => {
    refs.performanceRuntimeControllerRef.current?.setState({
      ...performanceRuntimeState,
      lookSource: refs.lookPositionRef.current.source,
    });
  }, [performanceRuntimeState, runtimeReadyVersion]);

  useEffect(() => {
    refs.mouthRuntimeControllerRef.current?.setState(mouthRuntimeState);
  }, [mouthRuntimeState, runtimeReadyVersion]);
}
