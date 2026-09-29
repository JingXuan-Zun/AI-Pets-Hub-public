import { useCallback, useEffect, useState, type MutableRefObject } from 'react';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  getDesktopPetSlot,
} from '../../multiPetRoster';
import { type PetConfig } from '../../types';

type Position = { x: number; y: number };
type ActiveCompanionPanelRenderPosition = { petId: string; position: Position } | null;

interface UsePetContainerPanelSelectionStateOptions {
  chatActivePetId: string;
  companionRenderedPositionByIdRef: MutableRefObject<Record<string, Position>>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  isChatOpen: boolean;
  isInteractiveDialogueOpen: boolean;
  isSettingsOpen: boolean;
  setActivePetId: (petId: string) => void;
  showPetActions: boolean;
}

export function usePetContainerPanelSelectionState({
  chatActivePetId,
  companionRenderedPositionByIdRef,
  config,
  configRef,
  isChatOpen,
  isInteractiveDialogueOpen,
  isSettingsOpen,
  setActivePetId,
  showPetActions,
}: UsePetContainerPanelSelectionStateOptions) {
  const [panelPetId, setPanelPetId] = useState(() => (
    getDesktopPetSlot(config, chatActivePetId)
      ? chatActivePetId
      : PRIMARY_DESKTOP_PET_SLOT_ID
  ));
  const [activeCompanionPanelRenderPosition, setActiveCompanionPanelRenderPosition] = useState<ActiveCompanionPanelRenderPosition>(null);

  const selectPanelPet = useCallback((petId: string) => {
    const resolvedPetId = getDesktopPetSlot(configRef.current, petId)
      ? petId
      : PRIMARY_DESKTOP_PET_SLOT_ID;
    setPanelPetId(resolvedPetId);
    setActivePetId(resolvedPetId);
  }, [configRef, setActivePetId]);

  useEffect(() => {
    const resolvedPanelPetId = getDesktopPetSlot(config, panelPetId)
      ? panelPetId
      : PRIMARY_DESKTOP_PET_SLOT_ID;

    if (resolvedPanelPetId !== panelPetId) {
      setPanelPetId(resolvedPanelPetId);
    }
    if (!getDesktopPetSlot(config, chatActivePetId)) {
      setActivePetId(PRIMARY_DESKTOP_PET_SLOT_ID);
    }
  }, [chatActivePetId, config, panelPetId, setActivePetId]);

  useEffect(() => {
    if (showPetActions || isSettingsOpen || isChatOpen || isInteractiveDialogueOpen) {
      return;
    }

    const resolvedChatPetId = getDesktopPetSlot(config, chatActivePetId)
      ? chatActivePetId
      : PRIMARY_DESKTOP_PET_SLOT_ID;

    if (resolvedChatPetId !== panelPetId) {
      setPanelPetId(resolvedChatPetId);
    }
  }, [
    chatActivePetId,
    config,
    isChatOpen,
    isInteractiveDialogueOpen,
    isSettingsOpen,
    panelPetId,
    showPetActions,
  ]);

  const shouldTrackActiveCompanionPanelPosition = panelPetId !== PRIMARY_DESKTOP_PET_SLOT_ID
    && (showPetActions || isSettingsOpen || isChatOpen || isInteractiveDialogueOpen);

  useEffect(() => {
    if (!shouldTrackActiveCompanionPanelPosition) {
      setActiveCompanionPanelRenderPosition(null);
      return;
    }

    setActiveCompanionPanelRenderPosition((currentPosition) => (
      currentPosition?.petId === panelPetId
        ? currentPosition
        : null
    ));
  }, [panelPetId, shouldTrackActiveCompanionPanelPosition]);

  const handleCompanionRenderedPositionChange = useCallback((
    petId: string,
    position: Position | null,
  ) => {
    if (position) {
      companionRenderedPositionByIdRef.current[petId] = position;
    } else {
      delete companionRenderedPositionByIdRef.current[petId];
    }

    if (!shouldTrackActiveCompanionPanelPosition || petId !== panelPetId) {
      return;
    }

    setActiveCompanionPanelRenderPosition((currentPosition) => {
      if (!position) {
        return currentPosition?.petId === petId ? null : currentPosition;
      }

      if (
        currentPosition?.petId === petId
        && currentPosition.position.x === position.x
        && currentPosition.position.y === position.y
      ) {
        return currentPosition;
      }

      return { petId, position };
    });
  }, [
    companionRenderedPositionByIdRef,
    panelPetId,
    shouldTrackActiveCompanionPanelPosition,
  ]);

  return {
    activeCompanionPanelRenderPosition,
    handleCompanionRenderedPositionChange,
    panelPetId,
    selectPanelPet,
  };
}
