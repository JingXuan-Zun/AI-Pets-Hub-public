import { useState, type MutableRefObject } from 'react';
import { type Application, type Container } from 'pixi.js';
import { type AvatarRuntimeEventListener } from '../../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type Live2DRuntimeProfileConfigV1 } from '../../../pet-runtime/live2d/live2dRuntimeProfile';
import { type Live2DResolvedPointerLookPosition } from '../live2dPointerLookTarget';
import { type Live2DPointerLookRuntimeController } from '../live2dPointerLookRuntimeController';
import {
  type Live2DPerformanceRuntimeController,
  type Live2DPerformanceRuntimeState,
} from '../live2dPerformanceRuntimeController';
import {
  type Live2DMouthRuntimeController,
  type Live2DMouthRuntimeState,
} from '../live2dMouthRuntimeController';
import {
  type Live2DExpressionManagerConstructor,
  type Live2DModelLike,
  type Live2DModelPresentationOptions,
} from '../live2dModelRuntime';
import {
  type Live2DModelTickerHandle,
  type Live2DSharedRendererHandle,
} from '../live2dSharedRenderer';

export type Live2DRendererRuntimeContext = {
  modelRuntimeUrl: string;
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  runtimePetId: string;
};

// Stable ref bundle owned by PetLive2DRenderer and shared with its extracted
// effect hooks. The component keeps creating and owning every ref.
export type Live2DRendererRefs = {
  appRef: MutableRefObject<Application | null>;
  appliedRuntimeProfileSignatureRef: MutableRefObject<string>;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  createExpressionManagerRef: MutableRefObject<Live2DExpressionManagerConstructor | null>;
  declaredParameterIdsRef: MutableRefObject<ReadonlySet<string> | null>;
  live2dRuntimeProfileRef: MutableRefObject<Live2DRuntimeProfileConfigV1 | null>;
  lookPositionRef: MutableRefObject<Live2DResolvedPointerLookPosition>;
  modelLayerRef: MutableRefObject<Container | null>;
  modelRef: MutableRefObject<Live2DModelLike | null>;
  modelTickerHandleRef: MutableRefObject<Live2DModelTickerHandle | null>;
  mouthRuntimeControllerRef: MutableRefObject<Live2DMouthRuntimeController | null>;
  mouthRuntimeStateRef: MutableRefObject<Live2DMouthRuntimeState>;
  performanceRuntimeControllerRef: MutableRefObject<Live2DPerformanceRuntimeController | null>;
  performanceRuntimeStateRef: MutableRefObject<Live2DPerformanceRuntimeState>;
  pointerLookRuntimeControllerRef: MutableRefObject<Live2DPointerLookRuntimeController | null>;
  pointerLookStrengthRef: MutableRefObject<number>;
  presentationOptionsRef: MutableRefObject<Live2DModelPresentationOptions>;
  renderedVisualBoundsSignatureRef: MutableRefObject<string>;
  resetMotionExpressionSignaturesRef: MutableRefObject<() => void>;
  runtimeContextRef: MutableRefObject<Live2DRendererRuntimeContext>;
  sharedRendererHandleRef: MutableRefObject<Live2DSharedRendererHandle | null>;
};

export type Live2DRendererCoreRefs = Omit<
  Live2DRendererRefs,
  | 'live2dRuntimeProfileRef'
  | 'mouthRuntimeStateRef'
  | 'performanceRuntimeStateRef'
  | 'presentationOptionsRef'
  | 'resetMotionExpressionSignaturesRef'
  | 'runtimeContextRef'
>;

function createLive2DRendererCoreRefs(): Live2DRendererCoreRefs {
  return {
    appRef: { current: null },
    appliedRuntimeProfileSignatureRef: { current: '' },
    containerRef: { current: null },
    createExpressionManagerRef: { current: null },
    declaredParameterIdsRef: { current: null },
    lookPositionRef: { current: { source: 'center', x: 0, y: 0 } },
    modelLayerRef: { current: null },
    modelRef: { current: null },
    modelTickerHandleRef: { current: null },
    mouthRuntimeControllerRef: { current: null },
    performanceRuntimeControllerRef: { current: null },
    pointerLookRuntimeControllerRef: { current: null },
    pointerLookStrengthRef: { current: 1 },
    renderedVisualBoundsSignatureRef: { current: '' },
    sharedRendererHandleRef: { current: null },
  };
}

// Refs without render-time initial values, created once per renderer instance.
export function useLive2DRendererCoreRefs() {
  const [coreRefs] = useState(createLive2DRendererCoreRefs);
  return coreRefs;
}
