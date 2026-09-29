import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';

type Position = { x: number; y: number };

interface UsePetContainerCompanionDragHandlersOptions {
  selectPanelPet: (petId: string) => void;
  startCompanionDrag: (
    event: ReactPointerEvent<HTMLDivElement>,
    petId: string,
    renderedPosition: Position,
  ) => void;
}

export function usePetContainerCompanionDragHandlers({
  selectPanelPet,
  startCompanionDrag,
}: UsePetContainerCompanionDragHandlersOptions) {
  const handleStartCompanionPetDrag = useCallback((
    event: ReactPointerEvent<HTMLDivElement>,
    petId: string,
    renderedPosition: Position,
  ) => {
    selectPanelPet(petId);
    startCompanionDrag(event, petId, renderedPosition);
  }, [selectPanelPet, startCompanionDrag]);

  return {
    handleStartCompanionPetDrag,
  };
}
