export const LIVE2D_RUNTIME_PROFILE_VERSION = 1 as const;

export type Live2DLayoutFitMode = 'canvas' | 'visible' | 'visible-overflow';

export type Live2DParameterSemantic =
  | 'bodySwayY'
  | 'bodySwayZ'
  | 'bodyTurnX'
  | 'breath'
  | 'eyeLOpen'
  | 'eyeLookX'
  | 'eyeLookY'
  | 'eyeROpen'
  | 'headRoll'
  | 'lookX'
  | 'lookY'
  | 'mouthOpen';

export type Live2DRuntimeProfileParameterConfig = {
  enabled?: boolean;
  id?: string;
  invert?: boolean;
  sensitivity?: number;
};

export type Live2DRuntimeProfileConfigV1 = {
  capabilities?: {
    bodySway?: boolean;
    bodyTurn?: boolean;
    breathing?: boolean;
    dragLook?: boolean;
    eyeLook?: boolean;
    pointerLook?: boolean;
  };
  layout?: {
    canvasAnchorX?: number;
    canvasAnchorY?: number;
    fitMode?: Live2DLayoutFitMode;
    groundAnchorX?: number;
    groundAnchorY?: number;
    interactionCenterX?: number;
    interactionCenterY?: number;
    lookAtOriginX?: number;
    lookAtOriginY?: number;
    offsetX?: number;
    offsetY?: number;
    scale?: number;
    visibleBoundsAnchorX?: number;
    visibleBoundsAnchorY?: number;
  };
  parameters?: Partial<Record<Live2DParameterSemantic, Live2DRuntimeProfileParameterConfig>>;
  profileVersion: typeof LIVE2D_RUNTIME_PROFILE_VERSION;
};

export type ResolvedLive2DRuntimeProfileParameter = {
  defaultScale: number;
  defaultWeight: number;
  enabled: boolean;
  id: string | null;
  invert: boolean;
  sensitivity: number;
};

export type ResolvedLive2DRuntimeProfile = {
  capabilities: {
    bodySway: boolean;
    bodyTurn: boolean;
    breathing: boolean;
    complexPhysicsRig: boolean;
    dragLook: boolean;
    eyeLook: boolean;
    pointerLook: boolean;
  };
  layout: Required<NonNullable<Live2DRuntimeProfileConfigV1['layout']>>;
  parameters: Record<Live2DParameterSemantic, ResolvedLive2DRuntimeProfileParameter>;
  profileVersion: typeof LIVE2D_RUNTIME_PROFILE_VERSION;
};

type Live2DCoreModelParameterLookup = {
  getParameterIndex?: (parameterId: string) => number;
};

type Live2DParameterSpec = {
  candidateIds: readonly string[];
  defaultScale: number;
  defaultWeight: number;
};

