import { useCallback, useEffect, useState } from 'react';
import { desktopPetShellRuntime } from './desktopShellRuntime';

/** Standard minimize / maximize controls for the standalone chat and settings windows. */
export function useStandaloneWindowFrame({ enabled = true }: { enabled?: boolean } = {}) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!enabled || !desktopPetShellRuntime.isDesktopMode()) return undefined;
    let cancelled = false;
    const syncMaximized = () => {
      void desktopPetShellRuntime.isCurrentWindowMaximized().then((maximized) => {
        if (!cancelled) setIsMaximized(Boolean(maximized));
      });
    };
    syncMaximized();
    // Dragging or resizing a maximized window leaves the maximized state.
    window.addEventListener('resize', syncMaximized);
    return () => {
      cancelled = true;
      window.removeEventListener('resize', syncMaximized);
    };
  }, [enabled]);

  const minimizeWindow = useCallback(() => {
    if (enabled) desktopPetShellRuntime.minimizeCurrentWindow();
  }, [enabled]);

  const toggleMaximizeWindow = useCallback(() => {
    if (!enabled || !desktopPetShellRuntime.isDesktopMode()) return;
    void desktopPetShellRuntime.toggleMaximizeCurrentWindow().then((maximized) => {
      setIsMaximized(Boolean(maximized));
    });
  }, [enabled]);

  return { isMaximized, minimizeWindow, toggleMaximizeWindow };
}
