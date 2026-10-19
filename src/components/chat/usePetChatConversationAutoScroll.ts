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

// Kept across reopening the window, not just tab switches.
function scrollStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
  lastMessageFromUser?: boolean;
  lastMessageText?: string;
  messageCount: number;
  storageKey?: string;
}

export function usePetChatConversationAutoScroll({
  isTyping,
  lastMessageFromUser = false,
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
      const rawValue = scrollStorage()?.getItem(scrollStorageKey)
        ?? window.sessionStorage.getItem(scrollStorageKey);
      if (!rawValue) return null;

      const parsedValue = JSON.parse(rawValue) as Partial<ScrollPositionSnapshot>;
      if (
        Number.isFinite(parsedValue.scrollTop)
        && Number(parsedValue.maxScrollTop) > 0
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
    // A detached viewport, or one whose history has not loaded yet, reads as scrollTop 0;
    // saving that would send the user back to the top next time.
    if (!viewport.isConnected || viewport.scrollHeight - viewport.clientHeight <= 0) return;
    try {
      const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const scrollTop = Math.max(0, viewport.scrollTop);
      const snapshot = {
        maxScrollTop,
        ratio: maxScrollTop > 0 ? Math.max(0, Math.min(1, scrollTop / maxScrollTop)) : 0,
        scrollTop,
      } satisfies ScrollPositionSnapshot;
      scrollStorage()?.setItem(scrollStorageKey, JSON.stringify(snapshot));
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

    let lastScrollTop = viewport.scrollTop;
    const updateStickiness = () => {
      const scrolledUp = viewport.scrollTop < lastScrollTop - 1;
      lastScrollTop = viewport.scrollTop;
      if (isRestoringScrollRef.current || isScrollSnapshotFrozenRef.current) return;
      // Following only ever scrolls down, so any upward move is the user reading back.
      shouldStickToBottomRef.current = !scrolledUp && isViewportNearBottom(viewport);
      saveScrollTop(viewport);
    };
    // Wheel scrolling animates over several frames; the first frame may still be within the
    // bottom threshold, and streaming would snap it back. Stop following on the gesture itself.
    const stopFollowingOnUpwardGesture = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        shouldStickToBottomRef.current = false;
        isRestoringScrollRef.current = false;
      }
    };
    const stopFollowingOnUpwardKey = (event: KeyboardEvent) => {
      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) shouldStickToBottomRef.current = false;
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
    viewport.addEventListener('wheel', stopFollowingOnUpwardGesture, { passive: true });
    viewport.addEventListener('keydown', stopFollowingOnUpwardKey);
    window.addEventListener(CAPTURE_SCROLL_POSITION_EVENT, captureBeforeCompact);

    isRestoringScrollRef.current = true;
    const restoreScrollPosition = () => {
      restoreFrameId = null;
      if (!isRestoringScrollRef.current) return;
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
      lastScrollTop = viewport.scrollTop;

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
      const wasRestoring = isRestoringScrollRef.current;
      isRestoringScrollRef.current = false;
      if (!wasRestoring && !isScrollSnapshotFrozenRef.current) saveScrollTop(viewport);
      viewport.removeEventListener('scroll', updateStickiness);
      viewport.removeEventListener('wheel', stopFollowingOnUpwardGesture);
      viewport.removeEventListener('keydown', stopFollowingOnUpwardKey);
      window.removeEventListener(CAPTURE_SCROLL_POSITION_EVENT, captureBeforeCompact);
      if (scrollViewportRef.current === viewport) {
        scrollViewportRef.current = null;
      }
    };
  }, [scrollStorageKey, storageKey]);

  // Sending a message yourself always brings the conversation back to the latest.
  const previousMessageCountRef = useRef(messageCount);
  useEffect(() => {
    const added = messageCount > previousMessageCountRef.current;
    previousMessageCountRef.current = messageCount;
    if (added && lastMessageFromUser && !isRestoringScrollRef.current) shouldStickToBottomRef.current = true;
  }, [lastMessageFromUser, messageCount]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || isRestoringScrollRef.current || !shouldStickToBottomRef.current) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      if (!shouldStickToBottomRef.current) return;
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