const LIVE2D_PARAMETER_SPECS: Record<Live2DParameterSemantic, Live2DParameterSpec> = {
  bodySwayY: {
    candidateIds: ['ParamBodyAngleY', 'PARAM_BODY_ANGLE_Y'],
    defaultScale: 2.1,
    defaultWeight: 0.2,
  },
  bodySwayZ: {
    candidateIds: ['ParamBodyAngleZ', 'PARAM_BODY_ANGLE_Z'],
    defaultScale: 1.22,
    defaultWeight: 0.18,
  },
  bodyTurnX: {
    candidateIds: ['ParamBodyAngleX', 'PARAM_BODY_ANGLE_X'],
    defaultScale: 22,
    defaultWeight: 0.7,
  },
  breath: {
    candidateIds: ['ParamBreath', 'PARAM_BREATH'],
    defaultScale: 1,
    defaultWeight: 0.48,
  },
  eyeLOpen: {
    candidateIds: ['ParamEyeLOpen', 'PARAM_EYE_L_OPEN'],
    defaultScale: 1,
    defaultWeight: 0.86,
  },
  eyeLookX: {
    candidateIds: ['ParamEyeBallX', 'PARAM_EYE_BALL_X'],
    defaultScale: 2,
    defaultWeight: 0.96,
  },
  eyeLookY: {
    candidateIds: ['ParamEyeBallY', 'PARAM_EYE_BALL_Y'],
    defaultScale: 1.8,
    defaultWeight: 0.96,
  },
  eyeROpen: {
    candidateIds: ['ParamEyeROpen', 'PARAM_EYE_R_OPEN'],
    defaultScale: 1,
    defaultWeight: 0.86,
  },
  headRoll: {
    candidateIds: ['HeadAngleZ', 'PARAM_HEAD_ANGLE_Z', 'ParamAngleZ', 'PARAM_ANGLE_Z'],
    defaultScale: -16,
    defaultWeight: 0.72,
  },
  lookX: {
    candidateIds: ['HeadAngleX', 'PARAM_HEAD_ANGLE_X', 'ParamAngleX', 'PARAM_ANGLE_X'],
    defaultScale: 60,
    defaultWeight: 0.92,
  },
  lookY: {
    candidateIds: ['HeadAngleY', 'PARAM_HEAD_ANGLE_Y', 'ParamAngleY', 'PARAM_ANGLE_Y'],
    defaultScale: 48,
    defaultWeight: 0.92,
  },
  mouthOpen: {
    candidateIds: ['ParamMouthOpenY', 'PARAM_MOUTH_OPEN_Y'],
    defaultScale: 1,
    defaultWeight: 0.16,
  },
};

export function resolveLive2DDefaultParameterId(
  semantic: Live2DParameterSemantic,
  declaredParameterIds: ReadonlySet<string> | null | undefined,
) {
  if (!declaredParameterIds?.size) {
    return null;
  }
  return LIVE2D_PARAMETER_SPECS[semantic].candidateIds.find((id) => declaredParameterIds.has(id)) ?? null;
}

const COMPLEX_PHYSICS_RIG_PARAMETER_IDS = [
  'HeadAngleX',
  'HeadAngleY',
  'HeadAngleZ',
  'ChestX_input',
  'ChestY_input',
  'ChestZ_input',
] as const;

const DEFAULT_LAYOUT: ResolvedLive2DRuntimeProfile['layout'] = {
  canvasAnchorX: 0.5,
  canvasAnchorY: 0.52,
  fitMode: 'visible-overflow',
  groundAnchorX: 0.5,
  groundAnchorY: 1,
  interactionCenterX: 0.5,
  interactionCenterY: 0.5,
  lookAtOriginX: 0.5,
  lookAtOriginY: 0.34,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  visibleBoundsAnchorX: 0.5,
  visibleBoundsAnchorY: 0.5,
};

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

function normalizeOptionalBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeOptionalNumber(value: unknown, min: number, max: number) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : undefined;
}

function hasParameter(coreModel: Live2DCoreModelParameterLookup, parameterId: string) {
  const index = coreModel.getParameterIndex?.(parameterId) ?? -1;
  return Number.isInteger(index) && index >= 0;
}

function resolveFirstParameterId(
  coreModel: Live2DCoreModelParameterLookup,
  candidateIds: readonly string[],
  declaredParameterIds?: ReadonlySet<string> | null,
) {
  return candidateIds.find((parameterId) => (
    (!declaredParameterIds || declaredParameterIds.has(parameterId))
    && hasParameter(coreModel, parameterId)
  )) ?? null;
}

function normalizeParameterConfig(value: unknown): Live2DRuntimeProfileParameterConfig | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const raw = value as Record<string, unknown>;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : undefined;
  const enabled = normalizeOptionalBoolean(raw.enabled);
  const invert = normalizeOptionalBoolean(raw.invert);
  const sensitivity = normalizeOptionalNumber(raw.sensitivity, 0, 4);
  if (id === undefined && enabled === undefined && invert === undefined && sensitivity === undefined) {
    return undefined;
  }

  return {
    ...(enabled === undefined ? {} : { enabled }),
    ...(id === undefined ? {} : { id }),
    ...(invert === undefined ? {} : { invert }),
    ...(sensitivity === undefined ? {} : { sensitivity }),
  };
}

