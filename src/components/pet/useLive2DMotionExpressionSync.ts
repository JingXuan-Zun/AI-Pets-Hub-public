import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { type PetAction, type PetModelMotionBinding } from '../../types';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { resolveLive2DMotionGroupCandidates } from '../../pet-runtime/live2d/live2dRuntimeMapping';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  LIVE2D_MOTION_PRIORITY_FORCE,
  LIVE2D_MOTION_PRIORITY_NORMAL,
  playFirstAvailableMotion,
  stopLive2DMotions,
  type Live2DModelLike,
} from './live2dModelRuntime';
import {
  canRotateLive2DIdleMotion,
  resolveLive2DIdleMotionRotationDelayMs,
  rotateLive2DMotionCandidates,
} from './live2dIdleMotionRotation';
import { resolveLive2DAvailableMotionCandidateGroups } from './live2dMotionAvailability';
import { useLive2DExpressionPresentationSync } from './useLive2DExpressionPresentationSync';

type UseLive2DMotionExpressionSyncOptions = {
  action: PetAction;
  contentManifestOverride?: PetContentManifest | null;
  effectiveManualExpressionBinding?: PetModelMotionBinding | null;
  expressionAction?: PetAction | null;
  isDragging: boolean;
  isMoving: boolean;
  manualMotionBinding?: PetModelMotionBinding | null;
  manualMotionBindingForMotion?: PetModelMotionBinding | null;
  modelRef: MutableRefObject<Live2DModelLike | null>;
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  runtimePetId: string;
  runtimeReadyVersion: number;
};

export function useLive2DMotionExpressionSync({
  action,
  contentManifestOverride = null,
  effectiveManualExpressionBinding = null,
  expressionAction = null,
  isDragging,
  isMoving,
  manualMotionBinding = null,
  manualMotionBindingForMotion = null,
  modelRef,
  modelUrl,
  onRuntimeEvent,
  runtimePetId,
  runtimeReadyVersion,
}: UseLive2DMotionExpressionSyncOptions) {
  const motionSignatureRef = useRef('');
  const idleMotionRotationTimerRef = useRef<number | null>(null);
  const resetExpressionSignature = useLive2DExpressionPresentationSync({
    contentManifestOverride,
    effectiveManualExpressionBinding,
    expressionAction,
    isDragging,
    manualMotionBinding,
    modelRef,
    modelUrl,
    onRuntimeEvent,
    runtimePetId,
    runtimeReadyVersion,
  });

  const clearIdleMotionRotationTimer = useCallback(() => {
    if (idleMotionRotationTimerRef.current === null) {
      return;
    }

    window.clearTimeout(idleMotionRotationTimerRef.current);
    idleMotionRotationTimerRef.current = null;
  }, []);

  const emitMotionState = useCallback((motionKey: string | null) => {
    onRuntimeEvent?.({
      motionKey,
      petId: runtimePetId,
      runtimeKind: 'live2d',
      type: 'motion-state-changed',
    });
  }, [onRuntimeEvent, runtimePetId]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) {
      return;
    }

    if (isDragging) {
      clearIdleMotionRotationTimer();
      if (motionSignatureRef.current !== 'dragging') {
        motionSignatureRef.current = 'dragging';
        try {
          stopLive2DMotions(model);
          emitMotionState(null);
        } catch (error) {
          pushFrontendRuntimeError('model', `live2d drag motion stop failed pet=${runtimePetId}`, error, {
            modelUrl,
          });
        }
      }
      return clearIdleMotionRotationTimer;
    }

    const { candidates, motionKey } = resolveLive2DMotionGroupCandidates({
      action,
      contentManifest: contentManifestOverride,
      isMoving,
      manualMotionBinding: manualMotionBindingForMotion,
    });
    const manualMotionActive = Boolean(manualMotionBindingForMotion);
    const availableMotionCandidates = resolveLive2DAvailableMotionCandidateGroups(model, candidates);
    const canRotateIdleMotion = canRotateLive2DIdleMotion({
      action,
      availableCandidateCount: availableMotionCandidates.length,
      isMoving,
      manualMotionActive,
    });
    const motionMode = manualMotionActive ? 'manual' : 'auto';
    const nextSignature = `${motionKey}:${motionMode}:${availableMotionCandidates.join('|')}`;
    if (motionSignatureRef.current === nextSignature) {
      return;
    }

    clearIdleMotionRotationTimer();
    motionSignatureRef.current = nextSignature;
    void playFirstAvailableMotion({
      candidates: availableMotionCandidates,
      model,
      priority: manualMotionActive ? LIVE2D_MOTION_PRIORITY_FORCE : LIVE2D_MOTION_PRIORITY_NORMAL,
    })
      .then((resolvedMotionGroup) => {
        emitMotionState(resolvedMotionGroup ?? motionKey);
      })
      .catch((error) => {
        pushFrontendRuntimeError('model', `live2d motion failed pet=${runtimePetId}`, error, {
          candidates,
          motionKey,
          modelUrl,
        });
        emitMotionState(null);
      });

    if (!canRotateIdleMotion) {
      return clearIdleMotionRotationTimer;
    }

    let disposed = false;
    let rotationTurnIndex = 1;

    const scheduleNextIdleMotionRotation = () => {
      const delayMs = resolveLive2DIdleMotionRotationDelayMs(nextSignature, rotationTurnIndex);
      idleMotionRotationTimerRef.current = window.setTimeout(() => {
        idleMotionRotationTimerRef.current = null;
        if (disposed || motionSignatureRef.current !== nextSignature) {
          return;
        }

        const rotatedCandidates = rotateLive2DMotionCandidates(availableMotionCandidates, rotationTurnIndex);
        rotationTurnIndex += 1;
        void playFirstAvailableMotion({
          candidates: rotatedCandidates,
          model,
          priority: LIVE2D_MOTION_PRIORITY_NORMAL,
        })
          .then((resolvedMotionGroup) => {
            emitMotionState(resolvedMotionGroup ?? motionKey);
          })
          .catch((error) => {
            pushFrontendRuntimeError('model', `live2d idle motion rotation failed pet=${runtimePetId}`, error, {
              candidates: rotatedCandidates,
              motionKey,
              modelUrl,
            });
            emitMotionState(null);
          })
          .finally(() => {
            if (!disposed && motionSignatureRef.current === nextSignature) {
              scheduleNextIdleMotionRotation();
            }
          });
      }, delayMs);
    };

    scheduleNextIdleMotionRotation();

    return () => {
      disposed = true;
      clearIdleMotionRotationTimer();
    };
  }, [
    action,
    clearIdleMotionRotationTimer,
    contentManifestOverride,
    emitMotionState,
    isDragging,
    isMoving,
    manualMotionBindingForMotion,
    modelRef,
    modelUrl,
    runtimeReadyVersion,
    runtimePetId,
  ]);

  return useCallback(() => {
    clearIdleMotionRotationTimer();
    motionSignatureRef.current = '';
    resetExpressionSignature();
  }, [clearIdleMotionRotationTimer, resetExpressionSignature]);
}
