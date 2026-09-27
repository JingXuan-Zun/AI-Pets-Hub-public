import { type MutableRefObject } from 'react';
import { type DesktopPetChatMode, type PetConfig } from '../../types';
import { usePetContainerCustomMotionSelection } from './usePetContainerCustomMotionSelection';
import { usePetContainerPrimaryChatState } from './usePetContainerDerivedState';
import { usePetContainerPanelSelectionState } from './usePetContainerPanelSelectionState';

type Position = { x: number; y: number };

interface UsePetContainerSelectionChatDerivedStateOptions {
  chatActivePetId: string;
  chatMode: DesktopPetChatMode;
  companionRenderedPositionByIdRef: MutableRefObject<Record<string, Position>>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  isChatOpen: boolean;
  isInteractiveDialogueOpen: boolean;
  isSpeaking: boolean;
  isSettingsOpen: boolean;
  isTyping: boolean;
  latestPetMessage: string;
  latestPetMessages: Record<string, string>;
  pauseAutoMovement: boolean;
  setActivePetId: (petId: string) => void;
  showPetActions: boolean;
  speakingPetId: string | null;
  typingPetId: string | null;
}

export function usePetContainerSelectionChatDerivedState({
  chatActivePetId,
  chatMode,
  companionRenderedPositionByIdRef,
  config,
  configRef,
  isChatOpen,
  isInteractiveDialogueOpen,
  isSpeaking,
  isSettingsOpen,
  isTyping,
  latestPetMessage,
  latestPetMessages,
  pauseAutoMovement,
  setActivePetId,
  showPetActions,
  speakingPetId,
  typingPetId,
}: UsePetContainerSelectionChatDerivedStateOptions) {
  const customMotionSelectionState = usePetContainerCustomMotionSelection(config);
  const panelSelectionState = usePetContainerPanelSelectionState({
    chatActivePetId,
    companionRenderedPositionByIdRef,
    config,
    configRef,
    isChatOpen,
    isInteractiveDialogueOpen,
    isSettingsOpen,
    setActivePetId,
    showPetActions,
  });
  const primaryChatState = usePetContainerPrimaryChatState({
    chatMode,
    isSpeaking,
    isInteractiveDialogueOpen,
    isTyping,
    latestPetMessage,
    latestPetMessages,
    panelPetId: panelSelectionState.panelPetId,
    pauseAutoMovement,
    showPetActions,
    speakingPetId,
    typingPetId,
  });

  return {
    ...customMotionSelectionState,
    ...panelSelectionState,
    ...primaryChatState,
  };
}
