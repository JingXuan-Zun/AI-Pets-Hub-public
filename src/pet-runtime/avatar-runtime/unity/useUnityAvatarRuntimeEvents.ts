import { useEffect } from 'react';
import { desktopPetShellRuntime } from '../../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { type AvatarRuntimeEventListener } from '../avatarRuntimeEvents';
import { normalizeUnityBridgeAvatarRuntimeEvent } from './unityBridgeEventAdapter';
import { resolveUnityBridgeIgnoredEventDetails } from './unityBridgeEventSurface';

export function useUnityAvatarRuntimeEvents(
  onRuntimeEvent?: AvatarRuntimeEventListener | null,
) {
  useEffect(() => {
    if (!onRuntimeEvent || !desktopPetShellRuntime.isDesktopMode()) {
      return undefined;
    }

    return desktopPetShellRuntime.onUnityBridgeEvent((payload) => {
      const runtimeEvent = normalizeUnityBridgeAvatarRuntimeEvent(payload);
      if (!runtimeEvent) {
        pushFrontendRuntimeLog(
          'unity',
          'ignored unsupported Unity bridge event',
          resolveUnityBridgeIgnoredEventDetails(payload),
        );
        return;
      }

      onRuntimeEvent(runtimeEvent);
    });
  }, [onRuntimeEvent]);
}
