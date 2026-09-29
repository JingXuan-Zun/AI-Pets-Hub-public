import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import { type PetAction, type PetModelMotionBinding } from '../../types';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type PetContentManifest } from '../../pet-runtime/content/petContentManifest';
import { resolveLive2DExpressionCandidates } from '../../pet-runtime/live2d/live2dRuntimeMapping';
import {
  resolveLive2DExpressionPresentationTarget,
  resolveLive2DExpressionTransitionDelayMs,
  type Live2DExpressionPresentationSource,
} from '../../pet-runtime/live2d/live2dPresentationPriority';
import {
  resetLive2DExpression,
  resolveAvailableExpressionNames,
  setFirstAvailableExpression,
  type Live2DModelLike,
} from './live2dModelRuntime';

type UseLive2DExpressionPresentationSyncOptions = {
  contentManifestOverride?: PetContentManifest | null;
  effectiveManualExpressionBinding?: PetModelMotionBinding | null;
  expressionAction?: PetAction | null;
  isDragging: boolean;
  manualMotionBinding?: PetModelMotionBinding | null;
  modelRef: MutableRefObject<Live2DModelLike | null>;
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  runtimePetId: string;
  runtimeReadyVersion: number;
};

function resolveNowMs() {
  return window.performance?.now?.() ?? Date.now();
}

export function useLive2DExpressionPresentationSync({
  contentManifestOverride = null,
  effectiveManualExpressionBinding = null,
  expressionAction = null,
  isDragging,
  manualMotionBinding = null,
  modelRef,
  modelUrl,
  onRuntimeEvent,
  runtimePetId,
  runtimeReadyVersion,
}: UseLive2DExpressionPresentationSyncOptions) {
  const appliedAtMsRef = useRef(0);
  const appliedSourceRef = useRef<Live2DExpressionPresentationSource | null>(null);
  const expressionSignatureRef = useRef('');
  const requestSerialRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);

  const emitExpressionState = useCallback((expressionKey: string | null) => {
    onRuntimeEvent?.({
      expressionKey,
      petId: runtimePetId,
      runtimeKind: 'live2d',
      type: 'expression-state-changed',
    });
  }, [onRuntimeEvent, runtimePetId]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model) {
      return undefined;
    }
    const chatTarget = resolveLive2DExpressionCandidates({
      contentManifest: contentManifestOverride,
      expressionAction,
      manualExpressionBinding: effectiveManualExpressionBinding,
      manualMotionBinding,
    });
    const target = resolveLive2DExpressionPresentationTarget({
      chatCandidates: chatTarget.candidates,
      chatExpressionKey: chatTarget.expressionKey,
      contentManifest: contentManifestOverride,
      isDragging,
    });
    const nextSignature = `${target.source}:${target.expressionKey}:${target.candidates.join('|')}`;
    if (expressionSignatureRef.current === nextSignature) {
      return undefined;
    }

    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    expressionSignatureRef.current = nextSignature;
    requestSerialRef.current += 1;
    const requestSerial = requestSerialRef.current;
    const nowMs = resolveNowMs();
    const delayMs = resolveLive2DExpressionTransitionDelayMs({
      appliedAtMs: appliedAtMsRef.current,
      nextSource: target.source,
      nowMs,
      previousSource: appliedSourceRef.current,
    });
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      void setFirstAvailableExpression({ candidates: target.candidates, model })
        .then((resolvedExpression) => {
          if (requestSerialRef.current !== requestSerial) {
            return;
          }
          if (!resolvedExpression) {
            resetLive2DExpression(model);
            pushFrontendRuntimeLog('model', `live2d expression not found pet=${runtimePetId}`, {
              availableExpressions: resolveAvailableExpressionNames(model),
              candidates: target.candidates,
              expressionKey: target.expressionKey,
              modelUrl,
              source: target.source,
            });
          }
          appliedAtMsRef.current = resolveNowMs();
          appliedSourceRef.current = target.source;
          emitExpressionState(resolvedExpression ?? target.expressionKey);
        })
        .catch((error) => {
          if (requestSerialRef.current !== requestSerial) {
            return;
          }
          pushFrontendRuntimeError('model', `live2d expression failed pet=${runtimePetId}`, error, {
            candidates: target.candidates,
            expressionKey: target.expressionKey,
            modelUrl,
            source: target.source,
          });
          emitExpressionState(null);
        });
    }, delayMs);

    return undefined;
  }, [
    contentManifestOverride,
    effectiveManualExpressionBinding,
    emitExpressionState,
    expressionAction,
    isDragging,
    manualMotionBinding,
    modelRef,
    modelUrl,
    runtimeReadyVersion,
    runtimePetId,
  ]);

  useEffect(() => () => {
    requestSerialRef.current += 1;
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
  }, []);

  return useCallback(() => {
    requestSerialRef.current += 1;
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    appliedAtMsRef.current = 0;
    appliedSourceRef.current = null;
    expressionSignatureRef.current = '';
  }, []);
}
