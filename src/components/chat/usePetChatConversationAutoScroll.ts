import { useEffect, useRef } from 'react';

const AUTO_SCROLL_THRESHOLD_PX = 28;
const RESTORE_MAX_ATTEMPTS = 60;
const CAPTURE_SCROLL_POSITION_EVENT = 'desktop-pet:capture-chat-scroll-position';

function isViewportNearBottom(viewport: HTMLElement) {
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= AUTO_SCROLL_THRESHOLD_PX;
}

function scrollViewportToLatest(viewport: HTMLElement) {
  viewport.scrollTop = viewport.scrollHeight;
}

type ScrollPositionSnapshot = {
  maxScrollTop: number;
  ratio: number;
  scrollTop: number;
};

type CaptureScrollPositionEventDetail = {
  storageKey: string;
};

export function capturePetChatScrollPosition(storageKey: string) {
  window.dispatchEvent(new CustomEvent<CaptureScrollPositionEventDetail>(
    CAPTURE_SCROLL_POSITION_EVENT,
    { detail: { storageKey } },
  ));
}

interface UsePetChatConversationAutoScrollOptions {
  isTyping: boolean;
  lastMessageText?: string;
  messageCount: number;
  storageKey?: string;
}

export function usePetChatConversationAutoScroll({
  isTyping,
  lastMessageText,
  messageCount,
  storageKey = 'default',
}: UsePetChatConversationAutoScrollOptions) {
  const scrollRegionRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const isRestoringScrollRef = useRef(false);
  const isScrollSnapshotFrozenRef = useRef(false);
  const scrollStorageKey = `desktop-pet:chat-scroll-position:v1:${storageKey}`;

  const readSavedScrollTop = () => {
    try {
      const rawValue = window.sessionStorage.getItem(scrollStorageKey);
      if (!rawValue) return null;

      const parsedValue = JSON.parse(rawValue) as Partial<ScrollPositionSnapshot>;
      if (
        Number.isFinite(parsedValue.scrollTop)
        && Number.isFinite(parsedValue.maxScrollTop)
        && Number.isFinite(parsedValue.ratio)
      ) {
        return {
          maxScrollTop: Math.max(0, Number(parsedValue.maxScrollTop)),
          ratio: Math.max(0, Math.min(1, Number(parsedValue.ratio))),
          scrollTop: Math.max(0, Number(parsedValue.scrollTop)),
        } satisfies ScrollPositionSnapshot;
      }

      // Read the previous numeric format once so old sessions are not lost.
      const legacyValue = Number(rawValue);
      return Number.isFinite(legacyValue) && legacyValue >= 0
        ? { maxScrollTop: 0, ratio: 0, scrollTop: legacyValue }
        : null;
    } catch {
      return null;
    }
  };

  const saveScrollTop = (viewport: HTMLElement) => {
    try {
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const scrollTop = Math.max(0, viewport.scrollTop);
      const snapshot = {
        maxScrollTop,
        ratio: maxScrollTop > 0 ? Math.max(0, Math.min(1, scrollTop / maxScrollTop)) : 0,
        scrollTop,
      } satisfies ScrollPositionSnapshot;
      window.sessionStorage.setItem(scrollStorageKey, JSON.stringify(snapshot));
    } catch {
      // Scroll restoration is a convenience; storage may be unavailable.
    }
  };

  useEffect(() => {
    const viewport = scrollRegionRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!(viewport instanceof HTMLElement)) {
      return undefined;
    }

    scrollViewportRef.current = viewport;
    const savedScrollPosition = readSavedScrollTop();
    const restoreAttemptRef = { current: 0 };
    let lastRestoreMaxScrollTop = -1;
    let stableRestoreFrameCount = 0;
    let restoreFrameId: number | null = null;
    let restoreObserver: ResizeObserver | null = null;
    let restoreMutationObserver: MutationObserver | null = null;

    const updateStickiness = () => {
      if (isRestoringScrollRef.current || isScrollSnapshotFrozenRef.current) return;
      shouldStickToBottomRef.current = isViewportNearBottom(viewport);
      saveScrollTop(viewport);
    };

    const captureBeforeCompact = (event: Event) => {
      const detail = (event as CustomEvent<CaptureScrollPositionEventDetail>).detail;
      if (detail?.storageKey !== storageKey) return;

      saveScrollTop(viewport);
      isScrollSnapshotFrozenRef.current = true;
    };

    shouldStickToBottomRef.current = savedScrollPosition === null
      || savedScrollPosition.ratio >= 0.999;
    viewport.addEventListener('scroll', updateStickiness, { passive: true });
    window.addEventListener(CAPTURE_SCROLL_POSITION_EVENT, captureBeforeCompact);

    isRestoringScrollRef.current = true;
    const restoreScrollPosition = () => {
      restoreFrameId = null;
      restoreAttemptRef.current += 1;

      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      if (maxScrollTop <= 0 && restoreAttemptRef.current < RESTORE_MAX_ATTEMPTS) {
        restoreFrameId = window.requestAnimationFrame(restoreScrollPosition);
        return;
      }

      if (maxScrollTop !== lastRestoreMaxScrollTop) {
        lastRestoreMaxScrollTop = maxScrollTop;
        stableRestoreFrameCount = 0;
      }

      if (savedScrollPosition === null) {
        scrollViewportToLatest(viewport);
      } else if (maxScrollTop > 0) {
        const targetScrollTop = savedScrollPosition.ratio >= 0.999
          ? maxScrollTop
          : savedScrollPosition.scrollTop <= maxScrollTop
            ? savedScrollPosition.scrollTop
            : savedScrollPosition.ratio * maxScrollTop;
        viewport.scrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));
      }

      stableRestoreFrameCount += 1;
      if (
        restoreAttemptRef.current < RESTORE_MAX_ATTEMPTS
        && stableRestoreFrameCount < 4
      ) {
        restoreFrameId = window.requestAnimationFrame(restoreScrollPosition);
        return;
      }

      isRestoringScrollRef.current = false;
      shouldStickToBottomRef.current = savedScrollPosition === null
        || isViewportNearBottom(viewport);
      saveScrollTop(viewport);
    };

    restoreFrameId = window.requestAnimationFrame(restoreScrollPosition);
    if (typeof ResizeObserver !== 'undefined') {
      restoreObserver = new ResizeObserver(() => {
        if (isRestoringScrollRef.current && restoreFrameId === null) {
          restoreFrameId = window.requestAnimationFrame(restoreScrollPosition);
        }
      });
      restoreObserver.observe(viewport);
      if (viewport.firstElementChild) restoreObserver.observe(viewport.firstElementChild);
    }
    if (typeof MutationObserver !== 'undefined') {
      restoreMutationObserver = new MutationObserver(() => {
        if (isRestoringScrollRef.current && restoreFrameId === null) {
          restoreFrameId = window.requestAnimationFrame(restoreScrollPosition);
        }
      });
      restoreMutationObserver.observe(viewport, { childList: true, subtree: true });
    }

    return () => {
      if (restoreFrameId !== null) window.cancelAnimationFrame(restoreFrameId);
      restoreObserver?.disconnect();
      restoreMutationObserver?.disconnect();
      isRestoringScrollRef.current = false;
      if (!isScrollSnapshotFrozenRef.current) saveScrollTop(viewport);
      viewport.removeEventListener('scroll', updateStickiness);
      window.removeEventListener(CAPTURE_SCROLL_POSITION_EVENT, captureBeforeCompact);
      if (scrollViewportRef.current === viewport) {
        scrollViewportRef.current = null;
      }
    };
  }, [scrollStorageKey, storageKey]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || !shouldStickToBottomRef.current) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollViewportToLatest(viewport);
      shouldStickToBottomRef.current = true;
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isTyping, lastMessageText, messageCount]);

  return {
    scrollRegionRef,
  };
}
