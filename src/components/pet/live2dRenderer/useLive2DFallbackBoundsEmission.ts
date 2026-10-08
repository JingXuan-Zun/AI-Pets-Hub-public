import { useEffect, useRef, type MutableRefObject } from 'react';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type AvatarRuntimeEventListener } from '../../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type AvatarRuntimeViewport } from '../../../pet-runtime/avatar-runtime/avatarRuntimeTypes';
import { type PetVisualBounds } from '../petVisualBounds';
import { isLive2DDragReleaseProbeEnabled } from '../live2dDragProbeFlag';
import {
  createLive2DFallbackBoundsSignature,
  emitLive2DFallbackBounds,
  resolveLive2DFallbackBounds,
  summarizeLive2DViewport,
} from './live2dRendererVisualBounds';

const LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT = 160;

type FallbackBoundsValues = {
  isDragging: boolean;
  isMoving: boolean;
  modelUrl: string;
  onRuntimeEvent?: AvatarRuntimeEventListener;
  onVisualBoundsChange?: (bounds: PetVisualBounds) => void;
  renderedVisualBoundsSignatureRef: MutableRefObject<string>;
  runtimePetId: string;
  stageSize: number;
  viewport: AvatarRuntimeViewport | null;
};

type FallbackBoundsProbeState = {
  lastEmissionSignatureRef: MutableRefObject<string>;
  lastProbeSignatureRef: MutableRefObject<string>;
  probeCountRef: MutableRefObject<number>;
};

function canWriteFallbackBoundsProbe(state: FallbackBoundsProbeState) {
  return isLive2DDragReleaseProbeEnabled()
    && state.probeCountRef.current < LIVE2D_FALLBACK_BOUNDS_PROBE_LIMIT;
}

function writeFallbackBoundsProbe(state: FallbackBoundsProbeState, details: Record<string, unknown>) {
  state.probeCountRef.current += 1;
  pushFrontendRuntimeLog('drag-diagnose', 'TEMP live2d fallback bounds probe', details);
}

function probeDetails(values: FallbackBoundsValues, extra: Record<string, unknown>, reason: string) {
  return {
    ...extra,
    isDragging: values.isDragging,
    isMoving: values.isMoving,
    petId: values.runtimePetId,
    reason,
    stageSize: values.stageSize,
    viewport: summarizeLive2DViewport(values.viewport),
  };
}

function resetFallbackBoundsWhileDragging(state: FallbackBoundsProbeState, values: FallbackBoundsValues) {
  state.lastEmissionSignatureRef.current = '';
  if (canWriteFallbackBoundsProbe(state)) {
    writeFallbackBoundsProbe(state, probeDetails(values, { emitted: false, fallbackBounds: null }, 'dragging-reset'));
  }
}

function emitFallbackBoundsWhenChanged(state: FallbackBoundsProbeState, values: FallbackBoundsValues) {
  const { isMoving, modelUrl, runtimePetId, stageSize } = values;
  const fallbackBounds = resolveLive2DFallbackBounds({ isMoving, stageSize });
  if (values.renderedVisualBoundsSignatureRef.current === `${modelUrl}|${stageSize}`) {
    return;
  }
  const fallbackBoundsSignature = createLive2DFallbackBoundsSignature({
    bounds: fallbackBounds,
    isMoving,
    modelUrl,
    petId: runtimePetId,
    stageSize,
  });
  if (state.lastEmissionSignatureRef.current === fallbackBoundsSignature) {
    const skipProbeSignature = `skip|${fallbackBoundsSignature}`;
    if (canWriteFallbackBoundsProbe(state) && state.lastProbeSignatureRef.current !== skipProbeSignature) {
      state.lastProbeSignatureRef.current = skipProbeSignature;
      writeFallbackBoundsProbe(state, probeDetails(values, { emitted: false, fallbackBounds, fallbackBoundsSignature }, 'same-signature'));
    }
    return;
  }
  state.lastEmissionSignatureRef.current = fallbackBoundsSignature;

  if (canWriteFallbackBoundsProbe(state)) {
    state.lastProbeSignatureRef.current = `emit|${fallbackBoundsSignature}`;
    writeFallbackBoundsProbe(state, probeDetails(values, { emitted: true, fallbackBounds, fallbackBoundsSignature }, 'signature-changed'));
  }

  emitLive2DFallbackBounds({
    bounds: fallbackBounds,
    isMoving,
    onRuntimeEvent: values.onRuntimeEvent,
    onVisualBoundsChange: values.onVisualBoundsChange,
    petId: runtimePetId,
    stageSize,
  });
}

export function useLive2DFallbackBoundsEmission(values: FallbackBoundsValues) {
  const lastEmissionSignatureRef = useRef('');
  const probeCountRef = useRef(0);
  const lastProbeSignatureRef = useRef('');
  const {
    isDragging, isMoving, modelUrl, onRuntimeEvent, onVisualBoundsChange, runtimePetId, stageSize, viewport,
  } = values;

  useEffect(() => {
    const state = { lastEmissionSignatureRef, lastProbeSignatureRef, probeCountRef };
    if (isDragging) {
      resetFallbackBoundsWhileDragging(state, values);
      return;
    }

    emitFallbackBoundsWhenChanged(state, values);
  }, [isDragging, isMoving, modelUrl, onRuntimeEvent, onVisualBoundsChange, runtimePetId, stageSize, viewport]);
}
