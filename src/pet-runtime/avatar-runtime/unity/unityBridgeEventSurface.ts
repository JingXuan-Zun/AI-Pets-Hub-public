import {
  resolveUnity3DInteractiveVisualBounds,
  type PetVisualBounds,
} from '../../../components/pet/petVisualBounds';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../../multiPetRoster';
import {
  type AvatarRuntimeEvent,
  type AvatarRuntimeVisualBoundsSource,
} from '../avatarRuntimeEvents';

const DEFAULT_UNITY_PET_ID = 'main';
const DEFAULT_UNITY_ERROR_MESSAGE = 'Unity runtime reported an unknown error';
const MIN_UNITY_VISUAL_BOUNDS = resolveUnity3DInteractiveVisualBounds(1, false);

type UnityBridgeEventType = AvatarRuntimeEvent['type'];
type UnityBridgeVisualBoundsPayload = Partial<PetVisualBounds>;

type UnityBridgeEventSurface =
  | {
    petId: string;
    type: 'ready';
  }
  | {
    errorMessage: string;
    petId: string;
    type: 'error';
  }
  | {
    bounds: PetVisualBounds;
    petId: string;
    source: AvatarRuntimeVisualBoundsSource;
    type: 'visual-bounds';
  }
  | {
    motionKey: string | null;
    petId: string;
    type: 'motion-state-changed';
  }
  | {
    expressionKey: string | null;
    petId: string;
    type: 'expression-state-changed';
  }
  | {
    fps: number | null;
    frameIntervalMs: number | null;
    petId: string;
    type: 'perf-stats';
  };

function normalizeUnityBridgeEventType(rawType: unknown): UnityBridgeEventType | null {
  if (typeof rawType !== 'string') {
    return null;
  }

  switch (rawType) {
    case 'ready':
    case 'visual-bounds':
    case 'motion-state-changed':
    case 'expression-state-changed':
    case 'perf-stats':
    case 'error':
      return rawType;
    case 'visualBounds':
      return 'visual-bounds';
    case 'motionStateChanged':
      return 'motion-state-changed';
    case 'expressionStateChanged':
      return 'expression-state-changed';
    case 'perfStats':
      return 'perf-stats';
    default:
      return null;
  }
}

function normalizeUnityPetId(rawPetId: unknown) {
  const normalizedPetId = typeof rawPetId === 'string' && rawPetId.trim()
    ? rawPetId.trim()
    : DEFAULT_UNITY_PET_ID;

  return normalizedPetId === DEFAULT_UNITY_PET_ID
    ? PRIMARY_DESKTOP_PET_SLOT_ID
    : normalizedPetId;
}

function normalizeOptionalString(rawValue: unknown) {
  if (rawValue == null) {
    return null;
  }

  return typeof rawValue === 'string' && rawValue.trim()
    ? rawValue.trim()
    : null;
}

function normalizeOptionalNumber(rawValue: unknown) {
  if (rawValue == null || rawValue === '') {
    return null;
  }

  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function normalizeVisualBoundsSource(rawSource: unknown): AvatarRuntimeVisualBoundsSource {
  return rawSource === 'fallback' ? 'fallback' : 'measured';
}

function resolveVisualBoundsPayload(
  payload: DesktopPetUnityBridgeEventLike,
): UnityBridgeVisualBoundsPayload | null {
  if (payload.bounds && typeof payload.bounds === 'object' && !Array.isArray(payload.bounds)) {
    return payload.bounds;
  }

  return payload;
}

function normalizeVisualBounds(
  payload: DesktopPetUnityBridgeEventLike,
): PetVisualBounds | null {
  const boundsPayload = resolveVisualBoundsPayload(payload);
  if (!boundsPayload) {
    return null;
  }

  const left = normalizeOptionalNumber(boundsPayload.left);
  const right = normalizeOptionalNumber(boundsPayload.right);
  const top = normalizeOptionalNumber(boundsPayload.top);
  const bottom = normalizeOptionalNumber(boundsPayload.bottom);

  if (left == null || right == null || top == null || bottom == null) {
    return null;
  }

  return {
    bottom: Math.max(MIN_UNITY_VISUAL_BOUNDS.bottom, Math.round(bottom)),
    left: Math.max(MIN_UNITY_VISUAL_BOUNDS.left, Math.round(left)),
    right: Math.max(MIN_UNITY_VISUAL_BOUNDS.right, Math.round(right)),
    top: Math.max(MIN_UNITY_VISUAL_BOUNDS.top, Math.round(top)),
  };
}

export function resolveUnityBridgeIgnoredEventDetails(
  payload: DesktopPetUnityBridgeEventLike | null | undefined,
) {
  return {
    petId: normalizeOptionalString(payload?.petId) ?? null,
    runtimeKind: payload?.runtimeKind ?? null,
    type: payload?.type ?? null,
  };
}

export function resolveUnityBridgeEventSurface(
  payload: DesktopPetUnityBridgeEventLike | null | undefined,
): UnityBridgeEventSurface | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const type = normalizeUnityBridgeEventType(payload.type);
  if (!type) {
    return null;
  }

  const petId = normalizeUnityPetId(payload.petId);

  if (type === 'ready') {
    return {
      petId,
      type,
    };
  }

  if (type === 'error') {
    return {
      errorMessage: normalizeOptionalString(payload.errorMessage ?? payload.message)
        ?? DEFAULT_UNITY_ERROR_MESSAGE,
      petId,
      type,
    };
  }

  if (type === 'visual-bounds') {
    const bounds = normalizeVisualBounds(payload);
    if (!bounds) {
      return null;
    }

    return {
      bounds,
      petId,
      source: normalizeVisualBoundsSource(payload.source),
      type,
    };
  }

  if (type === 'motion-state-changed') {
    return {
      motionKey: normalizeOptionalString(payload.motionKey),
      petId,
      type,
    };
  }

  if (type === 'expression-state-changed') {
    return {
      expressionKey: normalizeOptionalString(payload.expressionKey),
      petId,
      type,
    };
  }

  return {
    fps: normalizeOptionalNumber(payload.fps),
    frameIntervalMs: normalizeOptionalNumber(payload.frameIntervalMs),
    petId,
    type,
  };
}