export function normalizeLive2DRuntimeProfileConfig(
  value: unknown,
): Live2DRuntimeProfileConfigV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (raw.profileVersion !== LIVE2D_RUNTIME_PROFILE_VERSION) {
    return null;
  }

  const rawLayout = raw.layout && typeof raw.layout === 'object' && !Array.isArray(raw.layout)
    ? raw.layout as Record<string, unknown>
    : {};
  const fitMode = rawLayout.fitMode === 'canvas'
    || rawLayout.fitMode === 'visible'
    || rawLayout.fitMode === 'visible-overflow'
    ? rawLayout.fitMode
    : undefined;
  const layout = {
    canvasAnchorX: normalizeOptionalNumber(rawLayout.canvasAnchorX, 0, 1),
    canvasAnchorY: normalizeOptionalNumber(rawLayout.canvasAnchorY, 0, 1),
    fitMode,
    groundAnchorX: normalizeOptionalNumber(rawLayout.groundAnchorX, 0, 1),
    groundAnchorY: normalizeOptionalNumber(rawLayout.groundAnchorY, 0, 1),
    interactionCenterX: normalizeOptionalNumber(rawLayout.interactionCenterX, 0, 1),
    interactionCenterY: normalizeOptionalNumber(rawLayout.interactionCenterY, 0, 1),
    lookAtOriginX: normalizeOptionalNumber(rawLayout.lookAtOriginX, 0, 1),
    lookAtOriginY: normalizeOptionalNumber(rawLayout.lookAtOriginY, 0, 1),
    offsetX: normalizeOptionalNumber(rawLayout.offsetX, -2, 2),
    offsetY: normalizeOptionalNumber(rawLayout.offsetY, -2, 2),
    scale: normalizeOptionalNumber(rawLayout.scale, 0.1, 4),
    visibleBoundsAnchorX: normalizeOptionalNumber(rawLayout.visibleBoundsAnchorX, 0, 1),
    visibleBoundsAnchorY: normalizeOptionalNumber(rawLayout.visibleBoundsAnchorY, 0, 1),
  };
  const normalizedLayout = Object.fromEntries(
    Object.entries(layout).filter(([, item]) => item !== undefined),
  ) as Live2DRuntimeProfileConfigV1['layout'];

  const rawParameters = raw.parameters && typeof raw.parameters === 'object' && !Array.isArray(raw.parameters)
    ? raw.parameters as Record<string, unknown>
    : {};
  const parameters = Object.fromEntries(
    (Object.keys(LIVE2D_PARAMETER_SPECS) as Live2DParameterSemantic[])
      .map((semantic) => [semantic, normalizeParameterConfig(rawParameters[semantic])] as const)
      .filter((entry): entry is readonly [Live2DParameterSemantic, Live2DRuntimeProfileParameterConfig] => Boolean(entry[1])),
  ) as Live2DRuntimeProfileConfigV1['parameters'];

  const rawCapabilities = raw.capabilities && typeof raw.capabilities === 'object' && !Array.isArray(raw.capabilities)
    ? raw.capabilities as Record<string, unknown>
    : {};
  const capabilities = Object.fromEntries(
    ['bodySway', 'bodyTurn', 'breathing', 'dragLook', 'eyeLook', 'pointerLook']
      .map((key) => [key, normalizeOptionalBoolean(rawCapabilities[key])] as const)
      .filter((entry): entry is readonly [string, boolean] => entry[1] !== undefined),
  ) as Live2DRuntimeProfileConfigV1['capabilities'];

  return {
    ...(capabilities && Object.keys(capabilities).length > 0 ? { capabilities } : {}),
    ...(normalizedLayout && Object.keys(normalizedLayout).length > 0 ? { layout: normalizedLayout } : {}),
    ...(parameters && Object.keys(parameters).length > 0 ? { parameters } : {}),
    profileVersion: LIVE2D_RUNTIME_PROFILE_VERSION,
  };
}

