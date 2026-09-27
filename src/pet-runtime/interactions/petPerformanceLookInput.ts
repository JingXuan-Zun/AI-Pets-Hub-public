type Position = {
  x: number;
  y: number;
};

export type PetPerformanceLookInputSource = 'center' | 'focus' | 'pointer';

export type PetPerformanceLookInput = {
  source: PetPerformanceLookInputSource;
  target: Position | null;
};

function isFinitePosition(target: Position | null | undefined): target is Position {
  return Number.isFinite(target?.x) && Number.isFinite(target?.y);
}

export function resolvePetPerformanceLookInput({
  focusTarget = null,
  pointerLookTarget = null,
}: {
  focusTarget?: Position | null;
  pointerLookTarget?: Position | null;
}): PetPerformanceLookInput {
  if (isFinitePosition(pointerLookTarget)) {
    return {
      source: 'pointer',
      target: pointerLookTarget,
    };
  }

  if (isFinitePosition(focusTarget)) {
    return {
      source: 'focus',
      target: focusTarget,
    };
  }

  return {
    source: 'center',
    target: null,
  };
}
