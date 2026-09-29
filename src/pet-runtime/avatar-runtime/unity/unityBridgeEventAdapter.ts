import { type AvatarRuntimeEvent } from '../avatarRuntimeEvents';
import { resolveUnityBridgeEventSurface } from './unityBridgeEventSurface';

export function normalizeUnityBridgeAvatarRuntimeEvent(
  payload: DesktopPetUnityBridgeEventLike | null | undefined,
): AvatarRuntimeEvent | null {
  const surface = resolveUnityBridgeEventSurface(payload);
  if (!surface) {
    return null;
  }

  return {
    ...surface,
    runtimeKind: 'unity',
  } as AvatarRuntimeEvent;
}
