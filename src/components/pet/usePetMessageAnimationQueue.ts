import { useEffect, useMemo, useRef, useState } from 'react';
import { type DesktopPetAnimationToolTrigger } from '../../chatState';
import { type ModelType, type PetModelMotionBinding, type PetModelPreset } from '../../types';
import { resolvePetModelMotionBindingsForModel } from '../../pet-runtime/content/petModelMotionBindings';
import { canModelTypeUseMotionBindings } from '../../pet-runtime/live2d/live2dModelSupport';
import { mergeIncomingAnimationBindingsIntoQueue } from './animationBindingQueue';
import {
  MESSAGE_ANIMATION_DURATION_MS,
  resolveAnimationBindingPlaybackDurationMs,
  shouldResetAnimationPlaybackOnTypingStart,
} from './animationBindingPlaybackDuration';
import {
  getAvatar3DMotionClipDurationVersion,
  resolveAvatar3DMotionClipDurationMs,
  subscribeAvatar3DMotionClipDurations,
} from '../../pet-runtime/avatar3d/avatar3dMotionClipDurationStore';
import { clearAnimationTriggerBatchTimeouts } from './animationTriggerBatchScheduler';
import {
  buildMotionBindingSignature,
  resolveExplicitAnimationToolIds,
  resolveMessageAnimationBindingQueue,
} from './petMessageAnimationQueueResolvers';
import {
  createPetMessageAnimationPlaybackState,
  splitPetMessageAnimationBindings,
  usePetMessageExpressionPlayback,
} from './petMessageAnimationPlaybackState';
import { handleAnimationToolTriggerPlayback } from './animationToolTriggerPlayback';
import { setAnimationToolPerformanceRuntimeState } from './animationToolPerformanceState';

export { resolveExplicitAnimationToolIds, resolveMessageAnimationBindingQueue } from './petMessageAnimationQueueResolvers';

