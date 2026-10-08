import { useMemo, useRef, type MutableRefObject } from 'react';
import { type PetAction, type PetModelMotionBinding } from '../../../types';
import { type PetHoverState } from '../../../pet-runtime/interactions/petHoverController';
import { isPetModelExpressionBinding } from '../../../pet-runtime/content/petModelMotionBindingKinds';
import { resolvePetPointerLookStrength } from '../../../pet-runtime/interactions/petPointerLookPriority';
import {
  resolveLive2DDragSettledPointerLookTarget,
  type Live2DResolvedPointerLookPosition,
} from '../live2dPointerLookTarget';
import { type Live2DPerformanceRuntimeState } from '../live2dPerformanceRuntimeController';
import { type Live2DMouthRuntimeState } from '../live2dMouthRuntimeController';
import { useLive2DDragLookSettle } from '../useLive2DDragLookSettle';
import { useLive2DScaleStablePointerLookTarget } from './useLive2DScaleStablePointerLookTarget';

type Position = {
  x: number;
  y: number;
};

export function shouldUseLive2DDragSettleCenter(
  shouldSettleLive2DLook: boolean,
  focusTarget: Position | null | undefined,
) {
  return shouldSettleLive2DLook && !focusTarget;
}

type RuntimeStateInput = {
  action: PetAction;
  expressionAction: PetAction | null;
  focusTarget: Position | null;
  hoverState: PetHoverState | null;
  isDragging: boolean;
  isMoving: boolean;
  isSpeaking: boolean;
  isTyping: boolean;
  latestMessage: string;
  lookPositionRef: MutableRefObject<Live2DResolvedPointerLookPosition>;
  manualExpressionBinding: PetModelMotionBinding | null;
  manualMotionBinding: PetModelMotionBinding | null;
  modelMotionBindings: PetModelMotionBinding[];
  pointerLookTarget: Position | null;
  scale: number;
  visible: boolean;
};

function useMergedMotionBindings(input: RuntimeStateInput) {
  const { manualExpressionBinding, manualMotionBinding, modelMotionBindings } = input;
  const motionBindings = useMemo(() => {
    const manualBindings = [manualMotionBinding, manualExpressionBinding]
      .filter((binding): binding is PetModelMotionBinding => Boolean(binding));
    return manualBindings.reduce((nextBindings, binding) => (
      nextBindings.some((nextBinding) => nextBinding.id === binding.id)
        ? nextBindings
        : [...nextBindings, binding]
    ), modelMotionBindings);
  }, [manualExpressionBinding, manualMotionBinding, modelMotionBindings]);
  const effectiveManualExpressionBinding = manualExpressionBinding
    ?? (manualMotionBinding && isPetModelExpressionBinding(manualMotionBinding)
      ? manualMotionBinding
      : null);
  const manualMotionBindingForMotion = manualMotionBinding && !isPetModelExpressionBinding(manualMotionBinding)
    ? manualMotionBinding
    : null;
  return { effectiveManualExpressionBinding, manualMotionBindingForMotion, motionBindings };
}

function useLive2DLookSettleState(input: RuntimeStateInput) {
  const { focusTarget, isDragging, pointerLookTarget, scale } = input;
  const {
    shouldStabilize: shouldStabilizeScaleLook,
    stabilizedTarget: scaleStablePointerLookTarget,
  } = useLive2DScaleStablePointerLookTarget(scale, pointerLookTarget);
  const {
    settledFocusTarget: dragSettledFocusTarget,
    shouldSettle: shouldSettleLive2DLook,
  } = useLive2DDragLookSettle(isDragging, focusTarget);
  const dragSettledPointerLookTarget = resolveLive2DDragSettledPointerLookTarget({
    pointerLookTarget: scaleStablePointerLookTarget,
    shouldSettle: shouldSettleLive2DLook,
  });
  const shouldUseDragSettleCenter = shouldUseLive2DDragSettleCenter(
    shouldSettleLive2DLook,
    dragSettledFocusTarget,
  );
  return {
    dragSettledFocusTarget,
    dragSettledPointerLookTarget,
    shouldSettleLive2DLook,
    shouldStabilizeScaleLook,
    shouldUseDragSettleCenter,
  };
}

function useLive2DPointerLookStrength(
  input: RuntimeStateInput,
  look: ReturnType<typeof useLive2DLookSettleState>,
  manualMotionBindingForMotion: PetModelMotionBinding | null,
) {
  const { action, expressionAction, isDragging, isMoving } = input;
  const { dragSettledFocusTarget, shouldSettleLive2DLook } = look;
  const pointerLookStrength = useMemo(() => resolvePetPointerLookStrength({
    action,
    expressionAction,
    isDragging,
    isDragLookSettling: shouldSettleLive2DLook && Boolean(dragSettledFocusTarget),
    isMoving,
    manualMotionActive: Boolean(manualMotionBindingForMotion),
    manualMotionKey: manualMotionBindingForMotion?.motionKey ?? null,
  }), [
    action,
    dragSettledFocusTarget,
    expressionAction,
    isDragging,
    isMoving,
    manualMotionBindingForMotion,
    shouldSettleLive2DLook,
  ]);
  const { shouldUseDragSettleCenter } = look;
  const effectivePointerLookStrength = shouldUseDragSettleCenter ? 0 : pointerLookStrength;
  return effectivePointerLookStrength;
}

function useLive2DPerformanceState(
  input: RuntimeStateInput,
  bindings: ReturnType<typeof useMergedMotionBindings>,
  effectivePointerLookStrength: number,
) {
  const { action, expressionAction, hoverState, isDragging, isMoving, lookPositionRef, visible } = input;
  const { effectiveManualExpressionBinding, manualMotionBindingForMotion } = bindings;
  return useMemo<Live2DPerformanceRuntimeState>(() => ({
    action,
    expressionAction,
    hoverRegion: hoverState?.activeRegion ?? null,
    isDragging,
    isMoving,
    lookSource: lookPositionRef.current.source,
    manualExpressionActive: Boolean(effectiveManualExpressionBinding),
    manualMotionActive: Boolean(manualMotionBindingForMotion),
    pointerLookStrength: effectivePointerLookStrength,
    visible,
  }), [
    action,
    effectiveManualExpressionBinding,
    effectivePointerLookStrength,
    expressionAction,
    hoverState?.activeRegion,
    isDragging,
    isMoving,
    manualMotionBindingForMotion,
    visible,
  ]);
}

export function useLive2DRendererRuntimeState(input: RuntimeStateInput) {
  const bindings = useMergedMotionBindings(input);
  const look = useLive2DLookSettleState(input);
  const effectivePointerLookStrength = useLive2DPointerLookStrength(input, look, bindings.manualMotionBindingForMotion);
  const performanceRuntimeState = useLive2DPerformanceState(input, bindings, effectivePointerLookStrength);
  const performanceRuntimeStateRef = useRef(performanceRuntimeState);
  const { isSpeaking, isTyping, latestMessage, visible } = input;
  const mouthRuntimeState = useMemo<Live2DMouthRuntimeState>(() => ({
    isSpeaking,
    isTyping,
    latestMessage,
    visible,
  }), [isSpeaking, isTyping, latestMessage, visible]);
  const mouthRuntimeStateRef = useRef(mouthRuntimeState);
  return {
    ...bindings,
    ...look,
    effectivePointerLookStrength,
    mouthRuntimeState,
    mouthRuntimeStateRef,
    performanceRuntimeState,
    performanceRuntimeStateRef,
  };
}
