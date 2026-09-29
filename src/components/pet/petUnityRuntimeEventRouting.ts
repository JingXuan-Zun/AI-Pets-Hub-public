import { type AvatarRuntimeEventListener } from '../../pet-runtime/avatar-runtime/avatarRuntimeEvents';
import { type PetVisualBounds } from './petVisualBounds';
import {
  createUnityInteractionVisualBoundsEvent,
  shouldIgnoreUnityMeasuredVisualBoundsEvent,
} from './petUnityVisualBoundsFiltering';

export function routeUnityRendererRuntimeEvent(
  event: Parameters<AvatarRuntimeEventListener>[0],
  runtimePetId: string,
  onVisualBoundsChange?: ((bounds: PetVisualBounds) => void) | null,
  scale = 1,
  isMoving = false,
) {
  if (event.petId !== runtimePetId) {
    return false;
  }

  if (event.type === 'visual-bounds') {
    if (shouldIgnoreUnityMeasuredVisualBoundsEvent(event, scale, isMoving)) {
      return false;
    }

    onVisualBoundsChange?.(
      createUnityInteractionVisualBoundsEvent(event, scale, isMoving).bounds,
    );
    return true;
  }

  return false;
}
