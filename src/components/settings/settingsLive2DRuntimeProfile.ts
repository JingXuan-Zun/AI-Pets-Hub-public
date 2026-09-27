import {
  LIVE2D_RUNTIME_PROFILE_VERSION,
  normalizeLive2DRuntimeProfileConfig,
  type Live2DParameterSemantic,
  type Live2DRuntimeProfileConfigV1,
  type Live2DRuntimeProfileParameterConfig,
} from '../../pet-runtime/live2d/live2dRuntimeProfile';

export type Live2DRuntimeProfileCapability = keyof NonNullable<
  Live2DRuntimeProfileConfigV1['capabilities']
>;

export type Live2DRuntimeProfileCapabilityMode = 'auto' | 'disabled' | 'enabled';

const PROFILE_CAPABILITIES: Live2DRuntimeProfileCapability[] = [
  'bodySway',
  'bodyTurn',
  'breathing',
  'dragLook',
  'eyeLook',
  'pointerLook',
];

const PROFILE_PARAMETERS: Live2DParameterSemantic[] = [
  'bodySwayY',
  'bodySwayZ',
  'bodyTurnX',
  'breath',
  'eyeLOpen',
  'eyeLookX',
  'eyeLookY',
  'eyeROpen',
  'headRoll',
  'lookX',
  'lookY',
  'mouthOpen',
];

function createProfileBase(profile?: Live2DRuntimeProfileConfigV1 | null) {
  return normalizeLive2DRuntimeProfileConfig(profile) ?? {
    profileVersion: LIVE2D_RUNTIME_PROFILE_VERSION,
  };
}

function resolveCapabilityMode(value: boolean | undefined): Live2DRuntimeProfileCapabilityMode {
  if (value === true) {
    return 'enabled';
  }
  if (value === false) {
    return 'disabled';
  }
  return 'auto';
}

export function resolveLive2DRuntimeProfileEditorState(
  profile?: Live2DRuntimeProfileConfigV1 | null,
) {
  const normalizedProfile = createProfileBase(profile);
  const capabilities = Object.fromEntries(PROFILE_CAPABILITIES.map((capability) => (
    [capability, resolveCapabilityMode(normalizedProfile.capabilities?.[capability])]
  ))) as Record<Live2DRuntimeProfileCapability, Live2DRuntimeProfileCapabilityMode>;
  const parameters = Object.fromEntries(PROFILE_PARAMETERS.map((parameter) => (
    [parameter, {
      enabled: normalizedProfile.parameters?.[parameter]?.enabled !== false,
      id: normalizedProfile.parameters?.[parameter]?.id ?? '',
      invert: normalizedProfile.parameters?.[parameter]?.invert ?? false,
      sensitivity: normalizedProfile.parameters?.[parameter]?.sensitivity ?? 1,
    }]
  ))) as Record<Live2DParameterSemantic, Required<Live2DRuntimeProfileParameterConfig>>;

  return {
    canvasAnchorX: normalizedProfile.layout?.canvasAnchorX ?? 0.5,
    canvasAnchorY: normalizedProfile.layout?.canvasAnchorY ?? 0.52,
    capabilities,
    fitMode: normalizedProfile.layout?.fitMode ?? 'visible-overflow',
    offsetX: normalizedProfile.layout?.offsetX ?? 0,
    offsetY: normalizedProfile.layout?.offsetY ?? 0,
    parameters,
    scale: normalizedProfile.layout?.scale ?? 1,
    visibleBoundsAnchorX: normalizedProfile.layout?.visibleBoundsAnchorX ?? 0.5,
    visibleBoundsAnchorY: normalizedProfile.layout?.visibleBoundsAnchorY ?? 0.5,
  };
}

export function updateLive2DRuntimeProfileLayout(
  profile: Live2DRuntimeProfileConfigV1 | null | undefined,
  updates: Partial<NonNullable<Live2DRuntimeProfileConfigV1['layout']>>,
) {
  const currentProfile = createProfileBase(profile);
  return createProfileBase({
    ...currentProfile,
    layout: {
      ...currentProfile.layout,
      ...updates,
    },
  });
}

export function updateLive2DRuntimeProfileParameter(
  profile: Live2DRuntimeProfileConfigV1 | null | undefined,
  parameter: Live2DParameterSemantic,
  updates: Partial<Live2DRuntimeProfileParameterConfig>,
) {
  const currentProfile = createProfileBase(profile);
  return createProfileBase({
    ...currentProfile,
    parameters: {
      ...currentProfile.parameters,
      [parameter]: {
        ...currentProfile.parameters?.[parameter],
        ...updates,
      },
    },
  });
}

export function updateLive2DRuntimeProfileCapability(
  profile: Live2DRuntimeProfileConfigV1 | null | undefined,
  capability: Live2DRuntimeProfileCapability,
  mode: Live2DRuntimeProfileCapabilityMode,
) {
  const currentProfile = createProfileBase(profile);
  return createProfileBase({
    ...currentProfile,
    capabilities: {
      ...currentProfile.capabilities,
      [capability]: mode === 'auto' ? undefined : mode === 'enabled',
    },
  });
}
