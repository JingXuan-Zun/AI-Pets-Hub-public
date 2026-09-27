import { useCallback, useEffect, useRef } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type DesktopPetSharedState } from '../desktopShellSharedState';
import { cloneCaptureOptions } from '../services/desktopCapture';
import { type PetConfig, type PetVisualSize } from '../types';

const SHARED_STATE_SYNC_DELAY_IDLE_MS = 900;
const SHARED_STATE_SYNC_DELAY_ACTIVE_MS = 96;

interface UseDesktopShellSharedStateSyncOptions {
  config: PetConfig;
  isChatWindowOpen: boolean;
  isDesktopShell: boolean;
  interactiveDialogueActive: boolean;
  isSettingsOpen: boolean;
  logs: string[];
  petVisualSize: PetVisualSize | null;
  screenCaptureOptions: DesktopPetCaptureOptionsLike | null;
  screenStream: MediaStream | null;
}

export function useDesktopShellSharedStateSync({
  config,
  isChatWindowOpen,
  isDesktopShell,
  interactiveDialogueActive,
  isSettingsOpen,
  logs,
  petVisualSize,
  screenCaptureOptions,
  screenStream,
}: UseDesktopShellSharedStateSyncOptions) {
  const pendingSharedStateSyncRef = useRef<DesktopPetSharedState | null>(null);
  const sharedStateSyncTimerRef = useRef<number | null>(null);
  const sharedStateSyncDelayRef = useRef<number>(SHARED_STATE_SYNC_DELAY_IDLE_MS);
  const configRef = useRef(config);
  const logsRef = useRef(logs);
  const interactiveDialogueActiveRef = useRef(interactiveDialogueActive);
  const petVisualSizeRef = useRef(petVisualSize);
  const screenCaptureActiveRef = useRef(Boolean(screenStream));
  const screenCaptureOptionsRef = useRef<DesktopPetCaptureOptionsLike | null>(null);
  const chatStateRef = useRef(desktopPetChatStore.getState());
  const isSettingsOpenRef = useRef(isSettingsOpen);
  const isChatWindowOpenRef = useRef(isChatWindowOpen);
  const isDesktopShellRef = useRef(isDesktopShell);

  const scheduleSharedStateSync = useCallback((preferredDelayMs?: number) => {
    if (!isDesktopShellRef.current) {
      return;
    }

    const nextSyncDelay = preferredDelayMs
      ?? (isSettingsOpenRef.current || isChatWindowOpenRef.current
        ? SHARED_STATE_SYNC_DELAY_ACTIVE_MS
        : SHARED_STATE_SYNC_DELAY_IDLE_MS);

    pendingSharedStateSyncRef.current = {
      chatState: chatStateRef.current,
      config: configRef.current,
      interactiveDialogueActive: interactiveDialogueActiveRef.current,
      logs: logsRef.current,
      petVisualSize: petVisualSizeRef.current,
      screenCaptureActive: screenCaptureActiveRef.current,
      screenCaptureOptions: screenCaptureOptionsRef.current,
    };

    if (nextSyncDelay <= 0) {
      if (sharedStateSyncTimerRef.current !== null) {
        window.clearTimeout(sharedStateSyncTimerRef.current);
        sharedStateSyncTimerRef.current = null;
      }

      sharedStateSyncDelayRef.current = SHARED_STATE_SYNC_DELAY_IDLE_MS;
      const pendingState = pendingSharedStateSyncRef.current;
      if (pendingState) {
        desktopPetShellRuntime.syncSharedState(pendingState);
      }
      return;
    }

    if (
      sharedStateSyncTimerRef.current !== null
      && sharedStateSyncDelayRef.current <= nextSyncDelay
    ) {
      return;
    }

    if (sharedStateSyncTimerRef.current !== null) {
      window.clearTimeout(sharedStateSyncTimerRef.current);
    }

    sharedStateSyncDelayRef.current = nextSyncDelay;
    sharedStateSyncTimerRef.current = window.setTimeout(() => {
      sharedStateSyncTimerRef.current = null;
      sharedStateSyncDelayRef.current = SHARED_STATE_SYNC_DELAY_IDLE_MS;
      const pendingState = pendingSharedStateSyncRef.current;
      if (!pendingState) {
        return;
      }

      desktopPetShellRuntime.syncSharedState(pendingState);
    }, nextSyncDelay);
  }, []);

  useEffect(() => {
    isDesktopShellRef.current = isDesktopShell;
  }, [isDesktopShell]);

  useEffect(() => {
    if (!isDesktopShell) {
      return undefined;
    }

    chatStateRef.current = desktopPetChatStore.getState();
    scheduleSharedStateSync();

    return desktopPetChatStore.subscribe(() => {
      chatStateRef.current = desktopPetChatStore.getState();
      scheduleSharedStateSync();
    });
  }, [isDesktopShell, scheduleSharedStateSync]);

  useEffect(() => {
    configRef.current = config;
    logsRef.current = logs;
    interactiveDialogueActiveRef.current = interactiveDialogueActive;
    petVisualSizeRef.current = petVisualSize;
    screenCaptureActiveRef.current = Boolean(screenStream);
    screenCaptureOptionsRef.current = screenStream
      ? cloneCaptureOptions(screenCaptureOptions)
      : null;
    isSettingsOpenRef.current = isSettingsOpen;
    isChatWindowOpenRef.current = isChatWindowOpen;

    if (!isDesktopShell) {
      return;
    }

    scheduleSharedStateSync();
  }, [
    config,
    isChatWindowOpen,
    isDesktopShell,
    interactiveDialogueActive,
    isSettingsOpen,
    logs,
    petVisualSize,
    scheduleSharedStateSync,
    screenCaptureOptions,
    screenStream,
  ]);

  useEffect(() => {
    return () => {
      if (sharedStateSyncTimerRef.current !== null) {
        window.clearTimeout(sharedStateSyncTimerRef.current);
        sharedStateSyncTimerRef.current = null;
      }
      sharedStateSyncDelayRef.current = SHARED_STATE_SYNC_DELAY_IDLE_MS;
    };
  }, []);

  return {
    scheduleSharedStateSync,
  };
}
