import { useEffect, useRef, type MutableRefObject } from 'react';
import { type PetAction, type PetModelMotionBinding } from '../../../types';
import { type PetHoverState } from '../../../pet-runtime/interactions/petHoverController';
import { pushFrontendRuntimeError } from '../../../frontendRuntimeLogger';
import {
  createPointerLookDiagnosticsState,
  createPointerLookTargetSignature,
  pushPointerLookDiagnosticLog,
  pushPointerLookTraceLog,
  summarizePointerLookTarget,
} from '../petPointerLookDiagnostics';
import {
  resolveLive2DLookPosition,
  type Live2DResolvedPointerLookPosition,
} from '../live2dPointerLookTarget';
import { type Live2DRendererRefs } from './live2dRendererRefs';

type Position = {
  x: number;
  y: number;
};

const LIVE2D_DRAG_SETTLE_LOOK_POSITION = {
  source: 'center',
  x: 0,
  y: 0,
} satisfies Live2DResolvedPointerLookPosition;

type PointerLookApplicationValues = {
  action: PetAction;
  dragSettledFocusTarget: Position | null;
  dragSettledPointerLookTarget: Position | null;
  effectiveManualExpressionBinding: PetModelMotionBinding | null;
  effectivePointerLookStrength: number;
  expressionAction: PetAction | null;
  hoverRegion: PetHoverState['activeRegion'] | undefined;
  isMoving: boolean;
  manualMotionBindingForMotion: PetModelMotionBinding | null;
  modelUrl: string;
  refs: Pick<Live2DRendererRefs, 'lookPositionRef' | 'modelRef' | 'performanceRuntimeControllerRef' | 'pointerLookRuntimeControllerRef'>;
  runtimePetId: string;
  shouldUseDragSettleCenter: boolean;
  visible: boolean;
};

type PointerLookDiagnosticRefs = {
  appliedRef: MutableRefObject<ReturnType<typeof createPointerLookDiagnosticsState>>;
  upperRightRef: MutableRefObject<ReturnType<typeof createPointerLookDiagnosticsState>>;
};

function traceUpperRightPointerLook(
  values: PointerLookApplicationValues,
  diagnostics: PointerLookDiagnosticRefs,
  lookPosition: Live2DResolvedPointerLookPosition,
) {
  pushPointerLookTraceLog(
    diagnostics.upperRightRef.current,
    'live2d upper-right trace renderer input',
    [
      values.runtimePetId,
      lookPosition.source,
      lookPosition.x.toFixed(3),
      lookPosition.y.toFixed(3),
      createPointerLookTargetSignature(values.dragSettledPointerLookTarget),
      createPointerLookTargetSignature(values.dragSettledFocusTarget),
    ],
    {
      action: values.action,
      expressionAction: values.expressionAction,
      focusPosition: {
        x: Number(lookPosition.x.toFixed(3)),
        y: Number(lookPosition.y.toFixed(3)),
      },
      focusTarget: summarizePointerLookTarget(values.dragSettledFocusTarget),
      hoverRegion: values.hoverRegion ?? null,
      isMoving: values.isMoving,
      manualExpressionActive: Boolean(values.effectiveManualExpressionBinding),
      manualMotionActive: Boolean(values.manualMotionBindingForMotion),
      modelUrl: values.modelUrl,
      pointerLookStrength: values.effectivePointerLookStrength,
      pointerLookTarget: summarizePointerLookTarget(values.dragSettledPointerLookTarget),
      runtimePetId: values.runtimePetId,
      source: lookPosition.source,
      visible: values.visible,
    },
    1200,
  );
}

function logAppliedPointerLook(
  values: PointerLookApplicationValues,
  diagnostics: PointerLookDiagnosticRefs,
  lookPosition: Live2DResolvedPointerLookPosition,
) {
  pushPointerLookDiagnosticLog(
    diagnostics.appliedRef.current,
    'live2d pointer look applied',
    [
      values.runtimePetId,
      createPointerLookTargetSignature(values.dragSettledPointerLookTarget),
      lookPosition.source,
      lookPosition.x.toFixed(3),
      lookPosition.y.toFixed(3),
    ],
    {
      focusPosition: {
        x: Number(lookPosition.x.toFixed(3)),
        y: Number(lookPosition.y.toFixed(3)),
      },
      focusTarget: summarizePointerLookTarget(values.dragSettledFocusTarget),
      hoverRegion: values.hoverRegion ?? null,
      isMoving: values.isMoving,
      manualExpressionActive: Boolean(values.effectiveManualExpressionBinding),
      manualMotionActive: Boolean(values.manualMotionBindingForMotion),
      parameterController: values.refs.pointerLookRuntimeControllerRef.current?.summary ?? null,
      modelUrl: values.modelUrl,
      pointerLookStrength: values.effectivePointerLookStrength,
      pointerLookTarget: summarizePointerLookTarget(values.dragSettledPointerLookTarget),
      runtimePetId: values.runtimePetId,
      source: lookPosition.source,
    },
  );
}

