import { type MutableRefObject } from 'react';
import {
  type AgentChatCommandHandler,
} from '../../agent';
import { usePetChatSession } from '../chat/usePetChatSession';
import { useFloatingChatPanel } from '../chat/useFloatingChatPanel';
import { type FloatingChatPanelBasePositionResolver } from '../chat/floatingChatPanelTypes';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { usePetPanelController } from './usePetPanelController';

type PanelSize = { width: number; height: number };
type PanelOffset = { x: number; y: number };

interface UsePetContainerPanelChatStateOptions {
  addLog: (msg: string) => void;
  config: PetConfig;
  defaultChatPanelOffset: PanelOffset;
  defaultChatPanelSize: PanelSize;
  interactiveDefaultChatPanelOffset: PanelOffset;
  interactiveDefaultChatPanelSize: PanelSize;
  maxChatPanelHeight: number;
  maxChatPanelWidth: number;
  minChatPanelHeight: number;
  minChatPanelWidth: number;
  panelBasePositionResolverRef: MutableRefObject<FloatingChatPanelBasePositionResolver>;
  onRequestChatWindow?: () => void;
  onRequestCloseChatWindow?: () => void;
  onRequestSharedStateSync?: (preferredDelayMs?: number) => void;
  onRequestSettingsWindow?: () => void;
  onAgentChatCommand?: AgentChatCommandHandler;
  onSetSettingsOpen: (isOpen: boolean) => void;
  onUpdateConfig: PetConfigUpdateHandler;
  useExternalChatWindow: boolean;
  useExternalSettingsWindow: boolean;
}

export function usePetContainerPanelChatState({
  addLog,
  config,
  defaultChatPanelOffset,
  defaultChatPanelSize,
  interactiveDefaultChatPanelOffset,
  interactiveDefaultChatPanelSize,
  maxChatPanelHeight,
  maxChatPanelWidth,
  minChatPanelHeight,
  minChatPanelWidth,
  panelBasePositionResolverRef,
  onRequestChatWindow,
  onRequestCloseChatWindow,
  onRequestSharedStateSync,
  onRequestSettingsWindow,
  onAgentChatCommand,
  onSetSettingsOpen,
  onUpdateConfig,
  useExternalChatWindow,
  useExternalSettingsWindow,
}: UsePetContainerPanelChatStateOptions) {
  const floatingChatPanelState = useFloatingChatPanel({
    defaultOffset: defaultChatPanelOffset,
    defaultSize: defaultChatPanelSize,
    interactiveDefaultOffset: interactiveDefaultChatPanelOffset,
    interactiveDefaultSize: interactiveDefaultChatPanelSize,
    maxHeight: maxChatPanelHeight,
    maxWidth: maxChatPanelWidth,
    minHeight: minChatPanelHeight,
    minWidth: minChatPanelWidth,
    panelBasePositionResolverRef,
  });
  const panelControllerState = usePetPanelController({
    onRequestChatWindow,
    onRequestCloseChatWindow,
    onRequestSharedStateSync,
    onRequestSettingsWindow,
    onSetSettingsOpen,
    resetInteractiveChatPanelLayout: floatingChatPanelState.resetInteractiveChatPanelLayout,
    resetChatPanelLayout: floatingChatPanelState.resetChatPanelLayout,
    useExternalChatWindow,
    useExternalSettingsWindow,
  });
  const chatSessionState = usePetChatSession({
    config,
    onUpdateConfig,
    onStatusMessage: addLog,
    onAgentChatCommand,
    onOpenChat: panelControllerState.handleOpenChatFromSession,
  });

  return {
    ...floatingChatPanelState,
    ...panelControllerState,
    ...chatSessionState,
  };
}
