import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { flushSync } from 'react-dom';
import {
  PRIMARY_DESKTOP_PET_SLOT_ID,
  applyDesktopPetSlotChanges,
  getDesktopPetSlot,
} from '../../multiPetRoster';
import {
  PetAction,
  type DesktopPetChatMode,
  type PetConfig,
  type PetConfigUpdateHandler,
  type PetModelMotionBinding,
} from '../../types';
import { resolvePetActionForMotionKey } from '../../pet-runtime/content/petModelMotionBindings';
import { isPetModelExpressionBinding } from '../../pet-runtime/content/petModelMotionBindingKinds';

type SelectedCustomMotionBindingMap = Record<string, PetModelMotionBinding | undefined>;

interface UsePetContainerActionHandlersOptions {
  addLog: (msg: string) => void;
  configRef: MutableRefObject<PetConfig>;
  fallbackPetName: string;
  onSetAction: (action: PetAction) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  openChatPanel: () => void;
  openInteractiveDialogue: () => void;
  openPetActions: () => void;
  openSettingsPanel: (tab: 'personality' | 'motion-expression') => void;
  panelPetId: string;
  selectPanelPet: (petId: string) => void;
  setChatMode: (mode: DesktopPetChatMode) => void;
  setSelectedCustomMotionByPetId: Dispatch<SetStateAction<SelectedCustomMotionBindingMap>>;
  startPetDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  suppressPetClickRef: MutableRefObject<boolean>;
}

export function usePetContainerActionHandlers({
  addLog,
  configRef,
  fallbackPetName,
  onSetAction,
  onUpdateConfig,
  openChatPanel,
  openInteractiveDialogue,
  openPetActions,
  openSettingsPanel,
  panelPetId,
  selectPanelPet,
  setChatMode,
  setSelectedCustomMotionByPetId,
  startPetDrag,
  suppressPetClickRef,
}: UsePetContainerActionHandlersOptions) {
  const openPetActionsForPet = useCallback((petId: string) => {
    flushSync(() => {
      selectPanelPet(petId);
      openPetActions();
    });
  }, [openPetActions, selectPanelPet]);

  const handlePetContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (suppressPetClickRef.current) {
      suppressPetClickRef.current = false;
      return;
    }

    openPetActionsForPet(PRIMARY_DESKTOP_PET_SLOT_ID);
  }, [openPetActionsForPet, suppressPetClickRef]);

  const handleStartPrimaryPetDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    selectPanelPet(PRIMARY_DESKTOP_PET_SLOT_ID);
    startPetDrag(event);
  }, [selectPanelPet, startPetDrag]);

  const handleCompanionPetContextMenu = useCallback((
    event: React.MouseEvent<HTMLDivElement>,
    petId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    openPetActionsForPet(petId);
  }, [openPetActionsForPet]);

  const handleOpenSingleChatPanel = useCallback(() => {
    setChatMode('single');
    openChatPanel();
  }, [openChatPanel, setChatMode]);

  const handleOpenInteractiveDialoguePanel = useCallback(() => {
    const targetPetId = panelPetId || PRIMARY_DESKTOP_PET_SLOT_ID;
    flushSync(() => {
      selectPanelPet(targetPetId);
      setChatMode('single');
    });
    openInteractiveDialogue();
  }, [openInteractiveDialogue, panelPetId, selectPanelPet, setChatMode]);

  const handleOpenGroupChatPanel = useCallback(() => {
    setChatMode('group');
    openChatPanel();
  }, [openChatPanel, setChatMode]);

  const handleOpenSettingsHomePanel = useCallback(() => {
    selectPanelPet(panelPetId || PRIMARY_DESKTOP_PET_SLOT_ID);
    openSettingsPanel('personality');
  }, [openSettingsPanel, panelPetId, selectPanelPet]);

  const handleOpenControlsPanel = useCallback(() => {
    selectPanelPet(panelPetId || PRIMARY_DESKTOP_PET_SLOT_ID);
    openSettingsPanel('motion-expression');
  }, [openSettingsPanel, panelPetId, selectPanelPet]);

  const handleSelectActivePetAction = useCallback((action: PetAction) => {
    const currentConfig = configRef.current;
    const targetPetId = panelPetId || PRIMARY_DESKTOP_PET_SLOT_ID;
    const targetSlot = getDesktopPetSlot(currentConfig, targetPetId);
    const targetPetName = targetSlot?.personality.name ?? fallbackPetName;

    setSelectedCustomMotionByPetId((previousSelections) => {
      if (!previousSelections[targetPetId]) {
        return previousSelections;
      }

      const nextSelections = { ...previousSelections };
      delete nextSelections[targetPetId];
      return nextSelections;
    });

    if (!targetSlot || targetSlot.isPrimary) {
      configRef.current = {
        ...currentConfig,
        currentAction: action,
      };
      onSetAction(action);
      return;
    }

    const nextConfig = applyDesktopPetSlotChanges(currentConfig, targetPetId, {
      currentAction: action,
    });
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
    addLog(`已切换 ${targetPetName} 动作：${action}`);
  }, [
    addLog,
    configRef,
    fallbackPetName,
    onSetAction,
    onUpdateConfig,
    panelPetId,
    setSelectedCustomMotionByPetId,
  ]);

  const handleSelectActivePetCustomMotion = useCallback((binding: PetModelMotionBinding) => {
    const targetAction = isPetModelExpressionBinding(binding)
      ? null
      : resolvePetActionForMotionKey(binding.motionKey);
    const currentConfig = configRef.current;
    const targetPetId = panelPetId || PRIMARY_DESKTOP_PET_SLOT_ID;
    const targetSlot = getDesktopPetSlot(currentConfig, targetPetId);
    const targetPetName = targetSlot?.personality.name ?? fallbackPetName;

    setSelectedCustomMotionByPetId((previousSelections) => ({
      ...previousSelections,
      [targetPetId]: binding,
    }));

    if (!targetSlot || targetSlot.isPrimary) {
      if (targetAction) {
        configRef.current = {
          ...currentConfig,
          currentAction: targetAction,
        };
        onSetAction(targetAction);
      }
      addLog(`已切换 ${targetPetName} 自定义动作：${binding.name}`);
      return;
    }

    if (!targetAction) {
      addLog(`已切换 ${targetPetName} 自定义动作：${binding.name}`);
      return;
    }

    const nextConfig = applyDesktopPetSlotChanges(currentConfig, targetPetId, {
      currentAction: targetAction,
    });
    configRef.current = nextConfig;
    onUpdateConfig(nextConfig, { normalize: false });
    addLog(`已切换 ${targetPetName} 自定义动作：${binding.name}`);
  }, [
    addLog,
    configRef,
    fallbackPetName,
    onSetAction,
    onUpdateConfig,
    panelPetId,
    setSelectedCustomMotionByPetId,
  ]);

  return {
    handleCompanionPetContextMenu,
    handleOpenControlsPanel,
    handleOpenGroupChatPanel,
    handleOpenInteractiveDialoguePanel,
    handleOpenSettingsHomePanel,
    handleOpenSingleChatPanel,
    handlePetContextMenu,
    handleSelectActivePetAction,
    handleSelectActivePetCustomMotion,
    handleStartPrimaryPetDrag,
    openPetActionsForPet,
  };
}
