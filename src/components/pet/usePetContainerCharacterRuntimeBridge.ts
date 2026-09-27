import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { useUnityAvatarRuntimeEvents } from '../../pet-runtime/avatar-runtime/unity/useUnityAvatarRuntimeEvents';
import { type PetConfig, type PetConfigUpdateHandler } from '../../types';
import { type DirectionalExtents } from './petActivityRegionMath';
import { usePetContainerAvatarRuntimeEventHandler } from './usePetContainerAvatarRuntimeEventHandler';
import { usePetContainerLive2DExpressionDiscovery } from './usePetContainerLive2DExpressionDiscovery';

interface UsePetContainerCharacterRuntimeBridgeOptions {
  addLog: (message: string) => void;
  configRef: MutableRefObject<PetConfig>;
  customModelPresets: PetConfig['customModelPresets'];
  onCompanionVisualBoundsChange: (petId: string, bounds: DirectionalExtents) => void;
  onPrimaryVisualBoundsChange: (bounds: DirectionalExtents) => void;
  onUpdateConfig: PetConfigUpdateHandler;
}

export function usePetContainerCharacterRuntimeBridge({
  addLog,
  configRef,
  customModelPresets,
  onCompanionVisualBoundsChange,
  onPrimaryVisualBoundsChange,
  onUpdateConfig,
}: UsePetContainerCharacterRuntimeBridgeOptions) {
  const mainWindowReadyMarkedRef = useRef(false);

  usePetContainerLive2DExpressionDiscovery({
    configRef,
    customModelPresets,
    onUpdateConfig,
  });

  const {
    handleAvatarRuntimeEvent,
    runtimeSummaryByPetId,
  } = usePetContainerAvatarRuntimeEventHandler({
    addLog,
    configRef,
    onCompanionVisualBoundsChange,
    onPrimaryVisualBoundsChange,
  });
  useUnityAvatarRuntimeEvents(handleAvatarRuntimeEvent);

  useEffect(() => {
    if (!desktopPetShellRuntime.isDesktopMode() || mainWindowReadyMarkedRef.current) {
      return;
    }

    mainWindowReadyMarkedRef.current = true;
    const frameId = window.requestAnimationFrame(() => {
      desktopPetShellRuntime.markMainWindowReadyToShow();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return {
    handleAvatarRuntimeEvent,
    runtimeSummaryByPetId,
  };
}
