import { useCallback, useState } from 'react';

type SettingsTabId = 'personality' | 'model' | 'motion-expression' | 'vision' | 'voice' | 'system';

interface UsePetPanelControllerOptions {
  onRequestChatWindow?: () => void;
  onRequestCloseChatWindow?: () => void;
  onRequestSharedStateSync?: (preferredDelayMs?: number) => void;
  onRequestSettingsWindow?: () => void;
  onSetSettingsOpen: (isOpen: boolean) => void;
  resetInteractiveChatPanelLayout: () => void;
  resetChatPanelLayout: () => void;
  useExternalChatWindow: boolean;
  useExternalSettingsWindow: boolean;
}

export function usePetPanelController({
  onRequestChatWindow,
  onRequestCloseChatWindow,
  onRequestSharedStateSync,
  onRequestSettingsWindow,
  onSetSettingsOpen,
  resetInteractiveChatPanelLayout,
  resetChatPanelLayout,
  useExternalChatWindow,
  useExternalSettingsWindow,
}: UsePetPanelControllerOptions) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showPetActions, setShowPetActions] = useState(false);
  const [isPetActionSelectorOpen, setIsPetActionSelectorOpen] = useState(false);
  const [isChatSelectorOpen, setIsChatSelectorOpen] = useState(false);
  const [isAgentSelectorOpen, setIsAgentSelectorOpen] = useState(false);
  const [isInteractiveDialogueOpen, setIsInteractiveDialogueOpen] = useState(false);
  const [localSettingsResetToken, setLocalSettingsResetToken] = useState(0);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTabId>('personality');

  const openPetActions = useCallback(() => {
    setShowPetActions(true);
    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
  }, []);

  const handleOpenChatFromSession = useCallback(() => {
    if (useExternalChatWindow) {
      setIsInteractiveDialogueOpen(false);
      setIsAgentSelectorOpen(false);
      onRequestChatWindow?.();
      return;
    }

    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    setIsInteractiveDialogueOpen(false);
    setIsChatOpen(true);
  }, [onRequestChatWindow, useExternalChatWindow]);

  const togglePetActions = useCallback(() => {
    const nextOpenState = !showPetActions;
    setShowPetActions(nextOpenState);

    if (!nextOpenState) {
      setIsPetActionSelectorOpen(false);
      setIsChatSelectorOpen(false);
      setIsAgentSelectorOpen(false);
      setIsInteractiveDialogueOpen(false);
      if (!useExternalChatWindow) {
        setIsChatOpen(false);
      }
      if (!useExternalSettingsWindow) {
        onSetSettingsOpen(false);
      }
    }
  }, [onSetSettingsOpen, showPetActions, useExternalChatWindow, useExternalSettingsWindow]);

  const openChatPanel = useCallback(() => {
    if (useExternalChatWindow) {
      setShowPetActions(false);
      setIsPetActionSelectorOpen(false);
      setIsChatSelectorOpen(false);
      setIsAgentSelectorOpen(false);
      setIsInteractiveDialogueOpen(false);
      setIsChatOpen(true);
      onRequestChatWindow?.();
      if (!useExternalSettingsWindow) {
        onSetSettingsOpen(false);
      }
      return;
    }

    setShowPetActions(true);
    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    setIsInteractiveDialogueOpen(false);
    resetChatPanelLayout();
    setIsChatOpen(true);
    if (!useExternalSettingsWindow) {
      onSetSettingsOpen(false);
    }
  }, [onRequestChatWindow, onSetSettingsOpen, resetChatPanelLayout, useExternalChatWindow, useExternalSettingsWindow]);

  const openInteractiveDialogue = useCallback(() => {
    if (useExternalChatWindow) {
      setShowPetActions(false);
      setIsPetActionSelectorOpen(false);
      setIsChatSelectorOpen(false);
      setIsAgentSelectorOpen(false);
      setIsInteractiveDialogueOpen(true);
      setIsChatOpen(true);
      onRequestChatWindow?.();
      if (!useExternalSettingsWindow) {
        onSetSettingsOpen(false);
      }
      return;
    }

    setShowPetActions(false);
    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    resetInteractiveChatPanelLayout();
    setIsInteractiveDialogueOpen(true);
    setIsChatOpen(true);
    if (!useExternalSettingsWindow) {
      onSetSettingsOpen(false);
    }
  }, [onRequestChatWindow, onSetSettingsOpen, resetInteractiveChatPanelLayout, useExternalChatWindow, useExternalSettingsWindow]);

  const openSettingsPanel = useCallback((tab: SettingsTabId = 'personality') => {
    setSettingsInitialTab(tab);

    if (useExternalSettingsWindow) {
      setShowPetActions(false);
      setIsPetActionSelectorOpen(false);
      setIsChatSelectorOpen(false);
      setIsAgentSelectorOpen(false);
      setIsInteractiveDialogueOpen(false);
      if (!useExternalChatWindow) {
        setIsChatOpen(false);
      }
      onRequestSharedStateSync?.(0);
      onRequestSettingsWindow?.();
      return;
    }

    setShowPetActions(true);
    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    setIsInteractiveDialogueOpen(false);
    setLocalSettingsResetToken((value) => value + 1);
    onSetSettingsOpen(true);
    setIsChatOpen(false);
  }, [
    onRequestSettingsWindow,
    onRequestSharedStateSync,
    onSetSettingsOpen,
    useExternalChatWindow,
    useExternalSettingsWindow,
  ]);

  const togglePetActionSelector = useCallback(() => {
    setShowPetActions(true);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    setIsPetActionSelectorOpen((currentValue) => !currentValue);
    setIsInteractiveDialogueOpen(false);
    setIsChatOpen(false);
    if (!useExternalSettingsWindow) {
      onSetSettingsOpen(false);
    }
  }, [onSetSettingsOpen, useExternalSettingsWindow]);

  const toggleChatSelector = useCallback(() => {
    setShowPetActions(true);
    setIsPetActionSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    setIsChatSelectorOpen((currentValue) => !currentValue);
    if (!useExternalSettingsWindow) {
      onSetSettingsOpen(false);
    }
  }, [onSetSettingsOpen, useExternalSettingsWindow]);

  const toggleAgentSelector = useCallback(() => {
    setShowPetActions(true);
    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen((currentValue) => !currentValue);
    setIsInteractiveDialogueOpen(false);
    setIsChatOpen(false);
    if (!useExternalSettingsWindow) {
      onSetSettingsOpen(false);
    }
  }, [onSetSettingsOpen, useExternalSettingsWindow]);

  const closeAllPetPanels = useCallback(() => {
    setIsChatOpen(false);
    if (useExternalChatWindow) {
      onRequestCloseChatWindow?.();
    }
    if (!useExternalSettingsWindow) {
      onSetSettingsOpen(false);
    }
    setIsPetActionSelectorOpen(false);
    setIsChatSelectorOpen(false);
    setIsAgentSelectorOpen(false);
    setIsInteractiveDialogueOpen(false);
    setShowPetActions(false);
  }, [onRequestCloseChatWindow, onSetSettingsOpen, useExternalChatWindow, useExternalSettingsWindow]);

  return {
    closeAllPetPanels,
    handleOpenChatFromSession,
    isAgentSelectorOpen,
    isChatOpen,
    isChatSelectorOpen,
    isInteractiveDialogueOpen,
    isPetActionSelectorOpen,
    localSettingsResetToken,
    openChatPanel,
    openInteractiveDialogue,
    openPetActions,
    openSettingsPanel,
    settingsInitialTab,
    setIsChatOpen,
    showPetActions,
    toggleChatSelector,
    toggleAgentSelector,
    togglePetActionSelector,
    togglePetActions,
  };
}
