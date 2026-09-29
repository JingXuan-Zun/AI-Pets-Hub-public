import { useCallback, useMemo, type MutableRefObject } from 'react';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  getDesktopPetSlot,
} from '../../multiPetRoster';
import { type PetConfig } from '../../types';

type Position = { x: number; y: number };

interface UsePetContainerRenderCollectionsOptions {
  clampPositionToRenderedActivityArea: (position: Position, kind?: 'pet' | 'folder') => Position;
  companionRenderedPositionByIdRef: MutableRefObject<Record<string, Position>>;
  configFolders: PetConfig['folders'];
  configRef: MutableRefObject<PetConfig>;
  folderDragPreview: { folderId: string; position: Position } | null;
  petPosRef: MutableRefObject<Position>;
}

export function usePetContainerRenderCollections({
  clampPositionToRenderedActivityArea,
  companionRenderedPositionByIdRef,
  configFolders,
  configRef,
  folderDragPreview,
  petPosRef,
}: UsePetContainerRenderCollectionsOptions) {
  const resolvePetPositionForLocalTest = useCallback((petId: string) => {
    if (petId === PRIMARY_DESKTOP_PET_SLOT_ID) {
      return { ...petPosRef.current };
    }

    const renderedPosition = companionRenderedPositionByIdRef.current[petId];
    if (renderedPosition) {
      return { ...renderedPosition };
    }

    const targetSlot = getDesktopPetSlot(configRef.current, petId);
    if (!targetSlot || targetSlot.isPrimary) {
      return null;
    }

    return { ...targetSlot.position };
  }, [companionRenderedPositionByIdRef, configRef, petPosRef]);

  const folderRenderItems = useMemo(() => (
    configFolders.map((folder) => ({
      ...folder,
      renderPosition: clampPositionToRenderedActivityArea(
        folderDragPreview?.folderId === folder.id
          ? folderDragPreview.position
          : folder.position,
        'folder',
      ),
    }))
  ), [clampPositionToRenderedActivityArea, configFolders, folderDragPreview]);

  return {
    folderRenderItems,
    resolvePetPositionForLocalTest,
  };
}
