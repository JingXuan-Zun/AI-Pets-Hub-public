import { useLayoutEffect, useRef, useState } from 'react';

interface ScrollAnchor {
  container: HTMLElement;
  offset: number;
  settled: boolean;
}

// Categories above the mode selector can mount/unmount during an asynchronous
// switch. Preserve the selector's viewport position, not the old scrollTop.
export function useExpressionLibraryScrollAnchor() {
  const sectionRef = useRef<HTMLElement>(null);
  const pendingAnchor = useRef<ScrollAnchor | null>(null);
  const [, setRestoreRevision] = useState(0);

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    const section = sectionRef.current;
    if (!anchor || !section || !anchor.container.isConnected) return;
    const offset = section.getBoundingClientRect().top - anchor.container.getBoundingClientRect().top;
    anchor.container.scrollTop += offset - anchor.offset;
    if (anchor.settled) pendingAnchor.current = null;
  });

  const preserveScrollPosition = async (action: () => Promise<unknown>) => {
    const section = sectionRef.current;
    let container = section?.parentElement ?? null;
    while (container && !/^(auto|scroll)$/.test(getComputedStyle(container).overflowY)) {
      container = container.parentElement;
    }
    const anchor: ScrollAnchor | null = section && container ? {
      container,
      offset: section.getBoundingClientRect().top - container.getBoundingClientRect().top,
      settled: false,
    } : null;
    pendingAnchor.current = anchor;
    try {
      return await action();
    } finally {
      if (anchor && pendingAnchor.current === anchor) {
        anchor.settled = true;
        setRestoreRevision((revision) => revision + 1);
      }
    }
  };

  return { preserveScrollPosition, sectionRef };
}
