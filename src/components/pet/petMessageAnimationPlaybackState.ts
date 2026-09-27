import { useCallback, useEffect, useRef, useState } from 'react';
import { type PetModelMotionBinding } from '../../types';
import {
  isPetModelExpressionBinding,
  isPetModelMotionBinding,
} from '../../pet-runtime/content/petModelMotionBindingKinds';
import {
  MESSAGE_ANIMATION_DURATION_MS,
  resolveAnimationBindingPlaybackDurationMs,
} from './animationBindingPlaybackDuration';

export interface PetMessageAnimationPlaybackState {
  expressionBinding: PetModelMotionBinding | null;
  motionBinding: PetModelMotionBinding | null;
}

export function splitPetMessageAnimationBindings(bindings: PetModelMotionBinding[]) {
  return {
    expressionBindings: bindings.filter(isPetModelExpressionBinding),
    motionBindings: bindings.filter(isPetModelMotionBinding),
  };
}

export function createPetMessageAnimationPlaybackState(
  motionBinding: PetModelMotionBinding | null,
  expressionBinding: PetModelMotionBinding | null,
): PetMessageAnimationPlaybackState {
  return {
    expressionBinding,
    motionBinding,
  };
}

export function usePetMessageExpressionPlayback(
  durationMs = MESSAGE_ANIMATION_DURATION_MS,
) {
  const [activeExpressionBinding, setActiveExpressionBinding] = useState<PetModelMotionBinding | null>(null);
  const expressionTimerRef = useRef<number | null>(null);

  const clearExpressionPlayback = useCallback(() => {
    if (expressionTimerRef.current !== null) {
      window.clearTimeout(expressionTimerRef.current);
      expressionTimerRef.current = null;
    }

    setActiveExpressionBinding(null);
  }, []);

  const enqueueExpressionBindings = useCallback((expressionBindings: PetModelMotionBinding[]) => {
    const nextExpressionBinding = expressionBindings[expressionBindings.length - 1] ?? null;
    if (!nextExpressionBinding) {
      return;
    }

    if (expressionTimerRef.current !== null) {
      window.clearTimeout(expressionTimerRef.current);
    }

    setActiveExpressionBinding(nextExpressionBinding);
    expressionTimerRef.current = window.setTimeout(() => {
      expressionTimerRef.current = null;
      setActiveExpressionBinding(null);
    }, resolveAnimationBindingPlaybackDurationMs(nextExpressionBinding, 1, durationMs));
  }, [durationMs]);

  useEffect(() => () => {
    clearExpressionPlayback();
  }, [clearExpressionPlayback]);

  return {
    activeExpressionBinding,
    clearExpressionPlayback,
    enqueueExpressionBindings,
  };
}
