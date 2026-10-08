import { useEffect, useRef } from 'react';

/**
 * Closes an open popover when the user clicks outside it or presses Esc.
 * Clicks on `toggleSelector` are left to that button, so it can close the popover itself.
 */
export function usePopoverDismiss<T extends HTMLElement>(open: boolean, close: () => void, toggleSelector?: string) {
  const ref = useRef<T>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element;
      if (ref.current?.contains(target) || (toggleSelector && target.closest?.(toggleSelector))) return;
      closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // Esc closes only the popover, not the workspace behind it.
      event.stopPropagation();
      closeRef.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);
  return ref;
}