function logCenteredPointerLook(
  values: PointerLookApplicationValues,
  diagnostics: PointerLookDiagnosticRefs,
  lookPosition: Live2DResolvedPointerLookPosition,
) {
  pushPointerLookDiagnosticLog(
    diagnostics.appliedRef.current,
    'live2d pointer look applied',
    [values.runtimePetId, 'center'],
    {
      focusTarget: summarizePointerLookTarget(values.dragSettledFocusTarget),
      focusPosition: { x: 0, y: 0 },
      parameterController: values.refs.pointerLookRuntimeControllerRef.current?.summary ?? null,
      modelUrl: values.modelUrl,
      pointerLookTarget: summarizePointerLookTarget(values.dragSettledPointerLookTarget),
      runtimePetId: values.runtimePetId,
      source: lookPosition.source,
    },
  );
}

function applyLive2DPointerLook(values: PointerLookApplicationValues, diagnostics: PointerLookDiagnosticRefs) {
  const { dragSettledFocusTarget, dragSettledPointerLookTarget, refs, shouldUseDragSettleCenter } = values;
  const model = refs.modelRef.current;
  const lookPosition = shouldUseDragSettleCenter
    ? LIVE2D_DRAG_SETTLE_LOOK_POSITION
    : resolveLive2DLookPosition({
        focusTarget: dragSettledFocusTarget,
        pointerLookTarget: dragSettledPointerLookTarget,
      });
  const pointerLookRuntimeController = refs.pointerLookRuntimeControllerRef.current;
  refs.lookPositionRef.current = lookPosition;
  refs.performanceRuntimeControllerRef.current?.setState({
    lookSource: lookPosition.source,
  });
  pointerLookRuntimeController?.setStrength(values.effectivePointerLookStrength);
  pointerLookRuntimeController?.updateInputTarget(lookPosition);

  if (model && !pointerLookRuntimeController) {
    focusModelWithoutController(values, model, lookPosition);
  }

  if (lookPosition.source !== 'center') {
    if (lookPosition.x > 0.12 && lookPosition.y > 0.03) {
      traceUpperRightPointerLook(values, diagnostics, lookPosition);
    }
    logAppliedPointerLook(values, diagnostics, lookPosition);
    return;
  }

  logCenteredPointerLook(values, diagnostics, lookPosition);
}

function focusModelWithoutController(
  values: PointerLookApplicationValues,
  model: NonNullable<Live2DRendererRefs['modelRef']['current']>,
  lookPosition: Live2DResolvedPointerLookPosition,
) {
  try {
    model.focus(lookPosition.x, lookPosition.y);
  } catch (error) {
    pushFrontendRuntimeError('model', `live2d focus pointer look failed pet=${values.runtimePetId}`, error, {
      focusPosition: {
        x: Number(lookPosition.x.toFixed(3)),
        y: Number(lookPosition.y.toFixed(3)),
      },
      focusTarget: summarizePointerLookTarget(values.dragSettledFocusTarget),
      modelUrl: values.modelUrl,
      pointerLookTarget: summarizePointerLookTarget(values.dragSettledPointerLookTarget),
      runtimePetId: values.runtimePetId,
      source: lookPosition.source,
    });
  }
}

export function useLive2DPointerLookApplication(values: PointerLookApplicationValues) {
  const appliedRef = useRef(createPointerLookDiagnosticsState());
  const upperRightRef = useRef(createPointerLookDiagnosticsState());
  useEffect(() => {
    applyLive2DPointerLook(values, { appliedRef, upperRightRef });
  }, [
    values.action,
    values.effectiveManualExpressionBinding,
    values.effectivePointerLookStrength,
    values.expressionAction,
    values.dragSettledFocusTarget,
    values.hoverRegion,
    values.isMoving,
    values.manualMotionBindingForMotion,
    values.modelUrl,
    values.dragSettledPointerLookTarget,
    values.runtimePetId,
    values.shouldUseDragSettleCenter,
    values.visible,
  ]);
}
