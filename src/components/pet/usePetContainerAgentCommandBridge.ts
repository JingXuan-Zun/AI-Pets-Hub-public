import { useCallback, useEffect, useRef, type MutableRefObject } from 'react';
import {
  executeAgentChatCommand,
  type AgentChatCommand,
  type AgentChatCommandHandlerContext,
  type AgentChatCommandResult,
  type AgentRuntimeGameCompanionLoopController,
  type DesktopIconArrangementPlan,
} from '../../agent';
import {
  type AgentDesktopOrganizationAdapter,
  type AgentRuntimeDesktopIconPlacementResult,
} from '../../agent/agentRuntimeDesktopOrganizationTools';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';

type DesktopIconPlacementStarter = (
  placement: NonNullable<AgentChatCommand['desktopIconPlacement']>,
) => Promise<AgentRuntimeDesktopIconPlacementResult> | AgentRuntimeDesktopIconPlacementResult;

interface AgentRuntimeVoiceInputControllerLike {
  start: (options?: { agentPrefix?: boolean }) => Promise<AgentChatCommandResult> | AgentChatCommandResult;
  stop: () => Promise<AgentChatCommandResult> | AgentChatCommandResult;
}

interface UsePetContainerAgentCommandBridgeOptions {
  configRef: MutableRefObject<PetConfig>;
  gameCompanionLoopControllerRef: MutableRefObject<AgentRuntimeGameCompanionLoopController | null>;
  onUpdateConfig: PetConfigUpdateHandler;
}

export function usePetContainerAgentCommandBridge({
  configRef,
  gameCompanionLoopControllerRef,
  onUpdateConfig,
}: UsePetContainerAgentCommandBridgeOptions) {
  const desktopOrganizationRef = useRef<AgentDesktopOrganizationAdapter | null>(null);
  const lastDesktopOrganizationPlanRef = useRef<DesktopIconArrangementPlan | null>(null);
  const lastLocalProjectInspectionRef = useRef<DesktopPetLocalProjectInspectionLike | null>(null);
  const startDesktopIconPlacementRef = useRef<DesktopIconPlacementStarter | null>(null);
  const voiceInputControllerRef = useRef<AgentRuntimeVoiceInputControllerLike | null>(null);
  const persistAgentConfigUpdate = useCallback<PetConfigUpdateHandler>((nextConfig, options) => {
    onUpdateConfig(nextConfig, {
      ...options,
      persist: options?.persist ?? true,
    });
  }, [onUpdateConfig]);

  const handleAgentChatCommand = useCallback(async (
    command: AgentChatCommand,
    handlerContext?: AgentChatCommandHandlerContext,
  ): Promise<AgentChatCommandResult> => {
    return executeAgentChatCommand(command, {
      configRef,
      desktopOrganizationRef,
      gameCompanionLoopControllerRef,
      lastDesktopOrganizationPlanRef,
      lastLocalProjectInspectionRef,
      onUpdateConfig: persistAgentConfigUpdate,
      petId: handlerContext?.petId ?? null,
      signal: handlerContext?.signal ?? null,
      startDesktopIconPlacementRef,
      voiceInputControllerRef,
    });
  }, [configRef, gameCompanionLoopControllerRef, persistAgentConfigUpdate]);

  return {
    desktopOrganizationRef,
    handleAgentChatCommand,
    startDesktopIconPlacementRef,
    voiceInputControllerRef,
  };
}

interface UsePetContainerAgentDesktopOrganizationBridgeOptions {
  desktopOrganizationRef: MutableRefObject<AgentDesktopOrganizationAdapter | null>;
  preview: AgentDesktopOrganizationAdapter['preview'];
  start: AgentDesktopOrganizationAdapter['start'];
  startDesktopIconPlacementRef: MutableRefObject<DesktopIconPlacementStarter | null>;
  startRelativePlacement: DesktopIconPlacementStarter;
}

export function usePetContainerAgentDesktopOrganizationBridge({
  desktopOrganizationRef,
  preview,
  start,
  startDesktopIconPlacementRef,
  startRelativePlacement,
}: UsePetContainerAgentDesktopOrganizationBridgeOptions) {
  useEffect(() => {
    desktopOrganizationRef.current = {
      preview,
      start,
    };
    startDesktopIconPlacementRef.current = startRelativePlacement;

    return () => {
      if (
        desktopOrganizationRef.current?.preview === preview
        && desktopOrganizationRef.current?.start === start
      ) {
        desktopOrganizationRef.current = null;
      }
      if (startDesktopIconPlacementRef.current === startRelativePlacement) {
        startDesktopIconPlacementRef.current = null;
      }
    };
  }, [
    desktopOrganizationRef,
    preview,
    start,
    startDesktopIconPlacementRef,
    startRelativePlacement,
  ]);
}

interface UsePetContainerAgentVoiceInputBridgeOptions {
  startVoiceInputSession: AgentRuntimeVoiceInputControllerLike['start'];
  stopVoiceInput: AgentRuntimeVoiceInputControllerLike['stop'];
  voiceInputControllerRef: MutableRefObject<AgentRuntimeVoiceInputControllerLike | null>;
}

export function usePetContainerAgentVoiceInputBridge({
  startVoiceInputSession,
  stopVoiceInput,
  voiceInputControllerRef,
}: UsePetContainerAgentVoiceInputBridgeOptions) {
  useEffect(() => {
    voiceInputControllerRef.current = {
      start: startVoiceInputSession,
      stop: stopVoiceInput,
    };

    return () => {
      if (
        voiceInputControllerRef.current?.start === startVoiceInputSession
        && voiceInputControllerRef.current?.stop === stopVoiceInput
      ) {
        voiceInputControllerRef.current = null;
      }
    };
  }, [
    startVoiceInputSession,
    stopVoiceInput,
    voiceInputControllerRef,
  ]);
}
