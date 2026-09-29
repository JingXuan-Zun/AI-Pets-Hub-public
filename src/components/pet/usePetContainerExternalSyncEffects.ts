import {
  useEffect,
  useLayoutEffect,
  type MutableRefObject,
} from 'react';
import { type DesktopPetChatController } from '../../chatState';
import {
  type PetConfig,
  type PetConfigUpdateHandler,
  type PetVisualSize,
} from '../../types';
import { PET_STATS_TICK_MS, applyPassivePetStatsTick } from './petStatsMath';

interface UsePetContainerExternalSyncEffectsOptions {
  companionStatsTickAtRef: MutableRefObject<number>;
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  onChatControllerReady?: (controller: DesktopPetChatController | null) => void;
  onPetVisualSizeChange?: (size: PetVisualSize) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  petVisualSize: PetVisualSize;
  playMessageVoice: DesktopPetChatController['playMessageVoice'];
  resolveAgentApproval: DesktopPetChatController['resolveAgentApproval'];
  resolveGroupUserAttention: DesktopPetChatController['resolveGroupUserAttention'];
  sendMessage: DesktopPetChatController['sendMessage'];
  setActivePetId: DesktopPetChatController['setActivePetId'];
  setChatMode: DesktopPetChatController['setChatMode'];
  setInputValue: DesktopPetChatController['setInputValue'];
  stopAgentRun: DesktopPetChatController['stopAgentRun'];
  stopGroupChat: DesktopPetChatController['stopGroupChat'];
  stopPetSpeech: DesktopPetChatController['stopPetSpeech'];
  setGroupChatContinuationMode: DesktopPetChatController['setGroupChatContinuationMode'];
  toggleVoiceEnabled: DesktopPetChatController['toggleVoiceEnabled'];
  toggleVoiceInput: DesktopPetChatController['toggleVoiceInput'];
}

export function usePetContainerExternalSyncEffects({
  companionStatsTickAtRef,
  config,
  configRef,
  onChatControllerReady,
  onPetVisualSizeChange,
  onUpdateConfig,
  petVisualSize,
  playMessageVoice,
  resolveAgentApproval,
  resolveGroupUserAttention,
  sendMessage,
  setActivePetId,
  setChatMode,
  setInputValue,
  stopAgentRun,
  stopGroupChat,
  stopPetSpeech,
  setGroupChatContinuationMode,
  toggleVoiceEnabled,
  toggleVoiceInput,
}: UsePetContainerExternalSyncEffectsOptions) {
  useLayoutEffect(() => {
    // Sync the shared runtime ref before passive movement effects can reuse stale config.
    configRef.current = config;
  }, [config, configRef]);

  useEffect(() => {
    companionStatsTickAtRef.current = Date.now();

    const intervalId = window.setInterval(() => {
      const currentConfig = configRef.current;
      const now = Date.now();
      const elapsedStatsMs = now - companionStatsTickAtRef.current;

      if (elapsedStatsMs < PET_STATS_TICK_MS) {
        return;
      }

      const tickMs = Math.floor(elapsedStatsMs / PET_STATS_TICK_MS) * PET_STATS_TICK_MS;
      companionStatsTickAtRef.current += tickMs;

      let hasChanges = false;
      const nextCompanionPets = currentConfig.companionPets.map((pet) => {
        if (!pet.enabled) {
          return pet;
        }

        const nextStats = applyPassivePetStatsTick(pet.stats, tickMs);
        if (
          nextStats.hunger === pet.stats.hunger
          && nextStats.fatigue === pet.stats.fatigue
          && nextStats.affection === pet.stats.affection
        ) {
          return pet;
        }

        hasChanges = true;
        return {
          ...pet,
          stats: nextStats,
        };
      });

      if (!hasChanges) {
        return;
      }

      const nextConfig = {
        ...currentConfig,
        companionPets: nextCompanionPets,
      };

      configRef.current = nextConfig;
      onUpdateConfig(nextConfig, { normalize: false });
    }, PET_STATS_TICK_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [companionStatsTickAtRef, configRef, onUpdateConfig]);

  useEffect(() => {
    if (!onChatControllerReady) {
      return;
    }

    onChatControllerReady({
      playMessageVoice,
      resolveAgentApproval,
      resolveGroupUserAttention,
      sendMessage,
      setActivePetId,
      setChatMode,
      setInputValue,
      stopAgentRun,
      stopGroupChat,
      stopPetSpeech,
      setGroupChatContinuationMode,
      toggleVoiceEnabled,
      toggleVoiceInput,
    });

    return () => {
      onChatControllerReady(null);
    };
  }, [
    onChatControllerReady,
    playMessageVoice,
    resolveAgentApproval,
    resolveGroupUserAttention,
    sendMessage,
    setActivePetId,
    setChatMode,
    setInputValue,
    stopAgentRun,
    stopGroupChat,
    stopPetSpeech,
    setGroupChatContinuationMode,
    toggleVoiceEnabled,
    toggleVoiceInput,
  ]);

  useEffect(() => {
    if (!onPetVisualSizeChange) {
      return;
    }

    onPetVisualSizeChange(petVisualSize);
  }, [onPetVisualSizeChange, petVisualSize]);
}
