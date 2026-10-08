import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';

const NORMAL_GRAPH_HEIGHT = 'clamp(520px, 68vh, 900px)';

async function isWindowMaximized() {
  return desktopPetShellRuntime.isDesktopMode() && Boolean(await desktopPetShellRuntime.isCurrentWindowMaximized());
}

/**
 * Opening the memory workspace maximizes the window for real, so dragging its
 * header restores it like any maximized window. Closing it un-maximizes only
 * when the workspace did the maximizing and the user has not changed it since.
 */
export function useNeuralPersonaGraphFullscreen() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const maximizedByEditor = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const restoreWindow = async () => {
    if (!maximizedByEditor.current) return;
    maximizedByEditor.current = false;
    if (await isWindowMaximized()) await desktopPetShellRuntime.toggleMaximizeCurrentWindow();
  };
  const exitEditor = () => {
    setFullscreen(false);
    void restoreWindow();
  };
  const enterEditor = () => {
    setFullscreen(true);
    void isWindowMaximized().then((maximized) => {
      if (maximized || !desktopPetShellRuntime.isDesktopMode()) return;
      maximizedByEditor.current = true;
      void desktopPetShellRuntime.toggleMaximizeCurrentWindow();
    });
  };
  useEffect(() => {
    if (!fullscreen) return undefined;
    // Popovers inside the workspace stop Esc first, so it only exits when nothing else is open.
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && exitEditor();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);
  useEffect(() => () => { void restoreWindow(); }, []);
  const canvasStyle: CSSProperties = {
    height: fullscreen ? 'calc(100vh - 230px)' : NORMAL_GRAPH_HEIGHT, width: '100%',
  };
  return {
    canvasStyle, fullscreen, wrapperRef,
    toggleFullscreen: () => fullscreen ? exitEditor() : enterEditor(),
  };
}
