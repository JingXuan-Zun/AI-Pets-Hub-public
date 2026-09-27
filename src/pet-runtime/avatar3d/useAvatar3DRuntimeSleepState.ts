import { useEffect, useMemo, useRef, useState } from 'react';
import { type PetHoverState } from '../interactions/petHoverController';
import { type Avatar3DDragMotionState } from './avatar3dDragMotionState';
import { type Avatar3DPresentationMode } from './avatar3dPresentationMode';

export type Avatar3DRuntimeUpdatePriority = 'primary' | 'companion';

type UseAvatar3DRuntimeSleepStateOptions = {
  activeSceneCount?: number;
  dragMotionState?: Avatar3DDragMotionState | null;
  hoverState?: PetHoverState | null;
  isMoving?: boolean;
  isSpeaking?: boolean;
  isTyping?: boolean;
  latestMessage?: string;
  presentationMode?: Avatar3DPresentationMode;
  updatePriority?: Avatar3DRuntimeUpdatePriority;
  visible?: boolean;
};

function resolveRuntimeSleepDelayMs({
  activeSceneCount,
  presentationMode,
  updatePriority,
}: {
  activeSceneCount: number;
  presentationMode: Avatar3DPresentationMode;
  updatePriority: Avatar3DRuntimeUpdatePriority;
}) {
  if (presentationMode === 'interactive-dialogue') {
    return Number.POSITIVE_INFINITY;
  }

  if (updatePriority === 'primary') {
    if (activeSceneCount >= 3) {
      return 1800;
    }

    if (activeSceneCount === 2) {
      return 2400;
    }

    return 3200;
  }

  if (activeSceneCount >= 3) {
    return 650;
  }

  if (activeSceneCount === 2) {
    return 900;
  }

  return 1400;
}

export function useAvatar3DRuntimeSleepState({
  activeSceneCount = 1,
  dragMotionState = null,
  hoverState = null,
  isMoving = false,
  isSpeaking = false,
  isTyping = false,
  latestMessage = '',
  presentationMode = 'default',
  updatePriority = 'companion',
  visible = true,
}: UseAvatar3DRuntimeSleepStateOptions) {
  const [isSleeping, setIsSleeping] = useState(false);
  const lastActiveAtRef = useRef(Date.now());
  const previousMessageRef = useRef(latestMessage.trim());

  const activeSceneBudget = Math.max(1, Math.round(activeSceneCount || 1));
  const sleepDelayMs = useMemo(() => resolveRuntimeSleepDelayMs({
    activeSceneCount: activeSceneBudget,
    presentationMode,
    updatePriority,
  }), [activeSceneBudget, presentationMode, updatePriority]);
  const hasInteractiveActivity = Boolean(
    dragMotionState?.active
    || hoverState?.activeRegion
    || isMoving
    || isSpeaking
    || isTyping
    || presentationMode === 'interactive-dialogue',
  );

  useEffect(() => {
    const trimmedMessage = latestMessage.trim();
    if (trimmedMessage !== previousMessageRef.current) {
      previousMessageRef.current = trimmedMessage;
      lastActiveAtRef.current = Date.now();
      setIsSleeping(false);
    }
  }, [latestMessage]);

  useEffect(() => {
    if (!visible) {
      setIsSleeping(true);
      return undefined;
    }

    if (hasInteractiveActivity || !Number.isFinite(sleepDelayMs)) {
      lastActiveAtRef.current = Date.now();
      setIsSleeping(false);
      return undefined;
    }

    const now = Date.now();
    const remainingDelayMs = Math.max(0, sleepDelayMs - (now - lastActiveAtRef.current));
    if (remainingDelayMs === 0) {
      setIsSleeping(true);
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setIsSleeping(true);
    }, remainingDelayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [hasInteractiveActivity, sleepDelayMs, visible]);

  return {
    isSleeping,
    isVisible: visible,
    sleepDelayMs,
    updatePriority,
  };
}
