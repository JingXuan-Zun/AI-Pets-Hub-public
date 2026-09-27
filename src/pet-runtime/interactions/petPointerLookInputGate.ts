import { type PetHoverState } from './petHoverController';

export function resolvePetPointerLookHoverState(
  hoverState: PetHoverState,
  pointerLookEnabled: boolean,
): PetHoverState {
  if (pointerLookEnabled || hoverState.focusTarget === null) {
    return hoverState;
  }

  return {
    ...hoverState,
    focusTarget: null,
  };
}
