import { useEffect, useRef, type MutableRefObject } from 'react';
import { type DesktopPetChatController } from '../chatState';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type PetAction, type PetConfig, type PetConfigUpdateHandler, type PetVisualSize } from '../types';
import { useDesktopShellActionBridge } from './useDesktopShellActionBridge';
import { useDesktopShellSharedStateSync } from './useDesktopShellSharedStateSync';
import { useDesktopShellWindowState } from './useDesktopShellWindowState';

interface UseDesktopShellBridgeOptions {
  chatControllerRef: MutableRefObject<DesktopPetChatController | null>;
  config: PetConfig;
  interactiveDialogueActive: boolean;
  logs: string[];
  petVisualSize: PetVisualSize | null;
  screenCaptureOptions: DesktopPetCaptureOptionsLike | null;
  screenStream: MediaStream | null;
  onPreviewCaptureOptionsChange: (options?: DesktopPetCaptureOptionsLike | null) => void;
  onResetFolders: () => void;
  onSetAction: (action: PetAction) => void;
  onStartScreenCapture: (options?: DesktopPetCaptureOptionsLike) => Promise<void> | void;
  onStopScreenCapture: () => Promise<void> | void;
  onUpdateConfig: PetConfigUpdateHandler;
}

export function useDesktopShellBridge({
  chatControllerRef,
  config,
  interactiveDialogueActive,
  logs,
  petVisualSize,
  screenCaptureOptions,
  screenStream,
  onPreviewCaptureOptionsChange,
  onResetFolders,
  onSetAction,
  onStartScreenCapture,
  onStopScreenCapture,
  onUpdateConfig,
}: UseDesktopShellBridgeOptions) {
  const isDesktopShell = desktopPetShellRuntime.isDesktopMode();
  const configRef = useRef(config);
  const {
    isChatWindowOpen,
    isSettingsOpen,
    setIsSettingsOpen,
  } = useDesktopShellWindowState(isDesktopShell);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const { scheduleSharedStateSync } = useDesktopShellSharedStateSync({
    config,
    isChatWindowOpen,
    isDesktopShell,
    interactiveDialogueActive,
    isSettingsOpen,
    logs,
    petVisualSize,
    screenCaptureOptions,
    screenStream,
  });

  useDesktopShellActionBridge({
    chatControllerRef,
    getCurrentConfig: () => configRef.current,
    isDesktopShell,
    onPreviewCaptureOptionsChange,
    onRequestSharedStateSync: scheduleSharedStateSync,
    onResetFolders,
    onSetAction,
    onStartScreenCapture,
    onStopScreenCapture,
    onUpdateConfig,
  });

  useEffect(() => {
    if (!isDesktopShell) {
      return;
    }

    desktopPetShellRuntime.updateActivityRegion({
      displayId: config.settings.activityDisplayId,
      areaScale: config.settings.activityAreaScale,
    });
  }, [config.settings.activityAreaScale, config.settings.activityDisplayId, isDesktopShell]);

  return {
    isChatWindowOpen,
    isDesktopShell,
    isSettingsOpen,
    scheduleSharedStateSync,
    setIsSettingsOpen,
  };
}
