import { useEffect, useRef, useState, type CSSProperties } from 'react';

const NORMAL_GRAPH_HEIGHT = 'clamp(520px, 68vh, 900px)';

type WindowBounds = { height: number; width: number; x: number; y: number };
type PositionedScreen = Screen & { availLeft?: number; availTop?: number };

function currentWindowBounds(): WindowBounds {
  return {
    height: window.outerHeight, width: window.outerWidth,
    x: window.screenX, y: window.screenY,
  };
}

function availableScreenBounds(): WindowBounds {
  const display = window.screen as PositionedScreen;
  return {
    height: display.availHeight, width: display.availWidth,
    x: display.availLeft ?? 0, y: display.availTop ?? 0,
  };
}

function setCurrentWindowBounds(bounds: WindowBounds) {
  window.desktopPetShell?.setCurrentWindowBounds?.(bounds);
}

export function useNeuralPersonaGraphFullscreen() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const originalBounds = useRef<WindowBounds | null>(null);
  const activeRef = useRef(false);
  const [fullscreen, setFullscreen] = useState(false);
  const exitEditor = () => {
    activeRef.current = false;
    setFullscreen(false);
    if (originalBounds.current) setCurrentWindowBounds(originalBounds.current);
    originalBounds.current = null;
  };
  const enterEditor = () => {
    originalBounds.current ??= currentWindowBounds();
    activeRef.current = true;
    setFullscreen(true);
    setCurrentWindowBounds(availableScreenBounds());
  };
  useEffect(() => {
    if (!fullscreen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && exitEditor();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fullscreen]);
  useEffect(() => () => {
    if (activeRef.current && originalBounds.current) setCurrentWindowBounds(originalBounds.current);
  }, []);
  const canvasStyle: CSSProperties = {
    height: fullscreen ? 'calc(100vh - 230px)' : NORMAL_GRAPH_HEIGHT, width: '100%',
  };
  return {
    canvasStyle, fullscreen, wrapperRef,
    toggleFullscreen: () => fullscreen ? exitEditor() : enterEditor(),
  };
}
