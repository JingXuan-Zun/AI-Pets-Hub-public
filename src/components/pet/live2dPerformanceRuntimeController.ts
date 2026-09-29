import { pushFrontendRuntimeError } from '../../frontendRuntimeLogger';
import { type PetAction } from '../../types';
import { type Live2DPointerLookSource } from './live2dPointerLookTarget';
import { resolveLive2DHoverPerformanceCue } from './live2dHoverPerformanceCue';
import {
  resolveLive2DRuntimeProfile,
  type Live2DParameterSemantic,
  type ResolvedLive2DRuntimeProfile,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';

type Live2DCoreModelLike = {
  getParameterDefaultValue?: (parameterIndex: number) => number;
  getParameterIndex?: (parameterId: string) => number;
  getParameterMaximumValue?: (parameterIndex: number) => number;
  getParameterMinimumValue?: (parameterIndex: number) => number;
  setParameterValueById?: (parameterId: string, value: number, weight?: number) => void;
  setParameterValueByIndex?: (parameterIndex: number, value: number, weight?: number) => void;
};

type Live2DInternalModelLike = {
  coreModel?: Live2DCoreModelLike;
  off?: (eventName: string, listener: (timestampMs?: number) => void) => void;
  on?: (eventName: string, listener: (timestampMs?: number) => void) => void;
  removeListener?: (eventName: string, listener: (timestampMs?: number) => void) => void;
};

type Live2DPerformanceRuntimeModel = {
  internalModel?: Live2DInternalModelLike;
};

export type Live2DPerformanceRuntimeState = {
  action: PetAction;
  expressionAction: PetAction | null;
  hoverRegion: string | null;
  isDragging: boolean;
  isMoving: boolean;
  lookSource: Live2DPointerLookSource;
  manualExpressionActive: boolean;
  manualMotionActive: boolean;
  pointerLookStrength: number;
  visible: boolean;
};

type Live2DPerformanceRuntimeContext = {
  modelUrl: string;
  petId: string;
  runtimeProfile?: ResolvedLive2DRuntimeProfile;
};

type Live2DPerformanceParameterBinding = {
  defaultValue: number;
  id: string;
  index: number;
  max: number;
  min: number;
};

const LIVE2D_PERFORMANCE_FRAME_MS = 1000 / 60;
const LIVE2D_BLINK_CYCLE_MS = 4200;
const LIVE2D_BLINK_CLOSE_MS = 72;
const LIVE2D_BLINK_OPEN_MS = 118;

const LIVE2D_PERFORMANCE_PARAMETER_SEMANTICS = {
  bodyAngleY: 'bodySwayY',
  bodyAngleZ: 'bodySwayZ',
  breath: 'breath',
  eyeLOpen: 'eyeLOpen',
  eyeROpen: 'eyeROpen',
} as const;

type Live2DPerformanceParameterKey = keyof typeof LIVE2D_PERFORMANCE_PARAMETER_SEMANTICS;

const DEFAULT_PERFORMANCE_STATE: Live2DPerformanceRuntimeState = {
  action: 'IDLE',
  expressionAction: null,
  hoverRegion: null,
  isDragging: false,
  isMoving: false,
  lookSource: 'center',
  manualExpressionActive: false,
  manualMotionActive: false,
  pointerLookStrength: 1,
  visible: true,
};

function clampLive2DPerformanceValue(value: number, binding: Live2DPerformanceParameterBinding) {
  return Math.max(binding.min, Math.min(binding.max, value));
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function easeInOutSine(value: number) {
  const clampedValue = clamp01(value);
  return -(Math.cos(Math.PI * clampedValue) - 1) / 2;
}

function resolveHashOffsetMs(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash % LIVE2D_BLINK_CYCLE_MS;
}

function resolveLive2DPerformanceNowMs() {
  return window.performance?.now?.() ?? Date.now();
}

function resolveLive2DPerformanceParameterBinding(
  coreModel: Live2DCoreModelLike,
  candidateIds: readonly string[],
): Live2DPerformanceParameterBinding | null {
  for (const id of candidateIds) {
    const index = coreModel.getParameterIndex?.(id) ?? -1;
    if (!Number.isInteger(index) || index < 0) {
      continue;
    }

    const min = coreModel.getParameterMinimumValue?.(index) ?? -Infinity;
    const max = coreModel.getParameterMaximumValue?.(index) ?? Infinity;
    const defaultValue = coreModel.getParameterDefaultValue?.(index) ?? 0;
    return {
      defaultValue: Number.isFinite(defaultValue) ? defaultValue : 0,
      id,
      index,
      max: Number.isFinite(max) ? max : Infinity,
      min: Number.isFinite(min) ? min : -Infinity,
    };
  }

  return null;
}

function resolveLive2DPerformanceParameterBindings(
  coreModel: Live2DCoreModelLike,
  runtimeProfile: ResolvedLive2DRuntimeProfile,
) {
  return Object.fromEntries(
    (Object.entries(LIVE2D_PERFORMANCE_PARAMETER_SEMANTICS) as Array<[
      Live2DPerformanceParameterKey,
      Live2DParameterSemantic,
    ]>).map(([key, semantic]) => {
      const parameter = runtimeProfile.parameters[semantic];
      const capabilityEnabled = key === 'bodyAngleY' || key === 'bodyAngleZ'
        ? runtimeProfile.capabilities.bodySway
        : key === 'breath'
          ? runtimeProfile.capabilities.breathing
          : true;
      return [
        key,
        capabilityEnabled && parameter.enabled && parameter.id
          ? resolveLive2DPerformanceParameterBinding(coreModel, [parameter.id])
          : null,
      ];
    }),
  ) as Record<Live2DPerformanceParameterKey, Live2DPerformanceParameterBinding | null>;
}

function createLive2DPerformanceParameterSummary(
  bindings: Record<Live2DPerformanceParameterKey, Live2DPerformanceParameterBinding | null>,
) {
  return Object.fromEntries(
    Object.entries(bindings).map(([key, binding]) => [
      key,
      binding?.id ?? null,
    ]),
  ) as Record<Live2DPerformanceParameterKey, string | null>;
}

function writeLive2DPerformanceParameterValue(
  coreModel: Live2DCoreModelLike,
  binding: Live2DPerformanceParameterBinding | null,
  value: number,
  weight: number,
) {
  if (!binding) {
    return;
  }

  const clampedValue = clampLive2DPerformanceValue(value, binding);
  if (coreModel.setParameterValueByIndex) {
    coreModel.setParameterValueByIndex(binding.index, clampedValue, weight);
    return;
  }

  coreModel.setParameterValueById?.(binding.id, clampedValue, weight);
}

function resolvePositiveOffsetValue(
  binding: Live2DPerformanceParameterBinding | null,
  amount: number,
) {
  if (!binding) {
    return 0;
  }

  const positiveRoom = Number.isFinite(binding.max)
    ? Math.max(0, binding.max - binding.defaultValue)
    : amount;
  const resolvedAmount = Math.min(amount, positiveRoom || amount);
  return binding.defaultValue + resolvedAmount;
}

function resolveSignedOffsetValue(
  binding: Live2DPerformanceParameterBinding | null,
  amount: number,
) {
  if (!binding) {
    return 0;
  }

  const room = amount >= 0
    ? (Number.isFinite(binding.max) ? Math.max(0, binding.max - binding.defaultValue) : Math.abs(amount))
    : (Number.isFinite(binding.min) ? Math.max(0, binding.defaultValue - binding.min) : Math.abs(amount));
  const resolvedAmount = Math.sign(amount) * Math.min(Math.abs(amount), room || Math.abs(amount));
  return binding.defaultValue + resolvedAmount;
}

function resolveBlinkOpenAmount(nowMs: number, phaseOffsetMs: number) {
  const phaseMs = (nowMs + phaseOffsetMs) % LIVE2D_BLINK_CYCLE_MS;
  if (phaseMs < LIVE2D_BLINK_CLOSE_MS) {
    return 1 - easeInOutSine(phaseMs / LIVE2D_BLINK_CLOSE_MS);
  }

  if (phaseMs < LIVE2D_BLINK_CLOSE_MS + LIVE2D_BLINK_OPEN_MS) {
    return easeInOutSine((phaseMs - LIVE2D_BLINK_CLOSE_MS) / LIVE2D_BLINK_OPEN_MS);
  }

  return 1;
}

function resolvePerformanceIntensity(state: Live2DPerformanceRuntimeState) {
  if (!state.visible) {
    return 0;
  }

  if (state.isDragging) {
    return 0.18;
  }

  if (state.manualMotionActive) {
    return 0.28;
  }

  if (state.expressionAction || state.action !== 'IDLE') {
    return 0.46;
  }

  if (state.isMoving) {
    return 0.52;
  }

  return 1;
}

function writeLive2DPerformanceFrame(options: {
  allowProgrammaticBodySway: boolean;
  bindings: Record<Live2DPerformanceParameterKey, Live2DPerformanceParameterBinding | null>;
  coreModel: Live2DCoreModelLike;
  hoverCueVariantSeed: number;
  nowMs: number;
  phaseOffsetMs: number;
  runtimeProfile: ResolvedLive2DRuntimeProfile;
  state: Live2DPerformanceRuntimeState;
}) {
  const {
    allowProgrammaticBodySway,
    bindings,
    coreModel,
    hoverCueVariantSeed,
    nowMs,
    phaseOffsetMs,
    runtimeProfile,
    state,
  } = options;
  const intensity = resolvePerformanceIntensity(state);
  const breathPhase = (nowMs + phaseOffsetMs * 0.37) / 1380;
  const slowPhase = (nowMs + phaseOffsetMs * 0.23) / 2600;
  const breathWave = (Math.sin(breathPhase * Math.PI * 2) + 1) / 2;
  const slowWave = Math.sin(slowPhase * Math.PI * 2);
  const hoverCue = resolveLive2DHoverPerformanceCue(state.hoverRegion, hoverCueVariantSeed);
  const blinkOpenAmount = intensity > 0.18
    ? resolveBlinkOpenAmount(nowMs, phaseOffsetMs)
    : 1;
  const eyeWeight = state.manualExpressionActive ? 0.34 : 0.86;
  const resolveProfileAmount = (semantic: Live2DParameterSemantic, amount: number) => {
    const parameter = runtimeProfile.parameters[semantic];
    return amount * parameter.sensitivity * (parameter.invert ? -1 : 1);
  };

  writeLive2DPerformanceParameterValue(
    coreModel,
    bindings.eyeLOpen,
    resolveSignedOffsetValue(bindings.eyeLOpen, resolveProfileAmount('eyeLOpen', blinkOpenAmount - 1)),
    eyeWeight,
  );
  writeLive2DPerformanceParameterValue(
    coreModel,
    bindings.eyeROpen,
    resolveSignedOffsetValue(bindings.eyeROpen, resolveProfileAmount('eyeROpen', blinkOpenAmount - 1)),
    eyeWeight,
  );
  writeLive2DPerformanceParameterValue(
    coreModel,
    bindings.breath,
    resolvePositiveOffsetValue(
      bindings.breath,
      resolveProfileAmount('breath', (0.28 + breathWave * 0.78 + hoverCue.breathBonus) * intensity),
    ),
    runtimeProfile.parameters.breath.defaultWeight,
  );
  if (allowProgrammaticBodySway) {
    writeLive2DPerformanceParameterValue(
      coreModel,
      bindings.bodyAngleY,
      resolveSignedOffsetValue(
        bindings.bodyAngleY,
        resolveProfileAmount(
          'bodySwayY',
          slowWave * runtimeProfile.parameters.bodySwayY.defaultScale * intensity
            + hoverCue.bodyAngleYBias * intensity,
        ),
      ),
      runtimeProfile.parameters.bodySwayY.defaultWeight,
    );
    writeLive2DPerformanceParameterValue(
      coreModel,
      bindings.bodyAngleZ,
      resolveSignedOffsetValue(
        bindings.bodyAngleZ,
        resolveProfileAmount(
          'bodySwayZ',
          Math.sin((slowPhase + 0.19) * Math.PI * 2)
            * runtimeProfile.parameters.bodySwayZ.defaultScale
            * intensity
            + hoverCue.bodyAngleZBias * intensity,
        ),
      ),
      runtimeProfile.parameters.bodySwayZ.defaultWeight,
    );
  }
}

export type Live2DPerformanceRuntimeController = {
  applyImmediate: (timestampMs?: number) => void;
  destroy: () => void;
  setState: (nextState: Partial<Live2DPerformanceRuntimeState>) => void;
  summary: Record<Live2DPerformanceParameterKey, string | null>;
};

export function createLive2DPerformanceRuntimeController(
  model: Live2DPerformanceRuntimeModel,
  context: Live2DPerformanceRuntimeContext,
): Live2DPerformanceRuntimeController | null {
  const internalModel = model.internalModel;
  const coreModel = internalModel?.coreModel;
  if (!internalModel || !coreModel) {
    return null;
  }

  const runtimeProfile = context.runtimeProfile ?? resolveLive2DRuntimeProfile({ coreModel });
  const bindings = resolveLive2DPerformanceParameterBindings(coreModel, runtimeProfile);
  if (!Object.values(bindings).some(Boolean)) {
    return null;
  }

  const summary = createLive2DPerformanceParameterSummary(bindings);
  const allowProgrammaticBodySway = runtimeProfile.capabilities.bodySway;
  const phaseOffsetMs = resolveHashOffsetMs(`${context.petId}:${context.modelUrl}`);
  let destroyed = false;
  let fallbackAnimationFrameId: number | null = null;
  let lastAppliedAtMs = Number.NEGATIVE_INFINITY;
  let lastFallbackAt = 0;
  let state = { ...DEFAULT_PERFORMANCE_STATE };
  let hoverCueVariantSeed = 0;

  const destroyAfterPerformanceError = (phase: string, error: unknown) => {
    destroyed = true;
    internalModel.off?.('beforeModelUpdate', apply);
    internalModel.removeListener?.('beforeModelUpdate', apply);
    if (fallbackAnimationFrameId !== null) {
      window.cancelAnimationFrame(fallbackAnimationFrameId);
      fallbackAnimationFrameId = null;
    }
    pushFrontendRuntimeError('model', `live2d performance disabled pet=${context.petId}`, error, {
      modelUrl: context.modelUrl,
      performanceParameters: summary,
      phase,
    });
  };

  const apply = (timestampMs?: number) => {
    if (destroyed) {
      return;
    }

    try {
      const nowMs = Number.isFinite(timestampMs)
        ? timestampMs as number
        : resolveLive2DPerformanceNowMs();
      if (nowMs - lastAppliedAtMs < LIVE2D_PERFORMANCE_FRAME_MS * 0.5) {
        return;
      }
      lastAppliedAtMs = nowMs;

      writeLive2DPerformanceFrame({
        allowProgrammaticBodySway,
        bindings,
        coreModel,
        hoverCueVariantSeed,
        nowMs,
        phaseOffsetMs,
        runtimeProfile,
        state,
      });
    } catch (error) {
      destroyAfterPerformanceError('apply', error);
    }
  };

  const runFallbackFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }

    if (timestamp - lastFallbackAt >= LIVE2D_PERFORMANCE_FRAME_MS) {
      lastFallbackAt = timestamp;
      apply(timestamp);
    }
    fallbackAnimationFrameId = window.requestAnimationFrame(runFallbackFrame);
  };

  try {
    internalModel.on?.('beforeModelUpdate', apply);
    fallbackAnimationFrameId = window.requestAnimationFrame(runFallbackFrame);
  } catch (error) {
    destroyAfterPerformanceError('initialize', error);
    return null;
  }

  return {
    applyImmediate: apply,
    destroy: () => {
      destroyed = true;
      internalModel.off?.('beforeModelUpdate', apply);
      internalModel.removeListener?.('beforeModelUpdate', apply);
      if (fallbackAnimationFrameId !== null) {
        window.cancelAnimationFrame(fallbackAnimationFrameId);
      }
    },
    setState: (nextState) => {
      if (destroyed) {
        return;
      }

      const hasHoverRegionUpdate = Object.prototype.hasOwnProperty.call(nextState, 'hoverRegion');
      const nextHoverRegion = hasHoverRegionUpdate
        ? nextState.hoverRegion ?? null
        : state.hoverRegion;
      if (hasHoverRegionUpdate && nextHoverRegion !== state.hoverRegion) {
        hoverCueVariantSeed += 1;
      }

      state = {
        ...state,
        ...nextState,
        hoverRegion: nextHoverRegion,
        pointerLookStrength: Number.isFinite(nextState.pointerLookStrength)
          ? clamp01(nextState.pointerLookStrength as number)
          : state.pointerLookStrength,
      };
    },
    summary,
  };
}