export function resolveLive2DRuntimeProfile(options: {
  config?: Live2DRuntimeProfileConfigV1 | null;
  coreModel: Live2DCoreModelParameterLookup;
  declaredParameterIds?: ReadonlySet<string> | null;
}): ResolvedLive2DRuntimeProfile {
  const normalizedConfig = normalizeLive2DRuntimeProfileConfig(options.config) ?? {
    profileVersion: LIVE2D_RUNTIME_PROFILE_VERSION,
  };
  const declaredParameterIds = options.declaredParameterIds?.size
    ? options.declaredParameterIds
    : null;
  const complexPhysicsRig = COMPLEX_PHYSICS_RIG_PARAMETER_IDS.every((parameterId) => (
    declaredParameterIds
      ? declaredParameterIds.has(parameterId)
      : hasParameter(options.coreModel, parameterId)
  ));
  const parameters = Object.fromEntries(
    (Object.entries(LIVE2D_PARAMETER_SPECS) as Array<[Live2DParameterSemantic, Live2DParameterSpec]>)
      .map(([semantic, spec]) => {
        const configuredParameter = normalizedConfig.parameters?.[semantic];
        const candidateIds = configuredParameter?.id ? [configuredParameter.id] : spec.candidateIds;
        const enabled = configuredParameter?.enabled !== false;
        return [semantic, {
          defaultScale: spec.defaultScale,
          defaultWeight: spec.defaultWeight,
          enabled,
          id: enabled
            ? resolveFirstParameterId(
                options.coreModel,
                candidateIds,
                configuredParameter?.id ? null : declaredParameterIds,
              )
            : null,
          invert: configuredParameter?.invert ?? false,
          sensitivity: clampNumber(configuredParameter?.sensitivity, 1, 0, 4),
        }] as const;
      }),
  ) as ResolvedLive2DRuntimeProfile['parameters'];
  const autoCapabilities = {
    bodySway: Boolean(parameters.bodySwayY.id && parameters.bodySwayZ.id) && !complexPhysicsRig,
    bodyTurn: Boolean(parameters.bodyTurnX.id),
    breathing: Boolean(parameters.breath.id),
    dragLook: Boolean(parameters.lookX.id || parameters.lookY.id),
    eyeLook: Boolean(parameters.eyeLookX.id || parameters.eyeLookY.id),
    pointerLook: Boolean(parameters.lookX.id || parameters.lookY.id || parameters.eyeLookX.id || parameters.eyeLookY.id),
  };
  const supportedCapabilities = {
    bodySway: Boolean(parameters.bodySwayY.id && parameters.bodySwayZ.id),
    bodyTurn: Boolean(parameters.bodyTurnX.id),
    breathing: Boolean(parameters.breath.id),
    dragLook: Boolean(parameters.lookX.id || parameters.lookY.id),
    eyeLook: Boolean(parameters.eyeLookX.id || parameters.eyeLookY.id),
    pointerLook: Boolean(parameters.lookX.id || parameters.lookY.id || parameters.eyeLookX.id || parameters.eyeLookY.id),
  };
  const resolveCapability = (capability: keyof typeof autoCapabilities) => {
    const configuredValue = normalizedConfig.capabilities?.[capability];
    if (configuredValue === false) {
      return false;
    }
    return configuredValue === true
      ? supportedCapabilities[capability]
      : autoCapabilities[capability];
  };

  return {
    capabilities: {
      bodySway: resolveCapability('bodySway'),
      bodyTurn: resolveCapability('bodyTurn'),
      breathing: resolveCapability('breathing'),
      complexPhysicsRig,
      dragLook: resolveCapability('dragLook'),
      eyeLook: resolveCapability('eyeLook'),
      pointerLook: resolveCapability('pointerLook'),
    },
    layout: {
      ...DEFAULT_LAYOUT,
      ...(normalizedConfig.layout ?? {}),
    },
    parameters,
    profileVersion: LIVE2D_RUNTIME_PROFILE_VERSION,
  };
}
