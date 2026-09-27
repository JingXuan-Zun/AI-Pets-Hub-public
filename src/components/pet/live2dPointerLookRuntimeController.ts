import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import {
  advanceLive2DPointerLookTrackerState,
  createLive2DPointerLookTrackerState,
  resolveLive2DPointerLookTimedPosition,
  type Live2DPointerLookTrackerState,
  type Live2DResolvedPointerLookPosition,
} from './live2dPointerLookTarget';
import {
  resolveLive2DRuntimeProfile,
  type Live2DParameterSemantic,
  type ResolvedLive2DRuntimeProfile,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';
import { resolveUnifiedLive2DDragParameterValue } from './live2dDragLookNormalization';

type Live2DCoreModelLike = {
  getParameterDefaultValue?: (parameterIndex: number) => number;
  getParameterIndex?: (parameterId: string) => number;
  getParameterMaximumValue?: (parameterIndex: number) => number;
  getParameterMinimumValue?: (parameterIndex: number) => number;
  getParameterValueByIndex?: (parameterIndex: number) => number;
  setParameterValueById?: (parameterId: string, value: number, weight?: number) => void;
  setParameterValueByIndex?: (parameterIndex: number, value: number, weight?: number) => void;
};

type Live2DInternalModelLike = {
  coreModel?: Live2DCoreModelLike;
  off?: (eventName: string, listener: (timestampMs?: number) => void) => void;
  on?: (eventName: string, listener: (timestampMs?: number) => void) => void;
  removeListener?: (eventName: string, listener: (timestampMs?: number) => void) => void;
};

type Live2DPointerLookRuntimeModel = {
  internalModel?: Live2DInternalModelLike;
};

const LIVE2D_POINTER_LOOK_EPSILON = 0.006;
const LIVE2D_POINTER_LOOK_ACTIVE_LERP = 0.42;
// Drag focus is a latched semantic direction. Move toward its full target
// quickly enough that short gestures do not release before the head reaches
// the same range as the primary pet, while retaining a smooth transition.
const LIVE2D_POINTER_LOOK_FOCUS_LERP = 0.34;
const LIVE2D_POINTER_LOOK_RETURN_LERP = 0.08;
const LIVE2D_POINTER_LOOK_FRAME_MS = 1000 / 60;
const LIVE2D_POINTER_LOOK_EVENT_WATCHDOG_MS = 120;
const LIVE2D_POINTER_LOOK_MAX_LERP_DELTA_MS = LIVE2D_POINTER_LOOK_FRAME_MS * 2;
const LIVE2D_POINTER_LOOK_INFLUENCE_LERP = 0.12;
const LIVE2D_IDLE_LOOK_SEGMENT_MS = 4200;
const LIVE2D_IDLE_LOOK_TRANSITION_RATIO = 0.34;
const LIVE2D_IDLE_REENTRY_CENTER_HOLD_MS = 700;
const LIVE2D_IDLE_REENTRY_BLEND_MS = 1800;
const LIVE2D_RUNTIME_CENTER_TARGET: Live2DResolvedPointerLookPosition = {
  source: 'center',
  x: 0,
  y: 0,
};

function resolveLive2DTimeAdjustedLerpFactor(baseFactor: number, deltaMs: number) {
  const normalizedDeltaMs = Math.max(
    0,
    Math.min(LIVE2D_POINTER_LOOK_MAX_LERP_DELTA_MS, deltaMs),
  );
  const frameRatio = normalizedDeltaMs / LIVE2D_POINTER_LOOK_FRAME_MS;

  return 1 - (1 - baseFactor) ** frameRatio;
}

export function resolveLive2DPointerLookLerpFactor(
  timedSource: Live2DResolvedPointerLookPosition['source'],
  appliedSource: Live2DResolvedPointerLookPosition['source'],
  deltaMs = LIVE2D_POINTER_LOOK_FRAME_MS,
) {
  const baseFactor = timedSource === 'center'
    ? LIVE2D_POINTER_LOOK_RETURN_LERP
    : appliedSource === 'focus'
      ? LIVE2D_POINTER_LOOK_FOCUS_LERP
      : LIVE2D_POINTER_LOOK_ACTIVE_LERP;

  return resolveLive2DTimeAdjustedLerpFactor(baseFactor, deltaMs);
}

const LIVE2D_POINTER_PARAMETER_SEMANTICS = {
  angleX: 'lookX',
  angleY: 'lookY',
  angleZ: 'headRoll',
  bodyAngleX: 'bodyTurnX',
  eyeBallX: 'eyeLookX',
  eyeBallY: 'eyeLookY',
} as const;

const LIVE2D_POINTER_PARAMETER_AXES = {
  angleX: 'x',
  angleY: 'y',
  angleZ: 'x',
  bodyAngleX: 'x',
  eyeBallX: 'x',
  eyeBallY: 'y',
} as const;

const LIVE2D_SECONDARY_HEAD_PARAMETER_CANDIDATES = {
  angleX: ['ParamAngleX2', 'PARAM_ANGLE_X_2'],
  angleY: ['ParamAngleY2', 'PARAM_ANGLE_Y_2'],
  angleZ: ['ParamAngleZ2', 'PARAM_ANGLE_Z_2'],
} as const;

type Live2DPointerParameterKey = keyof typeof LIVE2D_POINTER_PARAMETER_SEMANTICS;

type Live2DPointerParameterBinding = {
  defaultValue: number;
  id: string;
  index: number;
  max: number;
  min: number;
};

export type Live2DPointerLookRuntimeController = {
  applyImmediate: () => void;
  destroy: () => void;
  setStrength: (strength: number) => void;
  summary: Record<Live2DPointerParameterKey, string | null>;
  updateInputTarget: (lookPosition: Live2DResolvedPointerLookPosition, nowMs?: number) => void;
};

type Live2DPointerLookRuntimeContext = {
  modelUrl: string;
  onDiagnosticFrame?: (frame: Live2DPointerLookFrameDiagnostic) => void;
  petId: string;
  runtimeProfile?: ResolvedLive2DRuntimeProfile;
  startCenteredBeforeIdle?: boolean;
};

export type Live2DPointerLookFrameDiagnostic = {
  appliedSource: Live2DResolvedPointerLookPosition['source'];
  currentX: number;
  currentY: number;
  parameterInfluence: number;
  postAngleX: number | null;
  postAngleY: number | null;
  postAngleZ: number | null;
  preAngleX: number | null;
  preAngleY: number | null;
  preAngleZ: number | null;
  secondaryAngleX: number | null;
  secondaryAngleY: number | null;
  secondaryAngleZ: number | null;
  secondaryPhysicsSuppression: number;
  targetX: number;
  targetY: number;
  timedSource: Live2DResolvedPointerLookPosition['source'];
};

function clampLive2DParameterValue(value: number, binding: Live2DPointerParameterBinding) {
  return Math.max(binding.min, Math.min(binding.max, value));
}

function resolveLive2DParameterBinding(
  coreModel: Live2DCoreModelLike,
  candidateIds: readonly string[],
): Live2DPointerParameterBinding | null {
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

function resolveLive2DPointerParameterBindings(coreModel: Live2DCoreModelLike) {
  const runtimeProfile = resolveLive2DRuntimeProfile({ coreModel });
  return resolveLive2DPointerParameterBindingsForProfile(coreModel, runtimeProfile);
}

function resolveLive2DPointerParameterBindingsForProfile(
  coreModel: Live2DCoreModelLike,
  runtimeProfile: ResolvedLive2DRuntimeProfile,
) {
  return Object.fromEntries(
    (Object.entries(LIVE2D_POINTER_PARAMETER_SEMANTICS) as Array<[
      Live2DPointerParameterKey,
      Live2DParameterSemantic,
    ]>).map(([key, semantic]) => {
      const parameter = runtimeProfile.parameters[semantic];
      const capabilityEnabled = key === 'bodyAngleX'
        ? runtimeProfile.capabilities.bodyTurn
        : key === 'eyeBallX' || key === 'eyeBallY'
          ? runtimeProfile.capabilities.eyeLook
          : true;
      return [
        key,
        capabilityEnabled && parameter.enabled && parameter.id
          ? resolveLive2DParameterBinding(coreModel, [parameter.id])
          : null,
      ];
    }),
  ) as Record<Live2DPointerParameterKey, Live2DPointerParameterBinding | null>;
}

function resolveLive2DSecondaryHeadParameterBindings(coreModel: Live2DCoreModelLike) {
  return Object.fromEntries(
    Object.entries(LIVE2D_SECONDARY_HEAD_PARAMETER_CANDIDATES).map(([key, candidateIds]) => [
      key,
      resolveLive2DParameterBinding(coreModel, candidateIds),
    ]),
  ) as Record<keyof typeof LIVE2D_SECONDARY_HEAD_PARAMETER_CANDIDATES, Live2DPointerParameterBinding | null>;
}

function createLive2DPointerParameterSummary(
  bindings: Record<Live2DPointerParameterKey, Live2DPointerParameterBinding | null>,
) {
  return Object.fromEntries(
    Object.entries(bindings).map(([key, binding]) => [
      key,
      binding?.id ?? null,
    ]),
  ) as Record<Live2DPointerParameterKey, string | null>;
}

function writeLive2DParameterValue(
  coreModel: Live2DCoreModelLike,
  binding: Live2DPointerParameterBinding | null,
  value: number,
  weight: number,
) {
  if (!binding) {
    return;
  }

  const clampedValue = clampLive2DParameterValue(value, binding);
  if (coreModel.setParameterValueByIndex) {
    coreModel.setParameterValueByIndex(binding.index, clampedValue, weight);
    return;
  }

  coreModel.setParameterValueById?.(binding.id, clampedValue, weight);
}

function readLive2DParameterValue(
  coreModel: Live2DCoreModelLike,
  binding: Live2DPointerParameterBinding | null,
) {
  if (!binding || !coreModel.getParameterValueByIndex) {
    return null;
  }

  const value = coreModel.getParameterValueByIndex(binding.index);
  return Number.isFinite(value) ? value : null;
}

function resolveLive2DPointerLookNowMs() {
  return window.performance?.now?.() ?? Date.now();
}

function resolveStableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function resolveHashOffsetMs(value: string, modulo: number) {
  return resolveStableHash(value) % modulo;
}

function isLive2DPointerLookDiagnosticsEnabled() {
  if (typeof window === 'undefined') {
    return false;
  }

  return new URLSearchParams(window.location?.search ?? '').get('pointerDiagnostics') === '1';
}

function pushLive2DUpperRightTrace(
  context: Live2DPointerLookRuntimeContext,
  options: {
    appliedSource: Live2DResolvedPointerLookPosition['source'];
    lastAtMs: number;
    lastSignature: string;
    nowMs: number;
    pointerLookStrength: number;
    timedSource: Live2DResolvedPointerLookPosition['source'];
    x: number;
    y: number;
  },
): {
  lastAtMs: number;
  signature: string;
} {
  const signature = [
    options.timedSource,
    options.appliedSource,
    options.x.toFixed(2),
    options.y.toFixed(2),
  ].join(':');
  if (
    signature === options.lastSignature
    && options.nowMs - options.lastAtMs < 1200
  ) {
    return {
      lastAtMs: options.lastAtMs,
      signature: options.lastSignature,
    };
  }

  pushFrontendRuntimeLog('pointer-look', 'live2d upper-right trace runtime target', {
    appliedSource: options.appliedSource,
    modelUrl: context.modelUrl,
    petId: context.petId,
    pointerLookStrength: options.pointerLookStrength,
    timedSource: options.timedSource,
    x: Number(options.x.toFixed(3)),
    y: Number(options.y.toFixed(3)),
  });

  return {
    lastAtMs: options.nowMs,
    signature,
  };
}

function easeInOutSine(value: number) {
  const clampedValue = Math.max(0, Math.min(1, value));
  return -(Math.cos(Math.PI * clampedValue) - 1) / 2;
}

function resolveIdleLookKeyframe(seed: string, segmentIndex: number) {
  const hash = resolveStableHash(`${seed}:${segmentIndex}`);
  const idleLookTargets = [
    { x: -0.22, y: -0.06 },
    { x: -0.16, y: 0.04 },
    { x: -0.08, y: -0.02 },
    { x: 0, y: 0.03 },
    { x: 0.08, y: 0.04 },
    { x: 0.15, y: -0.02 },
    { x: 0.22, y: -0.06 },
    { x: 0.05, y: 0 },
  ];
  const centerBias = hash % 7 === 0;
  const target = idleLookTargets[hash % idleLookTargets.length] ?? { x: 0, y: 0 };

  return {
    x: centerBias ? 0 : target.x,
    y: centerBias ? 0 : target.y,
  };
}

export function resolveLive2DAutonomousIdleLookTarget(options: {
  nowMs: number;
  phaseOffsetMs?: number;
  seed: string;
}): Live2DResolvedPointerLookPosition {
  const phaseOffsetMs = Number.isFinite(options.phaseOffsetMs)
    ? options.phaseOffsetMs as number
    : 0;
  const timelineMs = Math.max(0, options.nowMs + phaseOffsetMs);
  const segmentIndex = Math.floor(timelineMs / LIVE2D_IDLE_LOOK_SEGMENT_MS);
  const segmentProgress = (timelineMs % LIVE2D_IDLE_LOOK_SEGMENT_MS) / LIVE2D_IDLE_LOOK_SEGMENT_MS;
  const transitionProgress = Math.min(1, segmentProgress / LIVE2D_IDLE_LOOK_TRANSITION_RATIO);
  const blend = easeInOutSine(transitionProgress);
  const previousTarget = resolveIdleLookKeyframe(options.seed, segmentIndex - 1);
  const nextTarget = resolveIdleLookKeyframe(options.seed, segmentIndex);

  return {
    source: 'focus',
    x: previousTarget.x + (nextTarget.x - previousTarget.x) * blend,
    y: previousTarget.y + (nextTarget.y - previousTarget.y) * blend,
  };
}

export function resolveLive2DIdleReentryTarget(
  target: Live2DResolvedPointerLookPosition,
  elapsedMs: number,
) {
  const progress = Math.max(0, Math.min(1, elapsedMs / LIVE2D_IDLE_REENTRY_BLEND_MS));
  if (progress === 0) {
    return {
      ...target,
      x: 0,
      y: 0,
    };
  }
  const blend = easeInOutSine(progress);
  return {
    ...target,
    x: target.x * blend,
    y: target.y * blend,
  };
}

function writeLive2DPointerLookFrame(options: {
  coreModel: Live2DCoreModelLike;
  currentX: number;
  currentY: number;
  parameterInfluence: number;
  pointerLookStrength: number;
  runtimeProfile: ResolvedLive2DRuntimeProfile;
  bindings: Record<Live2DPointerParameterKey, Live2DPointerParameterBinding | null>;
  useUnifiedDragRange: boolean;
}) {
  const {
    bindings,
    coreModel,
    currentX,
    currentY,
    parameterInfluence,
    pointerLookStrength,
    runtimeProfile,
    useUnifiedDragRange,
  } = options;
  const resolveWeight = (weight: number) => {
    const strengthWeight = Math.max(0.08, Math.min(1, weight * (0.36 + pointerLookStrength * 0.64)));
    return strengthWeight * Math.max(0, Math.min(1, parameterInfluence));
  };
  for (const key of Object.keys(bindings) as Live2DPointerParameterKey[]) {
    const binding = bindings[key];
    if (!binding) continue;
    const semantic = LIVE2D_POINTER_PARAMETER_SEMANTICS[key];
    const parameter = runtimeProfile.parameters[semantic];
    const axisValue = LIVE2D_POINTER_PARAMETER_AXES[key] === 'x' ? currentX : currentY;
    const value = resolveLive2DPointerParameterValue({
      axisValue,
      binding,
      parameter,
      semantic,
      useUnifiedDragRange,
    });
    writeLive2DParameterValue(
      coreModel,
      binding,
      value,
      resolveWeight(parameter.defaultWeight),
    );
  }
}

function resolveLive2DPointerParameterValue(options: {
  axisValue: number;
  binding: Live2DPointerParameterBinding;
  parameter: ResolvedLive2DRuntimeProfile['parameters'][Live2DParameterSemantic];
  semantic: Live2DParameterSemantic;
  useUnifiedDragRange: boolean;
}) {
  const { axisValue, binding, parameter, semantic, useUnifiedDragRange } = options;
  if (useUnifiedDragRange) {
    return resolveUnifiedLive2DDragParameterValue({
      axisValue,
      binding,
      fallbackScale: parameter.defaultScale,
      invert: parameter.invert,
      semantic,
    });
  }
  const profileScale = parameter.defaultScale
    * parameter.sensitivity
    * (parameter.invert ? -1 : 1);
  return binding.defaultValue + axisValue * profileScale;
}

export function resolveLive2DPointerLookParameterInfluence(options: {
  appliedSource: Live2DResolvedPointerLookPosition['source'];
  currentX: number;
  currentY: number;
  timedSource: Live2DResolvedPointerLookPosition['source'];
}) {
  if (options.timedSource === 'pointer') {
    return 1;
  }

  if (options.timedSource === 'focus') {
    return 1;
  }

  if (options.appliedSource === 'center') {
    return 1;
  }

  return 0.28;
}

export function createLive2DPointerLookRuntimeController(
  model: Live2DPointerLookRuntimeModel,
  context: Live2DPointerLookRuntimeContext,
): Live2DPointerLookRuntimeController | null {
  const internalModel = model.internalModel;
  const coreModel = internalModel?.coreModel;
  if (!internalModel || !coreModel) {
    return null;
  }

  const runtimeProfile = context.runtimeProfile ?? resolveLive2DRuntimeProfile({ coreModel });
  const bindings = context.runtimeProfile
    ? resolveLive2DPointerParameterBindingsForProfile(coreModel, runtimeProfile)
    : resolveLive2DPointerParameterBindings(coreModel);
  const secondaryHeadBindings = resolveLive2DSecondaryHeadParameterBindings(coreModel);
  if (!Object.values(bindings).some(Boolean)) {
    return null;
  }

  const summary = createLive2DPointerParameterSummary(bindings);
  let destroyed = false;
  let currentX = 0;
  let currentY = 0;
  let fallbackAnimationFrameId: number | null = null;
  let lastAppliedAtMs = Number.NEGATIVE_INFINITY;
  let lastFallbackAt = 0;
  let lastUpperRightDiagnosticAtMs = Number.NEGATIVE_INFINITY;
  let lastUpperRightDiagnosticSignature = '';
  let pointerLookStrength = 1;
  let currentParameterInfluence = 0.28;
  let shouldSettleCenterBeforeIdle = context.startCenteredBeforeIdle ?? false;
  let settledCenterAtMs: number | null = null;
  let idleReentryStartedAtMs: number | null = null;
  let trackerState: Live2DPointerLookTrackerState = createLive2DPointerLookTrackerState();
  const idleLookSeed = `${context.petId}:${context.modelUrl}:idle-look`;
  const idleLookPhaseOffsetMs = resolveHashOffsetMs(idleLookSeed, LIVE2D_IDLE_LOOK_SEGMENT_MS);

  const destroyAfterPointerLookError = (phase: string, error: unknown) => {
    destroyed = true;
    internalModel.off?.('beforeModelUpdate', apply);
    internalModel.removeListener?.('beforeModelUpdate', apply);
    if (fallbackAnimationFrameId !== null) {
      window.cancelAnimationFrame(fallbackAnimationFrameId);
      fallbackAnimationFrameId = null;
    }
    pushFrontendRuntimeError('model', `live2d pointer look disabled pet=${context.petId}`, error, {
      modelUrl: context.modelUrl,
      phase,
      pointerLookParameters: summary,
    });
  };

  const apply = (timestampMs?: number) => {
    if (destroyed) {
      return;
    }

    try {
      const nowMs = Number.isFinite(timestampMs)
        ? timestampMs as number
        : resolveLive2DPointerLookNowMs();
      const deltaMs = Number.isFinite(lastAppliedAtMs)
        ? nowMs - lastAppliedAtMs
        : LIVE2D_POINTER_LOOK_FRAME_MS;
      lastAppliedAtMs = nowMs;

      const timedTarget = resolveLive2DPointerLookTimedPosition(trackerState, nowMs);
      if (timedTarget.source !== 'center') {
        shouldSettleCenterBeforeIdle = true;
        settledCenterAtMs = null;
        idleReentryStartedAtMs = null;
      }
      const shouldUseReturnCenter = timedTarget.source === 'center'
        && shouldSettleCenterBeforeIdle;
      const autonomousIdleTarget = resolveLive2DAutonomousIdleLookTarget({
        nowMs,
        phaseOffsetMs: idleLookPhaseOffsetMs,
        seed: idleLookSeed,
      });
      const resolvedTarget = shouldUseReturnCenter
        ? LIVE2D_RUNTIME_CENTER_TARGET
        : timedTarget.source === 'center'
          ? idleReentryStartedAtMs === null
            ? autonomousIdleTarget
            : resolveLive2DIdleReentryTarget(
                autonomousIdleTarget,
                nowMs - idleReentryStartedAtMs,
              )
          : timedTarget;
      const target = resolvedTarget.source === 'pointer' && !runtimeProfile.capabilities.pointerLook
        ? LIVE2D_RUNTIME_CENTER_TARGET
        : resolvedTarget.source === 'focus' && !runtimeProfile.capabilities.dragLook
          ? LIVE2D_RUNTIME_CENTER_TARGET
          : resolvedTarget;
      if (target.x > 0.12 && target.y > 0.03) {
        const nextTraceState = pushLive2DUpperRightTrace(
          context,
          {
            appliedSource: target.source,
            lastAtMs: lastUpperRightDiagnosticAtMs,
            lastSignature: lastUpperRightDiagnosticSignature,
            nowMs,
            pointerLookStrength,
            timedSource: timedTarget.source,
            x: target.x,
            y: target.y,
          },
        );
        lastUpperRightDiagnosticAtMs = nextTraceState.lastAtMs;
        lastUpperRightDiagnosticSignature = nextTraceState.signature;
      }
      const lerpFactor = resolveLive2DPointerLookLerpFactor(
        timedTarget.source,
        target.source,
        deltaMs,
      );
      const resolvedPointerLookStrength = Math.max(0, Math.min(1, pointerLookStrength));
      const targetX = target.x * resolvedPointerLookStrength;
      const targetY = target.y * resolvedPointerLookStrength;
      currentX += (targetX - currentX) * lerpFactor;
      currentY += (targetY - currentY) * lerpFactor;

      const isSettledCenter = target.source === 'center'
        && Math.abs(currentX) < LIVE2D_POINTER_LOOK_EPSILON
        && Math.abs(currentY) < LIVE2D_POINTER_LOOK_EPSILON;

      if (target.source === 'center' && isSettledCenter) {
        currentX = 0;
        currentY = 0;
        if (settledCenterAtMs === null) {
          settledCenterAtMs = nowMs;
        } else if (nowMs - settledCenterAtMs >= LIVE2D_IDLE_REENTRY_CENTER_HOLD_MS) {
          shouldSettleCenterBeforeIdle = false;
          settledCenterAtMs = null;
          idleReentryStartedAtMs = nowMs;
        }
      }

      if (
        idleReentryStartedAtMs !== null
        && nowMs - idleReentryStartedAtMs >= LIVE2D_IDLE_REENTRY_BLEND_MS
      ) {
        idleReentryStartedAtMs = null;
      }

      const preAngleX = readLive2DParameterValue(coreModel, bindings.angleX);
      const preAngleY = readLive2DParameterValue(coreModel, bindings.angleY);
      const preAngleZ = readLive2DParameterValue(coreModel, bindings.angleZ);

      const parameterInfluenceTarget = resolveLive2DPointerLookParameterInfluence({
        appliedSource: target.source,
        currentX,
        currentY,
        timedSource: timedTarget.source,
      });
      if (timedTarget.source === 'pointer') {
        currentParameterInfluence = parameterInfluenceTarget;
      } else {
        const influenceLerpFactor = resolveLive2DTimeAdjustedLerpFactor(
          LIVE2D_POINTER_LOOK_INFLUENCE_LERP,
          deltaMs,
        );
        currentParameterInfluence += (
          parameterInfluenceTarget - currentParameterInfluence
        ) * influenceLerpFactor;
        if (Math.abs(parameterInfluenceTarget - currentParameterInfluence) < 0.001) {
          currentParameterInfluence = parameterInfluenceTarget;
        }
      }
      writeLive2DPointerLookFrame({
        bindings,
        coreModel,
        currentX,
        currentY,
        parameterInfluence: currentParameterInfluence,
        pointerLookStrength: resolvedPointerLookStrength,
        runtimeProfile,
        useUnifiedDragRange: timedTarget.source === 'focus' && target.source === 'focus',
      });
      context.onDiagnosticFrame?.({
        appliedSource: target.source,
        currentX,
        currentY,
        parameterInfluence: currentParameterInfluence,
        postAngleX: readLive2DParameterValue(coreModel, bindings.angleX),
        postAngleY: readLive2DParameterValue(coreModel, bindings.angleY),
        postAngleZ: readLive2DParameterValue(coreModel, bindings.angleZ),
        preAngleX,
        preAngleY,
        preAngleZ,
        secondaryAngleX: readLive2DParameterValue(coreModel, secondaryHeadBindings.angleX),
        secondaryAngleY: readLive2DParameterValue(coreModel, secondaryHeadBindings.angleY),
        secondaryAngleZ: readLive2DParameterValue(coreModel, secondaryHeadBindings.angleZ),
        secondaryPhysicsSuppression: 0,
        targetX,
        targetY,
        timedSource: timedTarget.source,
      });
    } catch (error) {
      destroyAfterPointerLookError('apply', error);
    }
  };

  const runFallbackFrame = (timestamp: number) => {
    if (destroyed) {
      return;
    }

    if (
      timestamp - lastFallbackAt >= LIVE2D_POINTER_LOOK_FRAME_MS
      && timestamp - lastAppliedAtMs >= LIVE2D_POINTER_LOOK_EVENT_WATCHDOG_MS
    ) {
      lastFallbackAt = timestamp;
      apply(timestamp);
    }
    fallbackAnimationFrameId = window.requestAnimationFrame(runFallbackFrame);
  };

  try {
    if (typeof internalModel.on === 'function') {
      internalModel.on('beforeModelUpdate', apply);
    }
    // Some model versions expose EventEmitter methods but do not emit
    // beforeModelUpdate reliably. Keep a watchdog so pointer look does not
    // silently disappear for only part of a multi-model scene.
    fallbackAnimationFrameId = window.requestAnimationFrame(runFallbackFrame);
  } catch (error) {
    destroyAfterPointerLookError('initialize', error);
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
    setStrength: (strength) => {
      pointerLookStrength = Number.isFinite(strength)
        ? Math.max(0, Math.min(1, strength))
        : 1;
    },
    summary,
    updateInputTarget: (lookPosition, nowMs) => {
      if (destroyed) {
        return;
      }

      try {
        trackerState = advanceLive2DPointerLookTrackerState(
          trackerState,
          lookPosition,
          Number.isFinite(nowMs) ? nowMs as number : resolveLive2DPointerLookNowMs(),
        );
      } catch (error) {
        destroyAfterPointerLookError('update-target', error);
      }
    },
  };
}
