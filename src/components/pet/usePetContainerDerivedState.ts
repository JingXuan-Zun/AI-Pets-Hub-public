import { useCallback, useMemo } from 'react';
import { getChatTargetOptions } from '../chat/multiPetChat';
import { PRIMARY_DESKTOP_PET_SLOT_ID } from '../../multiPetRoster';
import { type DesktopPetChatMode, type PetConfig } from '../../types';

interface UsePetContainerPrimaryChatStateOptions {
  chatMode: DesktopPetChatMode;
  isSpeaking: boolean;
  isInteractiveDialogueOpen: boolean;
  isTyping: boolean;
  latestPetMessage: string;
  latestPetMessages: Record<string, string>;
  panelPetId: string;
  pauseAutoMovement: boolean;
  showPetActions: boolean;
  speakingPetId: string | null;
  typingPetId: string | null;
}

interface UsePetContainerPresentationStateOptions {
  config: PetConfig;
  typingPetId: string | null;
}

export function usePetContainerPrimaryChatState({
  chatMode,
  isSpeaking,
  isInteractiveDialogueOpen,
  isTyping,
  latestPetMessage,
  latestPetMessages,
  panelPetId,
  pauseAutoMovement,
  showPetActions,
  speakingPetId,
  typingPetId,
}: UsePetContainerPrimaryChatStateOptions) {
  const primaryLatestPetMessage = useMemo(() => (
    latestPetMessages[PRIMARY_DESKTOP_PET_SLOT_ID] ?? latestPetMessage
  ), [latestPetMessage, latestPetMessages]);
  const isPrimaryTyping = isTyping && typingPetId === PRIMARY_DESKTOP_PET_SLOT_ID;
  const isPrimarySpeaking = isSpeaking && speakingPetId === PRIMARY_DESKTOP_PET_SLOT_ID;
  const isInteractiveDialogueActive = isInteractiveDialogueOpen && chatMode === 'single';
  const effectiveAutoMovementPause = pauseAutoMovement || isInteractiveDialogueActive;
  const isSelectedPetMenuMovementLocked = useCallback((petId: string) => (
    showPetActions && panelPetId === petId
  ), [panelPetId, showPetActions]);

  return {
    effectiveAutoMovementPause,
    isInteractiveDialogueActive,
    isPrimarySpeaking,
    isPrimaryTyping,
    isSelectedPetMenuMovementLocked,
    primaryLatestPetMessage,
  };
}

export function usePetContainerPresentationState({
  config,
  typingPetId,
}: UsePetContainerPresentationStateOptions) {
  const petOptions = useMemo(() => getChatTargetOptions(config), [config]);
  const typingPetName = useMemo(() => (
    petOptions.find((option) => option.id === typingPetId)?.name ?? null
  ), [petOptions, typingPetId]);

  return {
    petOptions,
    typingPetName,
  };
}