export function usePetMessageAnimationQueue(
  latestMessage: string,
  isTyping: boolean,
  modelType: ModelType,
  modelUrl: string,
  customModelPresets: PetModelPreset[] = [],
  animationToolTrigger: DesktopPetAnimationToolTrigger | null = null,
  lastReplayableAnimationToolTrigger: DesktopPetAnimationToolTrigger | null = null,
  durationMs = MESSAGE_ANIMATION_DURATION_MS, petId?: string,
) {
  const [activeMotionBinding, setActiveMotionBinding] = useState<PetModelMotionBinding | null>(null);
  const expressionPlayback = usePetMessageExpressionPlayback(durationMs);
  const [motionClipDurationVersion, setMotionClipDurationVersion] = useState(() => (
    getAvatar3DMotionClipDurationVersion()
  ));
  const timerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const scheduledTriggerTimeoutsRef = useRef<number[]>([]);
  const activeMotionBindingRef = useRef<PetModelMotionBinding | null>(null);
  const activeMotionPlaybackDurationMsRef = useRef(0);
  const activeMotionStartedAtMsRef = useRef(0);
  const queuedMotionBindingsRef = useRef<PetModelMotionBinding[]>([]);
  const queuedStreamingAnimationIdsRef = useRef<string[]>([]);
  const lastAnimationToolTriggerTokenRef = useRef<number | null>(null);
  const lastProcessedMessageRef = useRef('');
  const wasTypingRef = useRef(false);
  const motionBindings = useMemo(() => (
    canModelTypeUseMotionBindings(modelType)
      ? resolvePetModelMotionBindingsForModel(modelType, modelUrl, customModelPresets)
      : []
  ), [customModelPresets, modelType, modelUrl]);
  const motionBindingSignature = useMemo(
    () => buildMotionBindingSignature(motionBindings), [motionBindings],
  );

  const clearScheduledPlayback = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    clearAnimationTriggerBatchTimeouts(scheduledTriggerTimeoutsRef);
  };

  useEffect(() => () => {
    clearScheduledPlayback();
  }, []);

  useEffect(() => subscribeAvatar3DMotionClipDurations(() => {
    setMotionClipDurationVersion(getAvatar3DMotionClipDurationVersion());
  }), []);

  const resetMotionPlayback = () => {
    clearScheduledPlayback();
    expressionPlayback.clearExpressionPlayback();
    queuedMotionBindingsRef.current = [];
    activeMotionBindingRef.current = null;
    activeMotionPlaybackDurationMsRef.current = 0;
    activeMotionStartedAtMsRef.current = 0;
    setActiveMotionBinding(null);
  };

  const resolveQueuedMotionBindingPlaybackDurationMs = (
    binding: PetModelMotionBinding,
    bindingCount: number,
  ) => resolveAnimationBindingPlaybackDurationMs(
    binding,
    bindingCount,
    durationMs,
    resolveAvatar3DMotionClipDurationMs([
      binding.name,
      ...(binding.clipNames ?? []),
    ]),
  );

  useEffect(() => {
    resetMotionPlayback();
    queuedStreamingAnimationIdsRef.current = [];
    lastProcessedMessageRef.current = '';
  }, [modelType, modelUrl, motionBindingSignature]);

  const playNextQueuedMotionBinding = () => {
    if (activeMotionBindingRef.current || timerRef.current !== null) {
      return;
    }

    const nextMotionBinding = queuedMotionBindingsRef.current.shift() ?? null;
    if (!nextMotionBinding) {
      activeMotionBindingRef.current = null;
      setActiveMotionBinding(null);
      return;
    }

    const remainingPlaybackCount = 1 + queuedMotionBindingsRef.current.length;
    const playbackDurationMs = resolveQueuedMotionBindingPlaybackDurationMs(
      nextMotionBinding,
      remainingPlaybackCount,
    );
    activeMotionBindingRef.current = nextMotionBinding;
    activeMotionPlaybackDurationMsRef.current = playbackDurationMs;
    activeMotionStartedAtMsRef.current = window.performance?.now?.() ?? Date.now();
    setActiveMotionBinding(nextMotionBinding);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      activeMotionBindingRef.current = null;
      if (queuedMotionBindingsRef.current.length === 0) {
        setActiveMotionBinding(null);
        if (lastAnimationToolTriggerTokenRef.current !== null) {
          setAnimationToolPerformanceRuntimeState({
            itemCount: 0,
            petId,
            status: 'ended',
            token: lastAnimationToolTriggerTokenRef.current,
          });
        }
        return;
      }

      playNextQueuedMotionBinding();
    }, playbackDurationMs);
  };

  const enqueueMotionBindings = (nextMotionBindings: PetModelMotionBinding[], preserveRepeats = false) => {
    if (nextMotionBindings.length === 0) {
      return;
    }

    queuedMotionBindingsRef.current = mergeIncomingAnimationBindingsIntoQueue(
      activeMotionBindingRef.current,
      queuedMotionBindingsRef.current,
      nextMotionBindings,
      { preserveRepeats },
    );
    playNextQueuedMotionBinding();
  };

  const enqueueAnimationBindings = (nextBindings: PetModelMotionBinding[], preserveRepeats = false) => {
    const { expressionBindings, motionBindings } = splitPetMessageAnimationBindings(nextBindings);
    expressionPlayback.enqueueExpressionBindings(expressionBindings);
    enqueueMotionBindings(motionBindings, preserveRepeats);
  };

  useEffect(() => {
    const normalizedMessage = latestMessage.trim();
    const wasTyping = wasTypingRef.current;
    wasTypingRef.current = isTyping;

    if (!canModelTypeUseMotionBindings(modelType) || motionBindings.length === 0) {
      return;
    }

    if (isTyping) {
      if (!wasTyping) {
        queuedStreamingAnimationIdsRef.current = [];
        if (shouldResetAnimationPlaybackOnTypingStart(
          activeMotionBindingRef.current,
          queuedMotionBindingsRef.current.length,
        )) {
          resetMotionPlayback();
        }
        lastProcessedMessageRef.current = '';
      }

      const explicitAnimationIds = resolveExplicitAnimationToolIds(normalizedMessage);
      if (explicitAnimationIds.length > 0) {
        queuedStreamingAnimationIdsRef.current = explicitAnimationIds;
      }
      return;
    }

    const queuedAnimationIds = wasTyping ? queuedStreamingAnimationIdsRef.current : [];
    if (!normalizedMessage && queuedAnimationIds.length === 0) {
      return;
    }

    if (lastProcessedMessageRef.current === normalizedMessage && queuedAnimationIds.length === 0) {
      return;
    }

    const nextMotionBindings = resolveMessageAnimationBindingQueue(
      normalizedMessage,
      motionBindings,
      queuedAnimationIds,
    );
    queuedStreamingAnimationIdsRef.current = [];
    lastProcessedMessageRef.current = normalizedMessage;
    if (nextMotionBindings.length === 0) {
      return;
    }
    enqueueAnimationBindings(nextMotionBindings);
  }, [durationMs, isTyping, latestMessage, modelType, motionBindings]);

  useEffect(() => {
    const activeMotionBinding = activeMotionBindingRef.current;
    if (!activeMotionBinding || timerRef.current === null) {
      return;
    }

    const remainingPlaybackCount = 1 + queuedMotionBindingsRef.current.length;
    const nextPlaybackDurationMs = resolveQueuedMotionBindingPlaybackDurationMs(
      activeMotionBinding,
      remainingPlaybackCount,
    );
    if (nextPlaybackDurationMs <= activeMotionPlaybackDurationMsRef.current + 50) {
      return;
    }

    const now = window.performance?.now?.() ?? Date.now();
    const elapsedMs = Math.max(0, now - activeMotionStartedAtMsRef.current);
    const remainingMs = nextPlaybackDurationMs - elapsedMs;
    if (remainingMs <= 50) {
      return;
    }

    window.clearTimeout(timerRef.current);
    activeMotionPlaybackDurationMsRef.current = nextPlaybackDurationMs;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      activeMotionBindingRef.current = null;
      if (queuedMotionBindingsRef.current.length === 0) {
        setActiveMotionBinding(null);
        return;
      }

      playNextQueuedMotionBinding();
    }, remainingMs);
  }, [durationMs, motionClipDurationVersion]);

  useEffect(() => {
    const shouldSkipTrigger = !canModelTypeUseMotionBindings(modelType)
      || motionBindings.length === 0
      || !animationToolTrigger
      || lastAnimationToolTriggerTokenRef.current === animationToolTrigger.token;
    if (shouldSkipTrigger) {
      return;
    }
    lastAnimationToolTriggerTokenRef.current = animationToolTrigger.token;
    const triggerPlayback = handleAnimationToolTriggerPlayback({
      animationToolTrigger,
      enqueueAnimationBindings,
      lastReplayableTrigger: lastReplayableAnimationToolTrigger,
      motionBindings,
      resetMotionPlayback,
      scheduledTriggerTimeoutsRef,
    });
    if (triggerPlayback.handled) {
      queuedStreamingAnimationIdsRef.current = [];
      if (triggerPlayback.status) {
        setAnimationToolPerformanceRuntimeState({
          itemCount: triggerPlayback.itemCount ?? 0,
          petId,
          status: triggerPlayback.status,
          token: animationToolTrigger.token, triggerKind: triggerPlayback.triggerKind,
        });
      }
    }
  }, [animationToolTrigger, durationMs, lastReplayableAnimationToolTrigger, modelType, motionBindings, petId]);

  return createPetMessageAnimationPlaybackState(
    activeMotionBinding,
    expressionPlayback.activeExpressionBinding,
  );
}
