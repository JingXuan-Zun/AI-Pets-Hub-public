import { useRef } from 'react';

type Position = { x: number; y: number };

// The quick menu is placed from the pet's drawn outline. A 2D video pet's outline changes a
// little with every clip (waving, idling), which nudged the open menu a few pixels several
// times per clip change and read as flicker. While the menu is open it keeps its place
// unless the pet itself moved, or the placement changed by more than a small jitter (e.g. a
// sub-panel opening and needing room).

const JITTER_PX = 24;

export function useSteadyQuickMenuPosition(position: Position, petAnchor: Position, isOpen: boolean) {
  const steadyRef = useRef<{ anchor: Position; position: Position } | null>(null);
  const steady = steadyRef.current;
  const anchorMoved = !steady || steady.anchor.x !== petAnchor.x || steady.anchor.y !== petAnchor.y;
  const jumped = !steady
    || Math.abs(steady.position.x - position.x) > JITTER_PX
    || Math.abs(steady.position.y - position.y) > JITTER_PX;
  if (!isOpen || anchorMoved || jumped) {
    steadyRef.current = { anchor: petAnchor, position };
    return position;
  }
  return steady.position;
}
