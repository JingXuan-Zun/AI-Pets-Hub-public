import { type PetModelMotionKey } from '../../../types';
import {
  type AvatarRuntimeDragState,
  type AvatarRuntimeFocusTarget,
  type AvatarRuntimeHoverState,
  type AvatarRuntimePresentationMode,
  type AvatarRuntimeViewport,
} from '../avatarRuntimeTypes';

const DEFAULT_UNITY_PET_ID = 'main';
const DEFAULT_LOOK_AT_Y = 4;
const LOOK_AT_HORIZONTAL_DIVISOR = 35;
const LOOK_AT_VERTICAL_DIVISOR = 56;
const MAX_LOOK_AT_X = 0.8;
const MAX_LOOK_AT_Y_OFFSET = 0.65;

type ResolveUnityAvatarRuntimeCommandSurfaceOptions = {
  expressionKey?: string | null;
  focusTarget?: AvatarRuntimeFocusTarget | null;
  hoverState?: AvatarRuntimeHoverState | null;
  dragState?: AvatarRuntimeDragState | null;
  modelUrl: string;
  motionKey?: PetModelMotionKey | null;
  petId?: string | null;
  presentationMode?: AvatarRuntimePresentationMode;
  scale?: number;
  visible?: boolean;
  viewport?: AvatarRuntimeViewport | null;
  viseme?: string | null;
};

type UnityAvatarRuntimeCommandSurface = {
  dragActive: boolean;
  dragDeltaX: number;
  dragDeltaY: number;
  expressionKey: string;
  hoverRegion: string;
  lookAtX: number;
  lookAtY: number;
  modelUrl: string;
  motionKey: PetModelMotionKey;
  petId: string;
  presentationMode: AvatarRuntimePresentationMode;
  scale: number;
  screenHeight: number;
  screenWidth: number;
  visible: boolean;
  viewportHeight: number;
  viewportWidth: number;
  viewportX: number;
  viewportY: number;
  viseme: string;
};

function normalizeUnityPetId(petId?: string | null) {
  return typeof petId === 'string' && petId.trim()
    ? petId.trim()
    : DEFAULT_UNITY_PET_ID;
}

function normalizeLookAtTarget(focusTarget?: AvatarRuntimeFocusTarget | null) {
  const rawX = Number(focusTarget?.x);
  const rawY = Number(focusTarget?.y);
  const lookAtX = Number.isFinite(rawX)
    ? Math.max(-MAX_LOOK_AT_X, Math.min(MAX_LOOK_AT_X, rawX / LOOK_AT_HORIZONTAL_DIVISOR))
    : 0;
  const lookAtYOffset = Number.isFinite(rawY)
    ? Math.max(-MAX_LOOK_AT_Y_OFFSET, Math.min(MAX_LOOK_AT_Y_OFFSET, -rawY / LOOK_AT_VERTICAL_DIVISOR))
    : 0;

  return {
    lookAtX: Number(lookAtX.toFixed(3)),
    lookAtY: Number((DEFAULT_LOOK_AT_Y + lookAtYOffset).toFixed(3)),
  };
}

