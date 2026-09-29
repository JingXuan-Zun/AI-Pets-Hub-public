import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type ModelType } from '../../types';
import { resolveRelativeFocusTarget } from './petMotionVisualState';
import {
  resolvePetRuntimeDragMotionState,
} from './petAvatarRuntimeSurface';
import {
  resolveMovementFocusTargetHoldMs,
  resolveNextMovementFocusTarget,
  resolvePetLayerDragFocusDelta,
  resolvePetLayerFocusTarget,
  resolvePetLayerMovementFocusTarget,
  resolvePetLayerRawFocusTarget,
  resolvePetMovementFocusPositionUpdate,
  shouldExpireMovementFocusTargetForModelType,
} from './petLayerMotionStateUtils';

type Position = {
  x: number;
  y: number;
};

interface UsePetLayerMotionStateOptions {
  isDragging: boolean;
  dragDelta?: Position | null;
  modelType: ModelType;
  motionTarget?: Position | null;
  position: Position;
  shouldAnimateAsMoving: boolean;
  visionTarget?: Position | null;
}

export function usePetLayerMotionState({
  dragDelta = null,
  isDragging,
  modelType,
  motionTarget = null,
  position,
  shouldAnimateAsMoving,
  visionTarget = null,
}: UsePetLayerMotionStateOptions) {
  const previousPositionRef = useRef(position);
  const wasDraggingRef = useRef(isDragging);
  const latestDragFocusTargetRef = useRef<Position | null>(null);
  const movementFocusTargetTimerRef = useRef<number | null>(null);
  const latestDragDelta = {
    x: position.x - previousPositionRef.current.x,
    y: position.y - previousPositionRef.current.y,
  };
  const currentDragFocusTarget = isDragging
    ? resolveNextMovementFocusTarget(
        modelType,
        resolvePetLayerDragFocusDelta(modelType, dragDelta ?? latestDragDelta),
      )
    : null;
  const previousDragFocusTarget = isDragging && !wasDraggingRef.current
    ? null
    : latestDragFocusTargetRef.current;
  const dragHandoffFocusTarget = isDragging
    ? currentDragFocusTarget ?? previousDragFocusTarget
    : wasDraggingRef.current
      ? resolveNextMovementFocusTarget(
          modelType,
          resolvePetLayerDragFocusDelta(modelType, dragDelta ?? latestDragDelta),
        ) ?? latestDragFocusTargetRef.current
      : null;
  const shouldExpireMovementFocusTarget = shouldExpireMovementFocusTargetForModelType(modelType);
  const [movementFocusTarget, setMovementFocusTarget] = useState<Position | null>(null);
  const renderedMovementFocusTarget = resolvePetLayerMovementFocusTarget({
    dragHandoffFocusTarget,
    isDragging,
    modelType,
    movementFocusTarget,
  });
  const motionFocusTarget = useMemo(() => (
    resolveRelativeFocusTarget(motionTarget, position)
  ), [motionTarget, position]);
  const rawFocusTarget = useMemo(() => (
    resolvePetLayerRawFocusTarget({
      modelType,
      motionFocusTarget,
      movementFocusTarget: renderedMovementFocusTarget,
      shouldAnimateAsMoving,
      visionTarget,
    })
  ), [
    modelType,
    motionFocusTarget,
    renderedMovementFocusTarget,
    shouldAnimateAsMoving,
    visionTarget,
  ]);
  const focusTarget = useMemo(() => (
    resolvePetLayerFocusTarget(modelType, rawFocusTarget)
  ), [modelType, rawFocusTarget]);
  const dragMotionState = useMemo(() => (
    resolvePetRuntimeDragMotionState(
      modelType,
      isDragging,
      latestDragDelta.x,
      latestDragDelta.y,
    )
  ), [isDragging, latestDragDelta.x, latestDragDelta.y, modelType]);

  const clearMovementFocusTargetTimer = useCallback(() => {
    if (movementFocusTargetTimerRef.current === null) {
      return;
    }

    window.clearTimeout(movementFocusTargetTimerRef.current);
    movementFocusTargetTimerRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!isDragging) {
      return;
    }

    if (!wasDraggingRef.current) {
      latestDragFocusTargetRef.current = null;
    }
    if (currentDragFocusTarget) {
      latestDragFocusTargetRef.current = currentDragFocusTarget;
    }
  }, [currentDragFocusTarget, isDragging]);

  useEffect(() => () => {
    clearMovementFocusTargetTimer();
  }, [clearMovementFocusTargetTimer]);

  useEffect(() => {
    if (shouldExpireMovementFocusTarget) {
      return;
    }

    clearMovementFocusTargetTimer();
  }, [clearMovementFocusTargetTimer, shouldExpireMovementFocusTarget]);

  useEffect(() => {
    const previousPosition = previousPositionRef.current;
    const dx = position.x - previousPosition.x;
    const dy = position.y - previousPosition.y;
    const wasDragging = wasDraggingRef.current;
    previousPositionRef.current = position;
    wasDraggingRef.current = isDragging;

    const focusPositionUpdate = resolvePetMovementFocusPositionUpdate({
      delta: { x: dx, y: dy },
      dragFocusTarget: wasDragging && !isDragging
        ? dragHandoffFocusTarget ?? latestDragFocusTargetRef.current
        : latestDragFocusTargetRef.current,
      isDragging,
      modelType,
      shouldAnimateAsMoving,
      wasDragging,
    });
    if (wasDragging && !isDragging) {
      latestDragFocusTargetRef.current = null;
    }
    if (focusPositionUpdate.type === 'preserve') {
      return;
    }

    if (focusPositionUpdate.type === 'clear') {
      clearMovementFocusTargetTimer();
      setMovementFocusTarget(null);
      return;
    }

    const nextFocusTarget = focusPositionUpdate.target;
    clearMovementFocusTargetTimer();
    setMovementFocusTarget((currentTarget) => (
      currentTarget?.x === nextFocusTarget.x
      && currentTarget?.y === nextFocusTarget.y
        ? currentTarget
        : nextFocusTarget
    ));
    if (shouldExpireMovementFocusTarget) {
      movementFocusTargetTimerRef.current = window.setTimeout(() => {
        movementFocusTargetTimerRef.current = null;
        setMovementFocusTarget(null);
      }, resolveMovementFocusTargetHoldMs(modelType));
    }
  }, [
    clearMovementFocusTargetTimer,
    isDragging,
    modelType,
    position,
    shouldAnimateAsMoving,
    shouldExpireMovementFocusTarget,
  ]);

  return {
    dragMotionState,
    focusTarget,
  };
}
