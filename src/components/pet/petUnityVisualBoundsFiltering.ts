import { type PetConfig } from '../../types';
import { getDesktopPetSlot } from '../../multiPetRoster';
import {
  resolveUnity3DInteractiveVisualBounds,
  type PetVisualBounds,
} from './petVisualBounds';
import { type AvatarRuntimeEvent } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';

const MIN_SCALE_FOR_UNITY_MEASURED_BOUNDS_GUARD = 1.35;
const MIN_COMPATIBLE_WIDTH_RATIO = 0.64;
const MIN_COMPATIBLE_HEIGHT_RATIO = 0.58;
const MAX_LEGACY_SCALE_ONE_WIDTH_RATIO = 1.2;
const MAX_LEGACY_SCALE_ONE_HEIGHT_RATIO = 1.2;
const MAX_INTERACTION_WIDTH_RATIO = 1.12;
const MAX_INTERACTION_HEIGHT_RATIO = 1.1;
const STABLE_UNITY_PRESENTATION_MEASURED_BOUNDS_ENABLED = false;
const LEGACY_SCALE_ONE_UNITY_BOUNDS = {
  bottom: 100,
  left: 126,
  right: 126,
  top: 145,
} satisfies PetVisualBounds;

type AvatarRuntimeVisualBoundsEvent = Extract<AvatarRuntimeEvent, { type: 'visual-bounds' }>;

function getBoundsWidth(bounds: PetVisualBounds) {
  return Math.max(1, bounds.left + bounds.right);
}

function getBoundsHeight(bounds: PetVisualBounds) {
  return Math.max(1, bounds.top + bounds.bottom);
}

function clampExtentPair(
  firstExtent: number,
  secondExtent: number,
  maxTotalExtent: number,
) {
  const safeFirstExtent = Math.max(1, Math.round(firstExtent));
  const safeSecondExtent = Math.max(1, Math.round(secondExtent));
  const safeTotalExtent = safeFirstExtent + safeSecondExtent;
  const safeMaxTotalExtent = Math.max(2, Math.round(maxTotalExtent));
  if (safeTotalExtent <= safeMaxTotalExtent) {
    return [safeFirstExtent, safeSecondExtent] as const;
  }

  const ratio = safeMaxTotalExtent / safeTotalExtent;
  const nextFirstExtent = Math.max(1, Math.round(safeFirstExtent * ratio));
  return [
    nextFirstExtent,
    Math.max(1, safeMaxTotalExtent - nextFirstExtent),
  ] as const;
}

export function isUnityMeasuredVisualBoundsTooSmallForScale(
  bounds: PetVisualBounds,
  scale: number,
  isMoving = false,
) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  if (safeScale < MIN_SCALE_FOR_UNITY_MEASURED_BOUNDS_GUARD) {
    return false;
  }

  const fallbackBounds = resolveUnity3DInteractiveVisualBounds(safeScale, isMoving);
  const looksLikeLegacyScaleOneBounds = (
    getBoundsWidth(bounds) <= getBoundsWidth(LEGACY_SCALE_ONE_UNITY_BOUNDS) * MAX_LEGACY_SCALE_ONE_WIDTH_RATIO
    && getBoundsHeight(bounds) <= getBoundsHeight(LEGACY_SCALE_ONE_UNITY_BOUNDS) * MAX_LEGACY_SCALE_ONE_HEIGHT_RATIO
  );
  if (!looksLikeLegacyScaleOneBounds) {
    return false;
  }

  const widthRatio = getBoundsWidth(bounds) / getBoundsWidth(fallbackBounds);
  const heightRatio = getBoundsHeight(bounds) / getBoundsHeight(fallbackBounds);

  return widthRatio < MIN_COMPATIBLE_WIDTH_RATIO
    || heightRatio < MIN_COMPATIBLE_HEIGHT_RATIO;
}

export function constrainUnityMeasuredVisualBoundsForInteraction(
  bounds: PetVisualBounds,
  scale: number,
  isMoving = false,
) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  const fallbackBounds = resolveUnity3DInteractiveVisualBounds(safeScale, isMoving);
  const maxWidth = getBoundsWidth(fallbackBounds) * MAX_INTERACTION_WIDTH_RATIO;
  const maxHeight = getBoundsHeight(fallbackBounds) * MAX_INTERACTION_HEIGHT_RATIO;
  const [left, right] = clampExtentPair(bounds.left, bounds.right, maxWidth);
  const [top, bottom] = clampExtentPair(bounds.top, bounds.bottom, maxHeight);

  return {
    bottom,
    left,
    right,
    top,
  } satisfies PetVisualBounds;
}

export function shouldIgnoreUnityMeasuredVisualBoundsEvent(
  event: AvatarRuntimeVisualBoundsEvent,
  scale: number,
  isMoving = false,
) {
  if (
    event.runtimeKind === 'unity'
    && event.source === 'measured'
    && !STABLE_UNITY_PRESENTATION_MEASURED_BOUNDS_ENABLED
  ) {
    return true;
  }

  return event.runtimeKind === 'unity'
    && event.source === 'measured'
    && isUnityMeasuredVisualBoundsTooSmallForScale(event.bounds, scale, isMoving);
}

export function createUnityInteractionVisualBoundsEvent(
  event: AvatarRuntimeVisualBoundsEvent,
  scale: number,
  isMoving = false,
) {
  if (event.runtimeKind !== 'unity' || event.source !== 'measured') {
    return event;
  }

  const nextBounds = constrainUnityMeasuredVisualBoundsForInteraction(event.bounds, scale, isMoving);
  if (
    nextBounds.left === event.bounds.left
    && nextBounds.right === event.bounds.right
    && nextBounds.top === event.bounds.top
    && nextBounds.bottom === event.bounds.bottom
  ) {
    return event;
  }

  return {
    ...event,
    bounds: nextBounds,
  } satisfies AvatarRuntimeVisualBoundsEvent;
}

export function shouldRouteAvatarRuntimeVisualBoundsEvent(
  event: AvatarRuntimeVisualBoundsEvent,
  config: PetConfig,
) {
  if (event.runtimeKind !== 'unity' || event.source !== 'measured') {
    return true;
  }

  if (!STABLE_UNITY_PRESENTATION_MEASURED_BOUNDS_ENABLED) {
    return false;
  }

  const slot = getDesktopPetSlot(config, event.petId);
  if (!slot || slot.modelType !== '3d') {
    return true;
  }

  return !isUnityMeasuredVisualBoundsTooSmallForScale(
    event.bounds,
    slot.scale,
    slot.currentAction === 'WALKING' || slot.currentAction === 'RUNNING' || slot.currentAction === 'SWIMMING',
  );
}
