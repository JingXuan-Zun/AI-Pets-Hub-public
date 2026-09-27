import { useCallback, useEffect, useRef, useState } from 'react';
import { type PetAction } from '../../types';
import { type PetRuntimePosition, type PetRuntimeRenderState } from '../core/petRuntimeTypes';
import { positionsMatch } from './companionPetRuntimeUtils';

interface UseCompanionPetRenderStateOptions {
  initialAction: PetAction;
  initialPosition: PetRuntimePosition;
  isMovementPaused: boolean;
  isTemporarilyMovementPaused: boolean;
}

export function useCompanionPetRenderState({
  initialAction,
  initialPosition,
  isMovementPaused,
  isTemporarilyMovementPaused,
}: UseCompanionPetRenderStateOptions) {
  const [renderState, setRenderState] = useState<PetRuntimeRenderState<PetAction>>({
    position: initialPosition,
    action: initialAction,
    motionTarget: null,
  });
  const renderPositionRef = useRef(initialPosition);
  const renderActionRef = useRef<PetAction>(initialAction);
  const renderMotionTargetRef = useRef<PetRuntimePosition | null>(null);
  const movementPausedRef = useRef(isMovementPaused);
  const temporarilyMovementPausedRef = useRef(isTemporarilyMovementPaused);

  const setRenderPosition = useCallback((nextPosition: PetRuntimePosition) => {
    if (positionsMatch(renderPositionRef.current, nextPosition)) {
      return;
    }

    renderPositionRef.current = nextPosition;
    setRenderState((currentState) => (
      positionsMatch(currentState.position, nextPosition)
        ? currentState
        : {
            ...currentState,
            position: nextPosition,
          }
    ));
  }, []);

  const setRenderAction = useCallback((nextAction: PetAction) => {
    if (renderActionRef.current === nextAction) {
      return;
    }

    renderActionRef.current = nextAction;
    setRenderState((currentState) => (
      currentState.action === nextAction
        ? currentState
        : {
            ...currentState,
            action: nextAction,
          }
    ));
  }, []);

  const updateRenderMotionTarget = useCallback((nextTarget: PetRuntimePosition | null) => {
    const currentTarget = renderMotionTargetRef.current;
    const isUnchanged = (
      currentTarget === nextTarget
      || (
        currentTarget !== null
        && nextTarget !== null
        && positionsMatch(currentTarget, nextTarget)
      )
    );

    if (isUnchanged) {
      return;
    }

    renderMotionTargetRef.current = nextTarget;
    setRenderState((currentState) => (
      currentState.motionTarget === nextTarget
      || (
        currentState.motionTarget !== null
        && nextTarget !== null
        && positionsMatch(currentState.motionTarget, nextTarget)
      )
        ? currentState
        : {
            ...currentState,
            motionTarget: nextTarget,
          }
    ));
  }, []);

  useEffect(() => {
    movementPausedRef.current = isMovementPaused;
    temporarilyMovementPausedRef.current = isTemporarilyMovementPaused;
  }, [isMovementPaused, isTemporarilyMovementPaused]);

  return {
    movementPausedRef,
    renderPositionRef,
    renderState,
    setRenderAction,
    setRenderPosition,
    temporarilyMovementPausedRef,
    updateRenderMotionTarget,
  };
}
