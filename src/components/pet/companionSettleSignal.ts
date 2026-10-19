/**
 * "This companion is being pushed aside" signal.
 *
 * When a dropped pet overlaps another, the collision sync moves it out of the way.
 * With the regular 220ms shell transition (shared with walking) that read as a snap.
 * The collision sync marks the moved pet here right before committing the new
 * position, and the pet's layer reads it while rendering that move, so the very
 * same render already uses the longer, eased transition. Walking and dragging keep
 * their own timing.
 */
export const COMPANION_SETTLE_TRANSITION_MS = 420;
export const COMPANION_SETTLE_TRANSITION = `transform ${COMPANION_SETTLE_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), width 220ms ease, height 220ms ease`;

const settlingUntilByPetId = new Map<string, number>();

export function markCompanionSettling(petId: string) {
  settlingUntilByPetId.set(petId, performance.now() + COMPANION_SETTLE_TRANSITION_MS);
}

export function isCompanionSettling(petId: string) {
  const until = settlingUntilByPetId.get(petId);
  if (until === undefined) return false;
  if (performance.now() < until) return true;
  settlingUntilByPetId.delete(petId);
  return false;
}