function normalizeFiniteNumber(value: unknown, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function normalizeViewport(viewport?: AvatarRuntimeViewport | null) {
  const viewportOwner = typeof window === 'undefined'
    ? null
    : window;
  const screenWidth = Math.max(0, normalizeFiniteNumber(viewportOwner?.innerWidth));
  const screenHeight = Math.max(0, normalizeFiniteNumber(viewportOwner?.innerHeight));

  return {
    screenHeight,
    screenWidth,
    viewportHeight: Math.max(0, normalizeFiniteNumber(viewport?.height)),
    viewportWidth: Math.max(0, normalizeFiniteNumber(viewport?.width)),
    viewportX: normalizeFiniteNumber(viewport?.x),
    viewportY: normalizeFiniteNumber(viewport?.y),
  };
}

function normalizeDragState(dragState?: AvatarRuntimeDragState | null) {
  return {
    dragActive: Boolean(dragState?.active),
    dragDeltaX: normalizeFiniteNumber(dragState?.deltaX),
    dragDeltaY: normalizeFiniteNumber(dragState?.deltaY),
  };
}

export function resolveUnityAvatarRuntimeCommandSurface({
  dragState = null,
  expressionKey = '',
  focusTarget = null,
  hoverState = null,
  modelUrl,
  motionKey = 'idle',
  petId = DEFAULT_UNITY_PET_ID,
  presentationMode = 'default',
  scale = 1,
  visible = true,
  viewport = null,
  viseme = '',
}: ResolveUnityAvatarRuntimeCommandSurfaceOptions): UnityAvatarRuntimeCommandSurface {
  const trimmedModelUrl = modelUrl.trim();
  const normalizedPetId = normalizeUnityPetId(petId);
  const { lookAtX, lookAtY } = normalizeLookAtTarget(focusTarget);
  const normalizedDragState = normalizeDragState(dragState);
  const normalizedViewport = normalizeViewport(viewport);

  return {
    ...normalizedDragState,
    ...normalizedViewport,
    expressionKey: expressionKey.trim(),
    hoverRegion: hoverState?.activeRegion?.trim() ?? '',
    lookAtX,
    lookAtY,
    modelUrl: trimmedModelUrl,
    motionKey,
    petId: normalizedPetId,
    presentationMode,
    scale,
    visible,
    viseme: viseme.trim(),
  };
}

export function createUnityLoadAvatarCommand(
  surface: Pick<UnityAvatarRuntimeCommandSurface, 'modelUrl' | 'petId'>,
): DesktopPetUnityBridgeCommandLike {
  return {
    modelUrl: surface.modelUrl,
    petId: surface.petId,
    runtimeKind: 'unity',
    type: 'loadAvatar',
  };
}

export function createUnityLayoutCommand(
  surface: Pick<
    UnityAvatarRuntimeCommandSurface,
    | 'petId'
    | 'presentationMode'
    | 'scale'
    | 'screenHeight'
    | 'screenWidth'
    | 'viewportHeight'
    | 'viewportWidth'
    | 'viewportX'
    | 'viewportY'
  >,
): DesktopPetUnityBridgeCommandLike {
  return {
    petId: surface.petId,
    presentationMode: surface.presentationMode,
    runtimeKind: 'unity',
    scale: surface.scale,
    screenHeight: surface.screenHeight,
    screenWidth: surface.screenWidth,
    type: 'setLayout',
    viewportHeight: surface.viewportHeight,
    viewportWidth: surface.viewportWidth,
    viewportX: surface.viewportX,
    viewportY: surface.viewportY,
  };
}

export function createUnityVisibilityCommand(
  surface: Pick<UnityAvatarRuntimeCommandSurface, 'petId' | 'visible'>,
): DesktopPetUnityBridgeCommandLike {
  return {
    petId: surface.petId,
    runtimeKind: 'unity',
    type: 'setVisibility',
    visible: surface.visible,
  };
}

export function createUnityHideAvatarCommand(
  petId?: string | null,
): DesktopPetUnityBridgeCommandLike {
  return createUnityVisibilityCommand({
    petId: normalizeUnityPetId(petId),
    visible: false,
  });
}

export function createUnitySemanticStateCommand(
  surface: Pick<
    UnityAvatarRuntimeCommandSurface,
    | 'dragActive'
    | 'dragDeltaX'
    | 'dragDeltaY'
    | 'expressionKey'
    | 'hoverRegion'
    | 'lookAtX'
    | 'lookAtY'
    | 'motionKey'
    | 'petId'
    | 'viseme'
  >,
): DesktopPetUnityBridgeCommandLike {
  return {
    dragActive: surface.dragActive,
    dragDeltaX: surface.dragDeltaX,
    dragDeltaY: surface.dragDeltaY,
    expressionKey: surface.expressionKey,
    hoverRegion: surface.hoverRegion,
    lookAtX: surface.lookAtX,
    lookAtY: surface.lookAtY,
    motionKey: surface.motionKey,
    petId: surface.petId,
    runtimeKind: 'unity',
    type: 'setSemanticState',
    viseme: surface.viseme,
  };
}
